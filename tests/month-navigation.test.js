import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import App from "../src/App.vue";
import { formatMonthTitle } from "../src/lib/date-utils.js";

function monthTitleFor(offset) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1);

  return formatMonthTitle(target.getFullYear(), target.getMonth());
}

function wheelOn(wrapper, deltaY) {
  const workspace = wrapper.find(".calendar-workspace").element;

  workspace.dispatchEvent(
    new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }),
  );
}

function calendarTitle(wrapper) {
  const title = wrapper.find("#calendar-title");

  return title.exists() ? title.text() : "";
}

// 切月過場（out-in Transition）在 jsdom 需跨幾幀完成，輪詢直到新月份標題出現。
async function waitForTitle(wrapper, expected) {
  const start = Date.now();

  while (Date.now() - start < 500) {
    if (calendarTitle(wrapper) === expected) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  assert.equal(calendarTitle(wrapper), expected);
}

test("scrolling down over the workspace moves to the next month", async () => {
  localStorage.clear();
  const wrapper = mount(App);

  wheelOn(wrapper, 120);
  await waitForTitle(wrapper, monthTitleFor(1));

  wrapper.unmount();
});

test("scrolling up over the workspace moves to the previous month", async () => {
  localStorage.clear();
  const wrapper = mount(App);

  wheelOn(wrapper, -120);
  await waitForTitle(wrapper, monthTitleFor(-1));

  wrapper.unmount();
});

test("the month controls still navigate months", async () => {
  localStorage.clear();
  const wrapper = mount(App);

  await wrapper.find("#next-month").trigger("click");
  await waitForTitle(wrapper, monthTitleFor(1));

  await wrapper.find("#previous-month").trigger("click");
  await waitForTitle(wrapper, monthTitleFor(0));

  wrapper.unmount();
});

test("goToday returns to the current month", async () => {
  localStorage.clear();
  const wrapper = mount(App);

  wheelOn(wrapper, 120);
  await waitForTitle(wrapper, monthTitleFor(1));

  await wrapper.find("#today").trigger("click");
  await waitForTitle(wrapper, monthTitleFor(0));

  wrapper.unmount();
});
