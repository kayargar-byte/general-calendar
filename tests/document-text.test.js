import assert from "node:assert/strict";
import { test } from "vitest";
import {
  findQuoteMatches,
  splitTextIntoSections,
} from "../src/lib/document-text.js";

test("splitTextIntoSections splits by blank-line paragraphs", () => {
  const sections = splitTextIntoSections("第一段。\n\n第二段。\n\n第三段。");

  assert.deepEqual(sections, ["第一段。", "第二段。", "第三段。"]);
});

test("splitTextIntoSections falls back to lines without blank lines", () => {
  const sections = splitTextIntoSections("第一行\n第二行\n第三行");

  assert.deepEqual(sections, ["第一行", "第二行", "第三行"]);
});

test("splitTextIntoSections splits single-line text by sentence punctuation", () => {
  const sections = splitTextIntoSections("第一句。第二句！第三句？");

  assert.deepEqual(sections, ["第一句。", "第二句！", "第三句？"]);
});

test("splitTextIntoSections trims and drops empty sections", () => {
  const sections = splitTextIntoSections("  a  \n\n\n  b  ");

  assert.deepEqual(sections, ["a", "b"]);
});

test("splitTextIntoSections returns [] for blank or non-string input", () => {
  assert.deepEqual(splitTextIntoSections(""), []);
  assert.deepEqual(splitTextIntoSections("   "), []);
  assert.deepEqual(splitTextIntoSections(null), []);
});

test("findQuoteMatches returns quotes found in the text", () => {
  const matches = findQuoteMatches("下周三下午三時在衛生局覆診", [
    "下周三下午三時在衛生局覆診",
    "不存在",
    "",
    null,
  ]);

  assert.deepEqual(matches, ["下周三下午三時在衛生局覆診"]);
});

test("findQuoteMatches returns [] when nothing matches", () => {
  assert.deepEqual(findQuoteMatches("原文", ["找不到"]), []);
  assert.deepEqual(findQuoteMatches("", ["x"]), []);
  assert.deepEqual(findQuoteMatches(null, ["x"]), []);
});
