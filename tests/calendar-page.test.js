import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "@vue/test-utils";
import { test } from "vitest";
import App from "../src/App.vue";
import { toDateKey } from "../src/lib/date-utils.js";
import { createEvent } from "../src/lib/storage.js";

const calendarPagePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../calendar.html",
);
const calendarStylesPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/styles/calendar.css",
);

const calendarIds = [
  "work",
  "family",
  "medical",
  "documents",
  "allowances",
  "leisure",
  "other",
];

const requiredIds = [
  "create-event",
  "mini-calendar",
  "calendar-filters",
  "calendar-title",
  "calendar-grid",
  "previous-month",
  "today",
  "next-month",
  "event-dialog",
  "event-form",
  "event-title",
  "event-date",
  "event-calendar",
  "event-start-time",
  "event-end-time",
  "event-notes",
  "delete-event",
  "cancel-event",
  "close-event-dialog",
  "ai-schedule-launcher",
  "ai-schedule-panel",
  "ai-schedule-title",
  "ai-schedule-input",
  "close-ai-schedule",
  "analyze-ai-schedule",
];

function readCalendarPage() {
  assert.equal(existsSync(calendarPagePath), true, "calendar.html should exist");
  return readFileSync(calendarPagePath, "utf8");
}

function readCalendarStyles() {
  assert.equal(existsSync(calendarStylesPath), true, "calendar.css should exist");
  return readFileSync(calendarStylesPath, "utf8");
}

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const channels = hex
      .match(/[a-f\d]{2}/gi)
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) =>
        channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      );

    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const first = luminance(foreground);
  const second = luminance(background);

  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("calendar page mounts the approved application structure", () => {
  const wrapper = mount(App);

  for (const id of requiredIds) {
    assert.ok(wrapper.find(`#${id}`).exists(), id);
  }

  assert.ok(wrapper.find("aside").exists());
  assert.ok(wrapper.find("main").exists());
  assert.ok(wrapper.find("dialog").exists());
});

test("calendar page renders each calendar category twice and enables controls", () => {
  const wrapper = mount(App);
  const checkboxes = wrapper.findAll("#calendar-filters input[type='checkbox']");
  const options = wrapper.findAll("#event-calendar option");

  assert.equal(checkboxes.length, 7);
  assert.equal(options.length, 7);

  for (const calendarId of calendarIds) {
    assert.ok(
      checkboxes.some((checkbox) => checkbox.element.value === calendarId),
      calendarId,
    );
    assert.ok(
      options.some((option) => option.element.value === calendarId),
      calendarId,
    );
  }

  assert.equal(wrapper.find("#create-event").attributes("disabled"), undefined);
  assert.equal(wrapper.find("#event-calendar").attributes("disabled"), undefined);

  for (const checkbox of checkboxes) {
    assert.equal(checkbox.attributes("disabled"), undefined);
  }
});

test("calendar page exposes the AI schedule panel initial states", () => {
  const wrapper = mount(App);

  assert.equal(
    wrapper.find("#ai-schedule-launcher").attributes("aria-expanded"),
    "false",
  );
  assert.equal(
    wrapper.find("#ai-schedule-panel").attributes("aria-hidden"),
    "true",
  );
});

test("calendar page entry loads the Vue application", () => {
  const html = readCalendarPage();

  assert.match(html, /<div id="app"><\/div>/);
  assert.match(html, /<script type="module" src="\/src\/main\.js"><\/script>/);
});

test("calendar page loads the desktop calendar visual system", () => {
  const css = readCalendarStyles();

  for (const selector of [
    ".calendar-toolbar",
    ".calendar-sidebar",
    ".calendar-grid",
    ".mini-calendar-date",
    "dialog",
  ]) {
    assert.match(css, new RegExp(selector.replace(".", "\\.")));
  }

  for (const calendarId of calendarIds) {
    assert.match(css, new RegExp(`data-calendar-id="${calendarId}"`));
  }
});

test("calendar page styles the AI schedule panel states", () => {
  const css = readCalendarStyles();

  assert.match(css, /\.calendar-layout\.is-ai-schedule-open/);
  assert.match(css, /220ms/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("calendar page renders a multi-day event as a bar, not in day lists", () => {
  localStorage.clear();
  // 以當月第 3–5 日為多日事件，確保落於當前可見月內。
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 3);
  const end = new Date(today.getFullYear(), today.getMonth(), 5);
  createEvent({
    title: "展覽",
    date: toDateKey(start),
    endDate: toDateKey(end),
    calendarId: "leisure",
    startTime: "09:00",
    endTime: "18:00",
    notes: "",
  });

  const wrapper = mount(App);

  assert.equal(wrapper.findAll(".calendar-bar").length > 0, true);
  assert.equal(wrapper.findAll(".event-summary").length, 0);
});

test("calendar text colors meet WCAG AA contrast", () => {
  const css = readCalendarStyles();
  const accent = css.match(/--color-accent:\s*(#[a-f\d]{6})/i)?.[1];
  const secondary = css.match(
    /--color-text-secondary:\s*(#[a-f\d]{6})/i,
  )?.[1];

  assert.ok(accent);
  assert.ok(secondary);
  assert.ok(contrastRatio("#ffffff", accent) >= 4.5);
  assert.ok(contrastRatio(secondary, "#ffffff") >= 4.5);
});
