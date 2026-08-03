<script setup>
defineProps({
  days: { type: Array, required: true },
});
const emit = defineEmits(["open-create"]);
</script>

<template>
  <button
    v-for="day in days"
    :key="day.dateKey"
    type="button"
    class="mini-calendar-date"
    :data-date="day.dateKey"
    :class="{
      'is-outside-month': !day.isCurrentMonth,
      'is-today': day.isToday,
    }"
    :aria-current="day.isToday ? 'date' : undefined"
    :aria-label="`新增 ${day.label} 的事件`"
    @click="emit('open-create', day.dateKey)"
  >
    {{ day.dayNumber }}
  </button>
</template>
