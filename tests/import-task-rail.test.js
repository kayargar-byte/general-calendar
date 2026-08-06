import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ImportTaskRail from "../src/components/ImportTaskRail.vue";

function task(overrides = {}) {
  return {
    id: "task-1",
    status: "ANALYZING",
    docName: "notice.pdf",
    mimeType: "application/pdf",
    createdAt: "2026-08-07T00:00:00.000Z",
    startedAt: "2026-08-07T00:00:01.000Z",
    completedAt: "",
    error: "",
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

test("shows no more than three task status items and reports queued work", () => {
  const wrapper = mount(ImportTaskRail, {
    props: {
      tasks: [
        task({ id: "one" }),
        task({ id: "two" }),
        task({ id: "three" }),
        task({ id: "four" }),
      ],
      queuedCount: 2,
    },
  });

  assert.equal(wrapper.find('[role="status"]').exists(), true);
  assert.equal(wrapper.find('[role="status"]').attributes("aria-label"), "文件分析進度");
  assert.equal(wrapper.findAll('[role="listitem"]').length, 3);
  assert.match(wrapper.text(), /\u53e6\u6709\s*2\s*\u4efd\u7b49\u5019\u4e2d/);
});

test("reports hidden non-queued tasks separately from queued work", () => {
  const wrapper = mount(ImportTaskRail, {
    props: {
      tasks: [task({ id: "one" }), task({ id: "two" }), task({ id: "three" })],
      queuedCount: 2,
      overflowCount: 1,
    },
  });

  assert.equal(wrapper.findAll('[role="listitem"]').length, 3);
  assert.match(wrapper.text(), /\u53e6\u6709\s*1\s*\u4efd\u5f85\u8655\u7406/);
  assert.match(wrapper.text(), /\u53e6\u6709\s*2\s*\u4efd\u7b49\u5019\u4e2d/);
  wrapper.unmount();
});

test("localizes task status labels", () => {
  const wrapper = mount(ImportTaskRail, {
    props: {
      tasks: [
        task({ id: "analyzing", status: "ANALYZING" }),
        task({ id: "completed", status: "COMPLETED" }),
        task({ id: "failed", status: "FAILED" }),
      ],
    },
  });

  assert.match(wrapper.text(), /分析中\s*0\s*秒/);
  assert.match(wrapper.text(), /已完成\s*0\s*秒/);
  assert.match(wrapper.text(), /失敗\s*0\s*秒/);
});

test("assigns an icon type for supported and generic documents", () => {
  const cases = [
    ["application/pdf", "notice.pdf", "pdf"],
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "notice.docx",
      "word",
    ],
    [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "schedule.xlsx",
      "excel",
    ],
    ["image/png", "scan.png", "image"],
    ["text/plain", "notes.txt", "file"],
  ];

  for (const [mimeType, docName, expected] of cases) {
    const wrapper = mount(ImportTaskRail, {
      props: { tasks: [task({ mimeType, docName })] },
    });
    assert.equal(wrapper.find("[data-file-icon]").attributes("data-file-icon"), expected);
    wrapper.unmount();
  }
});

test("updates elapsed seconds from the task start time", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-07T00:00:04.900Z"));
  const wrapper = mount(ImportTaskRail, {
    props: { tasks: [task()] },
  });

  assert.match(wrapper.text(), /3\s*\u79d2/);
  await vi.advanceTimersByTimeAsync(2100);
  assert.match(wrapper.text(), /5\s*\u79d2/);
  wrapper.unmount();
});

test("keeps analysis tasks non-cancellable and emits failed task actions", async () => {
  const wrapper = mount(ImportTaskRail, {
    props: {
      tasks: [
        task({ id: "analyzing" }),
        task({ id: "failed", status: "FAILED", error: "unreadable" }),
      ],
    },
  });

  assert.equal(wrapper.findAll('[aria-label^="關閉"]').length, 1);
  assert.equal(wrapper.findAll('[aria-label^="重試"]').length, 1);
  await wrapper.find('[aria-label="重試 notice.pdf"]').trigger("click");
  await wrapper.find('[aria-label="關閉 notice.pdf"]').trigger("click");

  assert.deepEqual(wrapper.emitted("retry"), [["failed"]]);
  assert.deepEqual(wrapper.emitted("dismiss"), [["failed"]]);
});

test("shows a failed task error summary without replacing its status or elapsed time", () => {
  const error = "\u7121\u6cd5\u5beb\u5165\u884c\u4e8b\u66c6\uff0c\u8acb\u6aa2\u67e5\u672c\u6a5f\u5132\u5b58\u7a7a\u9593\u5f8c\u91cd\u8a66";
  const wrapper = mount(ImportTaskRail, {
    props: {
      tasks: [task({ id: "failed", status: "FAILED", error })],
    },
  });

  const summary = wrapper.find("[data-task-error]");
  assert.equal(summary.text(), error);
  assert.equal(summary.attributes("title"), error);
  assert.match(wrapper.text(), /\u5931\u6557\s*0\s*\u79d2/);
  wrapper.unmount();
});

test("exposes the task element rectangle for a rendered task", () => {
  const wrapper = mount(ImportTaskRail, {
    attachTo: document.body,
    props: { tasks: [task({ id: "rect" })] },
  });
  const item = wrapper.find('[data-task-id="rect"]').element;
  const rect = { top: 10, left: 20 };
  item.getBoundingClientRect = () => rect;

  assert.equal(wrapper.vm.getTaskRect("rect"), rect);
  assert.equal(wrapper.vm.getTaskRect("missing"), null);
  wrapper.unmount();
});
