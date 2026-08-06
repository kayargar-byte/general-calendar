import assert from "node:assert/strict";
import { test } from "vitest";
import {
  INTEREST_CATEGORIES,
  INTEREST_SUB_BRANCH_LABELS,
} from "../src/lib/interest-catalog.js";

test("interest categories each have a unique id, label, and at least one sub-branch", () => {
  const ids = new Set();
  const labels = new Set();

  for (const category of INTEREST_CATEGORIES) {
    assert.equal(typeof category.id, "string");
    assert.ok(category.id.length > 0);
    assert.ok(!ids.has(category.id), `重複 id：${category.id}`);
    ids.add(category.id);

    assert.equal(typeof category.label, "string");
    assert.ok(category.label.length > 0);
    assert.ok(!labels.has(category.label), `重複 label：${category.label}`);
    labels.add(category.label);

    assert.ok(Array.isArray(category.subBranches));
    assert.ok(
      category.subBranches.length > 0,
      `「${category.label}」沒有小分支`,
    );

    for (const subBranch of category.subBranches) {
      assert.equal(typeof subBranch, "string");
      assert.ok(
        subBranch.trim() !== "",
        `「${category.label}」包含空的小分支`,
      );
    }
  }
});

test("sub-branch labels are unique across all categories", () => {
  const seen = new Set();

  for (const category of INTEREST_CATEGORIES) {
    for (const subBranch of category.subBranches) {
      assert.ok(!seen.has(subBranch), `子分支跨域重複：${subBranch}`);
      seen.add(subBranch);
    }
  }

  // 導出集合與實際清單一致，避免兩者不同步。
  assert.equal(seen.size, INTEREST_SUB_BRANCH_LABELS.size);
});

test("INTEREST_SUB_BRANCH_LABELS contains every sub-branch label", () => {
  for (const category of INTEREST_CATEGORIES) {
    for (const subBranch of category.subBranches) {
      assert.ok(INTEREST_SUB_BRANCH_LABELS.has(subBranch));
    }
  }
});
