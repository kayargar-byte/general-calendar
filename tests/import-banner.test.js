import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import ImportBanner from "../src/components/ImportBanner.vue";

test("renders the count and source doc name when open", () => {
  const wrapper = mount(ImportBanner, {
    props: { open: true, count: 3, docName: "a.docx" },
  });

  assert.match(wrapper.find("#import-banner").text(), /已匯入 3 筆（來源：a.docx）/);
});

test("renders the count without a doc name when empty", () => {
  const wrapper = mount(ImportBanner, {
    props: { open: true, count: 1 },
  });

  assert.match(wrapper.find("#import-banner").text(), /已匯入 1 筆/);
  assert.doesNotMatch(wrapper.find("#import-banner").text(), /來源/);
});

test("is hidden when closed", () => {
  const wrapper = mount(ImportBanner, { props: { open: false } });

  assert.ok(!wrapper.find("#import-banner").exists());
});

test("emits close", async () => {
  const wrapper = mount(ImportBanner, {
    props: { open: true, count: 2 },
  });

  await wrapper.find("#close-import-banner").trigger("click");

  assert.equal(wrapper.emitted("close").length, 1);
});

test("renders the error message and hides the undo action", () => {
  const wrapper = mount(ImportBanner, {
    props: { open: true, error: "此 PDF 為掃描型，無法直接抽文字" },
  });

  assert.match(wrapper.find("#import-banner-error").text(), /此 PDF 為掃描型/);
  assert.ok(!wrapper.find("#undo-import").exists());
  assert.ok(!wrapper.find(".import-banner-message").exists());
});
