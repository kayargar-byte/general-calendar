<script setup>
import { CALENDARS } from "../lib/calendar-catalog.js";

defineProps({
  visibleCalendarIds: { type: Set, required: true },
});
const emit = defineEmits(["toggle"]);
</script>

<template>
  <fieldset id="calendar-filters">
    <legend>我的日曆</legend>

    <label v-for="calendar in CALENDARS" :key="calendar.id">
      <input
        type="checkbox"
        :value="calendar.id"
        :checked="visibleCalendarIds.has(calendar.id)"
        @change="emit('toggle', calendar.id, $event.target.checked)"
      />
      <span
        class="calendar-color"
        :data-color="calendar.color"
        aria-hidden="true"
      ></span>
      {{ calendar.label }}
    </label>
  </fieldset>
</template>
