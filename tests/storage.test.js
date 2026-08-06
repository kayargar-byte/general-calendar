import assert from "node:assert/strict";
import { test } from "vitest";

import {
  STORAGE_KEY,
  createEvent,
  deleteEvent,
  findConflicts,
  getEvents,
  searchEvents,
  seedSampleEventsIfFirstRun,
  updateEvent,
} from "../src/lib/storage.js";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

function buildEvent(overrides = {}) {
  return {
    title: "證件續期",
    date: "2026-08-15",
    startTime: "09:30",
    endTime: "10:30",
    notes: "攜帶身份證明文件",
    ...overrides,
  };
}

test("createEvent normalizes and persists an event", () => {
  const storage = new MemoryStorage();
  const event = createEvent(buildEvent({ title: "  證件續期  " }), storage);

  assert.equal(event.title, "證件續期");
  assert.equal(event.calendarId, "work");
  assert.match(event.id, /^[0-9a-f-]+$/i);
  assert.deepEqual(getEvents(storage), [event]);
});

test("createEvent preserves supported calendar categories", () => {
  const calendarIds = [
    "work",
    "family",
    "medical",
    "documents",
    "allowances",
    "leisure",
    "other",
  ];

  for (const calendarId of calendarIds) {
    const storage = new MemoryStorage();
    const event = createEvent(buildEvent({ calendarId }), storage);

    assert.equal(event.calendarId, calendarId);
  }
});

test("createEvent rejects unsupported calendar categories", () => {
  const storage = new MemoryStorage();

  assert.throws(
    () => createEvent(buildEvent({ calendarId: "unknown" }), storage),
    /calendar/i,
  );
  assert.deepEqual(getEvents(storage), []);
});

test.each([
  ["empty title", { title: "  " }, /標題為必填/],
  ["invalid date", { date: "2026-02-30" }, /日期格式無效/],
  ["invalid start time", { startTime: "25:00" }, /開始時間格式無效/],
  [
    "end before start",
    { startTime: "11:00", endTime: "10:00" },
    /結束時間不得早於開始時間/,
  ],
])("createEvent rejects invalid event fields: %s", (name, overrides, expectedError) => {
  const storage = new MemoryStorage();

  assert.throws(() => createEvent(buildEvent(overrides), storage), expectedError);
  assert.deepEqual(getEvents(storage), []);
});

test("createEvent normalizes a same-day endDate to an empty string", () => {
  const storage = new MemoryStorage();
  const event = createEvent(buildEvent({ endDate: "2026-08-15" }), storage);

  assert.equal(event.endDate, "");
  assert.deepEqual(getEvents(storage), [event]);
});

test("createEvent preserves a multi-day endDate", () => {
  const storage = new MemoryStorage();
  const event = createEvent(buildEvent({ endDate: "2026-08-17" }), storage);

  assert.equal(event.endDate, "2026-08-17");
  assert.deepEqual(getEvents(storage), [event]);
});

test("createEvent allows end time before start time on a multi-day event", () => {
  const storage = new MemoryStorage();
  const event = createEvent(
    buildEvent({
      date: "2026-08-14",
      endDate: "2026-08-15",
      startTime: "22:00",
      endTime: "06:00",
    }),
    storage,
  );

  assert.equal(event.endDate, "2026-08-15");
  assert.equal(event.startTime, "22:00");
  assert.equal(event.endTime, "06:00");
});

test.each([
  ["invalid endDate", { endDate: "2026-8-15" }, /結束日期格式無效/],
  [
    "endDate before start date",
    { endDate: "2026-08-14" },
    /結束日期不得早於開始日期/,
  ],
])("createEvent rejects invalid endDate: %s", (name, overrides, expectedError) => {
  const storage = new MemoryStorage();

  assert.throws(() => createEvent(buildEvent(overrides), storage), expectedError);
  assert.deepEqual(getEvents(storage), []);
});

test("getEvents sorts events by date and start time", () => {
  const storage = new MemoryStorage();
  createEvent(
    buildEvent({ title: "下午", startTime: "14:00", endTime: "15:00" }),
    storage,
  );
  createEvent(buildEvent({ title: "全天", startTime: "", endTime: "" }), storage);
  createEvent(
    buildEvent({
      title: "前一天",
      date: "2026-08-14",
      startTime: "18:00",
      endTime: "19:00",
    }),
    storage,
  );

  assert.deepEqual(
    getEvents(storage).map((event) => event.title),
    ["前一天", "全天", "下午"],
  );
});

test("updateEvent changes only the selected event", () => {
  const storage = new MemoryStorage();
  const firstEvent = createEvent(buildEvent(), storage);
  const secondEvent = createEvent(
    buildEvent({ title: "牙醫", date: "2026-08-20" }),
    storage,
  );
  const updatedEvent = updateEvent(
    firstEvent.id,
    buildEvent({ title: "證件續期改期", startTime: "10:00", endTime: "11:00" }),
    storage,
  );

  assert.equal(updatedEvent.id, firstEvent.id);
  assert.equal(updatedEvent.title, "證件續期改期");
  assert.deepEqual(getEvents(storage), [updatedEvent, secondEvent]);
});

test("updateEvent returns null when the event does not exist", () => {
  const storage = new MemoryStorage();

  assert.equal(updateEvent("missing", buildEvent(), storage), null);
  assert.deepEqual(getEvents(storage), []);
});

test("updateEvent preserves document source fields when not provided", () => {
  const storage = new MemoryStorage();
  const event = createEvent(
    buildEvent({
      sourceDocId: "doc-1",
      sourceQuote: "身份證將於 2026-12-01 到期",
    }),
    storage,
  );

  // 表單 input 不含 source 欄位（模擬只改標題）。
  const updated = updateEvent(
    event.id,
    buildEvent({ title: "證件續期改期" }),
    storage,
  );

  assert.equal(updated.sourceDocId, "doc-1");
  assert.equal(updated.sourceQuote, "身份證將於 2026-12-01 到期");
  assert.equal(getEvents(storage)[0].sourceDocId, "doc-1");
});

test("updateEvent replaces document source fields when provided", () => {
  const storage = new MemoryStorage();
  const event = createEvent(
    buildEvent({ sourceDocId: "doc-1", sourceQuote: "舊引用" }),
    storage,
  );

  const updated = updateEvent(
    event.id,
    buildEvent({ sourceDocId: "doc-2", sourceQuote: "新引用" }),
    storage,
  );

  assert.equal(updated.sourceDocId, "doc-2");
  assert.equal(updated.sourceQuote, "新引用");
  assert.equal(getEvents(storage)[0].sourceDocId, "doc-2");
});

test("updateEvent replaces endDate when provided", () => {
  const storage = new MemoryStorage();
  const event = createEvent(buildEvent(), storage);

  const updated = updateEvent(
    event.id,
    buildEvent({ endDate: "2026-08-16" }),
    storage,
  );

  assert.equal(updated.endDate, "2026-08-16");
  assert.equal(getEvents(storage)[0].endDate, "2026-08-16");
});

test("updateEvent clears endDate when not provided", () => {
  const storage = new MemoryStorage();
  const event = createEvent(buildEvent({ endDate: "2026-08-16" }), storage);

  const updated = updateEvent(event.id, buildEvent(), storage);

  assert.equal(updated.endDate, "");
  assert.equal(getEvents(storage)[0].endDate, "");
});

test("deleteEvent removes only the selected event", () => {
  const storage = new MemoryStorage();
  const firstEvent = createEvent(buildEvent(), storage);
  const secondEvent = createEvent(
    buildEvent({ title: "牙醫", date: "2026-08-20" }),
    storage,
  );

  assert.equal(deleteEvent(firstEvent.id, storage), true);
  assert.deepEqual(getEvents(storage), [secondEvent]);
  assert.equal(deleteEvent(firstEvent.id, storage), false);
});

test("getEvents safely ignores damaged stored data", () => {
  const storage = new MemoryStorage();

  storage.setItem(STORAGE_KEY, "not-json");
  assert.deepEqual(getEvents(storage), []);

  storage.setItem(STORAGE_KEY, JSON.stringify({ title: "not-an-array" }));
  assert.deepEqual(getEvents(storage), []);
});

test("getEvents assigns legacy events to the first default calendar", () => {
  const storage = new MemoryStorage();
  const legacyEvent = { id: "legacy-event", ...buildEvent() };

  storage.setItem(STORAGE_KEY, JSON.stringify([legacyEvent]));

  assert.equal(getEvents(storage)[0].calendarId, "work");
});

test("getEvents fills endDate with an empty string for legacy events", () => {
  const storage = new MemoryStorage();
  const legacyEvent = { id: "legacy-event", ...buildEvent() };

  storage.setItem(STORAGE_KEY, JSON.stringify([legacyEvent]));

  assert.equal(getEvents(storage)[0].endDate, "");
});

test("findConflicts detects overlapping events on the same date", () => {
  const storage = new MemoryStorage();
  createEvent(
    buildEvent({
      title: "既存會議",
      startTime: "09:00",
      endTime: "10:30",
    }),
    storage,
  );

  const conflicts = findConflicts(
    { date: "2026-08-15", startTime: "10:00", endTime: "11:00" },
    null,
    storage,
  );

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].title, "既存會議");
});

test("findConflicts excludes the event being edited", () => {
  const storage = new MemoryStorage();
  const existing = createEvent(
    buildEvent({
      title: "既存會議",
      startTime: "09:00",
      endTime: "10:30",
    }),
    storage,
  );

  const conflicts = findConflicts(
    {
      date: "2026-08-15",
      startTime: "09:30",
      endTime: "10:00",
    },
    existing.id,
    storage,
  );

  assert.equal(conflicts.length, 0);
});

test("findConflicts returns empty when no startTime is provided", () => {
  const storage = new MemoryStorage();
  createEvent(
    buildEvent({
      title: "既存會議",
      startTime: "09:00",
      endTime: "10:30",
    }),
    storage,
  );

  const conflicts = findConflicts(
    { date: "2026-08-15", startTime: "", endTime: "" },
    null,
    storage,
  );

  assert.deepEqual(conflicts, []);
});

test("findConflicts detects a multi-day event covering a single-day event", () => {
  const storage = new MemoryStorage();
  createEvent(
    buildEvent({
      title: "既存會議",
      date: "2026-08-15",
      startTime: "09:00",
      endTime: "10:30",
    }),
    storage,
  );

  const conflicts = findConflicts(
    {
      date: "2026-08-14",
      endDate: "2026-08-16",
      startTime: "20:00",
      endTime: "08:00",
    },
    null,
    storage,
  );

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].title, "既存會議");
});

test("findConflicts ignores single-day events outside a multi-day range", () => {
  const storage = new MemoryStorage();
  createEvent(
    buildEvent({
      title: "既存多日",
      date: "2026-08-14",
      endDate: "2026-08-16",
      startTime: "20:00",
      endTime: "08:00",
    }),
    storage,
  );

  const conflicts = findConflicts(
    { date: "2026-08-17", startTime: "10:00", endTime: "11:00" },
    null,
    storage,
  );

  assert.deepEqual(conflicts, []);
});

test("findConflicts detects partially overlapping multi-day events", () => {
  const storage = new MemoryStorage();
  createEvent(
    buildEvent({
      title: "既存多日",
      date: "2026-08-14",
      endDate: "2026-08-16",
      startTime: "20:00",
      endTime: "08:00",
    }),
    storage,
  );

  const conflicts = findConflicts(
    {
      date: "2026-08-16",
      endDate: "2026-08-18",
      startTime: "06:00",
      endTime: "09:00",
    },
    null,
    storage,
  );

  assert.equal(conflicts.length, 1);
});

test("searchEvents matches events by title", () => {
  const storage = new MemoryStorage();
  createEvent(buildEvent({ title: "牙醫預約" }), storage);
  createEvent(
    buildEvent({ title: "工作會議", date: "2026-08-20" }),
    storage,
  );

  const results = searchEvents("牙醫", storage);

  assert.equal(results.length, 1);
  assert.equal(results[0].title, "牙醫預約");
});

test("searchEvents matches events by notes", () => {
  const storage = new MemoryStorage();
  createEvent(
    buildEvent({ title: "會議", notes: "攜帶牙醫報告" }),
    storage,
  );

  const results = searchEvents("牙醫", storage);

  assert.equal(results.length, 1);
  assert.equal(results[0].title, "會議");
});

test("searchEvents is case-insensitive", () => {
  const storage = new MemoryStorage();
  createEvent(buildEvent({ title: "Meeting" }), storage);

  const results = searchEvents("meeting", storage);

  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Meeting");
});

test("searchEvents returns empty array when no matches", () => {
  const storage = new MemoryStorage();
  createEvent(buildEvent({ title: "牙醫預約" }), storage);

  const results = searchEvents("不存在的關鍵字", storage);

  assert.deepEqual(results, []);
});

test("searchEvents matches events by source fields", () => {
  const storage = new MemoryStorage();
  createEvent(
    buildEvent({
      title: "美食節",
      sourceTitle: "2026澳門國際美食之都嘉年華",
      sourceSnippet: "於3月20日至29日舉行",
      sourceQuote: "官方公告：美食節十一月舉辦",
      sourceUrl: "https://m.gov.mo/food",
      sourceDocId: "doc-food",
    }),
    storage,
  );

  assert.equal(searchEvents("嘉年華", storage).length, 1); // sourceTitle
  assert.equal(searchEvents("3月20日", storage).length, 1); // sourceSnippet
  assert.equal(searchEvents("十一月", storage).length, 1); // sourceQuote
  assert.equal(searchEvents("m.gov.mo", storage).length, 1); // sourceUrl
  assert.equal(searchEvents("doc-food", storage).length, 1); // sourceDocId
});

test("seedSampleEventsIfFirstRun seeds sample events on first run", () => {
  const storage = new MemoryStorage();

  assert.equal(seedSampleEventsIfFirstRun(storage), true);
  assert.equal(getEvents(storage).length, 4);
});

test("seedSampleEventsIfFirstRun does not reseed when events exist", () => {
  const storage = new MemoryStorage();
  seedSampleEventsIfFirstRun(storage);

  assert.equal(seedSampleEventsIfFirstRun(storage), false);
  assert.equal(getEvents(storage).length, 4);
});

test("seedSampleEventsIfFirstRun keeps existing user events", () => {
  const storage = new MemoryStorage();
  createEvent(buildEvent(), storage);

  assert.equal(seedSampleEventsIfFirstRun(storage), false);
  assert.equal(getEvents(storage).length, 1);
});

test("createEvent preserves source document fields", () => {
  const storage = new MemoryStorage();
  const event = createEvent(
    buildEvent({
      sourceDocId: "doc-1",
      sourceQuote: "  身份證將於 2026-12-01 到期  ",
    }),
    storage,
  );

  assert.equal(event.sourceDocId, "doc-1");
  assert.equal(event.sourceQuote, "身份證將於 2026-12-01 到期");
  assert.equal(getEvents(storage)[0].sourceDocId, "doc-1");
});

test("events without source fields normalize to empty strings", () => {
  const storage = new MemoryStorage();
  const event = createEvent(buildEvent(), storage);

  assert.equal(event.sourceDocId, "");
  assert.equal(event.sourceQuote, "");
});

test("createEvent preserves search source fields", () => {
  const storage = new MemoryStorage();
  const event = createEvent(
    buildEvent({
      sourceUrl: "https://m.gov.mo/event/2026-food-festival",
      sourceTitle: "  2026 澳門國際美食之都嘉年華  ",
      sourceSnippet: " 2026年3月20日至29日  ",
    }),
    storage,
  );

  assert.equal(event.sourceUrl, "https://m.gov.mo/event/2026-food-festival");
  assert.equal(event.sourceTitle, "2026 澳門國際美食之都嘉年華");
  assert.equal(event.sourceSnippet, "2026年3月20日至29日");
  assert.deepEqual(getEvents(storage), [event]);
});

test("search source fields normalize to empty strings when absent", () => {
  const storage = new MemoryStorage();
  const event = createEvent(buildEvent(), storage);

  assert.equal(event.sourceUrl, "");
  assert.equal(event.sourceTitle, "");
  assert.equal(event.sourceSnippet, "");
});
