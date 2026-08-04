<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
  visibleMonth: { type: Date, required: true },
});
const emit = defineEmits(["confirm", "close"]);

const rootRef = ref(null);
const year = ref("");
const month = ref("");
const day = ref("");

const currentYear = computed(() => props.visibleMonth.getFullYear());
const yearOptions = computed(() => {
  const base = currentYear.value;

  return Array.from({ length: 21 }, (_, index) => base - 10 + index);
});
const daysInMonth = computed(() => {
  const selectedYear = Number(year.value);
  const selectedMonthIndex = Number(month.value);

  return new Date(selectedYear, selectedMonthIndex + 1, 0).getDate();
});

function updateDays() {
  const currentDay = props.visibleMonth.getDate();
  day.value = String(Math.min(currentDay, daysInMonth.value));
}

function populate() {
  year.value = String(currentYear.value);
  month.value = String(props.visibleMonth.getMonth());
  updateDays();
}

function confirm() {
  emit("confirm", {
    year: Number(year.value),
    monthIndex: Number(month.value),
    day: Number(day.value),
  });
  emit("close");
}

function handleDocumentClick(event) {
  if (rootRef.value && !rootRef.value.contains(event.target)) {
    emit("close");
  }
}

onMounted(() => {
  populate();
  document.addEventListener("click", handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
});
</script>

<template>
  <div ref="rootRef" id="date-picker-popover" class="date-picker-popover">
    <label for="date-picker-year">年</label>
    <select id="date-picker-year" v-model="year" @change="updateDays">
      <option
        v-for="yearOption in yearOptions"
        :key="yearOption"
        :value="String(yearOption)"
      >
        {{ yearOption }}
      </option>
    </select>

    <label for="date-picker-month">月</label>
    <select id="date-picker-month" v-model="month" @change="updateDays">
      <option
        v-for="monthIndex in 12"
        :key="monthIndex"
        :value="String(monthIndex - 1)"
      >
        {{ monthIndex }}月
      </option>
    </select>

    <label for="date-picker-day">日</label>
    <select id="date-picker-day" v-model="day">
      <option
        v-for="dayNumber in daysInMonth"
        :key="dayNumber"
        :value="String(dayNumber)"
      >
        {{ dayNumber }}
      </option>
    </select>

    <div class="date-picker-actions">
      <button type="button" id="date-picker-cancel" @click="emit('close')">
        取消
      </button>
      <button type="button" id="date-picker-confirm" @click="confirm">
        前往
      </button>
    </div>
  </div>
</template>
