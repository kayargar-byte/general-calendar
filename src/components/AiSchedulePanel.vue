<script setup>
import { ref } from "vue";
import { parseSchedule } from "../lib/ai.js";

const props = defineProps({
  open: { type: Boolean, required: true },
  calendars: { type: Array, required: true },
});
const emit = defineEmits(["close", "parsed"]);

const aiScheduleInputRef = ref(null);
const aiScheduleDraft = ref("");
const isAnalyzing = ref(false);
const aiScheduleError = ref("");

defineExpose({
  focusInput() {
    aiScheduleInputRef.value?.focus();
  },
});

function clearError() {
  aiScheduleError.value = "";
}

async function handleAnalyze() {
  clearError();
  isAnalyzing.value = true;

  try {
    const events = await parseSchedule(
      aiScheduleDraft.value,
      props.calendars,
    );
    emit("parsed", events);
  } catch (error) {
    aiScheduleError.value =
      error instanceof Error ? error.message : "無法分析日程。";
  } finally {
    isAnalyzing.value = false;
  }
}
</script>

<template>
  <section
    id="ai-schedule-panel"
    class="ai-schedule-panel"
    aria-labelledby="ai-schedule-title"
    :aria-hidden="String(!open)"
  >
    <header class="ai-schedule-header">
      <h2 id="ai-schedule-title">AI 輸入日程</h2>
      <button
        type="button"
        id="close-ai-schedule"
        aria-label="收合 AI 輸入日程"
        @click="emit('close')"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>

    <label for="ai-schedule-input">描述日程</label>
    <textarea
      ref="aiScheduleInputRef"
      id="ai-schedule-input"
      rows="7"
      placeholder="例如：下週三下午三時看醫生"
      v-model="aiScheduleDraft"
    ></textarea>
    <p
      v-if="aiScheduleError"
      id="ai-schedule-error"
      class="ai-schedule-error"
      role="alert"
    >
      {{ aiScheduleError }}
    </p>
    <button
      type="button"
      id="analyze-ai-schedule"
      :disabled="isAnalyzing"
      @click="handleAnalyze"
    >
      {{ isAnalyzing ? "分析中…" : "分析日程" }}
    </button>
  </section>
</template>
