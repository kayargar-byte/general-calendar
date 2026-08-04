import assert from "node:assert/strict";
import { test } from "vitest";
import {
  createCalendar,
  deleteCalendar,
  getCalendars,
  isCalendarId,
  updateCalendar,
} from "../src/lib/calendar-catalog.js";
import {
  createEvent,
  getEvents,
  reassignEventsCalendar,
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

test("getCalendars seeds the six default tags when storage is empty", () => {
  const storage = new MemoryStorage();
  const calendars = getCalendars(storage);

  assert.equal(calendars.length, 6);
  assert.deepEqual(
    calendars.map((calendar) => calendar.id),
    ["personal", "documents", "medical", "family", "work", "other"],
  );
});

test("createCalendar adds a tag with a color and persists it", () => {
  const storage = new MemoryStorage();
  const calendar = createCalendar("寵物", storage);

  assert.match(calendar.id, /^[0-9a-f-]+$/i);
  assert.equal(calendar.label, "寵物");
  assert.match(calendar.color, /^#[0-9a-f]{6}$/i);
  assert.deepEqual(getCalendars(storage).at(-1), calendar);
});

test("createCalendar rejects empty and duplicate labels", () => {
  const storage = new MemoryStorage();

  assert.throws(() => createCalendar("   ", storage), /不可為空/);
  assert.throws(() => createCalendar("個人", storage), /已存在/);
  assert.equal(getCalendars(storage).length, 6);
});

test("deleteCalendar removes the tag", () => {
  const storage = new MemoryStorage();
  const calendar = createCalendar("寵物", storage);

  assert.equal(deleteCalendar(calendar.id, storage), true);
  assert.equal(
    getCalendars(storage).some((item) => item.id === calendar.id),
    false,
  );
});

test("updateCalendar renames and recolors a custom tag", () => {
  const storage = new MemoryStorage();
  const calendar = createCalendar("寵物", storage);

  const updated = updateCalendar(calendar.id, "寵物改名", "#ff00aa", storage);

  assert.equal(updated.id, calendar.id);
  assert.equal(updated.label, "寵物改名");
  assert.equal(updated.color, "#ff00aa");
  assert.equal(
    getCalendars(storage).find((item) => item.id === calendar.id).label,
    "寵物改名",
  );
});

test("updateCalendar can rename a built-in tag", () => {
  const storage = new MemoryStorage();

  const updated = updateCalendar("personal", "我的個人", "#112233", storage);

  assert.equal(updated.label, "我的個人");
  assert.equal(
    getCalendars(storage).find((item) => item.id === "personal").label,
    "我的個人",
  );
});

test("updateCalendar rejects unknown id", () => {
  const storage = new MemoryStorage();

  assert.throws(
    () => updateCalendar("missing", "名稱", "#ff00aa", storage),
    /找不到要更新的分類/,
  );
});

test("updateCalendar rejects empty and duplicate labels", () => {
  const storage = new MemoryStorage();
  const calendar = createCalendar("寵物", storage);

  assert.throws(
    () => updateCalendar(calendar.id, "  ", "#ff00aa", storage),
    /不可為空/,
  );
  assert.throws(
    () => updateCalendar(calendar.id, "個人", "#ff00aa", storage),
    /已存在/,
  );
  assert.equal(
    getCalendars(storage).find((item) => item.id === calendar.id).label,
    "寵物",
  );
});

test("isCalendarId validates against the current tags", () => {
  const storage = new MemoryStorage();

  assert.equal(isCalendarId("personal", storage), true);
  assert.equal(isCalendarId("missing", storage), false);
});

test("reassignEventsCalendar moves events to the target tag", () => {
  const storage = new MemoryStorage();
  const workEvent = createEvent(
    {
      title: "開會",
      date: "2026-08-15",
      calendarId: "work",
      startTime: "",
      endTime: "",
      notes: "",
    },
    storage,
  );
  createEvent(
    {
      title: "看醫生",
      date: "2026-08-16",
      calendarId: "medical",
      startTime: "",
      endTime: "",
      notes: "",
    },
    storage,
  );

  reassignEventsCalendar("work", "other", storage);

  const events = getEvents(storage);
  assert.equal(
    events.find((event) => event.id === workEvent.id).calendarId,
    "other",
  );
  assert.equal(
    events.find((event) => event.title === "看醫生").calendarId,
    "medical",
  );
});

test("a reassigned event stays loadable after the source tag is deleted", () => {
  const storage = new MemoryStorage();
  createEvent(
    {
      title: "開會",
      date: "2026-08-15",
      calendarId: "work",
      startTime: "",
      endTime: "",
      notes: "",
    },
    storage,
  );

  reassignEventsCalendar("work", "other", storage);
  deleteCalendar("work", storage);

  const events = getEvents(storage);
  assert.equal(events.length, 1);
  assert.equal(events[0].calendarId, "other");
});
