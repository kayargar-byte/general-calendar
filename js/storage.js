import {
  DEFAULT_CALENDAR_ID,
  isCalendarId,
} from "./calendar-catalog.js";
import { toDateKey } from "./date-utils.js";

export const STORAGE_KEY = "general-calendar.events.v1";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const SAMPLE_EVENTS = [
  {
    title: "示例事件1",
    calendarId: "personal",
    dayOffset: 2,
    startTime: "09:00",
    endTime: "10:00",
    notes: "這是個人日程範例",
  },
  {
    title: "示例事件2",
    calendarId: "work",
    dayOffset: 4,
    startTime: "14:00",
    endTime: "15:30",
    notes: "工作會議範例",
  },
  {
    title: "示例事件3",
    calendarId: "medical",
    dayOffset: -1,
    startTime: "10:30",
    endTime: "11:00",
    notes: "覆診範例",
  },
  {
    title: "示例事件4",
    calendarId: "documents",
    dayOffset: 7,
    startTime: "",
    endTime: "",
    notes: "證件續期截止日範例",
  },
];

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

  const calendarId =
    input.calendarId === undefined
      ? DEFAULT_CALENDAR_ID
      : input.calendarId;

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

export function findConflicts(event, excludeId, storage) {
  if (!event || typeof event !== "object") {
    return [];
  }

  if (!event.date || !event.startTime) {
    return [];
  }

  const newStart = event.startTime;
  const newEnd = event.endTime || event.startTime;

  return getEvents(storage).filter((existing) => {
    if (existing.id === excludeId) {
      return false;
    }

    if (existing.date !== event.date || !existing.startTime) {
      return false;
    }

    const existingStart = existing.startTime;
    const existingEnd = existing.endTime || existing.startTime;

    return newStart < existingEnd && existingStart < newEnd;
  });
}

export function searchEvents(query, storage) {
  const trimmedQuery =
    typeof query === "string" ? query.trim().toLowerCase() : "";

  if (!trimmedQuery) {
    return [];
  }

  return getEvents(storage).filter((event) => {
    const title = typeof event.title === "string" ? event.title : "";
    const notes = typeof event.notes === "string" ? event.notes : "";

    return (
      title.toLowerCase().includes(trimmedQuery) ||
      notes.toLowerCase().includes(trimmedQuery)
    );
  });
}

export function seedSampleEventsIfFirstRun(storage) {
  const resolvedStorage = resolveStorage(storage);

  if (resolvedStorage.getItem(STORAGE_KEY) !== null) {
    return false;
  }

  const today = new Date();
  const samples = SAMPLE_EVENTS.map((sample) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + sample.dayOffset,
    );

    return normalizeEvent(
      {
        title: sample.title,
        date: toDateKey(date),
        calendarId: sample.calendarId,
        startTime: sample.startTime,
        endTime: sample.endTime,
        notes: sample.notes,
      },
      crypto.randomUUID(),
      storage,
    );
  });

  saveEvents(samples, storage);
  return true;
}
