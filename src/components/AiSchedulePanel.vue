<script setup>
import { ref } from "vue";

defineProps({
  open: { type: Boolean, required: true },
});
const emit = defineEmits(["close"]);

const aiScheduleInputRef = ref(null);
const aiScheduleDraft = ref("");

defineExpose({
  focusInput() {
    aiScheduleInputRef.value?.focus();
  },
});
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
    <button type="button" id="analyze-ai-schedule">分析日程</button>
  </section>
</template>
