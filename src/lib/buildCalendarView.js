import {
  buildMonthGrid,
  formatDateLabel,
  toDateKey,
} from "./date-utils.js";

export function buildCalendarView(
  year,
  monthIndex,
  events,
  today = new Date(),
  visibleCalendarIds,
) {
  const eventsByDate = new Map();

  for (const event of events) {
    if (visibleCalendarIds && !visibleCalendarIds.has(event.calendarId)) {
      continue;
    }

    const dateEvents = eventsByDate.get(event.date) ?? [];
    dateEvents.push(event);
    eventsByDate.set(event.date, dateEvents);
  }

  const todayKey = toDateKey(today);

  return buildMonthGrid(year, monthIndex).map((date) => {
    const dateKey = toDateKey(date);

    return {
      dateKey,
      dayNumber: date.getDate(),
      label: formatDateLabel(date),
      isCurrentMonth: date.getMonth() === monthIndex,
      isToday: dateKey === todayKey,
      events: eventsByDate.get(dateKey) ?? [],
    };
  });
}
