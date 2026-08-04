import assert from "node:assert/strict";
import { nextTick } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { test } from "vitest";
import { toDateKey } from "../src/lib/date-utils.js";
import { createEvent, getEvents } from "../src/lib/storage.js";
import App from "../src/App.vue";
import EventDialog from "../src/components/EventDialog.vue";

function mountDialog(props = {}) {
  return mount(EventDialog, {
    props: {
      open: false,
      editingEventId: null,
      pendingDate: "",
      ...props,
    },
  });
}

test("EventDialog creates an event and emits saved", async () => {
  localStorage.clear();
  const wrapper = mountDialog({ pendingDate: "2026-08-15" });
  await wrapper.setProps({ open: true });

  await wrapper.find("#event-title").setValue("證件續期");
  await wrapper.find("#event-form").trigger("submit");

  const events = getEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].title, "證件續期");
  assert.equal(events[0].date, "2026-08-15");
  assert.equal(wrapper.emitted("saved")?.length, 1);
});

test("EventDialog shows the validation error and does not save", async () => {
  localStorage.clear();
  const wrapper = mountDialog({ pendingDate: "2026-08-15" });
  await wrapper.setProps({ open: true });

  await wrapper.find("#event-form").trigger("submit");

  const error = wrapper.find("#event-form-error");
  assert.match(error.text(), /標題為必填/);
  assert.equal(error.attributes("hidden"), undefined);
  assert.equal(getEvents().length, 0);
  assert.equal(wrapper.emitted("saved"), undefined);
});

test("EventDialog loads and updates an existing event", async () => {
  localStorage.clear();
  const event = createEvent({
    title: "牙醫",
    date: "2026-08-20",
    calendarId: "medical",
    startTime: "",
    endTime: "",
    notes: "攜帶身份證明文件",
  });

  const wrapper = mountDialog({ editingEventId: event.id });
  await wrapper.setProps({ open: true });

  assert.equal(wrapper.find("#event-title").element.value, "牙醫");
  assert.equal(wrapper.find("#event-calendar").element.value, "medical");

  await wrapper.find("#event-title").setValue("牙醫覆診");
  await wrapper.find("#event-form").trigger("submit");

  const events = getEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].id, event.id);
  assert.equal(events[0].title, "牙醫覆診");
  assert.equal(wrapper.emitted("saved")?.length, 1);
});

test("EventDialog hides the delete button in create mode", async () => {
  localStorage.clear();
  const wrapper = mountDialog({ pendingDate: "2026-08-15" });
  await wrapper.setProps({ open: true });

  assert.equal(
    wrapper.find("#delete-event").attributes("hidden") !== undefined,
    true,
  );
});

test("EventDialog deletes the event after confirmation", async () => {
  localStorage.clear();
  const event = createEvent({
    title: "牙醫",
    date: "2026-08-20",
    calendarId: "medical",
    startTime: "",
    endTime: "",
    notes: "",
  });
  window.confirm = () => true;

  const wrapper = mountDialog({ editingEventId: event.id });
  await wrapper.setProps({ open: true });

  await wrapper.find("#delete-event").trigger("click");

  assert.equal(getEvents().length, 0);
  assert.equal(wrapper.emitted("deleted")?.[0]?.[0], "2026-08-20");
});

test("EventDialog closes and emits closed on cancel", async () => {
  localStorage.clear();
  const wrapper = mountDialog({ pendingDate: "2026-08-15" });
  await wrapper.setProps({ open: true });

  await wrapper.find("#cancel-event").trigger("click");

  assert.equal(wrapper.emitted("closed")?.length, 1);
});

test("EventDialog blocks a conflicting save once, then allows forcing", async () => {
  localStorage.clear();
  createEvent({
    title: "既存會議",
    date: "2026-08-15",
    calendarId: "work",
    startTime: "09:00",
    endTime: "10:30",
    notes: "",
  });

  const wrapper = mountDialog({ pendingDate: "2026-08-15" });
  await wrapper.setProps({ open: true });

  await wrapper.find("#event-title").setValue("新會議");
  await wrapper.find("#event-start-time").setValue("09:30");
  await wrapper.find("#event-end-time").setValue("10:00");

  await wrapper.find("#event-form").trigger("submit");
  assert.match(wrapper.find("#event-form-error").text(), /時間衝突/);
  assert.equal(getEvents().length, 1);

  await wrapper.find("#event-form").trigger("submit");
  assert.equal(getEvents().length, 2);
  assert.equal(wrapper.emitted("saved")?.length, 1);
});

test("App opens the create dialog from the toolbar button", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  await wrapper.find("#create-event").trigger("click");
  await nextTick();

  assert.equal(wrapper.find("#event-dialog").element.open, true);
  assert.equal(
    wrapper.find("#event-date").element.value,
    toDateKey(new Date()),
  );

  wrapper.unmount();
});

test("EventDialog prefills the form from an AI result", async () => {
  localStorage.clear();
  const wrapper = mountDialog({
    pendingDate: "",
    prefill: {
      title: "看醫生",
      date: "2026-08-06",
      calendarId: "medical",
      startTime: "15:00",
      endTime: "16:00",
      notes: "帶報告",
    },
  });
  await wrapper.setProps({ open: true });

  assert.equal(wrapper.find("#event-title").element.value, "看醫生");
  assert.equal(wrapper.find("#event-date").element.value, "2026-08-06");
  assert.equal(wrapper.find("#event-calendar").element.value, "medical");
  assert.equal(wrapper.find("#event-start-time").element.value, "15:00");
});

test("App creates an event from the grid and restores focus", async () => {
  localStorage.clear();
  const wrapper = mount(App, { attachTo: document.body });

  const dateKey = toDateKey(new Date());
  const dateButton = wrapper.find(
    `#calendar-grid button[data-date="${dateKey}"]`,
  );

  await dateButton.trigger("click");
  await nextTick();

  assert.equal(wrapper.find("#event-dialog").element.open, true);

  await wrapper.find("#event-title").setValue("證件續期");
  await wrapper.find("#event-form").trigger("submit");
  await flushPromises();
  await nextTick();

  assert.equal(wrapper.find("#event-dialog").element.open, false);
  assert.equal(wrapper.find(".event-summary").text(), "證件續期");
  assert.equal(document.activeElement?.getAttribute("data-date"), dateKey);

  wrapper.unmount();
});
