import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { saveCalendars } from "../src/lib/calendar-catalog.js";
import { getDocuments } from "../src/lib/document-store.js";
import { getEvents } from "../src/lib/storage.js";
import { analyzeDocument } from "../src/lib/ai.js";
import { useCalendar } from "../src/composables/useCalendar.js";

vi.mock("../src/lib/ai.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, analyzeDocument: vi.fn() };
});

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

test("importDocument writes events with source fields", async () => {
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

test("removeDocument deletes events, record, blob, and text", async () => {
  analyzeDocument.mockResolvedValue(makeAnalysisResult());
  const calls = installFakeIndexedDB();
  const { importDocument, removeDocument } = useCalendar();

  await importDocument(makeFile());
  const docId = getEvents()[0].sourceDocId;

  const removed = await removeDocument(docId);

  assert.equal(removed, true);
  assert.equal(getEvents().length, 0);
  assert.equal(getDocuments().length, 0);
  assert.deepEqual(calls.delete, [docId, "text:" + docId]);
});

test("removeDocument returns false for an unknown doc", async () => {
  const { removeDocument } = useCalendar();

  assert.equal(await removeDocument("missing"), false);
  assert.equal(await removeDocument(""), false);
});

test("importAnalyzedResult writes events, doc record, blob, and text", async () => {
  const calls = installFakeIndexedDB();
  const { importAnalyzedResult, importCount, importBannerOpen, importDocName } =
    useCalendar();
  const blob = new Blob(["content"], { type: "application/pdf" });

  const ok = await importAnalyzedResult({
    events: [
      {
        title: "覆診",
        date: "2026-08-06",
        startTime: "15:00",
        calendarId: "unknown",
        quote: "下周三覆診",
      },
    ],
    extractedText: "統一文本",
    name: "a.pdf",
    mimeType: "application/pdf",
    blob,
  });

  assert.equal(ok, true);
  const events = getEvents();
  assert.equal(events.length, 1);
  // 未知分類回落 personal（見 docs/adr/0008）
  assert.equal(events[0].calendarId, "personal");
  assert.equal(events[0].sourceQuote, "下周三覆診");
  assert.equal(getDocuments().length, 1);
  assert.equal(importCount.value, 1);
  assert.equal(importBannerOpen.value, true);
  assert.equal(importDocName.value, "a.pdf");
  const docId = events[0].sourceDocId;
  assert.deepEqual(calls.put, [
    { value: blob, key: docId },
    { value: "統一文本", key: "text:" + docId },
  ]);
});

test("importAnalyzedResult returns false and opens the error banner when no valid events", async () => {
  const { importAnalyzedResult, importError, importBannerOpen, importCount } =
    useCalendar();

  const ok = await importAnalyzedResult({
    events: [{ title: "無日期", date: "not-a-date" }],
    extractedText: "統一文本",
    name: "a.pdf",
    mimeType: "application/pdf",
  });

  assert.equal(ok, false);
  assert.equal(getEvents().length, 0);
  assert.equal(getDocuments().length, 0);
  assert.match(importError.value, /未能從文檔中解析出任何事件/);
  assert.equal(importBannerOpen.value, true);
  assert.equal(importCount.value, 0);
});

test("importAnalyzedResult does not store a blob when none is provided", async () => {
  const calls = installFakeIndexedDB();
  const { importAnalyzedResult } = useCalendar();

  const ok = await importAnalyzedResult({
    events: [{ title: "會議", date: "2026-08-10" }],
    extractedText: "統一文本",
    name: "a.docx",
    mimeType: "application/pdf",
  });

  assert.equal(ok, true);
  assert.equal(getDocuments().length, 1);
  assert.deepEqual(calls.put, [
    { value: "統一文本", key: "text:" + getEvents()[0].sourceDocId },
  ]);
});

test("importAnalyzedResult maps an unknown calendarId to the first user calendar", async () => {
  // 用戶自訂分類不含預設的 personal（右鍵抽取不帶分類時模型常回 personal）。
  saveCalendars([{ id: "jj", label: "jj", color: "#00897b" }]);
  installFakeIndexedDB();
  const { importAnalyzedResult } = useCalendar();

  const ok = await importAnalyzedResult({
    events: [{ title: "中秋節", date: "2026-09-25", calendarId: "personal" }],
    extractedText: "",
    name: "a.png",
    mimeType: "image/png",
  });

  assert.equal(ok, true);
  const events = getEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].title, "中秋節");
  assert.equal(events[0].calendarId, "jj");
});

test("deleteEventWithCleanup removes the document when its last event is deleted", async () => {
  const calls = installFakeIndexedDB();
  const { importAnalyzedResult, deleteEventWithCleanup } = useCalendar();

  await importAnalyzedResult({
    events: [
      { title: "A", date: "2026-08-10" },
      { title: "B", date: "2026-08-11" },
    ],
    extractedText: "",
    name: "a.pdf",
    mimeType: "application/pdf",
  });

  assert.equal(getDocuments().length, 1);
  const docId = getEvents()[0].sourceDocId;

  await deleteEventWithCleanup(getEvents()[0].id);
  assert.equal(getEvents().length, 1);
  assert.equal(getDocuments().length, 1);

  await deleteEventWithCleanup(getEvents()[0].id);
  assert.equal(getEvents().length, 0);
  assert.equal(getDocuments().length, 0);
  assert.deepEqual(calls.delete, [docId, "text:" + docId]);
});

test("importAnalyzedResult deduplicates identical events in one batch", async () => {
  installFakeIndexedDB();
  const { importAnalyzedResult } = useCalendar();

  await importAnalyzedResult({
    events: [
      {
        title: "Intel Extreme Masters Beijing 2026",
        date: "2026-08-02",
        endDate: "2026-08-08",
      },
      {
        title: "Intel Extreme Masters Beijing 2026",
        date: "2026-08-02",
        endDate: "2026-08-08",
      },
      {
        title: "Intel Extreme Masters Beijing 2026",
        date: "2026-08-02",
        endDate: "2026-08-08",
      },
      {
        title: "IEM北京2026电竞大赛（CS2）",
        date: "2026-08-02",
        endDate: "2026-08-08",
      },
    ],
    extractedText: "",
    name: "a.png",
    mimeType: "image/png",
  });

  const events = getEvents();
  assert.equal(events.length, 2);
  assert.equal(
    events.filter((event) => event.title.includes("Intel Extreme")).length,
    1,
  );
  assert.equal(
    events.filter((event) => event.title.includes("IEM北京")).length,
    1,
  );
});
