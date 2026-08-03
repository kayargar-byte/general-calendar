import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import App from "../src/App.vue";
import { formatMonthTitle } from "../src/lib/date-utils.js";

test("App shell renders the calendar toolbar and layout", () => {
  const wrapper = mount(App);
  const today = new Date();

  assert.equal(wrapper.find("h1").text(), "我的日曆");
  assert.equal(
    wrapper.find("#calendar-title").text(),
    formatMonthTitle(today.getFullYear(), today.getMonth()),
  );
  assert.equal(wrapper.findAll(".weekdays span").length, 7);
  assert.ok(wrapper.find(".calendar-layout").exists());
  assert.ok(wrapper.find("#create-event").exists());
  assert.ok(wrapper.find("#mini-calendar").exists());
  assert.ok(wrapper.find("#calendar-filters").exists());
  assert.ok(wrapper.find("#calendar-grid").exists());
  assert.ok(wrapper.find("#ai-schedule-launcher").exists());
});
