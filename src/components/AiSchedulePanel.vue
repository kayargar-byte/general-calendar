<script setup>
import { ref } from "vue";
import { askAi } from "../lib/ai.js";
import {
  markSearchEntryAdopted,
  recordSearchEntry,
} from "../lib/user-profile.js";
import AiCandidateList from "./AiCandidateList.vue";
import AiClarifyOptions from "./AiClarifyOptions.vue";

const props = defineProps({
  open: { type: Boolean, required: true },
  calendars: { type: Array, required: true },
});
const emit = defineEmits(["close", "confirm-event", "confirm-events"]);

const aiScheduleInputRef = ref(null);
const aiScheduleDraft = ref("");
const isAnalyzing = ref(false);
const aiScheduleError = ref("");
const conversation = ref([]);
const clarifyState = ref(null);
const candidates = ref([]);
const recommendations = ref([]);
const emptyMessage = ref("");
// 目前正在分析的查詢，供採納時標記 adopted（見計劃 Step 6）。
const pendingQuery = ref("");

defineExpose({
  focusInput() {
    aiScheduleInputRef.value?.focus();
  },
});

function clearError() {
  aiScheduleError.value = "";
}

// 依 AI 判別式回應分流：澄清請求／候選確認／直接入曆／無結果（見 docs/adr/0007）。
function routeResult(result) {
  if (result.type === "clarify") {
    clarifyState.value = result;
    recommendations.value = [];
    return;
  }

  // 推薦 chips 伴隨候選／空結果顯示；單一／多事件直接入曆時面板關閉，無從顯示。
  recommendations.value = result.recommendations ?? [];

  if (result.candidates.length > 0) {
    candidates.value = result.candidates;
    return;
  }

  if (result.events.length === 1) {
    markSearchEntryAdopted(pendingQuery.value);
    resetSession();
    emit("confirm-event", result.events[0]);
    return;
  }

  if (result.events.length > 1) {
    markSearchEntryAdopted(pendingQuery.value);
    resetSession();
    emit("confirm-events", result.events);
    return;
  }

  emptyMessage.value = result.explanation || "找不到可排程內容";
}

function resetSession() {
  conversation.value = [];
  clarifyState.value = null;
  candidates.value = [];
  recommendations.value = [];
  emptyMessage.value = "";
}

async function handleAnalyze() {
  clearError();
  resetSession();
  pendingQuery.value = aiScheduleDraft.value;

  // 記錄本次查詢，供畫像統計近期搜索主題；採納時再標記 adopted。
  if (pendingQuery.value.trim()) {
    recordSearchEntry({ query: pendingQuery.value });
  }

  isAnalyzing.value = true;

  try {
    const result = await askAi(aiScheduleDraft.value, props.calendars);
    routeResult(result);
  } catch (error) {
    aiScheduleError.value =
      error instanceof Error ? error.message : "無法分析日程。";
  } finally {
    isAnalyzing.value = false;
  }
}

// 澄清請求續輪：把模型上一回合的澄清回應與用戶選擇寫入歷史，再續問（可多步追問）。
// askAi 會把 text 追加為最後一條 user 訊息，故 context 只給歷史（不含剛寫入的選擇），避免重複。
async function selectOption(option) {
  clearError();
  isAnalyzing.value = true;

  try {
    const selectionNote = `已選選項：${option.label}`;
    // 澄清選項視為對原查詢意圖的採納；續輪查詢另記一筆。
    markSearchEntryAdopted(pendingQuery.value);
    recordSearchEntry({ query: selectionNote });
    pendingQuery.value = selectionNote;
    conversation.value = [
      ...conversation.value,
      { role: "assistant", content: JSON.stringify(clarifyState.value) },
      { role: "user", content: selectionNote },
    ];
    clarifyState.value = null;

    const result = await askAi(selectionNote, props.calendars, {
      contextMessages: conversation.value.slice(0, -1),
    });
    routeResult(result);
  } catch (error) {
    aiScheduleError.value =
      error instanceof Error ? error.message : "無法分析日程。";
  } finally {
    isAnalyzing.value = false;
  }
}

function confirmCandidate(candidate) {
  markSearchEntryAdopted(pendingQuery.value);
  resetSession();
  emit("confirm-event", candidate);
}

// 點擊推薦主題：填入輸入框並立即追問（見 docs/adr/0007）。
function handleRecommendationClick(topic) {
  aiScheduleDraft.value = topic;
  handleAnalyze();
  // handleAnalyze 在首個 await 前同步記錄查詢，此處立即標記該主題為已採納。
  markSearchEntryAdopted(topic);
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
      placeholder="例如：下週三下午三時看醫生，或查詢澳門美食節幾時"
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

    <AiClarifyOptions
      v-if="clarifyState"
      :question="clarifyState.question"
      :options="clarifyState.options"
      @select="selectOption"
    />

    <AiCandidateList
      v-if="candidates.length > 0"
      :candidates="candidates"
      :calendars="props.calendars"
      @confirm="confirmCandidate"
    />

    <p
      v-if="emptyMessage"
      id="ai-schedule-empty"
      class="ai-schedule-empty"
      role="status"
    >
      {{ emptyMessage }}
    </p>

    <div
      v-if="recommendations.length > 0"
      id="ai-recommendations"
      class="ai-recommendations"
    >
      <p class="ai-recommendations-title">你可能也想查</p>
      <div class="ai-recommendation-chips">
        <button
          v-for="(recommendation, index) in recommendations"
          :key="index"
          type="button"
          class="ai-recommendation-chip"
          :title="recommendation.reason || undefined"
          @click="handleRecommendationClick(recommendation.topic)"
        >
          {{ recommendation.topic }}
        </button>
      </div>
    </div>

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
