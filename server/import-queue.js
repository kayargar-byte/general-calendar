const DEFAULT_CONCURRENCY = 3;
const DEFAULT_MAX_TASKS = 20;

function copyValue(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function snapshot(task) {
  return {
    id: task.id,
    status: task.status,
    docName: task.input.docName,
    mimeType: task.input.mimeType,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    events: copyValue(task.events),
    extractedText: task.extractedText,
    error: task.error,
  };
}

export function createImportQueue({
  concurrency = DEFAULT_CONCURRENCY,
  maxTasks = DEFAULT_MAX_TASKS,
} = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError("concurrency must be a positive integer");
  }

  const tasks = [];
  let activeCount = 0;

  function drain() {
    while (activeCount < concurrency) {
      const task = tasks.find((item) => item.status === "QUEUED");

      if (!task) {
        return;
      }

      task.status = "ANALYZING";
      task.startedAt = new Date().toISOString();
      activeCount += 1;

      let analysis;
      try {
        analysis = task.analyze(task.input);
      } catch (error) {
        analysis = Promise.reject(error);
      }

      void (async () => {
        try {
          const result = await analysis;
          task.status = "COMPLETED";
          task.events = Array.isArray(result?.events) ? result.events : [];
          task.extractedText =
            typeof result?.extractedText === "string" ? result.extractedText : "";
          task.error = "";
        } catch (error) {
          task.status = "FAILED";
          task.events = [];
          task.extractedText = "";
          task.error =
            error instanceof Error ? error.message : "文件分析失敗。";
        } finally {
          task.completedAt = new Date().toISOString();
          activeCount -= 1;
          drain();
        }
      })();
    }
  }

  function enqueue(input, analyze) {
    if (tasks.length >= maxTasks) {
      const error = new Error("匯入任務已達上限。");
      error.code = "IMPORT_QUEUE_FULL";
      throw error;
    }

    if (typeof analyze !== "function") {
      throw new TypeError("analyze must be a function");
    }

    const task = {
      id: crypto.randomUUID(),
      status: "QUEUED",
      input,
      analyze,
      createdAt: new Date().toISOString(),
      startedAt: "",
      completedAt: "",
      events: [],
      extractedText: "",
      error: "",
    };

    tasks.push(task);
    drain();
    return snapshot(task);
  }

  function list() {
    return tasks.map(snapshot);
  }

  function retry(id) {
    const task = tasks.find((item) => item.id === id);

    if (!task || task.status !== "FAILED") {
      return null;
    }

    task.status = "QUEUED";
    task.startedAt = "";
    task.completedAt = "";
    task.events = [];
    task.extractedText = "";
    task.error = "";
    drain();
    return snapshot(task);
  }

  function ack(id) {
    const index = tasks.findIndex((task) => task.id === id);

    if (
      index === -1 ||
      !["COMPLETED", "FAILED"].includes(tasks[index].status)
    ) {
      return false;
    }

    tasks.splice(index, 1);
    return true;
  }

  function clear() {
    for (let index = tasks.length - 1; index >= 0; index -= 1) {
      if (["COMPLETED", "FAILED", "QUEUED"].includes(tasks[index].status)) {
        tasks.splice(index, 1);
      }
    }
  }

  return { enqueue, list, retry, ack, clear };
}
