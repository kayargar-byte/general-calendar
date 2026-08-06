import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test, vi } from "vitest";
import {
  analyzeDocument,
  assertFileSize,
  MAX_FILE_BYTES,
} from "../server/extractors.js";

// pdf-parse 對測試環境較重，統一 mock（數字 PDF 與掃描回退分支皆經此控制）。
vi.mock("pdf-parse", () => ({ PDFParse: vi.fn() }));
import { PDFParse } from "pdf-parse";

const AI_CONFIG = {
  remoteEndpoint: "https://ark.example/messages",
  visionEndpoint: "https://ark.example/vision",
  apiKey: "test-key",
  visionApiKey: "vision-test-key",
  model: "test-model",
  visionModel: "test-vision",
};

const CALENDARS = [
  { id: "personal", label: "個人" },
  { id: "work", label: "工作" },
  { id: "medical", label: "醫療" },
];

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

function loadFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name));
}

function mockTextResponse(json) {
  return {
    ok: true,
    json: async () => ({ content: [{ type: "text", text: json }] }),
  };
}

function mockVisionResponse(json) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content: json } }] }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("analyzeDocument extracts events from a real DOCX with quotes", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      mockTextResponse(
        '[{"title":"覆診","date":"2026-08-06","startTime":"15:00","endTime":"16:00","calendarId":"medical","notes":"","quote":"下周三下午三時在衛生局覆診"}]',
      ),
    ),
  );

  const { events, extractedText } = await analyzeDocument({
    mimeType: DOCX_MIME,
    filename: "sample.docx",
    buffer: loadFixture("sample.docx"),
    calendars: CALENDARS,
    aiConfig: AI_CONFIG,
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "覆診");
  assert.equal(events[0].quote, "下周三下午三時在衛生局覆診");
  assert.match(extractedText, /下周三下午三時在衛生局覆診/);
});

test("analyzeDocument passes through a multi-day endDate from the AI response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      mockTextResponse(
        '[{"title":"展覽","date":"2026-08-14","endDate":"2026-08-16","startTime":"09:00","endTime":"18:00","calendarId":"work","notes":"","quote":"展覽於8月14日至16日舉行"}]',
      ),
    ),
  );

  const { events } = await analyzeDocument({
    mimeType: DOCX_MIME,
    filename: "sample.docx",
    buffer: loadFixture("sample.docx"),
    calendars: CALENDARS,
    aiConfig: AI_CONFIG,
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].endDate, "2026-08-16");
});

test("analyzeDocument instructs multi-day events to output endDate", async () => {
  let requestBody;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      requestBody = JSON.parse(options.body);
      return mockTextResponse(
        '[{"title":"覆診","date":"2026-08-06","startTime":"15:00","endTime":"16:00","calendarId":"medical","notes":"","quote":"下周三下午三時在衛生局覆診"}]',
      );
    }),
  );

  await analyzeDocument({
    mimeType: DOCX_MIME,
    filename: "sample.docx",
    buffer: loadFixture("sample.docx"),
    calendars: CALENDARS,
    aiConfig: AI_CONFIG,
  });

  assert.match(requestBody.system, /endDate/);
  assert.match(requestBody.system, /YYYY-MM-DD/);
});

test("analyzeDocument injects the aggregated profile into the extraction prompt", async () => {
  let requestBody;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      requestBody = JSON.parse(options.body);
      return mockTextResponse(
        '[{"title":"覆診","date":"2026-08-06","startTime":"15:00","endTime":"16:00","calendarId":"medical","notes":"","quote":"下周三下午三時在衛生局覆診"}]',
      );
    }),
  );

  const { events } = await analyzeDocument({
    mimeType: DOCX_MIME,
    filename: "sample.docx",
    buffer: loadFixture("sample.docx"),
    calendars: CALENDARS,
    profile: "事件傾向：醫療 1 筆（共 1 筆）",
    aiConfig: AI_CONFIG,
  });

  assert.equal(events.length, 1);
  assert.match(requestBody.system, /用戶畫像/);
  assert.match(requestBody.system, /醫療 1 筆/);
  assert.match(requestBody.system, /分類偏置/);
});

test("analyzeDocument omits the profile section when no profile is provided", async () => {
  let requestBody;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      requestBody = JSON.parse(options.body);
      return mockTextResponse(
        '[{"title":"覆診","date":"2026-08-06","calendarId":"medical","notes":"","quote":"覆診"}]',
      );
    }),
  );

  await analyzeDocument({
    mimeType: DOCX_MIME,
    filename: "sample.docx",
    buffer: loadFixture("sample.docx"),
    calendars: CALENDARS,
    aiConfig: AI_CONFIG,
  });

  assert.ok(!requestBody.system.includes("用戶畫像"));
});

test("analyzeDocument treats a real XLSX as row-based events", async () => {
  let requestBody;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      requestBody = JSON.parse(options.body);
      return mockTextResponse(
        '[{"title":"覆診","date":"2026-08-06","startTime":"15:00","endTime":"16:00","calendarId":"medical","notes":"","quote":"title: 覆診 | date: 2026-08-06"}]',
      );
    }),
  );

  const { events, extractedText } = await analyzeDocument({
    mimeType: XLSX_MIME,
    filename: "sample.xlsx",
    buffer: loadFixture("sample.xlsx"),
    calendars: CALENDARS,
    aiConfig: AI_CONFIG,
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].quote, "title: 覆診 | date: 2026-08-06");
  assert.match(requestBody.system, /Excel 表格/);
  assert.match(extractedText, /覆診/);
});

test("analyzeDocument extracts events from a digital PDF", async () => {
  PDFParse.mockImplementation(function () {
    return {
      getText: async () => ({
        text: "下周三下午三時在衛生局覆診\nMeeting on 2026-08-15 at 14:00",
      }),
      destroy: async () => {},
    };
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      mockTextResponse(
        '[{"title":"覆診","date":"2026-08-06","startTime":"15:00","endTime":"16:00","calendarId":"medical","notes":"","quote":"下周三下午三時在衛生局覆診"}]',
      ),
    ),
  );

  const { events, extractedText } = await analyzeDocument({
    mimeType: "application/pdf",
    filename: "sample.pdf",
    buffer: Buffer.from("fake pdf bytes"),
    calendars: CALENDARS,
    aiConfig: AI_CONFIG,
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].title, "覆診");
  assert.match(extractedText, /Meeting on 2026-08-15/);
});

test("analyzeDocument rejects a scanned PDF with SCANNED_PDF", async () => {
  PDFParse.mockImplementation(function () {
    return {
      getText: async () => ({ text: "" }),
      destroy: async () => {},
    };
  });

  await assert.rejects(
    () =>
      analyzeDocument({
        mimeType: "application/pdf",
        filename: "scan.pdf",
        buffer: Buffer.from("fake scan"),
        calendars: CALENDARS,
        aiConfig: AI_CONFIG,
      }),
    (err) => err.code === "SCANNED_PDF",
  );
});

test("analyzeDocument sends images to the vision endpoint with a data URI", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      assert.equal(url, AI_CONFIG.visionEndpoint);
      const body = JSON.parse(options.body);
      assert.equal(body.model, "test-vision");
      assert.match(
        body.messages[0].content[1].image_url.url,
        /^data:image\/png;base64,/,
      );
      return mockVisionResponse(
        '[{"title":"會議","date":"2026-08-15","startTime":"14:00","endTime":"","calendarId":"work","notes":"","quote":"Meeting with client on 2026-08-15 at 14:00"}]',
      );
    }),
  );

  const { events, extractedText } = await analyzeDocument({
    mimeType: "image/png",
    filename: "sample.png",
    buffer: Buffer.from("fake png bytes"),
    calendars: CALENDARS,
    aiConfig: AI_CONFIG,
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].calendarId, "work");
  assert.equal(extractedText, "");
});

test("analyzeDocument throws NO_EVENTS when AI returns an empty list", async () => {
  PDFParse.mockImplementation(function () {
    return {
      getText: async () => ({
        text: "這是一段超過二十個字元的普通文字內容，但其中沒有任何日期或事件描述。",
      }),
      destroy: async () => {},
    };
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockTextResponse("[]")));

  await assert.rejects(
    () =>
      analyzeDocument({
        mimeType: "application/pdf",
        filename: "a.pdf",
        buffer: Buffer.from("x"),
        calendars: CALENDARS,
        aiConfig: AI_CONFIG,
      }),
    (err) => err.code === "NO_EVENTS",
  );
});

test("assertFileSize rejects files over 10MB", () => {
  assert.throws(
    () => assertFileSize(MAX_FILE_BYTES + 1),
    (err) => err.code === "FILE_TOO_LARGE",
  );
  assertFileSize(MAX_FILE_BYTES);
});

test("analyzeDocument rejects unsupported file types", async () => {
  await assert.rejects(
    () =>
      analyzeDocument({
        mimeType: "text/plain",
        filename: "note.txt",
        buffer: Buffer.from("hi"),
        calendars: CALENDARS,
        aiConfig: AI_CONFIG,
      }),
    (err) => err.code === "UNSUPPORTED_TYPE",
  );
});
