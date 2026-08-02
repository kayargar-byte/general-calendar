import {
  buildCalendarView,
  renderCalendar,
  renderMiniCalendar,
} from "./calendar.js";
import { DEFAULT_CALENDAR_ID } from "./calendar-catalog.js";
import { formatMonthTitle, toDateKey } from "./date-utils.js";
import {
  createEvent,
  deleteEvent,
  getEvents,
  updateEvent,
} from "./storage.js";

const calendarTitle = document.querySelector("#calendar-title");
const calendarGrid = document.querySelector("#calendar-grid");
const miniCalendar = document.querySelector("#mini-calendar");
const createEventButton = document.querySelector("#create-event");
const calendarFilters = [
  ...document.querySelectorAll("#calendar-filters input[type='checkbox']"),
];
const previousMonthButton = document.querySelector("#previous-month");
const todayButton = document.querySelector("#today");
const nextMonthButton = document.querySelector("#next-month");
const eventDialog = document.querySelector("#event-dialog");
const eventForm = eventDialog?.querySelector("form");
const eventDialogTitle = document.querySelector("#event-dialog-title");
const closeEventDialogButton = document.querySelector("#close-event-dialog");
const cancelEventButton = document.querySelector("#cancel-event");
const deleteEventButton = document.querySelector("#delete-event");
const eventFormError = document.querySelector("#event-form-error");
const eventTitleInput = document.querySelector("#event-title");
const eventDateInput = document.querySelector("#event-date");
const eventCalendarInput = document.querySelector("#event-calendar");
const eventStartTimeInput = document.querySelector("#event-start-time");
const eventEndTimeInput = document.querySelector("#event-end-time");
const eventNotesInput = document.querySelector("#event-notes");
const calendarLayout = document.querySelector(".calendar-layout");
const aiScheduleLauncher = document.querySelector("#ai-schedule-launcher");
const aiSchedulePanel = document.querySelector("#ai-schedule-panel");
const closeAiScheduleButton = document.querySelector("#close-ai-schedule");
const aiScheduleInput = document.querySelector("#ai-schedule-input");

if (
  !calendarTitle ||
  !calendarGrid ||
  !miniCalendar ||
  !createEventButton ||
  calendarFilters.length === 0 ||
  !previousMonthButton ||
  !todayButton ||
  !nextMonthButton ||
  !eventDialog ||
  !eventForm ||
  !eventDialogTitle ||
  !closeEventDialogButton ||
  !cancelEventButton ||
  !deleteEventButton ||
  !eventFormError ||
  !eventTitleInput ||
  !eventDateInput ||
  !eventCalendarInput ||
  !eventStartTimeInput ||
  !eventEndTimeInput ||
  !eventNotesInput ||
  !calendarLayout ||
  !aiScheduleLauncher ||
  !aiSchedulePanel ||
  !closeAiScheduleButton ||
  !aiScheduleInput
) {
  throw new Error("月曆頁面結構不完整。");
}

const initialDate = new Date();
let visibleMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
let editingEventId = null;
let returnFocus = null;
let isAiScheduleOpen = false;

function setAiScheduleOpen(isOpen) {
  isAiScheduleOpen = isOpen;
  calendarLayout.classList.toggle("is-ai-schedule-open", isOpen);
  aiScheduleLauncher.setAttribute("aria-expanded", String(isOpen));
  aiSchedulePanel.setAttribute("aria-hidden", String(!isOpen));

  if (isOpen) {
    aiScheduleInput.focus();
  } else {
    aiScheduleLauncher.focus();
  }
}

function renderVisibleMonth() {
  const year = visibleMonth.getFullYear();
  const monthIndex = visibleMonth.getMonth();
  const visibleCalendarIds = new Set(
    calendarFilters
      .filter((filter) => filter.checked)
      .map((filter) => filter.value),
  );
  const days = buildCalendarView(
    year,
    monthIndex,
    getEvents(),
    new Date(),
    visibleCalendarIds,
  );

  calendarTitle.textContent = formatMonthTitle(year, monthIndex);
  renderMiniCalendar(miniCalendar, days, {
    onDateSelect: openCreateEventDialog,
  });
  renderCalendar(calendarGrid, days, {
    onDateSelect: openCreateEventDialog,
    onEventSelect: openEditEventDialog,
  });
}

function clearFormError() {
  eventFormError.textContent = "";
  eventFormError.hidden = true;
}

function showFormError(error) {
  eventFormError.textContent =
    error instanceof Error ? error.message : "無法儲存事件。";
  eventFormError.hidden = false;
  eventFormError.focus();
}

function rememberReturnFocus(element, type, value, fallbackDate) {
  returnFocus = { element, type, value, fallbackDate };
}

function findReturnFocus() {
  if (returnFocus?.element?.isConnected) {
    return returnFocus.element;
  }

  const selector =
    returnFocus?.type === "event"
      ? "[data-event-id]"
      : "button[data-date]";
  const dataKey = returnFocus?.type === "event" ? "eventId" : "date";
  const matchingElement = [...document.querySelectorAll(selector)].find(
    (element) => element.dataset[dataKey] === returnFocus?.value,
  );

  if (matchingElement) {
    return matchingElement;
  }

  return [...document.querySelectorAll("button[data-date]")].find(
    (element) => element.dataset.date === returnFocus?.fallbackDate,
  );
}

function openCreateEventDialog(dateKey, trigger) {
  editingEventId = null;
  eventForm.reset();
  clearFormError();
  eventDialogTitle.textContent = "新增事件";
  deleteEventButton.hidden = true;
  eventDateInput.value = dateKey;
  eventCalendarInput.value = DEFAULT_CALENDAR_ID;
  rememberReturnFocus(trigger, "date", dateKey, dateKey);
  eventDialog.showModal();
  eventTitleInput.focus();
}

function openEditEventDialog(eventId, trigger) {
  const event = getEvents().find((storedEvent) => storedEvent.id === eventId);

  if (!event) {
    return;
  }

  editingEventId = event.id;
  eventForm.reset();
  clearFormError();
  eventDialogTitle.textContent = "編輯事件";
  deleteEventButton.hidden = false;
  eventTitleInput.value = event.title;
  eventDateInput.value = event.date;
  eventCalendarInput.value = event.calendarId;
  eventStartTimeInput.value = event.startTime;
  eventEndTimeInput.value = event.endTime;
  eventNotesInput.value = event.notes;
  rememberReturnFocus(trigger, "event", event.id, event.date);
  eventDialog.showModal();
  eventTitleInput.focus();
}

function getEventInput() {
  return {
    title: eventTitleInput.value,
    date: eventDateInput.value,
    calendarId: eventCalendarInput.value,
    startTime: eventStartTimeInput.value,
    endTime: eventEndTimeInput.value,
    notes: eventNotesInput.value,
  };
}

function handleEventSubmit(event) {
  event.preventDefault();
  clearFormError();

  try {
    if (editingEventId) {
      const updatedEvent = updateEvent(editingEventId, getEventInput());

      if (!updatedEvent) {
        throw new Error("找不到要更新的事件。");
      }
    } else {
      createEvent(getEventInput());
    }

    eventDialog.close();
    renderVisibleMonth();
  } catch (error) {
    showFormError(error);
  }
}

function handleEventDelete() {
  if (!editingEventId) {
    return;
  }

  const event = getEvents().find(
    (storedEvent) => storedEvent.id === editingEventId,
  );

  if (!event || !window.confirm(`確定要刪除「${event.title}」嗎？`)) {
    return;
  }

  deleteEvent(editingEventId);
  returnFocus = { ...returnFocus, type: "date", value: event.date };
  eventDialog.close();
  renderVisibleMonth();
}

function changeVisibleMonth(offset) {
  visibleMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + offset,
    1,
  );
  renderVisibleMonth();
}

previousMonthButton.addEventListener("click", () => changeVisibleMonth(-1));
nextMonthButton.addEventListener("click", () => changeVisibleMonth(1));
createEventButton.addEventListener("click", () => {
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === visibleMonth.getFullYear() &&
    today.getMonth() === visibleMonth.getMonth();
  const date = isCurrentMonth ? today : visibleMonth;

  openCreateEventDialog(toDateKey(date), createEventButton);
});
todayButton.addEventListener("click", () => {
  const today = new Date();
  visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  renderVisibleMonth();
});
for (const filter of calendarFilters) {
  filter.addEventListener("change", renderVisibleMonth);
}
eventForm.addEventListener("submit", handleEventSubmit);
deleteEventButton.addEventListener("click", handleEventDelete);
closeEventDialogButton.addEventListener("click", () => eventDialog.close());
cancelEventButton.addEventListener("click", () => eventDialog.close());
aiScheduleLauncher.addEventListener("click", () => {
  setAiScheduleOpen(!isAiScheduleOpen);
});
closeAiScheduleButton.addEventListener("click", () => {
  setAiScheduleOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isAiScheduleOpen && !eventDialog.open) {
    setAiScheduleOpen(false);
  }
});
eventDialog.addEventListener("close", () => {
  findReturnFocus()?.focus();
  returnFocus = null;
});

renderVisibleMonth();
