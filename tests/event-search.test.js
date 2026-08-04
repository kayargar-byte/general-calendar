import assert from "node:assert/strict";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, test, vi } from "vitest";
import { getCalendars } from "../src/lib/calendar-catalog.js";
import { createEvent } from "../src/lib/storage.js";
import EventSearch from "../src/components/EventSearch.vue";

afterEach(() => {
  vi.useRealTimers();
});

function mountSearch() {
  return mount(EventSearch, { props: { calendars: getCalendars() } });
}

test("EventSearch shows matching results after typing", async () => {
  localStorage.clear();
  createEvent({
    title: "牙醫預約",
    date: "2026-08-15",
    calendarId: "medical",
    startTime: "10:00",
    endTime: "",
    notes: "",
  });
  createEvent({
    title: "工作會議",
    date: "2026-08-20",
    calendarId: "work",
    startTime: "",
    endTime: "",
    notes: "",
  });

  vi.useFakeTimers();
  const wrapper = mountSearch();
  await wrapper.find("#event-search").setValue("牙醫");
  vi.advanceTimersByTime(250);
  await nextTick();

  assert.equal(wrapper.findAll(".search-result-button").length, 1);
  assert.match(wrapper.find(".search-result-button").text(), /牙醫預約/);

  wrapper.unmount();
});

test("EventSearch emits select and clears on result click", async () => {
  localStorage.clear();
  const event = createEvent({
    title: "牙醫預約",
    date: "2026-08-15",
    calendarId: "medical",
    startTime: "10:00",
    endTime: "",
    notes: "",
  });

  vi.useFakeTimers();
  const wrapper = mountSearch();
  await wrapper.find("#event-search").setValue("牙醫");
  vi.advanceTimersByTime(250);
  await nextTick();

  await wrapper.find(".search-result-button").trigger("click");

  assert.equal(wrapper.emitted("select")?.[0]?.[0].id, event.id);
  assert.equal(wrapper.find("#search-results").exists(), false);
  assert.equal(wrapper.find("#event-search").element.value, "");

  wrapper.unmount();
});

test("EventSearch shows the empty message when nothing matches", async () => {
  localStorage.clear();
  createEvent({
    title: "牙醫預約",
    date: "2026-08-15",
    calendarId: "medical",
    startTime: "10:00",
    endTime: "",
    notes: "",
  });

  vi.useFakeTimers();
  const wrapper = mountSearch();
  await wrapper.find("#event-search").setValue("不存在的關鍵字");
  vi.advanceTimersByTime(250);
  await nextTick();

  assert.match(wrapper.find(".search-result-empty").text(), /找不到/);

  wrapper.unmount();
});
