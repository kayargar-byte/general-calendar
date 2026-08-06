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
  assert.equal(wrapper.emitted("deleted")?.[0]?.[0].date, "2026-08-20");
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

test("EventDialog preserves search source fields from a prefill on save", async () => {
  localStorage.clear();
  const wrapper = mountDialog({
    pendingDate: "",
    prefill: {
      title: "美食節",
      date: "2026-03-20",
      calendarId: "other",
      startTime: "",
      endTime: "",
      notes: "",
      sourceUrl: "https://m.gov.mo/a",
      sourceTitle: "官方",
      sourceSnippet: "3月20日",
    },
  });
  await wrapper.setProps({ open: true });

  assert.equal(
    wrapper.find("#event-source a").attributes("href"),
    "https://m.gov.mo/a",
  );

  await wrapper.find("#event-form").trigger("submit");

  const event = getEvents()[0];
  assert.equal(event.sourceUrl, "https://m.gov.mo/a");
  assert.equal(event.sourceTitle, "官方");
  assert.equal(event.sourceSnippet, "3月20日");
  assert.equal(wrapper.emitted("saved")?.length, 1);
});

test("EventDialog keeps search source fields when editing an existing event", async () => {
  localStorage.clear();
  createEvent({
    title: "美食節",
    date: "2026-03-20",
    calendarId: "other",
    startTime: "",
    endTime: "",
    notes: "",
    sourceUrl: "https://m.gov.mo/a",
    sourceTitle: "官方",
    sourceSnippet: "3月20日",
  });
  const event = getEvents()[0];

  const wrapper = mountDialog({ editingEventId: event.id });
  await wrapper.setProps({ open: true });

  await wrapper.find("#event-title").setValue("美食節改期");
  await wrapper.find("#event-form").trigger("submit");

  const updated = getEvents()[0];
  assert.equal(updated.id, event.id);
  assert.equal(updated.title, "美食節改期");
  assert.equal(updated.sourceUrl, "https://m.gov.mo/a");
  assert.equal(updated.sourceTitle, "官方");
  assert.equal(updated.sourceSnippet, "3月20日");
});

test("EventDialog keeps document source fields when editing an existing event", async () => {
  localStorage.clear();
  createEvent({
    title: "覆診",
    date: "2026-08-06",
    calendarId: "medical",
    startTime: "15:00",
    endTime: "16:00",
    notes: "",
    sourceDocId: "doc-1",
    sourceQuote: "下周三下午三時在衛生局覆診",
  });
  const event = getEvents()[0];

  const wrapper = mountDialog({ editingEventId: event.id });
  await wrapper.setProps({ open: true });

  await wrapper.find("#event-title").setValue("覆診改期");
  await wrapper.find("#event-form").trigger("submit");

  const updated = getEvents()[0];
  assert.equal(updated.sourceDocId, "doc-1");
  assert.equal(updated.sourceQuote, "下周三下午三時在衛生局覆診");
});

test("EventDialog preserves document source fields from an AI prefill on save", async () => {
  localStorage.clear();
  const wrapper = mountDialog({
    pendingDate: "",
    prefill: {
      title: "覆診",
      date: "2026-08-06",
      calendarId: "medical",
      startTime: "15:00",
      endTime: "16:00",
      notes: "",
      sourceDocId: "doc-1",
      sourceQuote: "下周三下午三時在衛生局覆診",
    },
  });
  await wrapper.setProps({ open: true });

  await wrapper.find("#event-form").trigger("submit");

  const event = getEvents()[0];
  assert.equal(event.sourceDocId, "doc-1");
  assert.equal(event.sourceQuote, "下周三下午三時在衛生局覆診");
});

test("EventDialog submits endDate for a multi-day event", async () => {
  localStorage.clear();
  const wrapper = mountDialog({ pendingDate: "2026-08-14" });
  await wrapper.setProps({ open: true });

  await wrapper.find("#event-title").setValue("展覽");
  await wrapper.find("#event-end-date").setValue("2026-08-16");
  await wrapper.find("#event-form").trigger("submit");

  const event = getEvents()[0];
  assert.equal(event.title, "展覽");
  assert.equal(event.date, "2026-08-14");
  assert.equal(event.endDate, "2026-08-16");
  assert.equal(wrapper.emitted("saved")?.length, 1);
});

test("EventDialog shows the date range in the label when endDate is set", async () => {
  localStorage.clear();
  const wrapper = mountDialog({ pendingDate: "2026-08-14" });
  await wrapper.setProps({ open: true });

  await wrapper.find("#event-end-date").setValue("2026-08-16");

  assert.equal(
    wrapper.find("label[for='event-date']").text(),
    "日期（8月14日 – 8月16日）",
  );
});

test("EventDialog prefills endDate when editing a multi-day event", async () => {
  localStorage.clear();
  const event = createEvent({
    title: "展覽",
    date: "2026-08-14",
    endDate: "2026-08-16",
    calendarId: "leisure",
    startTime: "09:00",
    endTime: "18:00",
    notes: "",
  });

  const wrapper = mountDialog({ editingEventId: event.id });
  await wrapper.setProps({ open: true });

  assert.equal(wrapper.find("#event-end-date").element.value, "2026-08-16");
  assert.match(wrapper.find("label[for='event-date']").text(), /8月16日/);
});

test("EventDialog rejects endDate before the start date", async () => {
  localStorage.clear();
  const wrapper = mountDialog({ pendingDate: "2026-08-14" });
  await wrapper.setProps({ open: true });

  await wrapper.find("#event-title").setValue("展覽");
  await wrapper.find("#event-end-date").setValue("2026-08-12");
  await wrapper.find("#event-form").trigger("submit");

  assert.match(
    wrapper.find("#event-form-error").text(),
    /結束日期不得早於開始日期/,
  );
  assert.equal(getEvents().length, 0);
  assert.equal(wrapper.emitted("saved"), undefined);
});

test("EventDialog reports a conflict when a multi-day event covers an existing event", async () => {
  localStorage.clear();
  createEvent({
    title: "既存會議",
    date: "2026-08-15",
    calendarId: "work",
    startTime: "09:00",
    endTime: "10:30",
    notes: "",
  });

  const wrapper = mountDialog({ pendingDate: "2026-08-14" });
  await wrapper.setProps({ open: true });

  await wrapper.find("#event-title").setValue("展覽");
  await wrapper.find("#event-start-time").setValue("09:30");
  await wrapper.find("#event-end-time").setValue("10:00");
  await wrapper.find("#event-end-date").setValue("2026-08-16");
  await wrapper.find("#event-form").trigger("submit");

  assert.match(wrapper.find("#event-form-error").text(), /時間衝突/);
  assert.equal(getEvents().length, 1);
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
