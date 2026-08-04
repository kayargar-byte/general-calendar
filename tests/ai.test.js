import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import {
  normalizeParsedEvents,
  parseSchedule,
} from "../src/lib/ai.js";

const CALENDARS = [
  { id: "personal", label: "個人" },
  { id: "work", label: "工作" },
  { id: "medical", label: "醫療" },
];

function mockOkResponse(contentText) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: "text", text: contentText }],
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("parseSchedule returns normalized events from AI response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      mockOkResponse(
        '[{"title":"看醫生","date":"2026-08-06","startTime":"15:00","endTime":"16:00","calendarId":"medical","notes":""}]',
      ),
    ),
  );

  const events = await parseSchedule("後天下午三點看醫生", CALENDARS);

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "看醫生");
  assert.equal(events[0].calendarId, "medical");
  assert.equal(events[0].startTime, "15:00");
});

test("parseSchedule extracts JSON from a fenced code block", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      mockOkResponse(
        '```json\n[{"title":"開會","date":"2026-08-10","startTime":"09:00","endTime":"","calendarId":"work","notes":""}]\n```',
      ),
    ),
  );

  const events = await parseSchedule("下週一開會", CALENDARS);

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "開會");
  assert.equal(events[0].calendarId, "work");
});

test("parseSchedule throws when AI returns no parseable events", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(mockOkResponse("不是 JSON")),
  );

  await assert.rejects(
    () => parseSchedule("後天看醫生", CALENDARS),
    /無法解析/,
  );
});

test("parseSchedule throws for empty text", async () => {
  await assert.rejects(
    () => parseSchedule("  ", CALENDARS),
    /請先輸入日程描述/,
  );
});

test("parseSchedule surfaces proxy errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: { message: "尚未設定 API 金鑰。" },
      }),
    }),
  );

  await assert.rejects(
    () => parseSchedule("後天看醫生", CALENDARS),
    /尚未設定 API 金鑰/,
  );
});

test("parseSchedule throws when the proxy is unreachable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new Error("network down")),
  );

  await assert.rejects(
    () => parseSchedule("後天看醫生", CALENDARS),
    /無法連接 AI 服務/,
  );
});

test("normalizeParsedEvents falls back on invalid fields", () => {
  const events = normalizeParsedEvents(
    [
      {
        title: "",
        date: "not-a-date",
        startTime: "25:00",
        calendarId: "missing",
        notes: 42,
      },
      {
        title: "  會議  ",
        date: "2026-08-10",
        startTime: "10:00",
        endTime: "11:00",
        calendarId: "work",
        notes: "ok",
      },
    ],
    new Set(CALENDARS.map((calendar) => calendar.id)),
  );

  assert.equal(events.length, 2);
  assert.equal(events[0].title, "未命名事件");
  assert.equal(events[0].calendarId, "personal");
  assert.equal(events[1].title, "會議");
});
