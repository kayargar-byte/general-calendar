<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { searchEvents } from "../lib/storage.js";

const props = defineProps({
  calendars: { type: Array, required: true },
});
const emit = defineEmits(["select"]);

const rootRef = ref(null);
const inputRef = ref(null);
const query = ref("");
const results = ref([]);
const isOpen = ref(false);
let debounceTimer = null;

function clearResults() {
  results.value = [];
  isOpen.value = false;
}

function performSearch(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";

  if (!trimmed) {
    clearResults();
    return;
  }

  results.value = searchEvents(trimmed);
  isOpen.value = true;
}

function handleInput() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    performSearch(query.value);
  }, 250);
}

function handleSelect(event) {
  clearResults();
  query.value = "";
  emit("select", event);
}

function handleKeydown(event) {
  if (event.key === "Escape") {
    clearResults();
    inputRef.value?.blur();
  }
}

function handleDocumentClick(event) {
  if (rootRef.value && !rootRef.value.contains(event.target)) {
    clearResults();
  }
}

function formatDate(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  return match ? `${match[1]}/${match[2]}/${match[3]}` : dateKey;
}

function calendarColor(calendarId) {
  return props.calendars.find(
    (calendar) => calendar.id === calendarId,
  )?.color;
}

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
});
</script>

<template>
  <div ref="rootRef" class="event-search">
    <input
      ref="inputRef"
      id="event-search"
      class="event-search-input"
      type="text"
      placeholder="搜尋事件"
      aria-label="搜尋事件"
      v-model="query"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    <div
      v-if="isOpen"
      id="search-results"
      class="search-results"
      role="listbox"
    >
      <p v-if="results.length === 0" class="search-result-empty">
        找不到符合的事件。
      </p>
      <button
        v-for="event in results"
        :key="event.id"
        type="button"
        class="search-result-button"
        role="option"
        :style="{ '--result-color': calendarColor(event.calendarId) }"
        @click="handleSelect(event)"
      >
        <span class="search-result-date">{{ formatDate(event.date) }}</span>
        <span class="search-result-time">{{ event.startTime || "全天" }}</span>
        <span class="search-result-title">{{ event.title }}</span>
      </button>
    </div>
  </div>
</template>
