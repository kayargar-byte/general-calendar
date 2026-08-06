// 內建分類以「生活領域」為單一維度，各分類互不重疊：任何事件應有唯一歸屬。
// 「個人」原先等於第二個「其他」（catch-all），已移除；個人活動歸入休閒。
// DEFAULT_CALENDAR_ID 只在分類清單為空時兜底。
export const DEFAULT_CALENDAR_ID = "other";

export const DEFAULT_CALENDARS = [
  { id: "work", label: "工作", color: "#3478c7" },
  { id: "family", label: "家庭", color: "#459b38" },
  { id: "medical", label: "醫療", color: "#7857b3" },
  { id: "documents", label: "證件", color: "#e97816" },
  { id: "allowances", label: "津貼", color: "#d63384" },
  { id: "leisure", label: "休閒", color: "#0b7285" },
  { id: "other", label: "其他", color: "#70757e" },
];

export const TAG_COLOR_PALETTE = [
  "#d63384",
  "#e85d04",
  "#2a9d8f",
  "#6d28d9",
  "#0b7285",
  "#b45309",
  "#2563eb",
  "#be185d",
  "#059669",
];

export const CALENDARS_STORAGE_KEY = "general-calendar.calendars.v1";

function isCalendar(calendar) {
  return (
    typeof calendar?.id === "string" &&
    calendar.id.length > 0 &&
    typeof calendar.label === "string" &&
    calendar.label.length > 0 &&
    typeof calendar.color === "string" &&
    calendar.color.length > 0
  );
}

function resolveStorage(storage) {
  const resolvedStorage = storage ?? globalThis.localStorage;

  if (!resolvedStorage) {
    throw new Error("此環境不支援本機儲存。");
  }

  return resolvedStorage;
}

export function getCalendars(storage) {
  const storedValue = resolveStorage(storage).getItem(CALENDARS_STORAGE_KEY);

  if (!storedValue) {
    return [...DEFAULT_CALENDARS];
  }

  try {
    const parsedCalendars = JSON.parse(storedValue);

    if (!Array.isArray(parsedCalendars)) {
      return [...DEFAULT_CALENDARS];
    }

    const calendars = parsedCalendars.filter(isCalendar);

    return calendars.length > 0 ? calendars : [...DEFAULT_CALENDARS];
  } catch {
    return [...DEFAULT_CALENDARS];
  }
}

export function saveCalendars(calendars, storage) {
  resolveStorage(storage).setItem(
    CALENDARS_STORAGE_KEY,
    JSON.stringify(calendars),
  );
}

export function isCalendarId(value, storage) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  return getCalendars(storage).some((calendar) => calendar.id === value);
}

export function createCalendar(label, storage) {
  const name = typeof label === "string" ? label.trim() : "";

  if (!name) {
    throw new Error("分類名稱不可為空。");
  }

  const calendars = getCalendars(storage);

  if (calendars.some((calendar) => calendar.label === name)) {
    throw new Error(`分類「${name}」已存在。`);
  }

  const usedColors = new Set(calendars.map((calendar) => calendar.color));
  const color =
    TAG_COLOR_PALETTE.find((candidate) => !usedColors.has(candidate)) ??
    TAG_COLOR_PALETTE[0];

  const calendar = {
    id: crypto.randomUUID(),
    label: name,
    color,
  };

  saveCalendars([...calendars, calendar], storage);

  return calendar;
}

export function updateCalendar(id, label, color, storage) {
  const calendars = getCalendars(storage);
  const calendarIndex = calendars.findIndex(
    (calendar) => calendar.id === id,
  );

  if (calendarIndex === -1) {
    throw new Error("找不到要更新的分類。");
  }

  const name = typeof label === "string" ? label.trim() : "";

  if (!name) {
    throw new Error("分類名稱不可為空。");
  }

  if (
    calendars.some(
      (calendar) => calendar.id !== id && calendar.label === name,
    )
  ) {
    throw new Error(`分類「${name}」已存在。`);
  }

  if (typeof color !== "string" || color.length === 0) {
    throw new Error("分類顏色不可為空。");
  }

  const updatedCalendar = {
    ...calendars[calendarIndex],
    label: name,
    color,
  };

  const nextCalendars = [...calendars];
  nextCalendars[calendarIndex] = updatedCalendar;
  saveCalendars(nextCalendars, storage);

  return updatedCalendar;
}

export function deleteCalendar(id, storage) {
  const calendars = getCalendars(storage);
  const remainingCalendars = calendars.filter(
    (calendar) => calendar.id !== id,
  );

  if (remainingCalendars.length === calendars.length) {
    return false;
  }

  saveCalendars(remainingCalendars, storage);
  return true;
}
