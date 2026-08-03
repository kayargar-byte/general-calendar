import assert from "node:assert/strict";
import { test } from "vitest";

import {
  STORAGE_KEY,
  createEvent,
  deleteEvent,
  getEvents,
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
  assert.equal(event.calendarId, "personal");
  assert.match(event.id, /^[0-9a-f-]+$/i);
  assert.deepEqual(getEvents(storage), [event]);
});

test("createEvent preserves supported calendar categories", () => {
  const calendarIds = [
    "personal",
    "documents",
    "medical",
    "family",
    "work",
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

test("getEvents assigns legacy events to the personal calendar", () => {
  const storage = new MemoryStorage();
  const legacyEvent = { id: "legacy-event", ...buildEvent() };

  storage.setItem(STORAGE_KEY, JSON.stringify([legacyEvent]));

  assert.equal(getEvents(storage)[0].calendarId, "personal");
});
