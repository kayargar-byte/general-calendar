import assert from "node:assert/strict";
import test from "node:test";

import * as calendarModule from "../js/calendar.js";

const { buildCalendarView, renderCalendar } = calendarModule;

function createDocumentFixture() {
  class Element {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.className = "";
      this.listeners = {};
      this.classList = {
        add: (...tokens) => {
          this.className = [this.className, ...tokens].filter(Boolean).join(" ");
        },
      };
    }

    setAttribute(name, value) {
      this.attributes[name] = value;
    }

    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }

    append(...children) {
      this.children.push(...children);
    }

    replaceChildren(...children) {
      this.children = children.flatMap((child) =>
        child.tagName === "#fragment" ? child.children : child,
      );
    }
  }

  const document = {
    createDocumentFragment: () => new Element("#fragment"),
    createElement: (tagName) => new Element(tagName),
  };
  const root = new Element("div");
  root.ownerDocument = document;

  return root;
}

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

test("renderCalendar exposes each event calendar for category styling", () => {
  const grid = createDocumentFixture();
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

  renderCalendar(grid, days, {
    onDateSelect() {},
    onEventSelect() {},
  });

  const eventButton = grid.children[0].children[1].children[0].children[0];
  assert.equal(eventButton.dataset.calendarId, "other");
});

test("renderMiniCalendar renders selectable dates from the visible month", () => {
  const miniCalendar = createDocumentFixture();
  const selectedDates = [];
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

  assert.equal(typeof calendarModule.renderMiniCalendar, "function");
  calendarModule.renderMiniCalendar(miniCalendar, days, {
    onDateSelect: (dateKey) => selectedDates.push(dateKey),
  });

  assert.equal(miniCalendar.children.length, 2);
  assert.equal(miniCalendar.children[1].dataset.date, "2026-08-02");
  assert.match(miniCalendar.children[1].className, /is-today/);

  miniCalendar.children[0].listeners.click();
  assert.deepEqual(selectedDates, ["2026-08-01"]);
});
