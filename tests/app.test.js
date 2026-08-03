import assert from "node:assert/strict";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import App from "../src/App.vue";

test("AI schedule panel controls preserve its draft and accessibility state", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  const launcher = wrapper.find("#ai-schedule-launcher");
  const panel = wrapper.find("#ai-schedule-panel");
  const input = wrapper.find("#ai-schedule-input");
  const layout = wrapper.find(".calendar-layout");

  // 開啟：class／aria／焦點
  await launcher.trigger("click");
  await nextTick();
  assert.equal(layout.classes().includes("is-ai-schedule-open"), true);
  assert.equal(launcher.attributes("aria-expanded"), "true");
  assert.equal(panel.attributes("aria-hidden"), "false");
  assert.equal(document.activeElement, input.element);

  // 輸入草稿後關閉：草稿保留、焦點回 launcher
  await input.setValue("下週三下午三時看醫生");
  await launcher.trigger("click");
  await nextTick();
  assert.equal(layout.classes().includes("is-ai-schedule-open"), false);
  assert.equal(input.element.value, "下週三下午三時看醫生");
  assert.equal(document.activeElement, launcher.element);

  // Escape 關閉
  await launcher.trigger("click");
  await nextTick();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await nextTick();
  assert.equal(layout.classes().includes("is-ai-schedule-open"), false);

  // close 按鈕關閉
  await launcher.trigger("click");
  await nextTick();
  await wrapper.find("#close-ai-schedule").trigger("click");
  await nextTick();
  assert.equal(layout.classes().includes("is-ai-schedule-open"), false);

  // AI 面板不寫入本機儲存
  assert.equal(localStorage.length, 0);

  wrapper.unmount();
});
