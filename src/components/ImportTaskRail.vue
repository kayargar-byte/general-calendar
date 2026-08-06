<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  queuedCount: { type: Number, default: 0 },
  overflowCount: { type: Number, default: 0 },
});

const emit = defineEmits(["retry", "dismiss"]);
const now = ref(Date.now());
const taskElements = new Map();
let timer = null;

const displayedTasks = computed(() => props.tasks.slice(0, 3));

function fileIconType(task) {
  const mimeType = task.mimeType ?? "";
  const name = task.docName?.toLowerCase() ?? "";

  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mimeType.includes("word") ||
    mimeType.includes("msword") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  ) return "word";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsx")
  ) return "excel";
  if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/.test(name)) {
    return "image";
  }

  return "file";
}

function elapsedSeconds(task) {
  const startedAt = Date.parse(task.startedAt || task.createdAt || "");
  const endedAt = task.completedAt ? Date.parse(task.completedAt) : now.value;
  return Number.isNaN(startedAt)
    ? 0
    : Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}

function statusLabel(status) {
  return (
    {
      ANALYZING: "分析中",
      COMPLETED: "已完成",
      FAILED: "失敗",
    }[status] ?? status
  );
}

function setTaskElement(id, element) {
  if (element) {
    taskElements.set(id, element);
  } else {
    taskElements.delete(id);
  }
}

function getTaskRect(id) {
  return taskElements.get(id)?.getBoundingClientRect() ?? null;
}

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer !== null) {
    window.clearInterval(timer);
  }
});

defineExpose({ getTaskRect });
</script>

<template>
  <section
    v-if="displayedTasks.length || queuedCount || overflowCount"
    class="import-task-rail"
    role="status"
    aria-label="文件分析進度"
  >
    <ul v-if="displayedTasks.length" class="import-task-list">
      <li
        v-for="task in displayedTasks"
        :key="task.id"
        :ref="(element) => setTaskElement(task.id, element)"
        class="import-task-item"
        :class="`is-${task.status.toLowerCase()}`"
        :data-task-id="task.id"
        role="listitem"
      >
        <span
          class="import-task-icon"
          :class="`is-${fileIconType(task)}`"
          :data-file-icon="fileIconType(task)"
          aria-hidden="true"
        >
          {{ fileIconType(task).toUpperCase() }}
        </span>
        <span class="import-task-details">
          <span class="import-task-name" :title="task.docName">{{ task.docName }}</span>
          <span class="import-task-meta">
            {{ statusLabel(task.status) }} {{ elapsedSeconds(task) }} &#x79d2;
            <template v-if="task.status === 'FAILED' && task.error">
              &middot;
              <span
                class="import-task-error"
                :title="task.error"
                data-task-error
              >{{ task.error }}</span>
            </template>
          </span>
        </span>
        <span v-if="task.status === 'FAILED'" class="import-task-actions">
          <button
            type="button"
            class="import-task-action"
            :aria-label="`重試 ${task.docName}`"
            @click="emit('retry', task.id)"
          >
            <span aria-hidden="true">&#x21bb;</span>
          </button>
          <button
            type="button"
            class="import-task-action"
            :aria-label="`關閉 ${task.docName}`"
            @click="emit('dismiss', task.id)"
          >
            <span aria-hidden="true">&#xd7;</span>
          </button>
        </span>
      </li>
    </ul>
    <span v-if="queuedCount" class="import-task-queued">
      &#x53e6;&#x6709; {{ queuedCount }} &#x4efd;&#x7b49;&#x5019;&#x4e2d;
    </span>
    <span v-if="overflowCount" class="import-task-queued">
      &#x53e6;&#x6709; {{ overflowCount }} &#x4efd;&#x5f85;&#x8655;&#x7406;
    </span>
  </section>
</template>
