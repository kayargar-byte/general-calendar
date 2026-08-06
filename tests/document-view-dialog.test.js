import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import DocumentViewDialog from "../src/components/DocumentViewDialog.vue";
import {
  createDocument,
  saveDocumentBlob,
  saveDocumentText,
} from "../src/lib/document-store.js";
import { createEvent } from "../src/lib/storage.js";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?worker", () => ({
  default: class FakeWorker {},
}));
import { getDocument as pdfGetDocument } from "pdfjs-dist";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function installFakeIndexedDB() {
  const store = new Map();
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    close: () => {},
    transaction: () => {
      const transaction = {
        objectStore: () => ({
          put: (value, key) => store.set(key, value),
          delete: (key) => store.delete(key),
          get: (key) => {
            const request = {};
            queueMicrotask(() => {
              request.result = store.get(key) ?? null;
              request.onsuccess?.();
            });
            return request;
          },
        }),
      };
      queueMicrotask(() => transaction.oncomplete?.());
      return transaction;
    },
  };
  const request = { onupgradeneeded: null, onsuccess: null, onerror: null };
  globalThis.indexedDB = {
    open: () => {
      request.result = fakeDb;
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

function installFakeUrl() {
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:fake"),
    revokeObjectURL: vi.fn(),
  });
}

function makeDocxRecord(id = "doc-1", hasText = true) {
  return createDocument({
    id,
    name: "sample.docx",
    mimeType: DOCX_MIME,
    size: 100,
    hasText,
  });
}

afterEach(() => {
  localStorage.clear();
  delete globalThis.indexedDB;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("renders rule-split text with highlighted quote sections and related events", async () => {
  installFakeIndexedDB();
  makeDocxRecord();
  await saveDocumentText(
    "doc-1",
    "第一段內容\n\n下周三下午三時在衛生局覆診\n\n第三段內容",
  );
  createEvent({
    title: "覆診",
    date: "2026-08-06",
    calendarId: "medical",
    sourceDocId: "doc-1",
    sourceQuote: "下周三下午三時在衛生局覆診",
  });

  const wrapper = mount(DocumentViewDialog, {
    props: { open: true, docId: "doc-1" },
  });
  await flushPromises();

  assert.equal(wrapper.findAll(".doc-section").length, 3);
  assert.equal(
    wrapper.findAll(".doc-section")[1].classes().includes("is-quote"),
    true,
  );
  assert.match(wrapper.find("#document-view-title").text(), /sample\.docx/);
  assert.equal(wrapper.findAll(".doc-quote").length, 1);
  assert.equal(wrapper.findAll(".doc-event-button").length, 1);
});

test("shows a fallback message when a text document has no stored text", async () => {
  installFakeIndexedDB();
  makeDocxRecord("doc-2", false);

  const wrapper = mount(DocumentViewDialog, {
    props: { open: true, docId: "doc-2" },
  });
  await flushPromises();

  assert.match(wrapper.find("#document-view-text").text(), /沒有可顯示的文本/);
});

test("renders an image document from its stored blob", async () => {
  installFakeIndexedDB();
  installFakeUrl();
  createDocument({ id: "doc-3", name: "photo.png", mimeType: "image/png", size: 10 });
  await saveDocumentBlob("doc-3", new Blob(["img"]));

  const wrapper = mount(DocumentViewDialog, {
    props: { open: true, docId: "doc-3" },
  });
  await flushPromises();

  const img = wrapper.find("#document-view-image");
  assert.equal(img.exists(), true);
  assert.equal(img.attributes("src"), "blob:fake");
});

test("renders PDF pages via pdf.js", async () => {
  installFakeIndexedDB();
  pdfGetDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: async () => ({
        getViewport: () => ({ width: 200, height: 100 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    }),
  });
  createDocument({ id: "doc-4", name: "a.pdf", mimeType: "application/pdf", size: 20 });
  await saveDocumentBlob("doc-4", new Blob(["%PDF-fake"]));

  const wrapper = mount(DocumentViewDialog, {
    props: { open: true, docId: "doc-4" },
  });
  await flushPromises();

  assert.equal(pdfGetDocument.mock.calls.length, 1);
  assert.equal(wrapper.findAll(".doc-pdf-page").length, 2);
});

test("emits jump when a related event is clicked", async () => {
  installFakeIndexedDB();
  makeDocxRecord("doc-5");
  await saveDocumentText("doc-5", "內容");
  const event = createEvent({
    title: "會議",
    date: "2026-08-10",
    calendarId: "work",
    sourceDocId: "doc-5",
    sourceQuote: "",
  });

  const wrapper = mount(DocumentViewDialog, {
    props: { open: true, docId: "doc-5" },
  });
  await flushPromises();

  await wrapper.find(".doc-event-button").trigger("click");

  assert.equal(wrapper.emitted("jump")[0][0], event.id);
});

test("shows an error when the document record is missing", async () => {
  const wrapper = mount(DocumentViewDialog, {
    props: { open: true, docId: "ghost" },
  });
  await flushPromises();

  assert.match(wrapper.find("#document-view-error").text(), /找不到此文件/);
});

test("closes and emits close when the close button is clicked", async () => {
  installFakeIndexedDB();
  makeDocxRecord("doc-6");
  await saveDocumentText("doc-6", "內容");

  const wrapper = mount(DocumentViewDialog, {
    props: { open: true, docId: "doc-6" },
  });
  await flushPromises();

  await wrapper.find("#close-document-view-btn").trigger("click");

  assert.equal(wrapper.emitted("close").length, 1);
});
