import assert from "node:assert/strict";
import { nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import App from "../src/App.vue";
import ManageDialog from "../src/components/ManageDialog.vue";
import { getCalendars } from "../src/lib/calendar-catalog.js";
import { createEvent, getEvents } from "../src/lib/storage.js";

function mountManage() {
  return mount(ManageDialog, {
    props: { open: false, calendars: getCalendars() },
  });
}

test("lists events and deletes one after confirmation", async () => {
  localStorage.clear();
  createEvent({
    title: "牙醫",
    date: "2026-08-15",
    calendarId: "medical",
    startTime: "",
    endTime: "",
    notes: "",
  });
  createEvent({
    title: "開會",
    date: "2026-08-16",
    calendarId: "work",
    startTime: "",
    endTime: "",
    notes: "",
  });
  window.confirm = () => true;

  const wrapper = mountManage();
  await wrapper.setProps({ open: true });

  assert.equal(wrapper.findAll(".manage-row").length, 2);

  await wrapper.find(".manage-action-button.is-danger").trigger("click");

  assert.equal(getEvents().length, 1);
  assert.equal(wrapper.emitted("changed")?.length, 1);

  wrapper.unmount();
});

test("keeps the event when deletion is cancelled", async () => {
  localStorage.clear();
  createEvent({
    title: "牙醫",
    date: "2026-08-15",
    calendarId: "medical",
    startTime: "",
    endTime: "",
    notes: "",
  });
  window.confirm = () => false;

  const wrapper = mountManage();
  await wrapper.setProps({ open: true });

  await wrapper.find(".manage-action-button.is-danger").trigger("click");

  assert.equal(getEvents().length, 1);
  assert.equal(wrapper.emitted("changed"), undefined);

  wrapper.unmount();
});

test("switches to the tags tab and opens the tag edit dialog", async () => {
  localStorage.clear();
  const wrapper = mountManage();
  await wrapper.setProps({ open: true });

  await wrapper.find("#manage-tab-tags").trigger("click");
  await nextTick();

  await wrapper.find(".manage-tag-row .manage-action-button").trigger("click");
  await nextTick();

  assert.equal(wrapper.find("#tag-edit-dialog").element.open, true);

  wrapper.unmount();
});

test("App opens the event dialog from the manage center", async () => {
  localStorage.clear();
  createEvent({
    title: "牙醫",
    date: "2026-08-15",
    calendarId: "medical",
    startTime: "",
    endTime: "",
    notes: "",
  });
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper.find("#open-manage").trigger("click");
  await nextTick();

  await wrapper
    .find("#manage-events-panel .manage-action-button")
    .trigger("click");
  await nextTick();

  assert.equal(wrapper.find("#event-dialog").element.open, true);
  assert.equal(wrapper.find("#event-title").element.value, "牙醫");

  wrapper.unmount();
});
