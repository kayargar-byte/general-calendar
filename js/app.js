import {
  buildCalendarView,
  renderCalendar,
  renderMiniCalendar,
} from "./calendar.js";
import {
  CALENDARS,
  COLOR_PALETTE,
  DEFAULT_CALENDAR_ID,
  createCalendar,
  deleteCalendar,
  getAllCalendars,
  getCalendarById,
  getCustomCalendars,
  hasCalendarOverride,
  resetCalendarOverride,
  updateCalendar,
} from "./calendar-catalog.js";
import { formatMonthTitle, toDateKey } from "./date-utils.js";
import {
  createEvent,
  deleteEvent,
  findConflicts,
  getEvents,
  searchEvents,
  seedSampleEventsIfFirstRun,
  updateEvent,
} from "./storage.js";
import { parseSchedule } from "./ai.js";
import {
  LANGUAGES,
  applyTranslations,
  getCurrentLanguage,
  getBuiltInCalendarLabel,
  loadLanguage,
  setLanguage,
  t,
} from "./i18n.js";

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
const tagDialogTitle = document.querySelector("#tag-dialog-title");
const tagEditIdInput = document.querySelector("#tag-edit-id");
const themeToggleButton = document.querySelector("#theme-toggle");
const eventSearchInput = document.querySelector("#event-search");
const searchResultsPanel = document.querySelector("#search-results");
const aiBatchDialog = document.querySelector("#ai-batch-dialog");
const aiBatchDialogTitle = document.querySelector("#ai-batch-dialog-title");
const closeAiBatchDialogButton = document.querySelector("#close-ai-batch-dialog");
const cancelAiBatchButton = document.querySelector("#cancel-ai-batch");
const confirmAiBatchButton = document.querySelector("#confirm-ai-batch");
const aiBatchList = document.querySelector("#ai-batch-list");
const openManageButton = document.querySelector("#open-manage");
const manageDialog = document.querySelector("#manage-dialog");
const manageDialogTitle = document.querySelector("#manage-dialog-title");
const closeManageDialogButton = document.querySelector("#close-manage-dialog");
const manageTabEventsButton = document.querySelector("#manage-tab-events");
const manageTabTagsButton = document.querySelector("#manage-tab-tags");
const manageEventsPanel = document.querySelector("#manage-events-panel");
const manageTagsPanel = document.querySelector("#manage-tags-panel");
const manageEventList = document.querySelector("#manage-event-list");
const manageTagList = document.querySelector("#manage-tag-list");
const openSettingsButton = document.querySelector("#open-settings");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsDialogTitle = document.querySelector("#settings-dialog-title");
const closeSettingsDialogButton = document.querySelector("#close-settings-dialog");
const settingsLanguageSelect = document.querySelector("#settings-language");
const settingsThemeRadios = document.querySelectorAll('input[name="settings-theme"]');
const calendarTitleButton = document.querySelector("#calendar-title-button");
const datePickerPopover = document.querySelector("#date-picker-popover");
const datePickerYear = document.querySelector("#date-picker-year");
const datePickerMonth = document.querySelector("#date-picker-month");
const datePickerDay = document.querySelector("#date-picker-day");
const datePickerConfirmButton = document.querySelector("#date-picker-confirm");
const datePickerCancelButton = document.querySelector("#date-picker-cancel");
const calendarWorkspace = document.querySelector(".calendar-workspace");

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
  !tagFormError ||
  !tagDialogTitle ||
  !tagEditIdInput ||
  !themeToggleButton ||
  !eventSearchInput ||
  !searchResultsPanel ||
  !aiBatchDialog ||
  !aiBatchDialogTitle ||
  !closeAiBatchDialogButton ||
  !cancelAiBatchButton ||
  !confirmAiBatchButton ||
  !aiBatchList ||
  !openManageButton ||
  !manageDialog ||
  !manageDialogTitle ||
  !closeManageDialogButton ||
  !manageTabEventsButton ||
  !manageTabTagsButton ||
  !manageEventsPanel ||
  !manageTagsPanel ||
  !manageEventList ||
  !manageTagList ||
  !openSettingsButton ||
  !settingsDialog ||
  !settingsDialogTitle ||
  !closeSettingsDialogButton ||
  !settingsLanguageSelect ||
  !calendarTitleButton ||
  !datePickerPopover ||
  !datePickerYear ||
  !datePickerMonth ||
  !datePickerDay ||
  !datePickerConfirmButton ||
  !datePickerCancelButton ||
  !calendarWorkspace
) {
  throw new Error("月曆頁面結構不完整。");
}

const initialDate = new Date();
let visibleMonth = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
let editingEventId = null;
let returnFocus = null;
let isAiScheduleOpen = false;
let selectedTagColor = COLOR_PALETTE[0];
let editingCalendarId = null;
let calendarsById = buildCalendarsById();
let conflictConfirmed = false;
let pendingBatchEvents = [];
let searchDebounceTimer = null;
let wheelThrottleTimer = null;
const THEME_STORAGE_KEY = "general-calendar.theme";

function buildCalendarsById() {
  const map = {};

  for (const calendar of getAllCalendars()) {
    map[calendar.id] = calendar;
  }

  return map;
}

function getCalendarDisplayLabel(calendar) {
  if (!calendar) {
    return "";
  }

  const isBuiltIn = CALENDARS.some((item) => item.id === calendar.id);

  if (isBuiltIn && !hasCalendarOverride(calendar.id)) {
    return getBuiltInCalendarLabel(calendar.id);
  }

  return calendar.label;
}

function getCalendarDisplayLabelById(id) {
  return getCalendarDisplayLabel(getCalendarById(id));
}

function loadTheme() {
  let storedTheme = null;

  try {
    storedTheme = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
  } catch {
    storedTheme = null;
  }

  const theme =
    storedTheme === "dark" || storedTheme === "light"
      ? storedTheme
      : "light";

  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  updateThemeToggleIcon(theme);
}

function updateThemeToggleIcon(theme) {
  const icon = themeToggleButton.querySelector(".theme-toggle-icon");

  if (!icon) {
    return;
  }

  icon.textContent = theme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  const isDark =
    document.documentElement.getAttribute("data-theme") === "dark";
  const nextTheme = isDark ? "light" : "dark";

  if (nextTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  updateThemeToggleIcon(nextTheme);

  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // ignore storage errors
  }
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
    error instanceof Error ? error.message : t("error.analyzeSchedule");
  aiScheduleError.hidden = false;
  aiScheduleError.focus();
}

function openCreateEventDialogFromAi(eventData) {
  editingEventId = null;
  conflictConfirmed = false;
  eventForm.reset();
  clearFormError();
  eventDialogTitle.textContent = t("eventDialog.new");
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
  analyzeAiScheduleButton.textContent = t("ai.analyzing");

  try {
    const events = await parseSchedule(aiScheduleInput.value, getAllCalendars());
    setAiScheduleOpen(false);

    if (events.length === 1) {
      openCreateEventDialogFromAi(events[0]);
    } else {
      openBatchConfirmationDialog(events);
    }
  } catch (error) {
    showAiError(error);
  } finally {
    analyzeAiScheduleButton.classList.remove("is-loading");
    analyzeAiScheduleButton.disabled = false;
    analyzeAiScheduleButton.textContent = originalText;
  }
}

function formatBatchDate(dateKey) {
  if (!dateKey) {
    return "";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    return dateKey;
  }

  return `${match[1]}/${match[2]}/${match[3]}`;
}

function openBatchConfirmationDialog(events) {
  pendingBatchEvents = events;
  aiBatchList.replaceChildren();

  for (const event of events) {
    const item = document.createElement("li");
    item.className = "batch-event-item";
    const calendar = getCalendarById(event.calendarId);
    item.style.setProperty(
      "--batch-color",
      calendar?.color ?? "var(--color-other)",
    );

    const dateSpan = document.createElement("span");
    dateSpan.className = "batch-event-date";
    dateSpan.textContent = formatBatchDate(event.date);

    const timeSpan = document.createElement("span");
    timeSpan.className = "batch-event-time";
    timeSpan.textContent = event.startTime
      ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}`
      : t("search.allDay");

    const titleSpan = document.createElement("span");
    titleSpan.className = "batch-event-title";
    titleSpan.textContent = event.title;

    const calendarSpan = document.createElement("span");
    calendarSpan.className = "batch-event-calendar";
    calendarSpan.textContent = calendar ? getCalendarDisplayLabel(calendar) : event.calendarId;

    item.append(dateSpan, timeSpan, titleSpan, calendarSpan);
    aiBatchList.append(item);
  }

  aiBatchDialog.showModal();
}

function closeBatchDialog() {
  if (aiBatchDialog.open) {
    aiBatchDialog.close();
  }

  pendingBatchEvents = [];
}

function handleBatchSubmit() {
  for (const event of pendingBatchEvents) {
    try {
      createEvent(event);
    } catch {
      // ignore individual failures and continue
    }
  }

  calendarsById = buildCalendarsById();
  closeBatchDialog();
  renderVisibleMonth();
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
    const row = document.createElement("div");
    row.className = "calendar-filter-row custom-filter-row";

    const label = document.createElement("label");

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

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-tag-button";
    editButton.dataset.editCalendar = calendar.id;
    editButton.setAttribute(
      "aria-label",
      t("tag.editAria", { name: calendar.label }),
    );
    editButton.textContent = t("tag.edit");

    row.append(label, editButton);
    calendarFiltersFieldset.append(row);

    const option = document.createElement("option");
    option.value = calendar.id;
    option.textContent = calendar.label;
    option.className = "is-custom-option";
    eventCalendarInput.append(option);
  }
}

function refreshBuiltInTags() {
  for (const calendar of CALENDARS) {
    const editButton = document.querySelector(
      `#calendar-filters .edit-tag-button[data-edit-calendar="${calendar.id}"]`,
    );

    if (!editButton) {
      continue;
    }

    const row = editButton.closest(".calendar-filter-row");

    if (!row) {
      continue;
    }

    const updated = getCalendarById(calendar.id);

    if (!updated) {
      continue;
    }

    const displayLabel = getCalendarDisplayLabel(updated);
    const labelText = row.querySelector(".calendar-label-text");

    if (labelText) {
      labelText.textContent = displayLabel;
    }

    const checkbox = row.querySelector("input[type='checkbox']");

    if (checkbox) {
      checkbox.style.setProperty("--calendar-color", updated.color);
    }

    editButton.setAttribute(
      "aria-label",
      t("tag.editAria", { name: displayLabel }),
    );
    editButton.textContent = t("tag.edit");

    const option = document.querySelector(
      `#event-calendar option[value="${calendar.id}"]`,
    );

    if (option) {
      option.textContent = displayLabel;
    }
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
    error instanceof Error ? error.message : t("error.saveTag");
  tagFormError.hidden = false;
  tagFormError.focus();
}

function openTagDialog() {
  editingCalendarId = null;
  tagEditIdInput.value = "";
  tagForm.reset();
  clearTagFormError();
  tagDialogTitle.textContent = t("tagDialog.new");
  const firstSwatch = tagColorPalette.querySelector(".tag-color-swatch");

  if (firstSwatch) {
    selectTagColor(COLOR_PALETTE[0], firstSwatch);
  }

  tagDialog.showModal();
  tagNameInput.focus();
}

function openEditTagDialog(id) {
  const calendar = getCalendarById(id);

  if (!calendar) {
    return;
  }

  editingCalendarId = id;
  tagEditIdInput.value = id;
  tagForm.reset();
  clearTagFormError();
  tagDialogTitle.textContent = t("tagDialog.edit");
  tagNameInput.value = getCalendarDisplayLabel(calendar);

  const swatch = [...tagColorPalette.querySelectorAll(".tag-color-swatch")].find(
    (candidate) => candidate.dataset.color === calendar.color,
  );

  if (swatch) {
    selectTagColor(calendar.color, swatch);
  } else {
    const firstSwatch = tagColorPalette.querySelector(".tag-color-swatch");

    if (firstSwatch) {
      selectTagColor(COLOR_PALETTE[0], firstSwatch);
    }
  }

  tagDialog.showModal();
  tagNameInput.focus();
}

function handleTagSubmit(event) {
  event.preventDefault();
  clearTagFormError();

  try {
    if (editingCalendarId) {
      updateCalendar(editingCalendarId, {
        label: tagNameInput.value,
        color: selectedTagColor,
      });
    } else {
      createCalendar({
        label: tagNameInput.value,
        color: selectedTagColor,
      });
    }
    calendarsById = buildCalendarsById();
    renderCustomTags();
    refreshBuiltInTags();
    tagDialog.close();
    renderVisibleMonth();
  } catch (error) {
    showTagFormError(error);
  }
}

function handleDeleteTag(id) {
  const eventCount = getEvents().filter(
    (event) => event.calendarId === id,
  ).length;

  if (eventCount > 0) {
    window.alert(
      t("alert.tagHasEvents", { count: eventCount }),
    );
    return;
  }

  const calendar = getCalendarById(id);
  const displayName = calendar ? getCalendarDisplayLabel(calendar) : id;

  if (!window.confirm(t("confirm.deleteTag", { name: displayName }))) {
    return;
  }

  try {
    deleteCalendar(id);
    calendarsById = buildCalendarsById();
    renderCustomTags();
    refreshBuiltInTags();
    renderVisibleMonth();

    if (manageDialog.open) {
      renderManageTags();
    }
  } catch (error) {
    window.alert(error instanceof Error ? error.message : t("error.deleteTag"));
  }
}

function handleResetTag(id) {
  const calendar = getCalendarById(id);
  const displayName = calendar ? getCalendarDisplayLabel(calendar) : id;

  if (!window.confirm(t("confirm.resetTag", { name: displayName }))) {
    return;
  }

  try {
    resetCalendarOverride(id);
    calendarsById = buildCalendarsById();
    refreshBuiltInTags();
    renderVisibleMonth();

    if (manageDialog.open) {
      renderManageTags();
    }
  } catch (error) {
    window.alert(error instanceof Error ? error.message : t("error.resetTag"));
  }
}

function clearFormError() {
  eventFormError.textContent = "";
  eventFormError.hidden = true;
}

function showFormError(error) {
  eventFormError.textContent =
    error instanceof Error ? error.message : t("error.saveEvent");
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
  conflictConfirmed = false;
  eventForm.reset();
  clearFormError();
  eventDialogTitle.textContent = t("eventDialog.new");
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
  conflictConfirmed = false;
  eventForm.reset();
  clearFormError();
  eventDialogTitle.textContent = t("eventDialog.edit");
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

  const input = getEventInput();

  if (!conflictConfirmed) {
    const conflicts = findConflicts(input, editingEventId);

    if (conflicts.length > 0) {
      const conflictList = conflicts
        .map(
          (conflict) =>
            `「${conflict.title}」${conflict.startTime ? ` ${conflict.startTime}` : ""}`,
        )
        .join("、");
      showFormError(
        new Error(
          t("conflict.message", { list: conflictList }),
        ),
      );
      conflictConfirmed = true;
      return;
    }
  }

  try {
    if (editingEventId) {
      const updatedEvent = updateEvent(editingEventId, input);

      if (!updatedEvent) {
        throw new Error(t("error.eventNotFound"));
      }
    } else {
      createEvent(input);
    }

    conflictConfirmed = false;
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

  if (!event || !window.confirm(t("confirm.deleteEvent", { title: event.title }))) {
    return;
  }

  deleteEvent(editingEventId);
  returnFocus = { ...returnFocus, type: "date", value: event.date };
  eventDialog.close();
  renderVisibleMonth();
}

function handleSearchInput() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }

  const query = eventSearchInput.value;

  searchDebounceTimer = setTimeout(() => {
    performSearch(query);
  }, 250);
}

function performSearch(query) {
  const trimmed = typeof query === "string" ? query.trim() : "";

  if (!trimmed) {
    searchResultsPanel.hidden = true;
    searchResultsPanel.replaceChildren();
    return;
  }

  const results = searchEvents(trimmed);
  renderSearchResults(results);
}

function renderSearchResults(results) {
  searchResultsPanel.replaceChildren();

  if (results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "search-result-empty";
    empty.textContent = t("search.empty");
    searchResultsPanel.append(empty);
    searchResultsPanel.hidden = false;
    return;
  }

  for (const event of results) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result-button";
    const calendar = getCalendarById(event.calendarId);
    button.style.setProperty(
      "--result-color",
      calendar?.color ?? "var(--color-other)",
    );

    const dateSpan = document.createElement("span");
    dateSpan.className = "search-result-date";
    dateSpan.textContent = formatBatchDate(event.date);

    const timeSpan = document.createElement("span");
    timeSpan.className = "search-result-time";
    timeSpan.textContent = event.startTime
      ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}`
      : t("search.allDay");

    const titleSpan = document.createElement("span");
    titleSpan.className = "search-result-title";
    titleSpan.textContent = event.title;

    button.append(dateSpan, timeSpan, titleSpan);
    button.addEventListener("click", () => {
      navigateToEvent(event);
    });
    searchResultsPanel.append(button);
  }

  searchResultsPanel.hidden = false;
}

function closeSearchResults() {
  searchResultsPanel.hidden = true;
  searchResultsPanel.replaceChildren();
}

function navigateToEvent(event) {
  closeSearchResults();
  eventSearchInput.value = "";

  const eventDate = new Date(
    Number(event.date.slice(0, 4)),
    Number(event.date.slice(5, 7)) - 1,
    Number(event.date.slice(8, 10)),
  );

  visibleMonth = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    1,
  );
  renderVisibleMonth();
  openEditEventDialog(event.id, null);
}

function openManageDialog() {
  switchManageTab("events");
  renderManageEvents();
  renderManageTags();
  manageDialog.showModal();
}

function switchManageTab(tab) {
  const isEvents = tab === "events";

  manageEventsPanel.hidden = !isEvents;
  manageTagsPanel.hidden = isEvents;
  manageTabEventsButton.setAttribute("aria-selected", String(isEvents));
  manageTabTagsButton.setAttribute("aria-selected", String(!isEvents));
}

function renderManageEvents() {
  manageEventList.replaceChildren();
  const events = getEvents();

  if (events.length === 0) {
    const empty = document.createElement("p");
    empty.className = "manage-empty";
    empty.textContent = t("manage.empty.events");
    manageEventList.append(empty);
    return;
  }

  for (const event of events) {
    const row = document.createElement("div");
    row.className = "manage-event-row";
    const calendar = getCalendarById(event.calendarId);
    row.style.setProperty(
      "--row-color",
      calendar?.color ?? "var(--color-other)",
    );

    const dateSpan = document.createElement("span");
    dateSpan.className = "manage-event-date";
    dateSpan.textContent = formatBatchDate(event.date);

    const timeSpan = document.createElement("span");
    timeSpan.className = "manage-event-time";
    timeSpan.textContent = event.startTime
      ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ""}`
      : t("search.allDay");

    const titleSpan = document.createElement("span");
    titleSpan.className = "manage-event-title";
    titleSpan.textContent = event.title;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "manage-action-button";
    editButton.textContent = t("manage.edit");
    editButton.addEventListener("click", () => {
      manageDialog.close();
      navigateToEventFromManage(event);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "manage-action-button is-danger";
    deleteButton.textContent = t("manage.delete");
    deleteButton.addEventListener("click", () => {
      if (!window.confirm(t("confirm.deleteEvent", { title: event.title }))) {
        return;
      }

      deleteEvent(event.id);
      renderManageEvents();
      renderVisibleMonth();
    });

    row.append(dateSpan, timeSpan, titleSpan, editButton, deleteButton);
    manageEventList.append(row);
  }
}

function navigateToEventFromManage(event) {
  const eventDate = new Date(
    Number(event.date.slice(0, 4)),
    Number(event.date.slice(5, 7)) - 1,
    Number(event.date.slice(8, 10)),
  );

  visibleMonth = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    1,
  );
  renderVisibleMonth();
  openEditEventDialog(event.id, null);
}

function renderManageTags() {
  manageTagList.replaceChildren();
  const calendars = getAllCalendars();
  const events = getEvents();

  if (calendars.length === 0) {
    const empty = document.createElement("p");
    empty.className = "manage-empty";
    empty.textContent = t("manage.empty.tags");
    manageTagList.append(empty);
    return;
  }

  for (const calendar of calendars) {
    const row = document.createElement("div");
    row.className = "manage-tag-row";

    const swatch = document.createElement("span");
    swatch.className = "manage-tag-swatch";
    swatch.style.setProperty("--tag-color", calendar.color);

    const nameSpan = document.createElement("span");
    nameSpan.className = "manage-tag-name";
    nameSpan.textContent = getCalendarDisplayLabel(calendar);

    const count = events.filter(
      (event) => event.calendarId === calendar.id,
    ).length;

    const countSpan = document.createElement("span");
    countSpan.className = "manage-tag-count";
    countSpan.textContent = t("manage.eventCount", { count });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "manage-action-button";
    editButton.textContent = t("manage.edit");
    editButton.addEventListener("click", () => {
      manageDialog.close();
      openEditTagDialog(calendar.id);
    });

    const isBuiltIn = CALENDARS.some((item) => item.id === calendar.id);

    if (isBuiltIn) {
      const hasOverride = hasCalendarOverride(calendar.id);

      if (hasOverride) {
        const resetButton = document.createElement("button");
        resetButton.type = "button";
        resetButton.className = "manage-action-button is-danger";
        resetButton.textContent = t("manage.reset");
        resetButton.addEventListener("click", () => {
          handleResetTag(calendar.id);
        });
        row.append(swatch, nameSpan, countSpan, editButton, resetButton);
      } else {
        const placeholder = document.createElement("span");
        row.append(swatch, nameSpan, countSpan, editButton, placeholder);
      }
    } else {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "manage-action-button is-danger";
      deleteButton.textContent = t("manage.delete");
      deleteButton.addEventListener("click", () => {
        handleDeleteTag(calendar.id);
      });
      row.append(swatch, nameSpan, countSpan, editButton, deleteButton);
    }

    manageTagList.append(row);
  }
}

function changeVisibleMonth(offset) {
  visibleMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + offset,
    1,
  );
  renderVisibleMonth();
}

function handleCalendarWheel(event) {
  if (eventDialog.open || tagDialog.open || aiBatchDialog.open || manageDialog.open || settingsDialog.open) {
    return;
  }

  event.preventDefault();

  if (wheelThrottleTimer) {
    return;
  }

  const direction = event.deltaY > 0 ? 1 : -1;
  changeVisibleMonth(direction);

  wheelThrottleTimer = setTimeout(() => {
    wheelThrottleTimer = null;
  }, 250);
}

function openSettingsDialog() {
  settingsLanguageSelect.value = getCurrentLanguage();

  const isDark =
    document.documentElement.getAttribute("data-theme") === "dark";

  for (const radio of settingsThemeRadios) {
    radio.checked = radio.value === (isDark ? "dark" : "light");
  }

  settingsDialog.showModal();
}

function handleLanguageChange() {
  const lang = settingsLanguageSelect.value;

  if (!setLanguage(lang)) {
    return;
  }

  applyTranslations();
  calendarsById = buildCalendarsById();
  renderCustomTags();
  refreshBuiltInTags();
  renderColorPalette();
  renderVisibleMonth();

  if (manageDialog.open) {
    renderManageEvents();
    renderManageTags();
  }
}

function handleSettingsThemeChange(event) {
  const value = event.target.value;

  if (value === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  updateThemeToggleIcon(value);

  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // ignore storage errors
  }
}

function populateDatePicker() {
  const currentYear = visibleMonth.getFullYear();
  const currentMonth = visibleMonth.getMonth();

  datePickerYear.replaceChildren();

  for (let y = currentYear - 10; y <= currentYear + 10; y++) {
    const option = document.createElement("option");
    option.value = String(y);
    option.textContent = String(y);
    datePickerYear.append(option);
  }

  datePickerYear.value = String(currentYear);

  datePickerMonth.replaceChildren();

  for (let m = 0; m < 12; m++) {
    const option = document.createElement("option");
    option.value = String(m);
    option.textContent = String(m + 1);
    datePickerMonth.append(option);
  }

  datePickerMonth.value = String(currentMonth);

  updateDatePickerDays();
}

function updateDatePickerDays() {
  const year = Number(datePickerYear.value);
  const monthIndex = Number(datePickerMonth.value);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const currentDay = visibleMonth.getDate();

  datePickerDay.replaceChildren();

  for (let d = 1; d <= daysInMonth; d++) {
    const option = document.createElement("option");
    option.value = String(d);
    option.textContent = String(d);
    datePickerDay.append(option);
  }

  datePickerDay.value = String(Math.min(currentDay, daysInMonth));
}

function toggleDatePicker() {
  if (datePickerPopover.hidden) {
    populateDatePicker();
    datePickerPopover.hidden = false;
  } else {
    datePickerPopover.hidden = true;
  }
}

function closeDatePicker() {
  datePickerPopover.hidden = true;
}

function handleDatePickerConfirm() {
  const year = Number(datePickerYear.value);
  const monthIndex = Number(datePickerMonth.value);
  const day = Number(datePickerDay.value);

  visibleMonth = new Date(year, monthIndex, day);
  renderVisibleMonth();
  closeDatePicker();
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
calendarFiltersFieldset.addEventListener("click", (event) => {
  const button = event.target.closest?.(".edit-tag-button");

  if (button) {
    openEditTagDialog(button.dataset.editCalendar);
  }
});
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
themeToggleButton.addEventListener("click", toggleTheme);
eventSearchInput.addEventListener("input", handleSearchInput);
eventSearchInput.addEventListener("focus", handleSearchInput);
document.addEventListener("click", (event) => {
  if (
    !searchResultsPanel.hidden &&
    !searchResultsPanel.contains(event.target) &&
    event.target !== eventSearchInput
  ) {
    closeSearchResults();
  }
});
eventSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSearchResults();
    eventSearchInput.blur();
  }
});
closeAiBatchDialogButton.addEventListener("click", closeBatchDialog);
cancelAiBatchButton.addEventListener("click", closeBatchDialog);
confirmAiBatchButton.addEventListener("click", handleBatchSubmit);
openManageButton.addEventListener("click", openManageDialog);
closeManageDialogButton.addEventListener("click", () => manageDialog.close());
manageTabEventsButton.addEventListener("click", () => switchManageTab("events"));
manageTabTagsButton.addEventListener("click", () => switchManageTab("tags"));
openSettingsButton.addEventListener("click", openSettingsDialog);
closeSettingsDialogButton.addEventListener("click", () => settingsDialog.close());
settingsLanguageSelect.addEventListener("change", handleLanguageChange);
for (const radio of settingsThemeRadios) {
  radio.addEventListener("change", handleSettingsThemeChange);
}
calendarTitleButton.addEventListener("click", toggleDatePicker);
datePickerConfirmButton.addEventListener("click", handleDatePickerConfirm);
datePickerCancelButton.addEventListener("click", closeDatePicker);
datePickerYear.addEventListener("change", updateDatePickerDays);
datePickerMonth.addEventListener("change", updateDatePickerDays);
document.addEventListener("click", (event) => {
  if (
    !datePickerPopover.hidden &&
    !datePickerPopover.contains(event.target) &&
    event.target !== calendarTitleButton &&
    !calendarTitleButton.contains(event.target)
  ) {
    closeDatePicker();
  }
});
calendarWorkspace.addEventListener("wheel", handleCalendarWheel, { passive: false });
miniCalendar.addEventListener("wheel", handleCalendarWheel, { passive: false });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isAiScheduleOpen && !eventDialog.open && !aiBatchDialog.open && !manageDialog.open && !settingsDialog.open) {
    setAiScheduleOpen(false);
  }
  if (event.key === "Escape" && !datePickerPopover.hidden) {
    closeDatePicker();
  }
});
eventDialog.addEventListener("close", () => {
  findReturnFocus()?.focus();
  returnFocus = null;
});

loadLanguage();
applyTranslations();
loadTheme();
seedSampleEventsIfFirstRun();
renderCustomTags();
refreshBuiltInTags();
renderColorPalette();
renderVisibleMonth();
