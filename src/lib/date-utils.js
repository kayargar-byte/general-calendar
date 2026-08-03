const WEEKDAY_LABELS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
];

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
  return `${year}年${monthIndex + 1}月`;
}

export function formatDateLabel(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}年${month}月${day}日 ${WEEKDAY_LABELS[date.getDay()]}`;
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
