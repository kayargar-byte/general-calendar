import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  ackImport,
  listImports,
  retryImport,
  submitImport,
} from "../lib/import-tasks.js";
import { buildProfile, profileToText } from "../lib/user-profile.js";

const DEFAULT_POLL_INTERVAL_MS = 500;
const LOCAL_INGEST_FAILURE = "\u532f\u5165\u5931\u6557\uff0c\u8acb\u91cd\u8a66\u3002";

const defaultApi = { submitImport, listImports, retryImport, ackImport };

function uniqueDates(events) {
  return [
    ...new Set(
      events
        .map((event) => event?.date)
        .filter((date) => typeof date === "string" && date !== ""),
    ),
  ];
}

export function useImportTasks({
  calendars,
  importAnalyzedResult,
  api = defaultApi,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}) {
  const tasks = ref([]);
  const animationRequests = ref([]);
  const localFiles = new Map();
  const localIngestFailures = new Map();
  const processing = new Set();
  let pollTimer = null;
  let polling = false;

  const visibleTasks = computed(() => {
    const priority = { COMPLETED: 0, ANALYZING: 1, FAILED: 2 };
    return tasks.value
      .filter((task) => task.status !== "QUEUED")
      .sort((first, second) => {
        const statusOrder =
          (priority[first.status] ?? 3) - (priority[second.status] ?? 3);
        return statusOrder || first.createdAt.localeCompare(second.createdAt);
      })
      .slice(0, 3);
  });

  const queuedCount = computed(
    () => tasks.value.filter((task) => task.status === "QUEUED").length,
  );

  const overflowCount = computed(
    () =>
      Math.max(
        0,
        tasks.value.filter((task) => task.status !== "QUEUED").length -
          visibleTasks.value.length,
      ),
  );

  const hiddenTaskCount = computed(() => overflowCount.value);

  function localIngestError(error) {
    const message = error instanceof Error ? error.message.trim() : "";
    return message ? message.slice(0, 120) : LOCAL_INGEST_FAILURE;
  }

  function markLocalIngestFailure(task, error) {
    const message = localIngestError(error);
    localIngestFailures.set(task.id, message);
    processing.delete(task.id);
    tasks.value = tasks.value.map((current) =>
      current.id === task.id
        ? { ...current, status: "FAILED", error: message }
        : current,
    );
  }

  async function ingestCompleted(task) {
    if (processing.has(task.id)) {
      return;
    }

    processing.add(task.id);
    try {
      const imported = await importAnalyzedResult({
        events: task.events,
        extractedText: task.extractedText,
        name: task.docName,
        mimeType: task.mimeType,
        blob: localFiles.get(task.id),
      });

      if (!imported) {
        markLocalIngestFailure(task);
        return;
      }

      localIngestFailures.delete(task.id);

      animationRequests.value = [
        ...animationRequests.value,
        {
          taskId: task.id,
          dates: uniqueDates(task.events),
          events: task.events,
        },
      ];
    } catch (error) {
      markLocalIngestFailure(task, error);
    }
  }

  async function refresh() {
    if (polling || document.visibilityState !== "visible") {
      return;
    }

    polling = true;
    try {
      tasks.value = (await api.listImports()).map((task) => {
        const error = localIngestFailures.get(task.id);
        return error ? { ...task, status: "FAILED", error } : task;
      });

      for (const task of tasks.value) {
        if (task.status === "COMPLETED") {
          await ingestCompleted(task);
        }
      }
    } catch {
      // The rail keeps its current state until the next polling attempt.
    } finally {
      polling = false;
    }
  }

  async function submitFiles(files) {
    const calendarList = calendars.value ?? [];
    const profile = profileToText(buildProfile(), calendarList);

    const submitted = await Promise.all(
      Array.from(files).map(async (file) => {
        const task = await api.submitImport(file, calendarList, profile);
        localFiles.set(task.id, file);
        return task;
      }),
    );

    const byId = new Map(tasks.value.map((task) => [task.id, task]));
    for (const task of submitted) {
      byId.set(task.id, task);
    }
    tasks.value = [...byId.values()];
    return submitted;
  }

  async function retryTask(id) {
    if (localIngestFailures.has(id)) {
      const task = tasks.value.find((item) => item.id === id);
      if (task) await ingestCompleted(task);
      return;
    }

    const retried = await api.retryImport(id);
    tasks.value = tasks.value.map((task) =>
      task.id === id ? retried : task,
    );
  }

  async function dismissTask(id) {
    await api.ackImport(id);
    tasks.value = tasks.value.filter((task) => task.id !== id);
    localFiles.delete(id);
    localIngestFailures.delete(id);
    processing.delete(id);
  }

  async function animationStarted(id) {
    await api.ackImport(id);
    tasks.value = tasks.value.filter((task) => task.id !== id);
    animationRequests.value = animationRequests.value.filter(
      (request) => request.taskId !== id,
    );
    localFiles.delete(id);
    localIngestFailures.delete(id);
    processing.delete(id);
  }

  onMounted(() => {
    if (pollIntervalMs <= 0) {
      return;
    }

    void refresh();
    pollTimer = setInterval(refresh, pollIntervalMs);
  });

  onUnmounted(() => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  return {
    tasks,
    visibleTasks,
    queuedCount,
    overflowCount,
    hiddenTaskCount,
    animationRequests,
    submitFiles,
    refresh,
    retryTask,
    dismissTask,
    animationStarted,
  };
}
