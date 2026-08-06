import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import {
  analyzeDocument,
  askAi,
  normalizeParsedEvents,
  parseSchedule,
} from "../src/lib/ai.js";
import { createEvent } from "../src/lib/storage.js";

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
  localStorage.clear();
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

test("normalizeParsedEvents drops an event with an invalid date", () => {
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

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "會議");
  assert.equal(events[0].calendarId, "work");
});

test("normalizeParsedEvents drops an event without a date field", () => {
  const events = normalizeParsedEvents(
    [{ title: "無日期", calendarId: "work" }],
    new Set(CALENDARS.map((calendar) => calendar.id)),
  );

  assert.equal(events.length, 0);
});

test("normalizeParsedEvents keeps an event with a valid date", () => {
  const events = normalizeParsedEvents(
    [{ title: "會議", date: "2026-08-10", calendarId: "work" }],
    new Set(CALENDARS.map((calendar) => calendar.id)),
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].date, "2026-08-10");
});

test("normalizeParsedEvents keeps a valid multi-day endDate", () => {
  const events = normalizeParsedEvents(
    [
      {
        title: "展覽",
        date: "2026-08-14",
        endDate: "2026-08-16",
        calendarId: "work",
      },
    ],
    new Set(CALENDARS.map((calendar) => calendar.id)),
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].endDate, "2026-08-16");
});

test("normalizeParsedEvents treats a same-day endDate as single-day", () => {
  const events = normalizeParsedEvents(
    [
      {
        title: "會議",
        date: "2026-08-10",
        endDate: "2026-08-10",
        calendarId: "work",
      },
    ],
    new Set(CALENDARS.map((calendar) => calendar.id)),
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].endDate, "");
});

test("normalizeParsedEvents drops an event with an invalid endDate", () => {
  const events = normalizeParsedEvents(
    [
      {
        title: "結束日早於開始日",
        date: "2026-08-10",
        endDate: "2026-08-01",
        calendarId: "work",
      },
      {
        title: "結束日格式錯",
        date: "2026-08-10",
        endDate: "2026-8-12",
        calendarId: "work",
      },
    ],
    new Set(CALENDARS.map((calendar) => calendar.id)),
  );

  assert.equal(events.length, 0);
});

test("askAi instructs multi-day events to output endDate", async () => {
  let sentBody;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      sentBody = JSON.parse(options.body);
      return mockOkResponse('{"type":"events","events":[]}');
    }),
  );

  await askAi("下週三到週五展覽", CALENDARS);

  assert.match(sentBody.system, /endDate/);
  assert.match(sentBody.system, /YYYY-MM-DD/);
});

test("askAi instructs the model to pick calendarId only from the provided list", async () => {
  let sentBody;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      sentBody = JSON.parse(options.body);
      return mockOkResponse('{"type":"events","events":[]}');
    }),
  );

  await askAi("澳門美食節", CALENDARS);

  // 分類強化：不得自創 id、附分類定義、外部結果不明時歸 other（見 docs/adr/0007）。
  assert.match(sentBody.system, /不得自創/);
  assert.match(sentBody.system, /就醫、覆診、疫苗/);
  assert.match(sentBody.system, /外部搜尋結果無法確定歸類時選 other/);
});

function mockDocumentOkResponse(events, extractedText = "") {
  return {
    ok: true,
    json: async () => ({ events, extractedText }),
  };
}

test("analyzeDocument sends the proxy key and returns normalized events with quotes", async () => {
  let requestHeaders;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      requestHeaders = options.headers;
      return mockDocumentOkResponse(
        [
          {
            title: "覆診",
            date: "2026-08-06",
            startTime: "15:00",
            endTime: "16:00",
            calendarId: "medical",
            notes: "",
            quote: "下周三下午三時在衛生局覆診",
          },
        ],
        "範例原文",
      );
    }),
  );

  const file = new File(["content"], "sample.docx", {
    type: "application/pdf",
  });
  const { events, extractedText } = await analyzeDocument(file, CALENDARS);

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "覆診");
  assert.equal(events[0].quote, "下周三下午三時在衛生局覆診");
  assert.equal(extractedText, "範例原文");
  // 代理金鑰自 .env 讀取（測試環境值，見 vite.config.js 的 test.env）。
  assert.equal(requestHeaders["X-Proxy-Key"], "test-proxy-key");
});

test("analyzeDocument sends the aggregated profile in the form data", async () => {
  let sentForm;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      sentForm = options.body;
      return mockDocumentOkResponse(
        [{ title: "覆診", date: "2026-08-06", calendarId: "medical" }],
        "範例原文",
      );
    }),
  );
  // 有畫像資料，讓聚合摘要非空。
  createEvent({ title: "覆診", date: "2026-08-06", calendarId: "medical" });

  const file = new File(["content"], "sample.docx", { type: "application/pdf" });
  await analyzeDocument(file, CALENDARS);

  assert.match(sentForm.get("profile"), /醫療 1 筆/);
  assert.ok(sentForm.get("calendars").includes("medical"));
});

test("analyzeDocument throws when the proxy is unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
  const file = new File(["content"], "a.pdf", { type: "application/pdf" });

  await assert.rejects(
    () => analyzeDocument(file, CALENDARS),
    /無法連接 AI 服務/,
  );
});

test("analyzeDocument surfaces proxy error messages", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error: { message: "此 PDF 為掃描型，無法直接抽文字" },
      }),
    }),
  );
  const file = new File(["content"], "scan.pdf", { type: "application/pdf" });

  await assert.rejects(
    () => analyzeDocument(file, CALENDARS),
    /此 PDF 為掃描型/,
  );
});

test("analyzeDocument throws when no events are returned", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockDocumentOkResponse([])));
  const file = new File(["content"], "a.pdf", { type: "application/pdf" });

  await assert.rejects(
    () => analyzeDocument(file, CALENDARS),
    /未能從文檔中解析出任何事件/,
  );
});

test("analyzeDocument rejects non-file input", async () => {
  await assert.rejects(
    () => analyzeDocument("not a file", CALENDARS),
    /請先選擇要匯入的文檔/,
  );
});

test("askAi returns events with normalized source fields", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      mockOkResponse(
        '{"type":"events","events":[],"candidates":[{"title":"美食節","date":"2026-03-20","calendarId":"other","sourceUrl":"https://m.gov.mo/a","sourceTitle":"官方","sourceSnippet":"3月20日"}],"explanation":""}',
      ),
    ),
  );

  const result = await askAi("澳門美食節幾時", CALENDARS);

  assert.equal(result.type, "events");
  assert.equal(result.events.length, 0);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].sourceUrl, "https://m.gov.mo/a");
  assert.equal(result.candidates[0].sourceTitle, "官方");
  assert.equal(result.candidates[0].sourceSnippet, "3月20日");
});

test("askAi returns a clarify request when the model asks for clarification", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      mockOkResponse(
        '{"type":"clarify","question":"你想查什麼？","options":[{"id":"a","label":"颱風假"},{"id":"b","label":"航班"}]}',
      ),
    ),
  );

  const result = await askAi("颱風", CALENDARS);

  assert.equal(result.type, "clarify");
  assert.equal(result.question, "你想查什麼？");
  assert.equal(result.options.length, 2);
  assert.equal(result.options[1].label, "航班");
});

test("askAi treats a bare array as events (legacy protocol)", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      mockOkResponse(
        '[{"title":"看醫生","date":"2026-08-06","calendarId":"medical"}]',
      ),
    ),
  );

  const result = await askAi("後天看醫生", CALENDARS);

  assert.equal(result.type, "events");
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].title, "看醫生");
  assert.deepEqual(result.recommendations, []);
});

test("askAi returns normalized recommendations from the events response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      mockOkResponse(
        '{"type":"events","events":[],"candidates":[],"recommendations":[{"topic":"  政府津貼申請  ","reason":"你近期常搜補助"},{"topic":"","reason":"忽略"},42],"explanation":""}',
      ),
    ),
  );

  const result = await askAi("疫苗", CALENDARS);

  assert.equal(result.type, "events");
  assert.deepEqual(result.recommendations, [
    { topic: "政府津貼申請", reason: "你近期常搜補助" },
  ]);
});

test("askAi defaults recommendations to an empty array when absent", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      mockOkResponse('{"type":"events","events":[],"candidates":[]}'),
    ),
  );

  const result = await askAi("疫苗", CALENDARS);

  assert.deepEqual(result.recommendations, []);
});

test("askAi throws for empty text", async () => {
  await assert.rejects(() => askAi("  ", CALENDARS), /請先輸入日程描述/);
});

test("askAi sends the search flag and context messages", async () => {
  let sentBody;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      sentBody = JSON.parse(options.body);
      return mockOkResponse(
        '{"type":"events","events":[{"title":"會議","date":"2026-08-10","calendarId":"work"}]}',
      );
    }),
  );

  const result = await askAi("下週一開會", CALENDARS, {
    contextMessages: [{ role: "user", content: "前文" }],
  });

  assert.equal(sentBody.search, true);
  assert.equal(sentBody.max_tokens, 2048);
  assert.equal(sentBody.messages.length, 2);
  assert.equal(result.type, "events");
  assert.equal(result.events[0].title, "會議");
});

test("askAi injects the aggregated profile into the search prompt", async () => {
  let sentBody;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      sentBody = JSON.parse(options.body);
      return mockOkResponse('{"type":"events","events":[]}');
    }),
  );

  // 先建立一筆醫療事件，讓畫像聚合出事件傾向。
  createEvent({ title: "覆診", date: "2026-08-06", calendarId: "medical" });

  await askAi("澳門美食節", CALENDARS);

  assert.match(sentBody.system, /用戶畫像/);
  assert.match(sentBody.system, /醫療 1 筆/);
  assert.match(sentBody.system, /分類偏置/);
  assert.match(sentBody.system, /recommendations/);
});

test("askAi omits the profile section when there is no profile data", async () => {
  let sentBody;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      sentBody = JSON.parse(options.body);
      return mockOkResponse('{"type":"events","events":[]}');
    }),
  );

  await askAi("澳門美食節", CALENDARS);

  assert.ok(!sentBody.system.includes("用戶畫像"));
});

test("parseSchedule does not inject the profile (backward-compatible path)", async () => {
  let sentBody;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      sentBody = JSON.parse(options.body);
      return mockOkResponse(
        '[{"title":"看醫生","date":"2026-08-06","calendarId":"medical"}]',
      );
    }),
  );

  // 有畫像資料也一樣不注入（search:false 純解析路徑）。
  createEvent({ title: "覆診", date: "2026-08-06", calendarId: "medical" });

  await parseSchedule("後天看醫生", CALENDARS);

  assert.ok(!sentBody.system.includes("用戶畫像"));
});
