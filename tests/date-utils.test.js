import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMonthGrid,
  formatDateLabel,
  formatMonthTitle,
  toDateKey,
} from "../js/date-utils.js";

test("toDateKey uses the local calendar date", () => {
  assert.equal(toDateKey(new Date(2026, 7, 2, 23, 30)), "2026-08-02");
});

test("formatMonthTitle returns a Traditional Chinese year and month", () => {
  assert.equal(formatMonthTitle(2026, 7), "2026年8月");
});

test("formatDateLabel includes the local date and weekday", () => {
  assert.equal(formatDateLabel(new Date(2026, 7, 2)), "2026年8月2日 星期日");
});

test("buildMonthGrid returns complete Monday-to-Sunday weeks", () => {
  const cases = [
    {
      name: "28-day February",
      year: 2021,
      monthIndex: 1,
      length: 28,
      first: "2021-02-01",
      last: "2021-02-28",
    },
    {
      name: "leap-year February",
      year: 2024,
      monthIndex: 1,
      length: 35,
      first: "2024-01-29",
      last: "2024-03-03",
    },
    {
      name: "30-day April",
      year: 2025,
      monthIndex: 3,
      length: 35,
      first: "2025-03-31",
      last: "2025-05-04",
    },
    {
      name: "31-day August",
      year: 2021,
      monthIndex: 7,
      length: 42,
      first: "2021-07-26",
      last: "2021-09-05",
    },
  ];

  for (const currentCase of cases) {
    const days = buildMonthGrid(currentCase.year, currentCase.monthIndex);

    assert.equal(days.length, currentCase.length, currentCase.name);
    assert.equal(toDateKey(days[0]), currentCase.first, currentCase.name);
    assert.equal(toDateKey(days.at(-1)), currentCase.last, currentCase.name);
    assert.equal(days[0].getDay(), 1, currentCase.name);
    assert.equal(days.at(-1).getDay(), 0, currentCase.name);
  }
});

test("buildMonthGrid crosses the year boundary without losing days", () => {
  const days = buildMonthGrid(2026, 0);

  assert.equal(toDateKey(days[0]), "2025-12-29");
  assert.equal(toDateKey(days.at(-1)), "2026-02-01");
});
