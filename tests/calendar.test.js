import assert from "node:assert/strict";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import { getCalendars } from "../src/lib/calendar-catalog.js";
import { buildCalendarView } from "../src/lib/buildCalendarView.js";
import CalendarGrid from "../src/components/CalendarGrid.vue";
import MiniCalendar from "../src/components/MiniCalendar.vue";

test("buildCalendarView describes every day in the visible month grid", () => {
  const days = buildCalendarView(2026, 7, [], new Date(2026, 7, 2)).days;

  assert.equal(days.length, 42);
  assert.deepEqual(days[0], {
    dateKey: "2026-07-27",
    dayNumber: 27,
    label: "2026年7月27日 星期一",
    isCurrentMonth: false,
    isToday: false,
    events: [],
    coveredBars: 0,
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

  const days = buildCalendarView(2026, 7, events, new Date(2026, 7, 2)).days;
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
  ).days;
  const eventDay = days.find((day) => day.dateKey === "2026-08-15");

  assert.deepEqual(eventDay.events, [events[1]]);
});

test("buildCalendarView injects a multi-day event into every covered day", () => {
  const events = [
    {
      id: "event-multiday",
      title: "展覽",
      date: "2026-08-14",
      endDate: "2026-08-16",
      startTime: "09:00",
      endTime: "18:00",
      calendarId: "personal",
    },
  ];

  const { days } = buildCalendarView(2026, 7, events, new Date(2026, 7, 2));

  for (const dateKey of ["2026-08-14", "2026-08-15", "2026-08-16"]) {
    assert.deepEqual(
      days.find((day) => day.dateKey === dateKey).events,
      events,
    );
  }

  assert.equal(days.find((day) => day.dateKey === "2026-08-13").events.length, 0);
  assert.equal(days.find((day) => day.dateKey === "2026-08-17").events.length, 0);
});

test("buildCalendarView splits multi-day bars at week boundaries", () => {
  const event = {
    id: "event-span",
    title: "長週末",
    date: "2026-08-28",
    endDate: "2026-09-02",
    startTime: "",
    endTime: "",
    calendarId: "personal",
  };

  const { days, bars } = buildCalendarView(2026, 7, [event], new Date(2026, 7, 2));
  const startOf = (dateKey) => days.findIndex((day) => day.dateKey === dateKey);
  const startIndex = startOf("2026-08-28");
  const rowEndIndex = startOf("2026-08-30");
  const nextRowIndex = startOf("2026-08-31");

  // 8/28–8/30 同行成條，8/31 起跨下一行另起一條。
  assert.deepEqual(bars, [
    { event, startIndex, endIndex: rowEndIndex, lane: 0 },
    { event, startIndex: nextRowIndex, endIndex: nextRowIndex, lane: 0 },
  ]);
  // 注入仍含跨月 placeholder 格（9/2），與單日事件行為一致。
  assert.equal(days[startOf("2026-09-02")].events.length, 1);
});

test("buildCalendarView clips multi-day bars to the visible month", () => {
  const event = {
    id: "event-cross",
    title: "跨月",
    date: "2026-07-30",
    endDate: "2026-08-02",
    startTime: "",
    endTime: "",
    calendarId: "personal",
  };

  const { days, bars } = buildCalendarView(2026, 7, [event], new Date(2026, 7, 2));
  const startIndex = days.findIndex((day) => day.dateKey === "2026-08-01");
  const endIndex = days.findIndex((day) => day.dateKey === "2026-08-02");

  // 長條只涵蓋當月格（8/1–8/2），不入前月 placeholder。
  assert.deepEqual(bars, [{ event, startIndex, endIndex, lane: 0 }]);
  // 注入仍含 placeholder 格（7/30），與單日事件行為一致。
  assert.equal(days.find((day) => day.dateKey === "2026-07-30").events.length, 1);
});

test("buildCalendarView excludes multi-day events from hidden calendars", () => {
  const event = {
    id: "event-hidden",
    title: "隱藏多日",
    date: "2026-08-14",
    endDate: "2026-08-16",
    startTime: "",
    endTime: "",
    calendarId: "other",
  };

  const { days, bars } = buildCalendarView(
    2026,
    7,
    [event],
    new Date(2026, 7, 2),
    new Set(["personal"]),
  );

  assert.deepEqual(bars, []);
  assert.equal(days.find((day) => day.dateKey === "2026-08-15").events.length, 0);
});

test("buildCalendarView assigns distinct lanes to overlapping bars in the same row", () => {
  const events = [
    {
      id: "a",
      title: "A",
      date: "2026-08-03",
      endDate: "2026-08-06",
      startTime: "",
      endTime: "",
      calendarId: "personal",
    },
    {
      id: "b",
      title: "B",
      date: "2026-08-05",
      endDate: "2026-08-09",
      startTime: "",
      endTime: "",
      calendarId: "work",
    },
    {
      id: "c",
      title: "C",
      date: "2026-08-17",
      endDate: "2026-08-19",
      startTime: "",
      endTime: "",
      calendarId: "personal",
    },
  ];

  const { bars } = buildCalendarView(2026, 7, events, new Date(2026, 7, 2));
  const byId = Object.fromEntries(bars.map((bar) => [bar.event.id, bar]));

  // A（8/3–8/6）與 B（8/5–8/9）同週行且日期相交 → 不同車道；C 在另一週行 → 車道 0。
  assert.notEqual(byId.a.lane, byId.b.lane);
  assert.equal(byId.c.lane, 0);
});

test("buildCalendarView counts how many bars cover each day", () => {
  const events = [
    {
      id: "a",
      title: "A",
      date: "2026-08-03",
      endDate: "2026-08-06",
      calendarId: "personal",
    },
    {
      id: "b",
      title: "B",
      date: "2026-08-05",
      endDate: "2026-08-09",
      calendarId: "work",
    },
  ];

  const { days } = buildCalendarView(2026, 7, events, new Date(2026, 7, 2));
  const covered = (dateKey) =>
    days.find((day) => day.dateKey === dateKey)?.coveredBars ?? 0;

  // 8/5–8/6 被兩條長條覆蓋；8/3–8/4 只有 A；8/7–8/9 只有 B；8/10 無。
  assert.equal(covered("2026-08-03"), 1);
  assert.equal(covered("2026-08-04"), 1);
  assert.equal(covered("2026-08-05"), 2);
  assert.equal(covered("2026-08-06"), 2);
  assert.equal(covered("2026-08-07"), 1);
  assert.equal(covered("2026-08-09"), 1);
  assert.equal(covered("2026-08-10"), 0);
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

test("CalendarGrid filters multi-day events out of the per-day list", () => {
  const days = [
    {
      dateKey: "2026-08-15",
      dayNumber: 15,
      label: "2026年8月15日 星期六",
      isCurrentMonth: true,
      isToday: false,
      events: [
        {
          id: "multi",
          title: "展覽",
          date: "2026-08-14",
          endDate: "2026-08-16",
          startTime: "09:00",
        },
        {
          id: "single",
          title: "會議",
          date: "2026-08-15",
          startTime: "10:00",
        },
      ],
    },
  ];

  const wrapper = mount(CalendarGrid, {
    props: { days, calendars: getCalendars() },
  });

  const summaries = wrapper.findAll(".event-summary");

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].attributes("data-event-id"), "single");
});

test("CalendarGrid renders a multi-day bar spanning covered columns", () => {
  const days = [
    {
      dateKey: "2026-08-03",
      dayNumber: 3,
      label: "2026年8月3日 星期一",
      isCurrentMonth: true,
      isToday: false,
      events: [],
    },
    {
      dateKey: "2026-08-04",
      dayNumber: 4,
      label: "2026年8月4日 星期二",
      isCurrentMonth: true,
      isToday: false,
      events: [],
    },
    {
      dateKey: "2026-08-05",
      dayNumber: 5,
      label: "2026年8月5日 星期三",
      isCurrentMonth: true,
      isToday: false,
      events: [],
    },
    {
      dateKey: "2026-08-06",
      dayNumber: 6,
      label: "2026年8月6日 星期四",
      isCurrentMonth: true,
      isToday: false,
      events: [],
    },
  ];
  const bars = [
    {
      event: {
        id: "multi",
        title: "展覽",
        date: "2026-08-03",
        endDate: "2026-08-05",
        startTime: "09:00",
      },
      startIndex: 0,
      endIndex: 2,
    },
  ];

  const wrapper = mount(CalendarGrid, {
    props: { days, bars, calendars: getCalendars() },
  });

  const bar = wrapper.find(".calendar-bar");

  assert.equal(bar.exists(), true);
  assert.equal(
    bar.element.style.left,
    "calc(0 * var(--col-w) + 0 * 1px + 7px)",
  );
  assert.equal(
    bar.element.style.top,
    "calc(0 * var(--row-h) + 0 * 1px + var(--bar-top))",
  );
  assert.equal(
    bar.element.style.width,
    "calc(3 * var(--col-w) + 2 * 1px - 14px)",
  );
  assert.equal(bar.text(), "09:00 展覽");
});

test("CalendarGrid marks days covered by a multi-day bar", () => {
  const days = [
    {
      dateKey: "2026-08-03",
      dayNumber: 3,
      label: "2026年8月3日 星期一",
      isCurrentMonth: true,
      isToday: false,
      events: [],
      coveredBars: 1,
    },
    {
      dateKey: "2026-08-04",
      dayNumber: 4,
      label: "2026年8月4日 星期二",
      isCurrentMonth: true,
      isToday: false,
      events: [],
      coveredBars: 1,
    },
    {
      dateKey: "2026-08-05",
      dayNumber: 5,
      label: "2026年8月5日 星期三",
      isCurrentMonth: true,
      isToday: false,
      events: [],
      coveredBars: 1,
    },
  ];
  const bars = [
    {
      event: {
        id: "multi",
        title: "展覽",
        date: "2026-08-03",
        endDate: "2026-08-05",
      },
      startIndex: 0,
      endIndex: 2,
    },
  ];

  const wrapper = mount(CalendarGrid, {
    props: { days, bars, calendars: getCalendars() },
  });

  const covered = wrapper.findAll(".calendar-day.is-bar-covered");

  assert.equal(covered.length, 3);
  assert.equal(
    covered[0].attributes("data-date"),
    "2026-08-03",
  );
});

test("CalendarGrid emits open-edit when a multi-day bar is clicked", async () => {
  const days = [
    {
      dateKey: "2026-08-03",
      dayNumber: 3,
      label: "2026年8月3日 星期一",
      isCurrentMonth: true,
      isToday: false,
      events: [],
    },
    {
      dateKey: "2026-08-04",
      dayNumber: 4,
      label: "2026年8月4日 星期二",
      isCurrentMonth: true,
      isToday: false,
      events: [],
    },
  ];
  const bars = [
    {
      event: {
        id: "multi",
        title: "展覽",
        date: "2026-08-03",
        endDate: "2026-08-04",
        startTime: "09:00",
      },
      startIndex: 0,
      endIndex: 1,
    },
  ];

  const wrapper = mount(CalendarGrid, {
    props: { days, bars, calendars: getCalendars() },
  });

  await wrapper.find(".calendar-bar").trigger("click");

  assert.equal(wrapper.emitted("open-edit")[0][0], "multi");
});

test("CalendarGrid shows a source quote tooltip on a multi-day bar", async () => {
  const days = [
    {
      dateKey: "2026-08-03",
      dayNumber: 3,
      label: "2026年8月3日 星期一",
      isCurrentMonth: true,
      isToday: false,
      events: [],
    },
  ];
  const bars = [
    {
      event: {
        id: "multi",
        title: "展覽",
        date: "2026-08-03",
        endDate: "2026-08-05",
        startTime: "09:00",
        sourceQuote: "8月3日至5日舉行展覽",
      },
      startIndex: 0,
      endIndex: 0,
    },
  ];

  const wrapper = mount(CalendarGrid, {
    props: { days, bars, calendars: getCalendars() },
  });

  await wrapper.find(".calendar-bar").trigger("mouseenter");

  assert.equal(
    wrapper.find("#event-source-tooltip").text(),
    "8月3日至5日舉行展覽",
  );
});

test("CalendarGrid shows a source quote tooltip on hover", async () => {
  const days = [
    {
      dateKey: "2026-08-15",
      dayNumber: 15,
      label: "2026年8月15日 星期六",
      isCurrentMonth: true,
      isToday: false,
      events: [
        {
          id: "event-1",
          title: "覆診",
          startTime: "15:00",
          sourceQuote: "下周三下午三時在衛生局覆診",
        },
      ],
    },
  ];

  const wrapper = mount(CalendarGrid, {
    props: { days, calendars: getCalendars() },
  });
  const eventButton = wrapper.find(".event-summary");

  await eventButton.trigger("mouseenter");

  assert.equal(
    wrapper.find("#event-source-tooltip").text(),
    "下周三下午三時在衛生局覆診",
  );

  await eventButton.trigger("mouseleave");

  assert.ok(!wrapper.find("#event-source-tooltip").exists());
});

test("CalendarGrid does not render a tooltip without a source quote", async () => {
  const days = [
    {
      dateKey: "2026-08-15",
      dayNumber: 15,
      label: "2026年8月15日 星期六",
      isCurrentMonth: true,
      isToday: false,
      events: [{ id: "event-1", title: "覆診", startTime: "15:00" }],
    },
  ];

  const wrapper = mount(CalendarGrid, {
    props: { days, calendars: getCalendars() },
  });

  await wrapper.find(".event-summary").trigger("mouseenter");

  assert.ok(!wrapper.find("#event-source-tooltip").exists());
});
