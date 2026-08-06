<script setup>
import { ref } from "vue";

const props = defineProps({
  days: { type: Array, required: true },
  calendars: { type: Array, required: true },
  bars: { type: Array, default: () => [] },
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

// 多日事件由跨日長條代表，不重複出現在單日事件列表（見 buildCalendarView 的 bars）。
function singleDayEvents(day) {
  return day.events.filter((event) => !event.endDate);
}

// 被跨日長條覆蓋的日期：日期數字以白字＋陰影浮於長條之上，而非被不透明圓圈遮斷。
// coveredBars 由 buildCalendarView 算出（該格被幾條長條覆蓋）。
function isBarCovered(day) {
  return (day.coveredBars ?? 0) > 0;
}

// 覆蓋格的單日事件下推量：全部長條之下（第 1 條後每多一條多推 21px）。
function coveredExtra(day) {
  return Math.max(0, (day.coveredBars ?? 0) - 1);
}

// 長條定位：欄 = startIndex % 7 + 1，行 = floor(startIndex / 7) + 1。
// 長條為絕對定位（移出 grid flow，避免 auto-placement 避開其整列而把日格推走），
// 以 calc 依容器 7 欄 6 列與 1px gap 計算像素位置（見 .calendar-bar 的 --col-w/--row-h）。
// 長條定位：欄 = startIndex % 7 + 1，行 = floor(startIndex / 7) + 1。
// 車道（lane）決定同一週行內相交長條的垂直偏移（16px 高＋4px 間距）。
// 左右內縮 7px（與格子的 padding 同寬），與單日事件左緣對齊並在欄位邊界留白。
function barStyle(bar) {
  const column = (bar.startIndex % 7) + 1;
  const span = bar.endIndex - bar.startIndex + 1;
  const row = Math.floor(bar.startIndex / 7) + 1;

  return {
    "--event-color": calendarColor(bar.event.calendarId),
    "--bar-top": `calc(37px + ${bar.lane ?? 0} * 20px)`,
    left: `calc(${column - 1} * var(--col-w) + ${column - 1} * 1px + 7px)`,
    top: `calc(${row - 1} * var(--row-h) + ${row - 1} * 1px + var(--bar-top))`,
    width: `calc(${span} * var(--col-w) + ${span - 1} * 1px - 14px)`,
  };
}

// 來源浮窗：以 fixed 定位顯示事件來源，避免被日格 overflow 裁剪（檢視器列為後續）。
// 文檔事件顯示原文引用；搜尋事件顯示來源標題／URL／摘錄（見 docs/adr/0007）。
function sourceText(event) {
  if (event.sourceQuote) {
    return event.sourceQuote;
  }

  if (!event.sourceUrl && !event.sourceTitle && !event.sourceSnippet) {
    return "";
  }

  return [event.sourceTitle, event.sourceUrl, event.sourceSnippet]
    .filter(Boolean)
    .join("\n");
}

function showSource(mouseEvent, calendarEvent) {
  const text = sourceText(calendarEvent);

  if (!text) {
    return;
  }

  const rect = mouseEvent.currentTarget.getBoundingClientRect();
  tooltipStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
  };
  hoveredQuote.value = text;
}

function hideSourceQuote() {
  hoveredQuote.value = "";
}
</script>

<template>
  <div
    v-for="(day, index) in days"
    :key="day.dateKey"
    class="calendar-day"
    :data-date="day.dateKey"
    :data-date-key="day.dateKey"
    role="gridcell"
    :class="{
      'is-outside-month': !day.isCurrentMonth,
      'is-today': day.isToday,
      'is-bar-covered': isBarCovered(day),
    }"
    :style="{ '--covered-extra': coveredExtra(day) }"
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

    <ul v-if="singleDayEvents(day).length > 0" class="event-list">
      <li v-for="event in singleDayEvents(day)" :key="event.id">
        <button
          type="button"
          class="event-summary"
          :data-event-id="event.id"
          :data-calendar-id="event.calendarId"
          :style="{ '--event-color': calendarColor(event.calendarId) }"
          :aria-label="`查看事件：${eventSummary(event)}`"
          @mouseenter="showSource($event, event)"
          @mouseleave="hideSourceQuote"
          @click="emit('open-edit', event.id)"
        >
          {{ eventSummary(event) }}
        </button>
      </li>
    </ul>
  </div>

  <button
    v-for="bar in bars"
    :key="`${bar.event.id}-${bar.startIndex}`"
    type="button"
    class="calendar-bar"
    :style="barStyle(bar)"
    :aria-label="`查看事件：${eventSummary(bar.event)}`"
    @mouseenter="showSource($event, bar.event)"
    @mouseleave="hideSourceQuote"
    @click="emit('open-edit', bar.event.id)"
  >
    {{ eventSummary(bar.event) }}
  </button>

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
