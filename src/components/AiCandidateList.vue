<script setup>
import { getCalendars } from "../lib/calendar-catalog.js";

const props = defineProps({
  candidates: { type: Array, required: true },
  calendars: { type: Array, default: () => getCalendars() },
});
const emit = defineEmits(["confirm"]);

function hostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// 候選的日曆分類色標：id 不在清單時回落「未分類」與默認色。
function calendarLabel(calendarId) {
  return props.calendars.find((calendar) => calendar.id === calendarId)?.label;
}

function calendarColor(calendarId) {
  return props.calendars.find((calendar) => calendar.id === calendarId)?.color;
}
</script>

<template>
  <div class="ai-candidates">
    <p class="ai-candidates-title">搜尋到多個候選，請選擇要採用的來源：</p>
    <ul class="ai-candidate-list">
      <li
        v-for="(candidate, index) in candidates"
        :key="index"
        class="ai-candidate-item"
        :style="{ '--candidate-color': calendarColor(candidate.calendarId) }"
      >
        <div class="ai-candidate-main">
          <span class="ai-candidate-date">{{ candidate.date }}</span>
          <span class="ai-candidate-title">{{ candidate.title }}</span>
          <span class="ai-candidate-calendar">
            <span class="ai-candidate-calendar-dot" aria-hidden="true"></span>
            {{ calendarLabel(candidate.calendarId) || "未分類" }}
          </span>
        </div>
        <p class="ai-candidate-source">
          <span class="ai-candidate-source-name">
            {{ candidate.sourceTitle || hostname(candidate.sourceUrl) }}
          </span>
          <span
            v-if="candidate.sourceSnippet"
            class="ai-candidate-source-snippet"
          >
            {{ candidate.sourceSnippet }}
          </span>
        </p>
        <button
          type="button"
          class="ai-candidate-confirm"
          @click="emit('confirm', candidate)"
        >
          採用此來源
        </button>
      </li>
    </ul>
  </div>
</template>
