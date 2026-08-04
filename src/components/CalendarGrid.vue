<script setup>
const props = defineProps({
  days: { type: Array, required: true },
  calendars: { type: Array, required: true },
});
const emit = defineEmits(["open-create", "open-edit"]);

function eventSummary(event) {
  return event.startTime ? `${event.startTime} ${event.title}` : event.title;
}

function calendarColor(calendarId) {
  return props.calendars.find(
    (calendar) => calendar.id === calendarId,
  )?.color;
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
          @click="emit('open-edit', event.id)"
        >
          {{ eventSummary(event) }}
        </button>
      </li>
    </ul>
  </div>
</template>
