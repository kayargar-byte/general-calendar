import assert from "node:assert/strict";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import CalendarFilters from "../src/components/CalendarFilters.vue";
import App from "../src/App.vue";
import { getCalendars } from "../src/lib/calendar-catalog.js";
import { createEvent, getEvents } from "../src/lib/storage.js";

const calendars = getCalendars();
const visibleCalendarIds = new Set(
  calendars.map((calendar) => calendar.id),
);

test("emits add-tag with the trimmed label", async () => {
  const wrapper = mount(CalendarFilters, {
    props: { calendars, visibleCalendarIds },
  });

  await wrapper.find("#add-calendar-tag").trigger("click");
  await wrapper.find("#new-calendar-tag-input").setValue("  寵物  ");
  await wrapper.find("#new-calendar-tag-input").trigger("keydown.enter");

  assert.equal(wrapper.emitted("add-tag")?.[0]?.[0], "寵物");
});

test("renders the Macao One Account import entry below the calendar tags", async () => {
  const wrapper = mount(CalendarFilters, {
    props: { calendars, visibleCalendarIds },
  });

  const entry = wrapper.find("#macao-one-account-import");

  assert.ok(entry.exists());
  assert.equal(entry.text(), "一戶通資料匯入");

  await entry.trigger("click");

  assert.ok(wrapper.emitted("macao-import"));
});

test("shows an error for empty and duplicate labels without emitting", async () => {
  const wrapper = mount(CalendarFilters, {
    props: { calendars, visibleCalendarIds },
  });

  await wrapper.find("#add-calendar-tag").trigger("click");

  await wrapper.find("#new-calendar-tag-input").trigger("keydown.enter");
  assert.match(wrapper.find(".tag-add-error").text(), /不可為空/);

  await wrapper.find("#new-calendar-tag-input").setValue("工作");
  await wrapper.find("#new-calendar-tag-input").trigger("keydown.enter");
  assert.match(wrapper.find(".tag-add-error").text(), /已存在/);

  assert.equal(wrapper.emitted("add-tag"), undefined);
});

test("emits remove-tag with the tag id", async () => {
  const wrapper = mount(CalendarFilters, {
    props: { calendars, visibleCalendarIds },
  });

  await wrapper
    .find('.remove-calendar-tag[data-calendar-id="medical"]')
    .trigger("click");

  assert.equal(wrapper.emitted("remove-tag")?.[0]?.[0], "medical");
});

test("disables removal when only one tag remains", () => {
  const wrapper = mount(CalendarFilters, {
    props: {
      calendars: calendars.slice(0, 1),
      visibleCalendarIds: new Set(["work"]),
    },
  });

  assert.equal(
    wrapper.find(".remove-calendar-tag").attributes("disabled") !== undefined,
    true,
  );
});

test("emits toggle with the tag id and checked state", async () => {
  const wrapper = mount(CalendarFilters, {
    props: { calendars, visibleCalendarIds },
  });

  const workCheckbox = wrapper
    .findAll("input")
    .find((checkbox) => checkbox.element.value === "work");

  await workCheckbox.setValue(false);

  assert.equal(wrapper.emitted("toggle")?.[0]?.[0], "work");
  assert.equal(wrapper.emitted("toggle")?.[0]?.[1], false);
});

test("emits reorder-tags when a tag is dropped onto another", async () => {
  const wrapper = mount(CalendarFilters, {
    props: { calendars, visibleCalendarIds },
  });

  await wrapper.find('label[data-calendar-id="work"]').trigger("dragstart");
  await wrapper
    .find('label[data-calendar-id="medical"]')
    .trigger("dragover");
  await wrapper
    .find('label[data-calendar-id="medical"]')
    .trigger("drop");

  assert.deepEqual(wrapper.emitted("reorder-tags")?.[0], ["work", "medical"]);
});

test("App reorders tags when dragged and persists the order", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  const labels = () =>
    wrapper
      .findAll("#calendar-filters label")
      .map((label) => label.find(".tag-row-label").text());

  assert.deepEqual(labels(), ["工作", "家庭", "醫療", "證件", "津貼", "休閒", "其他"]);

  await wrapper.find('label[data-calendar-id="work"]').trigger("dragstart");
  await wrapper
    .find('label[data-calendar-id="medical"]')
    .trigger("dragover");
  await wrapper
    .find('label[data-calendar-id="medical"]')
    .trigger("drop");
  await nextTick();

  assert.deepEqual(labels(), ["醫療", "家庭", "工作", "證件", "津貼", "休閒", "其他"]);

  const persisted = JSON.parse(
    localStorage.getItem("general-calendar.calendars.v1"),
  );
  assert.deepEqual(
    persisted.map((calendar) => calendar.id),
    ["medical", "family", "work", "documents", "allowances", "leisure", "other"],
  );

  wrapper.unmount();
});

test("App removes a tag and reassigns its events to other", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  // 新增標籤「寵物」
  await wrapper.find("#add-calendar-tag").trigger("click");
  await wrapper.find("#new-calendar-tag-input").setValue("寵物");
  await wrapper.find("#new-calendar-tag-input").trigger("keydown.enter");
  await nextTick();

  const petLabel = wrapper
    .findAll("#calendar-filters label")
    .find((label) => label.text().includes("寵物"));
  assert.ok(petLabel);
  const petId = petLabel.find("input").element.value;

  createEvent({
    title: "餵貓",
    date: "2026-08-15",
    calendarId: petId,
    startTime: "",
    endTime: "",
    notes: "",
  });

  await wrapper
    .find(`.remove-calendar-tag[data-calendar-id="${petId}"]`)
    .trigger("click");
  await nextTick();

  const events = getEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].calendarId, "other");
  assert.equal(
    wrapper
      .findAll("#calendar-filters label")
      .some((label) => label.text().includes("寵物")),
    false,
  );

  wrapper.unmount();
});

test("opens the tag edit dialog prefilled from the row", async () => {
  const wrapper = mount(CalendarFilters, {
    props: { calendars, visibleCalendarIds },
  });

  await wrapper
    .find('.edit-calendar-tag[data-calendar-id="medical"]')
    .trigger("click");
  await nextTick();

  const dialog = wrapper.find("#tag-edit-dialog");
  assert.equal(dialog.element.open, true);
  assert.equal(wrapper.find("#tag-edit-name").element.value, "醫療");

  wrapper.unmount();
});

test("emits update-tag with the edited label and color", async () => {
  const wrapper = mount(CalendarFilters, {
    props: { calendars, visibleCalendarIds },
  });

  await wrapper
    .find('.edit-calendar-tag[data-calendar-id="medical"]')
    .trigger("click");
  await nextTick();

  await wrapper.find("#tag-edit-name").setValue("門診");
  await wrapper.findAll(".tag-color-swatch").at(2).trigger("click");
  await wrapper.find("#tag-edit-form").trigger("submit");

  const emitted = wrapper.emitted("update-tag")?.[0];
  assert.equal(emitted[0], "medical");
  assert.equal(emitted[1], "門診");
  assert.equal(typeof emitted[2], "string");

  wrapper.unmount();
});

test("shows an error for duplicate labels without emitting", async () => {
  const wrapper = mount(CalendarFilters, {
    props: { calendars, visibleCalendarIds },
  });

  await wrapper
    .find('.edit-calendar-tag[data-calendar-id="medical"]')
    .trigger("click");
  await nextTick();

  await wrapper.find("#tag-edit-name").setValue("工作");
  await wrapper.find("#tag-edit-form").trigger("submit");

  assert.match(wrapper.find("#tag-edit-error").text(), /已存在/);
  assert.equal(wrapper.emitted("update-tag"), undefined);

  wrapper.unmount();
});

test("App renames a tag and persists it", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper
    .find('.edit-calendar-tag[data-calendar-id="medical"]')
    .trigger("click");
  await nextTick();

  await wrapper.find("#tag-edit-name").setValue("門診");
  await wrapper.find("#tag-edit-form").trigger("submit");
  await nextTick();

  const labels = () =>
    wrapper
      .findAll("#calendar-filters label")
      .map((label) => label.find(".tag-row-label").text());

  assert.deepEqual(labels(), ["工作", "家庭", "門診", "證件", "津貼", "休閒", "其他"]);

  const persisted = JSON.parse(
    localStorage.getItem("general-calendar.calendars.v1"),
  );
  assert.equal(
    persisted.find((calendar) => calendar.id === "medical").label,
    "門診",
  );

  wrapper.unmount();
});
