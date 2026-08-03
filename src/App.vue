<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useCalendar } from "./composables/useCalendar.js";
import CalendarGrid from "./components/CalendarGrid.vue";
import MiniCalendar from "./components/MiniCalendar.vue";
import CalendarFilters from "./components/CalendarFilters.vue";
import EventDialog from "./components/EventDialog.vue";
import AiSchedulePanel from "./components/AiSchedulePanel.vue";

const {
  monthTitle,
  isAiScheduleOpen,
  visibleCalendarIds,
  days,
  changeMonth,
  goToday,
  toggleCalendar,
  toggleAiSchedule,
  openCreateEventDialog,
  openEditEventDialog,
  editingEventId,
  isEventDialogOpen,
  pendingDate,
  handleEventSaved,
  handleEventDeleted,
  handleDialogClosed,
} = useCalendar();

const aiScheduleLauncherRef = ref(null);
const aiSchedulePanelRef = ref(null);

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

onMounted(() => document.addEventListener("keydown", handleKeydown));
onUnmounted(() => document.removeEventListener("keydown", handleKeydown));
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
          :visible-calendar-ids="visibleCalendarIds"
          @toggle="toggleCalendar"
        />
      </div>

      <AiSchedulePanel
        ref="aiSchedulePanelRef"
        :open="isAiScheduleOpen"
        @close="toggleAiSchedule"
      />
    </aside>

    <main class="calendar-workspace">
      <section class="calendar" aria-labelledby="calendar-title">
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
            @open-create="openCreateEventDialog"
            @open-edit="openEditEventDialog"
          />
        </div>
      </section>

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
    @saved="handleEventSaved"
    @deleted="handleEventDeleted"
    @closed="handleDialogClosed"
  />
</template>
