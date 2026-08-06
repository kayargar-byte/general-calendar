import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { mount } from "@vue/test-utils";
import {
  ackImport,
  listImports,
  retryImport,
  submitImport,
} from "../src/lib/import-tasks.js";
import { useImportTasks } from "../src/composables/useImportTasks.js";

const ENDPOINT = "http://localhost:3000/api/imports";

function task(overrides = {}) {
  return {
    id: "task-1",
    status: "ANALYZING",
    docName: "notice.pdf",
    mimeType: "application/pdf",
    createdAt: "2026-08-06T00:00:00.000Z",
    startedAt: "2026-08-06T00:00:01.000Z",
    completedAt: "",
    events: [],
    extractedText: "",
    error: "",
    ...overrides,
  };
}

function ok(body, status = 200) {
  return {
    ok: true,
    status,
    json: async () => body,
  };
}

function mountImportTasks({ api, importAnalyzedResult = vi.fn() }) {
  let state;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useImportTasks({
          calendars: ref([{ id: "other", label: "其他", color: "#70757e" }]),
          importAnalyzedResult,
          api,
          pollIntervalMs: 0,
        });
        return () => null;
      },
    }),
  );
  return { state, wrapper };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("import task client sends multipart files and uses resource endpoints", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(ok({ task: task() }, 202))
    .mockResolvedValueOnce(ok({ imports: [task()] }))
    .mockResolvedValueOnce(ok({ task: task({ status: "QUEUED" }) }, 202))
    .mockResolvedValueOnce(ok({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  const file = new File(["content"], "notice.pdf", {
    type: "application/pdf",
  });

  await submitImport(file, [{ id: "other", label: "其他" }], "profile");
  await listImports();
  await retryImport("task-1");
  await ackImport("task-1");

  const createCall = fetchMock.mock.calls[0];
  assert.equal(createCall[0], ENDPOINT);
  assert.equal(createCall[1].method, "POST");
  assert.equal(createCall[1].headers["X-Proxy-Key"], "test-proxy-key");
  assert.equal(createCall[1].body.get("file"), file);
  assert.equal(createCall[1].body.get("profile"), "profile");
  assert.equal(
    createCall[1].body.get("calendars"),
    JSON.stringify([{ id: "other", label: "其他" }]),
  );
  assert.equal(fetchMock.mock.calls[1][0], ENDPOINT);
  assert.equal(fetchMock.mock.calls[2][0], `${ENDPOINT}/task-1/retry`);
  assert.equal(fetchMock.mock.calls[3][0], `${ENDPOINT}/task-1/ack`);
});

test("submits every selected file and retains its blob until completion", async () => {
  const api = {
    submitImport: vi
      .fn()
      .mockResolvedValueOnce(task({ id: "one", docName: "one.pdf" }))
      .mockResolvedValueOnce(task({ id: "two", docName: "two.docx" })),
    listImports: vi.fn().mockResolvedValue([]),
    retryImport: vi.fn(),
    ackImport: vi.fn(),
  };
  const importAnalyzedResult = vi.fn().mockResolvedValue(true);
  const { state, wrapper } = mountImportTasks({ api, importAnalyzedResult });
  const one = new File(["one"], "one.pdf", { type: "application/pdf" });
  const two = new File(["two"], "two.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  await state.submitFiles([one, two]);
  api.listImports.mockResolvedValueOnce([
    task({
      id: "one",
      status: "COMPLETED",
      docName: "one.pdf",
      completedAt: "2026-08-06T00:00:03.000Z",
      events: [{ title: "覆診", date: "2026-08-12" }],
      extractedText: "原文",
    }),
  ]);
  await state.refresh();

  assert.equal(api.submitImport.mock.calls.length, 2);
  assert.equal(importAnalyzedResult.mock.calls.length, 1);
  assert.equal(importAnalyzedResult.mock.calls[0][0].blob, one);
  assert.equal(state.animationRequests.value.length, 1);
  assert.deepEqual(state.animationRequests.value[0].dates, ["2026-08-12"]);
  assert.equal(api.ackImport.mock.calls.length, 0);

  await state.animationStarted("one");
  assert.equal(api.ackImport.mock.calls.length, 1);
  assert.equal(state.tasks.value.some((item) => item.id === "one"), false);
  wrapper.unmount();
});

test("shows at most three actionable tasks and counts queued tasks", async () => {
  const imports = [
    task({ id: "failed", status: "FAILED", error: "bad" }),
    task({ id: "active-1" }),
    task({ id: "active-2" }),
    task({ id: "active-3" }),
    task({ id: "queued-1", status: "QUEUED", startedAt: "" }),
    task({ id: "queued-2", status: "QUEUED", startedAt: "" }),
  ];
  const api = {
    submitImport: vi.fn(),
    listImports: vi.fn().mockResolvedValue(imports),
    retryImport: vi.fn(),
    ackImport: vi.fn(),
  };
  const { state, wrapper } = mountImportTasks({ api });

  await state.refresh();

  assert.equal(state.visibleTasks.value.length, 3);
  assert.equal(state.visibleTasks.value[0].id, "active-1");
  assert.equal(state.queuedCount.value, 2);
  wrapper.unmount();
});

test("keeps a completed task visible ahead of concurrent analyses", async () => {
  const imports = [
    task({ id: "analyzing-1" }),
    task({ id: "analyzing-2" }),
    task({ id: "analyzing-3" }),
    task({
      id: "completed",
      status: "COMPLETED",
      completedAt: "2026-08-06T00:00:03.000Z",
    }),
  ];
  const api = {
    submitImport: vi.fn(),
    listImports: vi.fn().mockResolvedValue(imports),
    retryImport: vi.fn(),
    ackImport: vi.fn(),
  };
  const { state, wrapper } = mountImportTasks({
    api,
    importAnalyzedResult: vi.fn().mockResolvedValue(true),
  });

  await state.refresh();

  assert.deepEqual(
    state.visibleTasks.value.map((item) => item.id),
    ["completed", "analyzing-1", "analyzing-2"],
  );
  assert.equal(state.overflowCount.value, 1);
  assert.equal(state.hiddenTaskCount.value, 1);
  wrapper.unmount();
});

test("keeps overflowed failed tasks actionable after dismissing a visible failure", async () => {
  const failedTasks = ["one", "two", "three", "four"].map((id) =>
    task({ id, status: "FAILED", error: "bad" }),
  );
  const api = {
    submitImport: vi.fn(),
    listImports: vi.fn().mockResolvedValue(failedTasks),
    retryImport: vi.fn(),
    ackImport: vi.fn().mockResolvedValue(true),
  };
  const { state, wrapper } = mountImportTasks({ api });

  await state.refresh();

  assert.deepEqual(
    state.visibleTasks.value.map((item) => item.id),
    ["one", "two", "three"],
  );
  assert.equal(state.overflowCount.value, 1);
  assert.equal(state.hiddenTaskCount.value, 1);

  await state.dismissTask("one");

  assert.deepEqual(
    state.visibleTasks.value.map((item) => item.id),
    ["two", "three", "four"],
  );
  wrapper.unmount();
});

test("retries and dismisses failed tasks through the API", async () => {
  const failed = task({ id: "failed", status: "FAILED", error: "bad" });
  const api = {
    submitImport: vi.fn(),
    listImports: vi.fn().mockResolvedValue([failed]),
    retryImport: vi.fn().mockResolvedValue(task({ id: "failed" })),
    ackImport: vi.fn().mockResolvedValue(true),
  };
  const { state, wrapper } = mountImportTasks({ api });
  await state.refresh();

  await state.retryTask("failed");
  assert.equal(state.tasks.value[0].status, "ANALYZING");

  state.tasks.value = [failed];
  await state.dismissTask("failed");
  assert.deepEqual(state.tasks.value, []);
  wrapper.unmount();
});

test("keeps the task rail usable when a refresh request fails", async () => {
  const api = {
    submitImport: vi.fn(),
    listImports: vi.fn().mockRejectedValue(new Error("offline")),
    retryImport: vi.fn(),
    ackImport: vi.fn(),
  };
  const { state, wrapper } = mountImportTasks({ api });

  await assert.doesNotReject(state.refresh());
  assert.deepEqual(state.tasks.value, []);
  wrapper.unmount();
});

test("keeps a local ingest failure failed without polling it again and retries locally", async () => {
  const completed = task({
    id: "completed",
    status: "COMPLETED",
    completedAt: "2026-08-06T00:00:03.000Z",
    events: [{ date: "2026-08-12" }],
  });
  const api = {
    submitImport: vi.fn(),
    listImports: vi.fn().mockResolvedValue([completed]),
    retryImport: vi.fn(),
    ackImport: vi.fn().mockResolvedValue(true),
  };
  const importAnalyzedResult = vi
    .fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  const { state, wrapper } = mountImportTasks({ api, importAnalyzedResult });

  await state.refresh();
  await state.refresh();

  assert.equal(state.tasks.value[0].status, "FAILED");
  assert.match(state.tasks.value[0].error, /\u532f\u5165\u5931\u6557/);
  assert.equal(importAnalyzedResult.mock.calls.length, 1);

  await state.retryTask("completed");

  assert.equal(api.retryImport.mock.calls.length, 0);
  assert.equal(importAnalyzedResult.mock.calls.length, 2);
  assert.equal(state.animationRequests.value.length, 1);

  await state.dismissTask("completed");
  assert.equal(api.ackImport.mock.calls.length, 1);
  wrapper.unmount();
});

test("turns a thrown local ingest error into a retryable failed task", async () => {
  const completed = task({
    id: "completed",
    status: "COMPLETED",
    completedAt: "2026-08-06T00:00:03.000Z",
  });
  const api = {
    submitImport: vi.fn(),
    listImports: vi.fn().mockResolvedValue([completed]),
    retryImport: vi.fn(),
    ackImport: vi.fn(),
  };
  const { state, wrapper } = mountImportTasks({
    api,
    importAnalyzedResult: vi.fn().mockRejectedValue(new Error("disk full")),
  });

  await state.refresh();

  assert.equal(state.tasks.value[0].status, "FAILED");
  assert.equal(state.tasks.value[0].error, "disk full");
  wrapper.unmount();
});
