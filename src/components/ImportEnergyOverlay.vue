<script>
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FLIGHT_DURATION = 650;
const LANDING_DURATION = 250;

function validDateKey(value) {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function monthParts(dateKey) {
  const [year, month] = dateKey.split("-").map(Number);
  return { monthKey: dateKey.slice(0, 7), year, month };
}

export function createParabolaFrames(from, to) {
  const midpointX = (from.x + to.x) / 2;
  const midpointY = (from.y + to.y) / 2 - Math.max(72, Math.abs(to.x - from.x) * 0.18);

  return {
    duration: FLIGHT_DURATION,
    keyframes: [
      { x: from.x, y: from.y },
      { x: midpointX, y: midpointY },
      { x: to.x, y: to.y },
    ],
  };
}

export function buildImportEffects(request, visibleMonth) {
  const uniqueDates = [
    ...new Set(
      [...(request?.dates ?? []), ...(request?.events ?? []).map((event) => event?.date)]
        .filter(validDateKey),
    ),
  ];
  const visibleYear = visibleMonth.getFullYear();
  const visibleMonthIndex = visibleMonth.getMonth() + 1;
  const offMonthKeys = new Set();
  const balls = uniqueDates
    .filter((date) => {
      const { year, month, monthKey } = monthParts(date);
      if (year === visibleYear && month === visibleMonthIndex) return true;
      if (offMonthKeys.has(monthKey)) return false;
      offMonthKeys.add(monthKey);
      return true;
    })
    .map((date, index) => {
    const parts = monthParts(date);
    return {
      date,
      delay: index * 100,
      isCurrentMonth:
        parts.year === visibleYear && parts.month === visibleMonthIndex,
      ...parts,
    };
    });
  const offMonthCounts = new Map();

  for (const event of request?.events ?? []) {
    if (!validDateKey(event?.date)) continue;
    const parts = monthParts(event.date);
    if (parts.year === visibleYear && parts.month === visibleMonthIndex) continue;
    offMonthCounts.set(parts.monthKey, (offMonthCounts.get(parts.monthKey) ?? 0) + 1);
  }

  return {
    balls,
    currentMonth: balls.filter((ball) => ball.isCurrentMonth),
    offMonth: [...new Set(balls.filter((ball) => !ball.isCurrentMonth).map((ball) => ball.monthKey))].map(
      (monthKey) => {
        const parts = monthParts(`${monthKey}-01`);
        return {
          ...parts,
          eventCount:
            offMonthCounts.get(monthKey) ??
            balls.filter((ball) => ball.monthKey === monthKey).length,
          delay: balls.find((ball) => ball.monthKey === monthKey)?.delay ?? 0,
        };
      },
    ),
  };
}
</script>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  requests: { type: Array, default: () => [] },
  visibleMonth: { type: Date, required: true },
  getSourceRect: { type: Function, default: () => null },
});
const emit = defineEmits(["started", "finished"]);

const balls = ref([]);
const popups = ref([]);
const handledTasks = new Set();
const timers = new Set();

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
  return timer;
}

function elementRect(selector) {
  return document.querySelector(selector)?.getBoundingClientRect() ?? null;
}

function pointFromRect(rect) {
  if (!rect) return { x: 24, y: 24 };
  return {
    x: rect.left + Math.max(8, rect.width / 2),
    y: rect.top + Math.max(8, rect.height / 2),
  };
}

function revealTarget(effect) {
  const selector = effect.isCurrentMonth
    ? `[data-date-key="${effect.date}"]`
    : "#calendar-title";
  const target = document.querySelector(selector);
  target?.classList.add("is-import-revealed");
  schedule(() => target?.classList.remove("is-import-revealed"), 500);
}

function showMonthPopup(taskId, effect) {
  const id = `${taskId}-${effect.monthKey}`;
  if (popups.value.some((popup) => popup.id === id)) return;
  const rect = elementRect("#calendar-title");
  const point = pointFromRect(rect);
  popups.value = [
    ...popups.value,
    {
      ...effect,
      id,
      x: point.x,
      y: rect ? rect.bottom + 8 : point.y + 8,
    },
  ];
  schedule(() => {
    popups.value = popups.value.filter((popup) => popup.id !== id);
  }, 2600);
}

function startBall(taskId, effect, sourceRect, eventCount, isLastBall) {
  const selector = effect.isCurrentMonth
    ? `[data-date-key="${effect.date}"]`
    : "#calendar-title";
  const target = elementRect(selector);
  const from = pointFromRect(sourceRect);
  const to = pointFromRect(target);
  const frame = createParabolaFrames(from, to);
  const id = `${taskId}-${effect.date}`;

  balls.value = [
    ...balls.value,
    { id, date: effect.date, frame, phase: "flying" },
  ];
  if (!effect.isCurrentMonth) {
    showMonthPopup(taskId, { ...effect, eventCount });
  }
  schedule(() => {
    revealTarget(effect);
    balls.value = balls.value.map((ball) =>
      ball.id === id ? { ...ball, phase: "landing" } : ball,
    );
    schedule(async () => {
      balls.value = balls.value.filter((ball) => ball.id !== id);
      if (isLastBall) {
        await nextTick();
        emit("finished", taskId);
      }
    }, LANDING_DURATION);
  }, frame.duration);
}

async function processRequest(request) {
  if (!request?.taskId || handledTasks.has(request.taskId)) return;
  handledTasks.add(request.taskId);

  await nextTick();
  // The rail acknowledges successful tasks on started, so capture before emit.
  const sourceRect = props.getSourceRect(request.taskId);
  const effects = buildImportEffects(request, props.visibleMonth);
  const eventCounts = new Map(effects.offMonth.map((effect) => [effect.monthKey, effect.eventCount]));

  if (effects.balls.length === 0) {
    emit("started", request.taskId);
    emit("finished", request.taskId);
    return;
  }

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reducedMotion) {
    for (const [index, effect] of effects.balls.entries()) {
      revealTarget(effect);
      if (!effect.isCurrentMonth) {
        showMonthPopup(request.taskId, {
          ...effect,
          eventCount: eventCounts.get(effect.monthKey),
        });
      }
      if (index === 0) emit("started", request.taskId);
    }
    emit("finished", request.taskId);
    return;
  }

  for (const [index, effect] of effects.balls.entries()) {
    schedule(
      () => {
        startBall(
          request.taskId,
          effect,
          sourceRect,
          eventCounts.get(effect.monthKey),
          index === effects.balls.length - 1,
        );
        if (index === 0) emit("started", request.taskId);
      },
      effect.delay,
    );
  }
}

watch(
  () => props.requests,
  (requests) => {
    for (const request of requests) {
      void processRequest(request);
    }
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(() => {
  for (const timer of timers) window.clearTimeout(timer);
  timers.clear();
});
</script>

<template>
  <div class="import-energy-overlay" aria-hidden="true">
    <span
      v-for="ball in balls"
      :key="ball.id"
      class="import-energy-ball"
      :class="`is-${ball.phase}`"
      :data-energy-date="ball.date"
      :style="{
        '--from-x': `${ball.frame.keyframes[0].x}px`,
        '--from-y': `${ball.frame.keyframes[0].y}px`,
        '--arc-x': `${ball.frame.keyframes[1].x}px`,
        '--arc-y': `${ball.frame.keyframes[1].y}px`,
        '--to-x': `${ball.frame.keyframes[2].x}px`,
        '--to-y': `${ball.frame.keyframes[2].y}px`,
      }"
    >
      <i class="import-energy-ripple" />
    </span>
    <span
      v-for="popup in popups"
      :key="popup.id"
      class="import-month-popup"
      :style="{ left: `${popup.x}px`, top: `${popup.y}px` }"
    >
      已加入 {{ popup.year }} 年 {{ popup.month }} 月 &middot; {{ popup.eventCount }} 個事件
    </span>
  </div>
</template>
