import { computed, nextTick, ref } from "vue";
import { formatMonthTitle } from "../lib/date-utils.js";
import { buildCalendarView } from "../lib/buildCalendarView.js";
import { CALENDARS } from "../lib/calendar-catalog.js";
import { getEvents } from "../lib/storage.js";

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

  const visibleCalendarIds = ref(
    new Set(CALENDARS.map((calendar) => calendar.id)),
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
    visibleMonth.value = new Date(
      visibleMonth.value.getFullYear(),
      visibleMonth.value.getMonth() + offset,
      1,
    );
  }

  function goToday() {
    const todayDate = new Date();
    visibleMonth.value = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      1,
    );
  }

  function toggleAiSchedule() {
    isAiScheduleOpen.value = !isAiScheduleOpen.value;
  }

  function openCreateEventDialog(dateKey) {
    editingEventId.value = null;
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
    returnFocus.value = {
      type: "event",
      value: event.id,
      fallbackDate: event.date,
    };
    isEventDialogOpen.value = true;
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
    visibleCalendarIds,
    monthTitle,
    days,
    changeMonth,
    goToday,
    toggleCalendar,
    toggleAiSchedule,
    openCreateEventDialog,
    openEditEventDialog,
    handleEventSaved,
    handleEventDeleted,
    handleDialogClosed,
  };
}
