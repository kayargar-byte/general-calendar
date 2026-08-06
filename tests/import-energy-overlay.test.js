import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ImportEnergyOverlay, {
  buildImportEffects,
  createParabolaFrames,
} from "../src/components/ImportEnergyOverlay.vue";

const visibleMonth = new Date(2026, 7, 1);
const sourceRect = { left: 18, top: 32, width: 120, height: 40 };
const calendarStylesPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/styles/calendar.css",
);

function request(overrides = {}) {
  return {
    taskId: "task-1",
    dates: ["2026-08-12"],
    events: [{ id: "event-1", date: "2026-08-12" }],
    ...overrides,
  };
}

function mountOverlay(requests, options = {}) {
  return mount(ImportEnergyOverlay, {
    attachTo: document.body,
    props: {
      requests,
      visibleMonth,
      getSourceRect: options.getSourceRect ?? (() => sourceRect),
      onFinished: options.onFinished,
    },
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("deduplicates same-date events and staggers document balls by 100ms", () => {
  const effects = buildImportEffects(
    request({
      dates: ["2026-08-12", "2026-08-13", "2026-08-12"],
      events: [
        { date: "2026-08-12" },
        { date: "2026-08-12" },
        { date: "2026-08-13" },
      ],
    }),
    visibleMonth,
  );

  assert.deepEqual(
    effects.currentMonth.map((effect) => effect.date),
    ["2026-08-12", "2026-08-13"],
  );
  assert.deepEqual(
    effects.currentMonth.map((effect) => effect.delay),
    [0, 100],
  );
});

test("builds a 650ms quadratic flight with a visible arc", () => {
  const frames = createParabolaFrames({ x: 10, y: 80 }, { x: 210, y: 180 });

  assert.equal(frames.duration, 650);
  assert.equal(frames.keyframes.length, 3);
  assert.ok(frames.keyframes[1].y < 80);
  assert.equal(frames.keyframes[2].x, 210);
  assert.equal(frames.keyframes[2].y, 180);
});

test("targets a matching current-month date cell and emits lifecycle events", async () => {
  vi.useFakeTimers();
  const target = document.createElement("div");
  target.dataset.dateKey = "2026-08-12";
  target.getBoundingClientRect = () => ({ left: 300, top: 200, width: 90, height: 110 });
  document.body.append(target);

  const wrapper = mountOverlay([request()]);
  await vi.advanceTimersByTimeAsync(0);

  assert.equal(wrapper.emitted("started")?.[0]?.[0], "task-1");
  assert.equal(wrapper.find('[data-energy-date="2026-08-12"]').exists(), true);

  await vi.advanceTimersByTimeAsync(900);
  assert.deepEqual(wrapper.emitted("finished"), [["task-1"]]);
  wrapper.unmount();
});

test("emits finished only after the final ball is removed", async () => {
  vi.useFakeTimers();
  const target = document.createElement("div");
  target.dataset.dateKey = "2026-08-12";
  document.body.append(target);
  let ballsAtFinish = -1;
  let wrapper;
  wrapper = mountOverlay([request()], {
    onFinished: () => {
      ballsAtFinish = wrapper.findAll(".import-energy-ball").length;
    },
  });

  await vi.advanceTimersByTimeAsync(900);

  assert.equal(ballsAtFinish, 0);
  wrapper.unmount();
});

test("groups off-month dates by month and reports event count in the popup", async () => {
  vi.useFakeTimers();
  const effects = buildImportEffects(
    request({
      dates: ["2026-09-01", "2026-09-02"],
      events: [
        { date: "2026-09-01" },
        { date: "2026-09-01" },
        { date: "2026-09-02" },
      ],
    }),
    visibleMonth,
  );
  assert.deepEqual(effects.offMonth, [
    { monthKey: "2026-09", year: 2026, month: 9, eventCount: 3, delay: 0 },
  ]);
  assert.deepEqual(
    effects.balls.map((effect) => ({ date: effect.date, delay: effect.delay })),
    [{ date: "2026-09-01", delay: 0 }],
  );

  const title = document.createElement("button");
  title.id = "calendar-title";
  title.getBoundingClientRect = () => ({ left: 300, top: 80, width: 100, height: 32 });
  document.body.append(title);
  const wrapper = mountOverlay([
    request({
      dates: ["2026-09-01", "2026-09-02"],
      events: [
        { date: "2026-09-01" },
        { date: "2026-09-01" },
        { date: "2026-09-02" },
      ],
    }),
  ]);

  await vi.advanceTimersByTimeAsync(0);
  assert.equal(wrapper.find(".import-month-popup").text(), "\u5df2\u52a0\u5165 2026 \u5e74 9 \u6708 \u00b7 3 \u500b\u4e8b\u4ef6");
  await vi.advanceTimersByTimeAsync(1001);
  assert.deepEqual(wrapper.emitted("finished"), [["task-1"]]);
  wrapper.unmount();
});

test("keeps a cross-month popup for each concurrent task in the same month", async () => {
  vi.useFakeTimers();
  const title = document.createElement("button");
  title.id = "calendar-title";
  document.body.append(title);
  const wrapper = mountOverlay([
    request({
      taskId: "first",
      dates: ["2026-09-01"],
      events: [{ date: "2026-09-01" }],
    }),
    request({
      taskId: "second",
      dates: ["2026-09-02"],
      events: [{ date: "2026-09-02" }, { date: "2026-09-02" }],
    }),
  ]);

  await vi.advanceTimersByTimeAsync(0);

  const popups = wrapper.findAll(".import-month-popup");
  assert.equal(popups.length, 2);
  assert.equal(popups[0].text(), "\u5df2\u52a0\u5165 2026 \u5e74 9 \u6708 \u00b7 1 \u500b\u4e8b\u4ef6");
  assert.equal(popups[1].text(), "\u5df2\u52a0\u5165 2026 \u5e74 9 \u6708 \u00b7 2 \u500b\u4e8b\u4ef6");
  wrapper.unmount();
});

test("acknowledges and finishes zero-date requests without leaving them stuck", async () => {
  const wrapper = mountOverlay([request({ dates: [], events: [] })]);
  await Promise.resolve();

  assert.deepEqual(wrapper.emitted("started"), [["task-1"]]);
  assert.deepEqual(wrapper.emitted("finished"), [["task-1"]]);
  wrapper.unmount();
});

test("reduced motion skips flight while preserving target reveal and lifecycle", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const target = document.createElement("div");
  target.dataset.dateKey = "2026-08-12";
  document.body.append(target);
  const wrapper = mountOverlay([request()]);
  await vi.advanceTimersByTimeAsync(0);

  assert.equal(wrapper.find(".import-energy-ball").exists(), false);
  assert.equal(target.classList.contains("is-import-revealed"), true);
  assert.deepEqual(wrapper.emitted("started"), [["task-1"]]);
  assert.deepEqual(wrapper.emitted("finished"), [["task-1"]]);
  wrapper.unmount();
});

test("reduced motion disables overlay, popup, and reveal animations", () => {
  const styles = readFileSync(calendarStylesPath, "utf8");

  assert.match(
    styles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.import-energy-ball[\s\S]*?animation:\s*none/,
  );
  assert.match(
    styles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.import-month-popup[\s\S]*?animation:\s*none/,
  );
  assert.match(
    styles,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.calendar-day\.is-import-revealed[\s\S]*?animation:\s*none/,
  );
});
