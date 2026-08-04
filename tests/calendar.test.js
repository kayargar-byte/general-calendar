import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import { getCalendars } from "../src/lib/calendar-catalog.js";
import { buildCalendarView } from "../src/lib/buildCalendarView.js";
import CalendarGrid from "../src/components/CalendarGrid.vue";
import MiniCalendar from "../src/components/MiniCalendar.vue";

test("buildCalendarView describes every day in the visible month grid", () => {
  const days = buildCalendarView(2026, 7, [], new Date(2026, 7, 2));

  assert.equal(days.length, 42);
  assert.deepEqual(days[0], {
    dateKey: "2026-07-27",
    dayNumber: 27,
    label: "2026年7月27日 星期一",
    isCurrentMonth: false,
    isToday: false,
    events: [],
  });
  assert.equal(days.find((day) => day.dateKey === "2026-08-02").isToday, true);
  assert.equal(
    days.find((day) => day.dateKey === "2026-08-31").isCurrentMonth,
    true,
  );
  assert.equal(days.at(-1).dateKey, "2026-09-06");
  assert.equal(days.at(-1).isCurrentMonth, false);
});

test("buildCalendarView groups stored events under their dates", () => {
  const events = [
    {
      id: "event-1",
      title: "全天事件",
      date: "2026-08-15",
      startTime: "",
      endTime: "",
      notes: "",
    },
    {
      id: "event-2",
      title: "上午會議",
      date: "2026-08-15",
      startTime: "09:30",
      endTime: "10:30",
      notes: "",
    },
  ];

  const days = buildCalendarView(2026, 7, events, new Date(2026, 7, 2));
  const eventDay = days.find((day) => day.dateKey === "2026-08-15");

  assert.deepEqual(eventDay.events, events);
});

test("buildCalendarView includes only events from visible calendars", () => {
  const events = [
    {
      id: "personal-event",
      title: "Personal event",
      date: "2026-08-15",
      startTime: "",
      endTime: "",
      notes: "",
      calendarId: "personal",
    },
    {
      id: "other-event",
      title: "Other event",
      date: "2026-08-15",
      startTime: "09:30",
      endTime: "10:30",
      notes: "",
      calendarId: "other",
    },
  ];

  const days = buildCalendarView(
    2026,
    7,
    events,
    new Date(2026, 7, 2),
    new Set(["other"]),
  );
  const eventDay = days.find((day) => day.dateKey === "2026-08-15");

  assert.deepEqual(eventDay.events, [events[1]]);
});

test("CalendarGrid exposes each event calendar for category styling", () => {
  const days = [
    {
      dateKey: "2026-08-15",
      dayNumber: 15,
      label: "2026年8月15日 星期六",
      isCurrentMonth: true,
      isToday: false,
      events: [
        {
          id: "other-event",
          title: "其他事件",
          date: "2026-08-15",
          startTime: "09:30",
          calendarId: "other",
        },
      ],
    },
  ];

  const wrapper = mount(CalendarGrid, {
    props: { days, calendars: getCalendars() },
  });
  const eventButton = wrapper.find(".event-summary");

  assert.equal(eventButton.attributes("data-calendar-id"), "other");
});

test("MiniCalendar renders selectable dates from the visible month", async () => {
  const days = [
    {
      dateKey: "2026-08-01",
      dayNumber: 1,
      label: "2026年8月1日 星期六",
      isCurrentMonth: true,
      isToday: false,
      events: [],
    },
    {
      dateKey: "2026-08-02",
      dayNumber: 2,
      label: "2026年8月2日 星期日",
      isCurrentMonth: true,
      isToday: true,
      events: [],
    },
  ];

  const wrapper = mount(MiniCalendar, { props: { days } });
  const dateButtons = wrapper.findAll(".mini-calendar-date");

  assert.equal(dateButtons.length, 2);
  assert.equal(dateButtons[1].attributes("data-date"), "2026-08-02");
  assert.ok(dateButtons[1].classes().includes("is-today"));
  assert.equal(dateButtons[1].attributes("aria-current"), "date");

  await dateButtons[0].trigger("click");
  assert.equal(wrapper.emitted("open-create")[0][0], "2026-08-01");
});
