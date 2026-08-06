import assert from "node:assert/strict";
import { nextTick } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, test } from "vitest";
import App from "../src/App.vue";
import ManageDialog from "../src/components/ManageDialog.vue";
import { getCalendars } from "../src/lib/calendar-catalog.js";
import {
  createDocument,
  getDocuments,
  saveDocumentText,
} from "../src/lib/document-store.js";
import { createEvent, getEvents } from "../src/lib/storage.js";

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

function mountManage() {
  return mount(ManageDialog, {
    props: { open: false, calendars: getCalendars() },
  });
}

function makeDoc() {
  return createDocument({
    id: "doc-1",
    name: "a.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 10,
    hasText: true,
  });
}

afterEach(() => {
  delete globalThis.indexedDB;
});

test("lists events and deletes one after confirmation", async () => {
  localStorage.clear();
  createEvent({
    title: "牙醫",
    date: "2026-08-15",
    calendarId: "medical",
    startTime: "",
    endTime: "",
    notes: "",
  });
  createEvent({
    title: "開會",
    date: "2026-08-16",
    calendarId: "work",
    startTime: "",
    endTime: "",
    notes: "",
  });
  window.confirm = () => true;

  const wrapper = mountManage();
  await wrapper.setProps({ open: true });

  assert.equal(wrapper.findAll(".manage-row").length, 2);

  await wrapper.find(".manage-action-button.is-danger").trigger("click");

  assert.equal(getEvents().length, 1);
  assert.equal(wrapper.emitted("changed")?.length, 1);

  wrapper.unmount();
});

test("keeps the event when deletion is cancelled", async () => {
  localStorage.clear();
  createEvent({
    title: "牙醫",
    date: "2026-08-15",
    calendarId: "medical",
    startTime: "",
    endTime: "",
    notes: "",
  });
  window.confirm = () => false;

  const wrapper = mountManage();
  await wrapper.setProps({ open: true });

  await wrapper.find(".manage-action-button.is-danger").trigger("click");

  assert.equal(getEvents().length, 1);
  assert.equal(wrapper.emitted("changed"), undefined);

  wrapper.unmount();
});

test("switches to the tags tab and opens the tag edit dialog", async () => {
  localStorage.clear();
  const wrapper = mountManage();
  await wrapper.setProps({ open: true });

  await wrapper.find("#manage-tab-tags").trigger("click");
  await nextTick();

  await wrapper.find(".manage-tag-row .manage-action-button").trigger("click");
  await nextTick();

  assert.equal(wrapper.find("#tag-edit-dialog").element.open, true);

  wrapper.unmount();
});

test("App opens the event dialog from the manage center", async () => {
  localStorage.clear();
  createEvent({
    title: "牙醫",
    date: "2026-08-15",
    calendarId: "medical",
    startTime: "",
    endTime: "",
    notes: "",
  });
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper.find("#open-manage").trigger("click");
  await nextTick();

  await wrapper
    .find("#manage-events-panel .manage-action-button")
    .trigger("click");
  await nextTick();

  assert.equal(wrapper.find("#event-dialog").element.open, true);
  assert.equal(wrapper.find("#event-title").element.value, "牙醫");

  wrapper.unmount();
});

test("lists imported documents with their event counts", async () => {
  localStorage.clear();
  installFakeIndexedDB();
  makeDoc();
  await saveDocumentText("doc-1", "內容");
  createEvent({
    title: "覆診",
    date: "2026-08-06",
    calendarId: "medical",
    sourceDocId: "doc-1",
    sourceQuote: "",
  });

  const wrapper = mountManage();
  await wrapper.setProps({ open: true });
  await wrapper.find("#manage-tab-documents").trigger("click");
  await nextTick();

  assert.equal(wrapper.findAll(".manage-doc-row").length, 1);
  assert.match(wrapper.find(".manage-doc-row").text(), /a\.docx/);
  assert.match(wrapper.find(".manage-doc-row").text(), /1 筆/);

  wrapper.unmount();
});

test("deletes a document and its events after confirmation", async () => {
  localStorage.clear();
  installFakeIndexedDB();
  makeDoc();
  createEvent({
    title: "覆診",
    date: "2026-08-06",
    calendarId: "medical",
    sourceDocId: "doc-1",
    sourceQuote: "",
  });
  window.confirm = () => true;

  const wrapper = mountManage();
  await wrapper.setProps({ open: true });
  await wrapper.find("#manage-tab-documents").trigger("click");
  await nextTick();
  await wrapper
    .find(".manage-doc-row .manage-action-button.is-danger")
    .trigger("click");
  await flushPromises();

  assert.equal(getEvents().length, 0);
  assert.equal(getDocuments().length, 0);
  assert.equal(wrapper.findAll(".manage-doc-row").length, 0);
  assert.equal(wrapper.emitted("changed")?.length, 1);

  wrapper.unmount();
});

test("keeps the document when deletion is cancelled", async () => {
  localStorage.clear();
  installFakeIndexedDB();
  makeDoc();
  window.confirm = () => false;

  const wrapper = mountManage();
  await wrapper.setProps({ open: true });
  await wrapper.find("#manage-tab-documents").trigger("click");
  await nextTick();
  await wrapper
    .find(".manage-doc-row .manage-action-button.is-danger")
    .trigger("click");
  await nextTick();

  assert.equal(getDocuments().length, 1);
  assert.equal(wrapper.emitted("changed"), undefined);

  wrapper.unmount();
});

test("opens the document viewer on double-click", async () => {
  localStorage.clear();
  installFakeIndexedDB();
  makeDoc();
  await saveDocumentText("doc-1", "原文內容");

  const wrapper = mountManage();
  await wrapper.setProps({ open: true });
  await wrapper.find("#manage-tab-documents").trigger("click");
  await nextTick();

  await wrapper.find(".manage-doc-row").trigger("dblclick");
  await flushPromises();

  assert.equal(wrapper.find("#document-view-dialog").element.open, true);
  assert.match(wrapper.find("#document-view-title").text(), /a\.docx/);

  wrapper.unmount();
});

test("emits jump-to-event when a related event is clicked in the viewer", async () => {
  localStorage.clear();
  installFakeIndexedDB();
  makeDoc();
  await saveDocumentText("doc-1", "內容");
  const event = createEvent({
    title: "覆診",
    date: "2026-08-06",
    calendarId: "medical",
    sourceDocId: "doc-1",
    sourceQuote: "",
  });

  const wrapper = mountManage();
  await wrapper.setProps({ open: true });
  await wrapper.find("#manage-tab-documents").trigger("click");
  await nextTick();
  await wrapper.find(".manage-doc-row").trigger("dblclick");
  await flushPromises();

  await wrapper.find(".doc-event-button").trigger("click");

  assert.equal(wrapper.emitted("jump-to-event")[0][0], event.id);

  wrapper.unmount();
});
