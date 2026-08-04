import assert from "node:assert/strict";
import test from "node:test";

import {
  CALENDARS,
  createCalendar,
  deleteCalendar,
  getCalendarById,
  getCustomCalendars,
  hasCalendarOverride,
  resetCalendarOverride,
  updateCalendar,
} from "../js/calendar-catalog.js";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

test("deleteCalendar removes a custom calendar", () => {
  const storage = new MemoryStorage();
  const calendar = createCalendar(
    { label: "自訂標籤", color: "#aabbcc" },
    storage,
  );

  assert.equal(getCustomCalendars(storage).length, 1);

  const result = deleteCalendar(calendar.id, storage);

  assert.equal(result, true);
  assert.equal(getCustomCalendars(storage).length, 0);
});

test("deleteCalendar throws when deleting a built-in calendar", () => {
  const storage = new MemoryStorage();

  assert.throws(
    () => deleteCalendar("personal", storage),
    /無法刪除內建標籤/,
  );
});

test("deleteCalendar throws when the id is unknown", () => {
  const storage = new MemoryStorage();

  assert.throws(
    () => deleteCalendar("cal-unknown", storage),
    /找不到要刪除的標籤/,
  );
});

test("resetCalendarOverride clears the override for a built-in calendar", () => {
  const storage = new MemoryStorage();

  updateCalendar(
    "personal",
    { label: "我的個人", color: "#112233" },
    storage,
  );

  assert.equal(hasCalendarOverride("personal", storage), true);

  const result = resetCalendarOverride("personal", storage);

  assert.equal(result, true);
  assert.equal(hasCalendarOverride("personal", storage), false);
  assert.equal(getCalendarById("personal", storage).label, "個人");
});

test("resetCalendarOverride throws for custom calendars", () => {
  const storage = new MemoryStorage();
  const calendar = createCalendar(
    { label: "自訂標籤", color: "#aabbcc" },
    storage,
  );

  assert.throws(
    () => resetCalendarOverride(calendar.id, storage),
    /無法重置自訂標籤/,
  );
});

test("resetCalendarOverride returns false when no override exists", () => {
  const storage = new MemoryStorage();

  assert.equal(hasCalendarOverride("personal", storage), false);

  const result = resetCalendarOverride("personal", storage);

  assert.equal(result, false);
});

test("hasCalendarOverride returns true only when override exists", () => {
  const storage = new MemoryStorage();

  assert.equal(hasCalendarOverride("personal", storage), false);

  updateCalendar(
    "personal",
    { label: "我的個人", color: "#112233" },
    storage,
  );

  assert.equal(hasCalendarOverride("personal", storage), true);
  assert.equal(hasCalendarOverride("documents", storage), false);
});

test("hasCalendarOverride returns false for custom calendars", () => {
  const storage = new MemoryStorage();
  const calendar = createCalendar(
    { label: "自訂標籤", color: "#aabbcc" },
    storage,
  );

  assert.equal(hasCalendarOverride(calendar.id, storage), false);
});
