<script setup>
import { ref } from "vue";

const props = defineProps({
  days: { type: Array, required: true },
  calendars: { type: Array, required: true },
});
const emit = defineEmits(["open-create", "open-edit"]);

const hoveredQuote = ref("");
const tooltipStyle = ref({});

function eventSummary(event) {
  return event.startTime ? `${event.startTime} ${event.title}` : event.title;
}

function calendarColor(calendarId) {
  return props.calendars.find(
    (calendar) => calendar.id === calendarId,
  )?.color;
}

// 來源浮窗：以 fixed 定位顯示原文引用，避免被日格 overflow 裁剪（檢視器列為後續）。
function showSourceQuote(event, sourceQuote) {
  if (!sourceQuote) {
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  tooltipStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
  };
  hoveredQuote.value = sourceQuote;
}

function hideSourceQuote() {
  hoveredQuote.value = "";
}
</script>

<template>
  <div
    v-for="day in days"
    :key="day.dateKey"
    class="calendar-day"
    :data-date="day.dateKey"
    role="gridcell"
    :class="{
      'is-outside-month': !day.isCurrentMonth,
      'is-today': day.isToday,
    }"
  >
    <button
      type="button"
      class="calendar-date"
      :data-date="day.dateKey"
      :aria-label="`新增 ${day.label} 的事件`"
      @click="emit('open-create', day.dateKey)"
    >
      {{ day.dayNumber }}
    </button>

    <ul v-if="day.events.length > 0" class="event-list">
      <li v-for="event in day.events" :key="event.id">
        <button
          type="button"
          class="event-summary"
          :data-event-id="event.id"
          :data-calendar-id="event.calendarId"
          :style="{ '--event-color': calendarColor(event.calendarId) }"
          :aria-label="`查看事件：${eventSummary(event)}`"
          @mouseenter="showSourceQuote($event, event.sourceQuote)"
          @mouseleave="hideSourceQuote"
          @click="emit('open-edit', event.id)"
        >
          {{ eventSummary(event) }}
        </button>
      </li>
    </ul>
  </div>

  <div
    v-if="hoveredQuote"
    id="event-source-tooltip"
    class="event-source-tooltip"
    role="tooltip"
    :style="tooltipStyle"
  >
    {{ hoveredQuote }}
  </div>
</template>
