import assert from "node:assert/strict";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import App from "../src/App.vue";

const THEME_STORAGE_KEY = "general-calendar.theme.v1";

test("theme toggle and settings radio switch and persist", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper.find("#theme-toggle").trigger("click");
  await nextTick();
  assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
  assert.equal(localStorage.getItem(THEME_STORAGE_KEY), "dark");

  await wrapper.find("#open-settings").trigger("click");
  await nextTick();

  await wrapper
    .find('input[name="settings-theme"][value="light"]')
    .setValue(true);
  await nextTick();
  assert.equal(document.documentElement.getAttribute("data-theme"), null);
  assert.equal(localStorage.getItem(THEME_STORAGE_KEY), "light");

  await wrapper
    .find('input[name="settings-theme"][value="dark"]')
    .setValue(true);
  await nextTick();
  assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
  assert.equal(localStorage.getItem(THEME_STORAGE_KEY), "dark");

  wrapper.unmount();
});

test("date picker jumps to the selected month", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper.find("#calendar-title").trigger("click");
  await nextTick();

  assert.equal(wrapper.find("#date-picker-popover").exists(), true);

  await wrapper.find("#date-picker-month").setValue("11");
  await wrapper.find("#date-picker-confirm").trigger("click");
  await nextTick();

  assert.match(wrapper.find("#calendar-title").text(), /2026年12月/);

  wrapper.unmount();
});
