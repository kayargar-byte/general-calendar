import {
  buildCalendarView,
  renderCalendar,
  renderMiniCalendar,
} from "./calendar.js";
import {
  COLOR_PALETTE,
  DEFAULT_CALENDAR_ID,
  createCalendar,
  getAllCalendars,
  getCustomCalendars,
} from "./calendar-catalog.js";
import { formatMonthTitle, toDateKey } from "./date-utils.js";
import {
  createEvent,
  deleteEvent,
  getEvents,
  seedSampleEventsIfFirstRun,
  updateEvent,
} from "./storage.js";
import { parseSchedule } from "./ai.js";

const calendarTitle = document.querySelector("#calendar-title");
const calendarGrid = document.querySelector("#calendar-grid");
const miniCalendar = document.querySelector("#mini-calendar");
const createEventButton = document.querySelector("#create-event");
const calendarFiltersFieldset = document.querySelector("#calendar-filters");
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
const analyzeAiScheduleButton = document.querySelector("#analyze-ai-schedule");
const aiScheduleError = document.querySelector("#ai-schedule-error");
const addTagButton = document.querySelector("#add-tag");
const tagDialog = document.querySelector("#tag-dialog");
const tagForm = tagDialog?.querySelector("form");
const closeTagDialogButton = document.querySelector("#close-tag-dialog");
const cancelTagButton = document.querySelector("#cancel-tag");
const tagNameInput = document.querySelector("#tag-name");
const tagColorPalette = document.querySelector("#tag-color-palette");
const tagFormError = document.querySelector("#tag-form-error");

if (
  !calendarTitle ||
  !calendarGrid ||
  !miniCalendar ||
  !createEventButton ||
  !calendarFiltersFieldset ||
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
  !aiScheduleInput ||
  !analyzeAiScheduleButton ||
  !aiScheduleError ||
  !addTagButton ||
  !tagDialog ||
  !tagForm ||
  !closeTagDialogButton ||
  !cancelTagButton ||
  !tagNameInput ||
  !tagColorPalette ||
  !tagFormError
) {
  throw new Error("月曆頁面結構不完整。");
}

const initialDate = new Date();
let visibleMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
let editingEventId = null;
let returnFocus = null;
let isAiScheduleOpen = false;
let selectedTagColor = COLOR_PALETTE[0];
let calendarsById = buildCalendarsById();

function buildCalendarsById() {
  const map = {};

  for (const calendar of getAllCalendars()) {
    map[calendar.id] = calendar;
  }

  return map;
}

function getVisibleCalendarIds() {
  return new Set(
    [...document.querySelectorAll("#calendar-filters input[type='checkbox']")]
      .filter((filter) => filter.checked)
      .map((filter) => filter.value),
  );
}

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

function clearAiError() {
  aiScheduleError.textContent = "";
  aiScheduleError.hidden = true;
}

function showAiError(error) {
  aiScheduleError.textContent =
    error instanceof Error ? error.message : "無法分析日程。";
  aiScheduleError.hidden = false;
  aiScheduleError.focus();
}

function openCreateEventDialogFromAi(eventData) {
  editingEventId = null;
  eventForm.reset();
  clearFormError();
  eventDialogTitle.textContent = "新增事件";
  deleteEventButton.hidden = true;
  eventTitleInput.value = eventData.title;
  eventDateInput.value = eventData.date;
  eventCalendarInput.value = eventData.calendarId;
  eventStartTimeInput.value = eventData.startTime;
  eventEndTimeInput.value = eventData.endTime;
  eventNotesInput.value = eventData.notes;
  rememberReturnFocus(aiScheduleLauncher, "date", eventData.date, eventData.date);
  eventDialog.showModal();
  eventTitleInput.focus();
}

async function handleAnalyzeSchedule() {
  clearAiError();
  analyzeAiScheduleButton.classList.add("is-loading");
  analyzeAiScheduleButton.disabled = true;
  const originalText = analyzeAiScheduleButton.textContent;
  analyzeAiScheduleButton.textContent = "分析中…";

  try {
    const event = await parseSchedule(aiScheduleInput.value);
    setAiScheduleOpen(false);
    openCreateEventDialogFromAi(event);
  } catch (error) {
    showAiError(error);
  } finally {
    analyzeAiScheduleButton.classList.remove("is-loading");
    analyzeAiScheduleButton.disabled = false;
    analyzeAiScheduleButton.textContent = originalText;
  }
}

function renderVisibleMonth() {
  const year = visibleMonth.getFullYear();
  const monthIndex = visibleMonth.getMonth();
  const days = buildCalendarView(
    year,
    monthIndex,
    getEvents(),
    new Date(),
    getVisibleCalendarIds(),
  );

  calendarTitle.textContent = formatMonthTitle(year, monthIndex);
  renderMiniCalendar(miniCalendar, days, {
    onDateSelect: openCreateEventDialog,
  });
  renderCalendar(calendarGrid, days, {
    onDateSelect: openCreateEventDialog,
    onEventSelect: openEditEventDialog,
    calendarsById,
  });
}

function renderCustomTags() {
  for (const row of document.querySelectorAll(
    "#calendar-filters .custom-filter-row",
  )) {
    row.remove();
  }

  for (const option of document.querySelectorAll(
    "#event-calendar .is-custom-option",
  )) {
    option.remove();
  }

  for (const calendar of getCustomCalendars()) {
    const label = document.createElement("label");
    label.className = "custom-filter-row";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = calendar.id;
    input.checked = true;
    input.className = "is-custom";
    input.style.setProperty("--calendar-color", calendar.color);

    const colorSpan = document.createElement("span");
    colorSpan.className = "calendar-color";
    colorSpan.setAttribute("aria-hidden", "true");

    const labelText = document.createElement("span");
    labelText.className = "calendar-label-text";
    labelText.textContent = calendar.label;

    label.append(input, colorSpan, labelText);
    calendarFiltersFieldset.append(label);

    const option = document.createElement("option");
    option.value = calendar.id;
    option.textContent = calendar.label;
    option.className = "is-custom-option";
    eventCalendarInput.append(option);
  }
}

function renderColorPalette() {
  tagColorPalette.replaceChildren();

  for (const color of COLOR_PALETTE) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "tag-color-swatch";
    swatch.style.setProperty("--swatch-color", color);
    swatch.dataset.color = color;
    swatch.setAttribute("role", "radio");
    swatch.setAttribute("aria-label", `顏色 ${color}`);
    swatch.setAttribute("aria-checked", "false");
    swatch.addEventListener("click", () => selectTagColor(color, swatch));
    tagColorPalette.append(swatch);
  }
}

function selectTagColor(color, swatch) {
  selectedTagColor = color;

  for (const item of tagColorPalette.querySelectorAll(".tag-color-swatch")) {
    item.classList.remove("is-selected");
    item.setAttribute("aria-checked", "false");
  }

  swatch.classList.add("is-selected");
  swatch.setAttribute("aria-checked", "true");
}

function clearTagFormError() {
  tagFormError.textContent = "";
  tagFormError.hidden = true;
}

function showTagFormError(error) {
  tagFormError.textContent =
    error instanceof Error ? error.message : "無法儲存標籤。";
  tagFormError.hidden = false;
  tagFormError.focus();
}

function openTagDialog() {
  tagForm.reset();
  clearTagFormError();
  const firstSwatch = tagColorPalette.querySelector(".tag-color-swatch");

  if (firstSwatch) {
    selectTagColor(COLOR_PALETTE[0], firstSwatch);
  }

  tagDialog.showModal();
  tagNameInput.focus();
}

function handleTagSubmit(event) {
  event.preventDefault();
  clearTagFormError();

  try {
    createCalendar({ label: tagNameInput.value, color: selectedTagColor });
    calendarsById = buildCalendarsById();
    renderCustomTags();
    tagDialog.close();
    renderVisibleMonth();
  } catch (error) {
    showTagFormError(error);
  }
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
calendarFiltersFieldset.addEventListener("change", renderVisibleMonth);
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
analyzeAiScheduleButton.addEventListener("click", handleAnalyzeSchedule);
addTagButton.addEventListener("click", openTagDialog);
tagForm.addEventListener("submit", handleTagSubmit);
closeTagDialogButton.addEventListener("click", () => tagDialog.close());
cancelTagButton.addEventListener("click", () => tagDialog.close());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isAiScheduleOpen && !eventDialog.open) {
    setAiScheduleOpen(false);
  }
});
eventDialog.addEventListener("close", () => {
  findReturnFocus()?.focus();
  returnFocus = null;
});

seedSampleEventsIfFirstRun();
renderCustomTags();
renderColorPalette();
renderVisibleMonth();
