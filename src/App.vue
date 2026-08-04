<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useCalendar } from "./composables/useCalendar.js";
import CalendarGrid from "./components/CalendarGrid.vue";
import MiniCalendar from "./components/MiniCalendar.vue";
import CalendarFilters from "./components/CalendarFilters.vue";
import EventDialog from "./components/EventDialog.vue";
import AiSchedulePanel from "./components/AiSchedulePanel.vue";

const {
  monthTitle,
  isAiScheduleOpen,
  calendars,
  visibleCalendarIds,
  days,
  changeMonth,
  goToday,
  toggleCalendar,
  addCalendar,
  removeCalendar,
  reorderCalendars,
  toggleAiSchedule,
  openCreateEventDialog,
  openEditEventDialog,
  editingEventId,
  isEventDialogOpen,
  pendingDate,
  slideDirection,
  handleEventSaved,
  handleEventDeleted,
  handleDialogClosed,
} = useCalendar();

const aiScheduleLauncherRef = ref(null);
const aiSchedulePanelRef = ref(null);
const calendarWorkspaceRef = ref(null);

const monthTransitionName = computed(() =>
  slideDirection.value === "prev" ? "month-slide-prev" : "month-slide-next",
);

let wheelAccumulator = 0;
let lastWheelSwitchAt = 0;
const WHEEL_SWITCH_THRESHOLD = 60;
const WHEEL_SWITCH_COOLDOWN = 180;

function handleWheel(event) {
  if (isEventDialogOpen.value) {
    return;
  }

  const workspace = calendarWorkspaceRef.value;

  if (!workspace) {
    return;
  }

  const scrollable = workspace.scrollHeight - workspace.clientHeight > 1;

  if (scrollable) {
    const atTop = workspace.scrollTop <= 0;
    const atBottom =
      workspace.scrollTop + workspace.clientHeight >=
      workspace.scrollHeight - 1;

    if (event.deltaY < 0 && !atTop) {
      return;
    }

    if (event.deltaY > 0 && !atBottom) {
      return;
    }
  }

  event.preventDefault();

  const now = performance.now();

  if (now - lastWheelSwitchAt < WHEEL_SWITCH_COOLDOWN) {
    return;
  }

  wheelAccumulator += event.deltaY;

  if (Math.abs(wheelAccumulator) < WHEEL_SWITCH_THRESHOLD) {
    return;
  }

  changeMonth(wheelAccumulator > 0 ? 1 : -1);
  wheelAccumulator = 0;
  lastWheelSwitchAt = now;
}

watch(isAiScheduleOpen, (isOpen) => {
  nextTick(() => {
    if (isOpen) {
      aiSchedulePanelRef.value?.focusInput();
    } else {
      aiScheduleLauncherRef.value?.focus();
    }
  });
});

function handleKeydown(event) {
  if (
    event.key === "Escape" &&
    isAiScheduleOpen.value &&
    !isEventDialogOpen.value
  ) {
    toggleAiSchedule();
  }
}

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
  calendarWorkspaceRef.value?.addEventListener("wheel", handleWheel, {
    passive: false,
  });
});
onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
  calendarWorkspaceRef.value?.removeEventListener("wheel", handleWheel);
});
</script>

<template>
  <header class="calendar-toolbar">
    <h1>我的日曆</h1>

    <button type="button" id="create-event">
      <span aria-hidden="true">＋</span>
      新增事件
    </button>

    <div class="month-controls" role="group" aria-label="月份導覽">
      <button type="button" id="previous-month" aria-label="上個月" @click="changeMonth(-1)">
        <span aria-hidden="true">‹</span>
      </button>
      <button type="button" id="today" @click="goToday">今天</button>
      <button type="button" id="next-month" aria-label="下個月" @click="changeMonth(1)">
        <span aria-hidden="true">›</span>
      </button>
    </div>
  </header>

  <div
    class="calendar-layout"
    :class="{ 'is-ai-schedule-open': isAiScheduleOpen }"
  >
    <aside class="calendar-sidebar" aria-labelledby="calendar-sidebar-title">
      <div class="calendar-sidebar-content">
        <h2 id="calendar-sidebar-title">日曆導覽</h2>

        <section class="mini-calendar-panel" aria-labelledby="mini-calendar-title">
          <h3 id="mini-calendar-title">迷你月曆</h3>
          <div id="mini-calendar" aria-live="polite">
            <MiniCalendar :days="days" @open-create="openCreateEventDialog" />
          </div>
        </section>

        <CalendarFilters
          :calendars="calendars"
          :visible-calendar-ids="visibleCalendarIds"
          @toggle="toggleCalendar"
          @add-tag="addCalendar"
          @remove-tag="removeCalendar"
          @reorder-tags="reorderCalendars"
        />
      </div>

      <AiSchedulePanel
        ref="aiSchedulePanelRef"
        :open="isAiScheduleOpen"
        @close="toggleAiSchedule"
      />
    </aside>

    <main class="calendar-workspace" ref="calendarWorkspaceRef">
      <Transition :name="monthTransitionName" mode="out-in">
        <section class="calendar" :key="monthTitle" aria-labelledby="calendar-title">
          <h2 id="calendar-title">{{ monthTitle }}</h2>
          <div class="weekdays" aria-hidden="true">
            <span>一</span>
            <span>二</span>
            <span>三</span>
            <span>四</span>
            <span>五</span>
            <span>六</span>
            <span>日</span>
          </div>
          <div
            id="calendar-grid"
            class="calendar-grid"
            role="grid"
            aria-live="polite"
          >
            <CalendarGrid
              :days="days"
              :calendars="calendars"
              @open-create="openCreateEventDialog"
              @open-edit="openEditEventDialog"
            />
          </div>
        </section>
      </Transition>

      <button
        type="button"
        id="ai-schedule-launcher"
        ref="aiScheduleLauncherRef"
        aria-controls="ai-schedule-panel"
        :aria-expanded="String(isAiScheduleOpen)"
        @click="toggleAiSchedule"
      >
        <span class="ai-launcher-mark" aria-hidden="true">AI</span>
        <span>輸入日程</span>
      </button>
    </main>
  </div>

  <EventDialog
    :open="isEventDialogOpen"
    :editing-event-id="editingEventId"
    :pending-date="pendingDate"
    :calendars="calendars"
    @saved="handleEventSaved"
    @deleted="handleEventDeleted"
    @closed="handleDialogClosed"
  />
</template>
