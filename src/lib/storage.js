import {
  DEFAULT_CALENDAR_ID,
  getCalendars,
  isCalendarId,
} from "./calendar-catalog.js";

export const STORAGE_KEY = "general-calendar.events.v1";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function resolveStorage(storage) {
  const resolvedStorage = storage ?? globalThis.localStorage;

  if (!resolvedStorage) {
    throw new Error("此環境不支援本機儲存。");
  }

  return resolvedStorage;
}

function isValidDateKey(value) {
  const match = DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(year, monthIndex, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === monthIndex &&
    date.getDate() === day
  );
}

function normalizeTime(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value !== "string" || !TIME_PATTERN.test(value)) {
    throw new Error(`${fieldName}格式無效。`);
  }

  return value;
}

function normalizeEvent(input, id, storage) {
  const title = typeof input?.title === "string" ? input.title.trim() : "";

  if (!title) {
    throw new Error("標題為必填。");
  }

  if (typeof input.date !== "string" || !isValidDateKey(input.date)) {
    throw new Error("日期格式無效。");
  }

  const startTime = normalizeTime(input.startTime, "開始時間");
  const endTime = normalizeTime(input.endTime, "結束時間");

  if (startTime && endTime && endTime < startTime) {
    throw new Error("結束時間不得早於開始時間。");
  }

  if (input.notes !== undefined && typeof input.notes !== "string") {
    throw new Error("備註格式無效。");
  }

  const defaultCalendarId =
    getCalendars(storage)[0]?.id ?? DEFAULT_CALENDAR_ID;
  const calendarId =
    input.calendarId === undefined ? defaultCalendarId : input.calendarId;

  if (!isCalendarId(calendarId, storage)) {
    throw new Error("日曆分類 calendarId 無效。");
  }

  return {
    id,
    title,
    date: input.date,
    startTime,
    endTime,
    notes: input.notes?.trim() ?? "",
    calendarId,
  };
}

function compareEvents(firstEvent, secondEvent) {
  return (
    firstEvent.date.localeCompare(secondEvent.date) ||
    firstEvent.startTime.localeCompare(secondEvent.startTime) ||
    firstEvent.title.localeCompare(secondEvent.title, "zh-Hant")
  );
}

function saveEvents(events, storage) {
  const sortedEvents = [...events].sort(compareEvents);
  resolveStorage(storage).setItem(STORAGE_KEY, JSON.stringify(sortedEvents));
}

export function getEvents(storage) {
  const storedValue = resolveStorage(storage).getItem(STORAGE_KEY);

  if (!storedValue) {
    return [];
  }

  try {
    const parsedEvents = JSON.parse(storedValue);

    if (!Array.isArray(parsedEvents)) {
      return [];
    }

    return parsedEvents
      .map((event) => {
        if (typeof event?.id !== "string" || !event.id) {
          return null;
        }

        try {
          return normalizeEvent(event, event.id, storage);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort(compareEvents);
  } catch {
    return [];
  }
}

export function createEvent(input, storage) {
  const event = normalizeEvent(input, crypto.randomUUID(), storage);
  const events = [...getEvents(storage), event];
  saveEvents(events, storage);

  return event;
}

export function updateEvent(id, input, storage) {
  const events = getEvents(storage);
  const eventIndex = events.findIndex((event) => event.id === id);

  if (eventIndex === -1) {
    return null;
  }

  const updatedEvent = normalizeEvent(input, id, storage);
  events[eventIndex] = updatedEvent;
  saveEvents(events, storage);

  return updatedEvent;
}

export function deleteEvent(id, storage) {
  const events = getEvents(storage);
  const remainingEvents = events.filter((event) => event.id !== id);

  if (remainingEvents.length === events.length) {
    return false;
  }

  saveEvents(remainingEvents, storage);
  return true;
}

export function reassignEventsCalendar(oldCalendarId, newCalendarId, storage) {
  const events = getEvents(storage);
  let changed = false;
  const updatedEvents = events.map((event) => {
    if (event.calendarId === oldCalendarId) {
      changed = true;
      return { ...event, calendarId: newCalendarId };
    }

    return event;
  });

  if (changed) {
    saveEvents(updatedEvents, storage);
  }
}
