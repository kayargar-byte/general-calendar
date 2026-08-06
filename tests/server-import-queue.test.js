import assert from "node:assert/strict";
import { test } from "vitest";
import { createImportQueue } from "../server/import-queue.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function settleQueue() {
  await Promise.resolve();
  await Promise.resolve();
}

function input(docName) {
  return { docName, mimeType: "application/pdf" };
}

test("runs at most three import tasks and starts queued work in FIFO order", async () => {
  const queue = createImportQueue({ concurrency: 3 });
  const work = [deferred(), deferred(), deferred(), deferred()];
  const started = [];

  for (let index = 0; index < work.length; index += 1) {
    queue.enqueue(input(`${index}.pdf`), async ({ docName }) => {
      started.push(docName);
      return work[index].promise;
    });
  }

  assert.deepEqual(started, ["0.pdf", "1.pdf", "2.pdf"]);
  assert.deepEqual(
    queue.list().map((task) => task.status),
    ["ANALYZING", "ANALYZING", "ANALYZING", "QUEUED"],
  );

  work[1].resolve({ events: [], extractedText: "" });
  await settleQueue();

  assert.deepEqual(started, ["0.pdf", "1.pdf", "2.pdf", "3.pdf"]);
  assert.equal(queue.list()[3].status, "ANALYZING");
});

test("publishes completed analysis results without leaking private input", async () => {
  const queue = createImportQueue();
  const task = queue.enqueue(
    { ...input("notice.pdf"), buffer: Buffer.from("private") },
    async () => ({
      events: [{ title: "覆診", date: "2026-08-12" }],
      extractedText: "原文",
    }),
  );

  assert.equal(task.status, "ANALYZING");
  await settleQueue();

  const [completed] = queue.list();
  assert.equal(completed.status, "COMPLETED");
  assert.deepEqual(completed.events, [
    { title: "覆診", date: "2026-08-12" },
  ]);
  assert.equal(completed.extractedText, "原文");
  assert.equal("buffer" in completed, false);
  assert.equal(typeof completed.startedAt, "string");
  assert.equal(typeof completed.completedAt, "string");
});

test("failed tasks expose a message and can be retried", async () => {
  const queue = createImportQueue();
  let attempt = 0;
  const task = queue.enqueue(input("broken.pdf"), async () => {
    attempt += 1;
    if (attempt === 1) {
      throw new Error("無法解析文件");
    }
    return { events: [], extractedText: "ok" };
  });

  await settleQueue();
  assert.equal(queue.list()[0].status, "FAILED");
  assert.equal(queue.list()[0].error, "無法解析文件");

  const retried = queue.retry(task.id);
  assert.equal(retried.status, "ANALYZING");
  await settleQueue();

  assert.equal(queue.list()[0].status, "COMPLETED");
  assert.equal(queue.list()[0].error, "");
  assert.equal(attempt, 2);
});

test("ack only removes completed or failed tasks", async () => {
  const queue = createImportQueue({ concurrency: 1 });
  const work = deferred();
  const active = queue.enqueue(input("active.pdf"), () => work.promise);
  const queued = queue.enqueue(input("queued.pdf"), async () => ({
    events: [],
    extractedText: "",
  }));

  assert.equal(queue.ack(active.id), false);
  assert.equal(queue.ack(queued.id), false);

  work.resolve({ events: [], extractedText: "" });
  await settleQueue();
  assert.equal(queue.ack(active.id), true);
  assert.equal(queue.list().some((task) => task.id === active.id), false);
});

test("list returns isolated task snapshots", async () => {
  const queue = createImportQueue();
  queue.enqueue(input("safe.pdf"), async () => ({
    events: [{ title: "安全", date: "2026-08-18" }],
    extractedText: "安全文本",
  }));
  await settleQueue();

  const first = queue.list();
  first[0].docName = "tampered";
  first[0].events[0].title = "tampered";

  const second = queue.list();
  assert.equal(second[0].docName, "safe.pdf");
  assert.equal(second[0].events[0].title, "安全");
});
