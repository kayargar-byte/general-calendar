import {
  MONTH_LABELS,
  WEEKDAY_LABELS_FULL,
  getCurrentLanguage,
} from "./i18n.js";

function padNumber(value) {
  return String(value).padStart(2, "0");
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());

  return `${year}-${month}-${day}`;
}

export function formatMonthTitle(year, monthIndex) {
  const lang = getCurrentLanguage();
  const months = MONTH_LABELS[lang] ?? MONTH_LABELS["zh-TW"];
  const monthLabel = months[monthIndex] ?? `${monthIndex + 1}月`;

  if (lang === "en") {
    return `${monthLabel} ${year}`;
  }

  return `${year}年${monthLabel}`;
}

export function formatDateLabel(date) {
  const lang = getCurrentLanguage();
  const months = MONTH_LABELS[lang] ?? MONTH_LABELS["zh-TW"];
  const weekdays = WEEKDAY_LABELS_FULL[lang] ?? WEEKDAY_LABELS_FULL["zh-TW"];
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const day = date.getDate();
  const weekday = weekdays[date.getDay()] ?? "";
  const monthLabel = months[monthIndex] ?? `${monthIndex + 1}月`;

  if (lang === "en") {
    return `${weekday}, ${monthLabel} ${day}, ${year}`;
  }

  return `${year}年${monthLabel}${day}日 ${weekday}`;
}

export function buildMonthGrid(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const trailingDays = 6 - ((lastDay.getDay() + 6) % 7);
  const totalDays = leadingDays + lastDay.getDate() + trailingDays;

  return Array.from(
    { length: totalDays },
    (_, index) => new Date(year, monthIndex, 1 - leadingDays + index),
  );
}
