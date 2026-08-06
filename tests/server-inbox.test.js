import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import {
  ackImport,
  getPendingImports,
  pushImport,
} from "../server/inbox.js";

// 收件箱為模組級記憶體態，逐測清空避免跨測殘留。
afterEach(() => {
  for (const entry of getPendingImports()) {
    ackImport(entry.id);
  }
});

function pushSample(docName = "a.pdf") {
  return pushImport({
    events: [{ title: "覆診", date: "2026-08-06" }],
    extractedText: "統一文本",
    docName,
    mimeType: "application/pdf",
  });
}

test("pushImport returns an id and getPendingImports returns the entry", () => {
  const id = pushSample();

  assert.equal(typeof id, "string");
  assert.ok(id.length > 0);
  const pending = getPendingImports();
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, id);
  assert.equal(pending[0].docName, "a.pdf");
  assert.equal(pending[0].mimeType, "application/pdf");
  assert.equal(pending[0].events[0].title, "覆診");
  assert.equal(pending[0].extractedText, "統一文本");
});

test("ackImport removes the entry and returns true", () => {
  const id = pushSample();

  assert.equal(ackImport(id), true);
  assert.deepEqual(getPendingImports(), []);
});

test("ackImport returns false for an unknown id", () => {
  assert.equal(ackImport("missing"), false);
});

test("pushImport drops the oldest entry when the cap is exceeded", () => {
  const ids = [];

  for (let i = 0; i < 21; i += 1) {
    ids.push(pushSample(`a-${i}.docx`));
  }

  const pending = getPendingImports();
  assert.equal(pending.length, 20);
  assert.ok(!pending.some((entry) => entry.id === ids[0]));
  assert.equal(pending[0].id, ids[1]);
  assert.equal(pending[19].id, ids[20]);
});

test("getPendingImports does not leak internal state", () => {
  const id = pushSample();

  const pending = getPendingImports();
  pending.push({ id: "fake" });
  pending[0].docName = "tampered";

  const fresh = getPendingImports();
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].id, id);
  assert.equal(fresh[0].docName, "a.pdf");
});
