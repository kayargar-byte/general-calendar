import { computed, nextTick, ref } from "vue";
import { formatMonthTitle } from "../lib/date-utils.js";
import { buildCalendarView } from "../lib/buildCalendarView.js";
import {
  createCalendar,
  deleteCalendar,
  getCalendars,
  saveCalendars,
  updateCalendar,
} from "../lib/calendar-catalog.js";
import { createEvent, getEvents, reassignEventsCalendar } from "../lib/storage.js";

export function useCalendar() {
  const today = new Date();
  const visibleMonth = ref(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const editingEventId = ref(null);
  const isAiScheduleOpen = ref(false);
  const isEventDialogOpen = ref(false);
  const pendingDate = ref("");
  const eventsVersion = ref(0);
  const returnFocus = ref(null);
  const slideDirection = ref("next");
  const isBatchDialogOpen = ref(false);
  const pendingBatchEvents = ref([]);
  const aiPrefill = ref(null);

  const calendars = ref(getCalendars());
  const visibleCalendarIds = ref(
    new Set(calendars.value.map((calendar) => calendar.id)),
  );

  function toggleCalendar(id, checked) {
    const next = new Set(visibleCalendarIds.value);

    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }

    visibleCalendarIds.value = next;
  }

  function addCalendar(label) {
    const calendar = createCalendar(label);
    calendars.value = getCalendars();

    if (!visibleCalendarIds.value.has(calendar.id)) {
      visibleCalendarIds.value = new Set([
        ...visibleCalendarIds.value,
        calendar.id,
      ]);
    }
  }

  function removeCalendar(id) {
    if (calendars.value.length <= 1) {
      return false;
    }

    const hasEvents = getEvents().some(
      (event) => event.calendarId === id,
    );

    if (hasEvents) {
      const fallback =
        calendars.value.find((calendar) => calendar.id === "other") ??
        calendars.value.find((calendar) => calendar.id !== id);
      reassignEventsCalendar(id, fallback.id);
    }

    deleteCalendar(id);
    calendars.value = getCalendars();

    if (visibleCalendarIds.value.has(id)) {
      const next = new Set(visibleCalendarIds.value);
      next.delete(id);
      visibleCalendarIds.value = next;
    }

    eventsVersion.value++;
    return true;
  }

  function updateCalendarTag(id, label, color) {
    updateCalendar(id, label, color);
    calendars.value = getCalendars();
  }

  function reorderCalendars(fromId, toId) {
    const fromIndex = calendars.value.findIndex(
      (calendar) => calendar.id === fromId,
    );
    const toIndex = calendars.value.findIndex(
      (calendar) => calendar.id === toId,
    );

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }

    const next = [...calendars.value];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    calendars.value = next;
    saveCalendars(next);
  }

  const monthTitle = computed(() =>
    formatMonthTitle(
      visibleMonth.value.getFullYear(),
      visibleMonth.value.getMonth(),
    ),
  );

  const days = computed(() => {
    eventsVersion.value;
    return buildCalendarView(
      visibleMonth.value.getFullYear(),
      visibleMonth.value.getMonth(),
      getEvents(),
      new Date(),
      visibleCalendarIds.value,
    );
  });

  function changeMonth(offset) {
    slideDirection.value = offset > 0 ? "next" : "prev";
    visibleMonth.value = new Date(
      visibleMonth.value.getFullYear(),
      visibleMonth.value.getMonth() + offset,
      1,
    );
  }

  function goToday() {
    const todayDate = new Date();
    const targetMonth = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      1,
    );

    if (targetMonth.getTime() === visibleMonth.value.getTime()) {
      return;
    }

    slideDirection.value =
      targetMonth > visibleMonth.value ? "next" : "prev";
    visibleMonth.value = targetMonth;
  }

  function goToDate(year, monthIndex) {
    const target = new Date(year, monthIndex, 1);
    slideDirection.value = target > visibleMonth.value ? "next" : "prev";
    visibleMonth.value = target;
  }

  function refreshEvents() {
    eventsVersion.value++;
  }

  function toggleAiSchedule() {
    isAiScheduleOpen.value = !isAiScheduleOpen.value;
  }

  function openCreateEventDialog(dateKey) {
    editingEventId.value = null;
    aiPrefill.value = null;
    pendingDate.value = dateKey;
    returnFocus.value = {
      type: "date",
      value: dateKey,
      fallbackDate: dateKey,
    };
    isEventDialogOpen.value = true;
  }

  function openEditEventDialog(eventId) {
    const event = getEvents().find(
      (storedEvent) => storedEvent.id === eventId,
    );

    if (!event) {
      return;
    }

    editingEventId.value = event.id;
    aiPrefill.value = null;
    returnFocus.value = {
      type: "event",
      value: event.id,
      fallbackDate: event.date,
    };
    isEventDialogOpen.value = true;
  }

  function navigateToEvent(event) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(event.date);

    if (!match) {
      return;
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const target = new Date(year, monthIndex, 1);
    slideDirection.value = target > visibleMonth.value ? "next" : "prev";
    visibleMonth.value = target;
    openEditEventDialog(event.id);
  }

  function openCreateEventFromAi(event) {
    editingEventId.value = null;
    aiPrefill.value = event;
    pendingDate.value = event.date;
    returnFocus.value = {
      type: "date",
      value: event.date,
      fallbackDate: event.date,
    };
    isEventDialogOpen.value = true;
  }

  function handleAiParsed(events) {
    isAiScheduleOpen.value = false;

    if (events.length === 1) {
      openCreateEventFromAi(events[0]);
      return;
    }

    pendingBatchEvents.value = events;
    isBatchDialogOpen.value = true;
  }

  function handleBatchConfirm() {
    for (const event of pendingBatchEvents.value) {
      try {
        createEvent(event);
      } catch {}
    }

    isBatchDialogOpen.value = false;
    pendingBatchEvents.value = [];
    eventsVersion.value++;
  }

  function handleBatchClose() {
    isBatchDialogOpen.value = false;
    pendingBatchEvents.value = [];
  }

  function handleEventSaved() {
    eventsVersion.value++;
    isEventDialogOpen.value = false;
  }

  function handleEventDeleted(date) {
    if (returnFocus.value) {
      returnFocus.value = {
        ...returnFocus.value,
        type: "date",
        value: date,
      };
    }

    eventsVersion.value++;
    isEventDialogOpen.value = false;
  }

  function handleDialogClosed() {
    isEventDialogOpen.value = false;
    aiPrefill.value = null;
    restoreFocus();
  }

  function restoreFocus() {
    const current = returnFocus.value;
    returnFocus.value = null;

    if (!current) {
      return;
    }

    nextTick(() => {
      const selector =
        current.type === "event" ? "[data-event-id]" : "button[data-date]";
      const dataKey = current.type === "event" ? "eventId" : "date";
      const matchingElement = [...document.querySelectorAll(selector)].find(
        (element) => element.dataset[dataKey] === current.value,
      );

      if (matchingElement) {
        matchingElement.focus();
        return;
      }

      [...document.querySelectorAll("button[data-date]")].find(
        (element) => element.dataset.date === current.fallbackDate,
      )?.focus();
    });
  }

  return {
    visibleMonth,
    editingEventId,
    isAiScheduleOpen,
    isEventDialogOpen,
    pendingDate,
    aiPrefill,
    isBatchDialogOpen,
    pendingBatchEvents,
    calendars,
    visibleCalendarIds,
    slideDirection,
    monthTitle,
    days,
    changeMonth,
    goToday,
    goToDate,
    refreshEvents,
    toggleCalendar,
    addCalendar,
    removeCalendar,
    updateCalendarTag,
    reorderCalendars,
    toggleAiSchedule,
    handleAiParsed,
    handleBatchConfirm,
    handleBatchClose,
    openCreateEventDialog,
    openEditEventDialog,
    navigateToEvent,
    handleEventSaved,
    handleEventDeleted,
    handleDialogClosed,
  };
}
