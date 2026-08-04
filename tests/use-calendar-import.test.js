import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { getDocuments, getLastImport } from "../src/lib/document-store.js";
import { getEvents } from "../src/lib/storage.js";
import { analyzeDocument } from "../src/lib/ai.js";
import { useCalendar } from "../src/composables/useCalendar.js";

vi.mock("../src/lib/ai.js", () => ({ analyzeDocument: vi.fn() }));

function installFakeIndexedDB() {
  const calls = { put: [], delete: [] };
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    close: () => {},
    transaction: () => {
      const transaction = {
        objectStore: () => ({
          put: (value, key) => calls.put.push({ value, key }),
          delete: (key) => calls.delete.push(key),
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
  return calls;
}

afterEach(() => {
  localStorage.clear();
  delete globalThis.indexedDB;
  vi.clearAllMocks();
});

function makeFile() {
  return new File(["content"], "sample.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function makeEvents() {
  return [
    {
      title: "覆診",
      date: "2026-08-06",
      startTime: "15:00",
      endTime: "16:00",
      calendarId: "personal",
      notes: "",
      quote: "下周三下午三時在衛生局覆診",
    },
    {
      title: "會議",
      date: "2026-08-15",
      startTime: "",
      endTime: "",
      calendarId: "work",
      notes: "",
      quote: "Meeting with client",
    },
  ];
}

function makeAnalysisResult(events = makeEvents(), extractedText = "統一文本") {
  return { events, extractedText };
}

test("importDocument writes events with source fields and sets the last-import pointer", async () => {
  analyzeDocument.mockResolvedValue(makeAnalysisResult());
  installFakeIndexedDB();
  const { importDocument, importCount, importBannerOpen, importDocName } =
    useCalendar();

  await importDocument(makeFile());

  const events = getEvents();
  assert.equal(events.length, 2);
  assert.equal(events[0].sourceDocId, events[1].sourceDocId);
  assert.equal(events[0].sourceQuote, "下周三下午三時在衛生局覆診");
  assert.equal(importCount.value, 2);
  assert.equal(importBannerOpen.value, true);
  assert.equal(importDocName.value, "sample.docx");
  assert.deepEqual(getLastImport(), { docId: events[0].sourceDocId });
  assert.equal(getDocuments().length, 1);
});

test("importDocument reports an error when analysis fails", async () => {
  analyzeDocument.mockRejectedValue(new Error("此 PDF 為掃描型，無法直接抽文字"));
  const { importDocument, importError, importBannerOpen, importCount } =
    useCalendar();

  await importDocument(makeFile());

  assert.equal(importError.value, "此 PDF 為掃描型，無法直接抽文字");
  assert.equal(importBannerOpen.value, true);
  assert.equal(importCount.value, 0);
  assert.equal(getEvents().length, 0);
});

test("importDocument does not write events when the analysis yields none", async () => {
  analyzeDocument.mockResolvedValue({ events: [], extractedText: "" });
  installFakeIndexedDB();
  const { importDocument, importError, importCount } = useCalendar();

  await importDocument(makeFile());

  assert.match(importError.value, /未能從文檔中解析出任何事件/);
  assert.equal(importCount.value, 0);
  assert.equal(getEvents().length, 0);
});

test("undoLastImport removes events, document record, blob, and text", async () => {
  analyzeDocument.mockResolvedValue(makeAnalysisResult());
  const calls = installFakeIndexedDB();
  const { importDocument, undoLastImport, importBannerOpen } = useCalendar();

  await importDocument(makeFile());
  const docId = getLastImport().docId;
  const undone = await undoLastImport();

  assert.equal(undone, true);
  assert.equal(getEvents().length, 0);
  assert.equal(getDocuments().length, 0);
  assert.equal(getLastImport(), null);
  assert.equal(importBannerOpen.value, false);
  assert.deepEqual(calls.delete, [docId, "text:" + docId]);
});

test("undoLastImport only undoes the most recent import", async () => {
  analyzeDocument.mockResolvedValue(
    makeAnalysisResult([makeEvents()[0]]),
  );
  installFakeIndexedDB();
  const { importDocument, undoLastImport } = useCalendar();

  await importDocument(makeFile());
  const firstDocId = getLastImport().docId;

  analyzeDocument.mockResolvedValue(
    makeAnalysisResult([makeEvents()[1]]),
  );
  await importDocument(makeFile());

  await undoLastImport();

  const remaining = getEvents();
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].sourceDocId, firstDocId);
  assert.equal(remaining[0].title, "覆診");
  assert.equal(getLastImport(), null);
});

test("undoLastImport returns false when there is no import", async () => {
  const { undoLastImport } = useCalendar();

  assert.equal(await undoLastImport(), false);
});

test("removeDocument deletes events, record, blob, and text", async () => {
  analyzeDocument.mockResolvedValue(makeAnalysisResult());
  const calls = installFakeIndexedDB();
  const { importDocument, removeDocument } = useCalendar();

  await importDocument(makeFile());
  const docId = getLastImport().docId;

  const removed = await removeDocument(docId);

  assert.equal(removed, true);
  assert.equal(getEvents().length, 0);
  assert.equal(getDocuments().length, 0);
  assert.equal(getLastImport(), null);
  assert.deepEqual(calls.delete, [docId, "text:" + docId]);
});

test("removeDocument returns false for an unknown doc", async () => {
  const { removeDocument } = useCalendar();

  assert.equal(await removeDocument("missing"), false);
  assert.equal(await removeDocument(""), false);
});
