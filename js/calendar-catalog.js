const STORAGE_KEY = "general-calendar.calendars.v1";

export const DEFAULT_CALENDAR_ID = "personal";

export const CALENDARS = [
  { id: "personal", label: "個人", color: "#078da0" },
  { id: "documents", label: "證件續期", color: "#e97816" },
  { id: "medical", label: "醫療", color: "#7857b3" },
  { id: "family", label: "家庭", color: "#459b38" },
  { id: "work", label: "工作", color: "#3478c7" },
  { id: "other", label: "其他", color: "#70757e" },
];

export const COLOR_PALETTE = [
  "#078da0",
  "#e97816",
  "#7857b3",
  "#459b38",
  "#3478c7",
  "#70757e",
  "#c9342f",
  "#d4a017",
  "#e85e8a",
  "#2d8659",
];

const DEFAULT_BY_ID = new Map(CALENDARS.map((calendar) => [calendar.id, calendar]));
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const LABEL_PATTERN = /^.+$/u;

function resolveStorage(storage) {
  const resolvedStorage = storage ?? globalThis.localStorage;

  if (!resolvedStorage) {
    throw new Error("此環境不支援本機儲存。");
  }

  return resolvedStorage;
}

function normalizeCustomCalendar(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const id = input.id;
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const color = typeof input.color === "string" ? input.color : "";

  if (
    typeof id !== "string" ||
    !id ||
    DEFAULT_BY_ID.has(id) ||
    !LABEL_PATTERN.test(label) ||
    !HEX_PATTERN.test(color)
  ) {
    return null;
  }

  return { id, label, color: color.toLowerCase() };
}

export function getCustomCalendars(storage) {
  let raw;

  try {
    raw = resolveStorage(storage).getItem(STORAGE_KEY);
  } catch {
    return [];
  }

  if (!raw) {
    return [];
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const seen = new Set();
  const customs = [];

  for (const entry of parsed) {
    const calendar = normalizeCustomCalendar(entry);

    if (!calendar || seen.has(calendar.id)) {
      continue;
    }

    seen.add(calendar.id);
    customs.push(calendar);
  }

  return customs;
}

export function getAllCalendars(storage) {
  return [...CALENDARS, ...getCustomCalendars(storage)];
}

export function getCalendarById(id, storage) {
  if (DEFAULT_BY_ID.has(id)) {
    return DEFAULT_BY_ID.get(id);
  }

  return getCustomCalendars(storage).find((calendar) => calendar.id === id) ?? null;
}

export function getCalendarColor(id, storage) {
  return getCalendarById(id, storage)?.color ?? "#70757e";
}

export function isCalendarId(value, storage) {
  if (DEFAULT_BY_ID.has(value)) {
    return true;
  }

  if (!storage) {
    return false;
  }

  return getCustomCalendars(storage).some((calendar) => calendar.id === value);
}

export function createCalendar({ label, color }, storage) {
  const trimmedLabel = typeof label === "string" ? label.trim() : "";

  if (!trimmedLabel) {
    throw new Error("標籤名稱為必填。");
  }

  if (trimmedLabel.length > 20) {
    throw new Error("標籤名稱不得超過 20 個字。");
  }

  if (typeof color !== "string" || !HEX_PATTERN.test(color)) {
    throw new Error("標籤顏色格式無效。");
  }

  const normalizedColor = color.toLowerCase();
  const customs = getCustomCalendars(storage);
  const existing = [...CALENDARS, ...customs];

  if (existing.some((calendar) => calendar.label === trimmedLabel)) {
    throw new Error("此標籤名稱已存在。");
  }

  const newCalendar = {
    id: `cal-${crypto.randomUUID()}`,
    label: trimmedLabel,
    color: normalizedColor,
  };

  resolveStorage(storage).setItem(
    STORAGE_KEY,
    JSON.stringify([...customs, newCalendar]),
  );

  return newCalendar;
}
