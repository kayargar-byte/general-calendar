<script setup>
import { onMounted, ref, watch } from "vue";
import { getCalendars } from "../lib/calendar-catalog.js";

const props = defineProps({
  open: { type: Boolean, required: true },
  events: { type: Array, required: true },
  calendars: { type: Array, default: () => getCalendars() },
});
const emit = defineEmits(["confirm", "close"]);

const dialogRef = ref(null);

function showDialog() {
  if (dialogRef.value && !dialogRef.value.open) {
    dialogRef.value.showModal();
  }
}

function closeDialog() {
  if (dialogRef.value?.open) {
    dialogRef.value.close();
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      showDialog();
    } else {
      closeDialog();
    }
  },
);

onMounted(() => {
  if (props.open) {
    showDialog();
  }
});

function formatDate(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  return match ? `${match[1]}/${match[2]}/${match[3]}` : dateKey;
}

function calendarLabel(calendarId) {
  return props.calendars.find(
    (calendar) => calendar.id === calendarId,
  )?.label;
}

function calendarColor(calendarId) {
  return props.calendars.find(
    (calendar) => calendar.id === calendarId,
  )?.color;
}
</script>

<template>
  <dialog
    ref="dialogRef"
    id="ai-batch-dialog"
    aria-labelledby="ai-batch-title"
    @close="emit('close')"
  >
    <header class="dialog-header">
      <h2 id="ai-batch-title">AI 日程確認</h2>
      <button
        type="button"
        id="close-ai-batch"
        aria-label="關閉"
        @click="closeDialog"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>

    <ul id="ai-batch-list" class="ai-batch-list">
      <li
        v-for="(event, index) in events"
        :key="index"
        class="ai-batch-item"
        :style="{ '--batch-color': calendarColor(event.calendarId) }"
      >
        <span class="ai-batch-date">{{ formatDate(event.date) }}</span>
        <span class="ai-batch-time">{{ event.startTime || "全天" }}</span>
        <span class="ai-batch-title">{{ event.title }}</span>
        <span class="ai-batch-calendar">{{ calendarLabel(event.calendarId) }}</span>
      </li>
    </ul>

    <footer class="dialog-actions">
      <div></div>
      <div>
        <button type="button" id="cancel-ai-batch" @click="closeDialog">
          取消
        </button>
        <button type="button" id="confirm-ai-batch" @click="emit('confirm')">
          新增
        </button>
      </div>
    </footer>
  </dialog>
</template>
