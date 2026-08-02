export const DEFAULT_CALENDAR_ID = "personal";

export const CALENDARS = [
  { id: "personal", label: "個人", color: "teal" },
  { id: "documents", label: "證件續期", color: "orange" },
  { id: "medical", label: "醫療", color: "purple" },
  { id: "family", label: "家庭", color: "green" },
  { id: "work", label: "工作", color: "blue" },
  { id: "other", label: "其他", color: "gray" },
];

const CALENDAR_IDS = new Set(CALENDARS.map((calendar) => calendar.id));

export function isCalendarId(value) {
  return CALENDAR_IDS.has(value);
}
