import {
  buildMonthGrid,
  formatDateLabel,
  toDateKey,
} from "./date-utils.js";
import { t } from "./i18n.js";

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

export function renderCalendar(
  gridElement,
  days,
  { onDateSelect, onEventSelect, calendarsById },
) {
  const document = gridElement.ownerDocument;
  const fragment = document.createDocumentFragment();

  for (const day of days) {
    const dayElement = document.createElement("div");
    dayElement.className = "calendar-day";
    dayElement.dataset.date = day.dateKey;
    dayElement.setAttribute("role", "gridcell");

    if (!day.isCurrentMonth) {
      dayElement.classList.add("is-outside-month");
    }

    if (day.isToday) {
      dayElement.classList.add("is-today");
    }

    const dateButton = document.createElement("button");
    dateButton.type = "button";
    dateButton.className = "calendar-date";
    dateButton.dataset.date = day.dateKey;
    dateButton.textContent = String(day.dayNumber);
    dateButton.setAttribute("aria-label", t("event.addDateAria", { label: day.label }));
    dateButton.addEventListener("click", () =>
      onDateSelect(day.dateKey, dateButton),
    );
    dayElement.append(dateButton);

    if (day.events.length > 0) {
      const eventList = document.createElement("ul");
      eventList.className = "event-list";

      for (const event of day.events) {
        const eventItem = document.createElement("li");
        const eventButton = document.createElement("button");
        const summary = event.startTime
          ? `${event.startTime} ${event.title}`
          : event.title;
        eventButton.type = "button";
        eventButton.className = "event-summary";
        eventButton.dataset.eventId = event.id;
        eventButton.dataset.calendarId = event.calendarId;
        const calendar = calendarsById?.[event.calendarId];

        if (calendar) {
          eventButton.style.setProperty("--event-color", calendar.color);
        }

        eventButton.textContent = summary;
        eventButton.setAttribute("aria-label", t("event.viewEventAria", { summary }));
        eventButton.addEventListener("click", () =>
          onEventSelect(event.id, eventButton),
        );
        eventItem.append(eventButton);
        eventList.append(eventItem);
      }

      dayElement.append(eventList);
    }

    fragment.append(dayElement);
  }

  gridElement.replaceChildren(fragment);
}

export function renderMiniCalendar(
  calendarElement,
  days,
  { onDateSelect },
) {
  const document = calendarElement.ownerDocument;
  const fragment = document.createDocumentFragment();

  for (const day of days) {
    const dateButton = document.createElement("button");
    dateButton.type = "button";
    dateButton.className = "mini-calendar-date";
    dateButton.dataset.date = day.dateKey;
    dateButton.textContent = String(day.dayNumber);
    dateButton.setAttribute("aria-label", t("event.addDateAria", { label: day.label }));

    if (!day.isCurrentMonth) {
      dateButton.classList.add("is-outside-month");
    }

    if (day.isToday) {
      dateButton.classList.add("is-today");
      dateButton.setAttribute("aria-current", "date");
    }

    dateButton.addEventListener("click", () =>
      onDateSelect(day.dateKey, dateButton),
    );
    fragment.append(dateButton);
  }

  calendarElement.replaceChildren(fragment);
}
