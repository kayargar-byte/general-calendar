import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const calendarPageUrl = new URL("../calendar.html", import.meta.url);
const calendarStylesUrl = new URL("../calendar.css", import.meta.url);

function readCalendarPage() {
  assert.equal(existsSync(calendarPageUrl), true, "calendar.html should exist");
  return readFileSync(calendarPageUrl, "utf8");
}

function readCalendarStyles() {
  assert.equal(existsSync(calendarStylesUrl), true, "calendar.css should exist");
  return readFileSync(calendarStylesUrl, "utf8");
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

test("calendar page exposes the approved application structure", () => {
  const html = readCalendarPage();
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
    "theme-toggle",
    "event-search",
    "search-results",
    "ai-batch-dialog",
    "ai-batch-dialog-title",
    "close-ai-batch-dialog",
    "cancel-ai-batch",
    "confirm-ai-batch",
    "ai-batch-list",
    "open-manage",
    "manage-dialog",
    "manage-dialog-title",
    "close-manage-dialog",
    "manage-tab-events",
    "manage-tab-tags",
    "manage-events-panel",
    "manage-tags-panel",
    "manage-event-list",
    "manage-tag-list",
    "open-settings",
    "settings-dialog",
    "settings-dialog-title",
    "close-settings-dialog",
    "settings-language",
    "calendar-title-button",
    "date-picker-popover",
    "date-picker-year",
    "date-picker-month",
    "date-picker-day",
    "date-picker-confirm",
    "date-picker-cancel",
  ];

  assert.match(html, /<aside\b/);
  assert.match(html, /<main\b/);
  assert.match(html, /<dialog\b/);

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }

  for (const calendarId of [
    "personal",
    "documents",
    "medical",
    "family",
    "work",
    "other",
  ]) {
    const matches = html.match(new RegExp(`value="${calendarId}"`, "g"));
    assert.equal(matches?.length, 2, calendarId);
  }

  assert.match(html, /<script type="module" src="js\/app\.js"><\/script>/);
});

test("calendar page enables controls wired by the application", () => {
  const html = readCalendarPage();

  assert.doesNotMatch(html, /<button[^>]*id="create-event"[^>]*disabled/);
  assert.doesNotMatch(html, /<select[^>]*id="event-calendar"[^>]*disabled/);

  for (const calendarId of [
    "personal",
    "documents",
    "medical",
    "family",
    "work",
    "other",
  ]) {
    assert.doesNotMatch(
      html,
      new RegExp(`<input[^>]*value="${calendarId}"[^>]*disabled`),
    );
  }
});

test("calendar page loads the desktop calendar visual system", () => {
  const html = readCalendarPage();
  const css = readCalendarStyles();

  assert.match(html, /<link rel="stylesheet" href="calendar\.css" \/>/);

  for (const selector of [
    ".calendar-toolbar",
    ".calendar-sidebar",
    ".calendar-grid",
    ".mini-calendar-date",
    "dialog",
    ".manage-dialog",
    ".manage-tab",
    ".settings-button",
    ".date-picker-popover",
    ".calendar-workspace",
  ]) {
    assert.match(css, new RegExp(selector.replace(".", "\\.")));
  }

  for (const calendarId of [
    "personal",
    "documents",
    "medical",
    "family",
    "work",
    "other",
  ]) {
    assert.match(css, new RegExp(`data-calendar-id="${calendarId}"`));
  }
});

test("calendar page exposes the AI schedule panel states", () => {
  const html = readCalendarPage();
  const css = readCalendarStyles();
  const requiredIds = [
    "ai-schedule-launcher",
    "ai-schedule-panel",
    "ai-schedule-title",
    "ai-schedule-input",
    "close-ai-schedule",
    "analyze-ai-schedule",
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }

  assert.match(
    html,
    /id="ai-schedule-launcher"[^>]*aria-controls="ai-schedule-panel"[^>]*aria-expanded="false"/,
  );
  assert.match(html, /id="ai-schedule-panel"[^>]*aria-hidden="true"/);
  assert.match(css, /\.calendar-layout\.is-ai-schedule-open/);
  assert.match(css, /220ms/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
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
