// server/extractors.js
// 文檔抽取管線：逐格式抽取 → 統一格式 → AI 分析（見 docs/adr/0006）。
// 抽取（確定性庫）與分析（LLM）分離以降低幻覺；AI 只讀規整後的文字，並回傳支持每個事件的原文引用（quote）。

import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const MIME_TYPES = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/bmp": "image",
};

const EXT_TYPES = {
  docx: "docx",
  pdf: "pdf",
  xlsx: "xlsx",
  xls: "xls",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  bmp: "image",
};

// 掃描型 PDF 的文字層幾乎為空，以此閾值判別需回退（降級提示轉圖片，見 ADR 0006）。
const SCANNED_PDF_THRESHOLD = 20;

export function assertFileSize(bytes) {
  if (bytes > MAX_FILE_BYTES) {
    throw Object.assign(new Error("檔案超過 10MB 上限。"), {
      code: "FILE_TOO_LARGE",
    });
  }
}

function normalizeType(mimeType, filename) {
  if (MIME_TYPES[mimeType]) {
    return MIME_TYPES[mimeType];
  }

  const extension =
    typeof filename === "string"
      ? filename.split(".").pop()?.toLowerCase() ?? ""
      : "";
  return EXT_TYPES[extension] ?? null;
}

// 統一格式規整化：壓縮連續空白、trim、去空行，避免 PDF 抽取的零散間距拆破日期。
function normalizeUnifiedText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// Excel 表列映射：每列序列化為「欄名: 值 | ...」，空儲存格以空字串表示。
function extractSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const lines = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
    });

    if (rows.length === 0) {
      continue;
    }

    const header = rows[0].map((cell) => String(cell ?? ""));

    for (const row of rows.slice(1)) {
      lines.push(
        row
          .map((cell, index) => `${header[index]}: ${String(cell ?? "")}`)
          .join(" | "),
      );
    }
  }

  return lines.join("\n");
}

function toDateKey(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildAnalyzePrompt(calendars, isSpreadsheet, profile = "") {
  const today = new Date();
  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][
    today.getDay()
  ];
  const categoryList = calendars
    .map((calendar) => `- ${calendar.id}：${calendar.label}`)
    .join("\n");
  const tableRule = isSpreadsheet
    ? "此內容來自 Excel 表格，每一列即一個事件，忽略表頭欄位標題。"
    : "此內容來自文檔文字，從中找出「日期＋事件描述」的配對。";

  return [
    "你是一個日曆助手，負責從用戶提供的文檔內容中抽取日曆事件。",
    "",
    `今日日期：${toDateKey(today)}（${weekday}）。若文檔中日期為相對說法，請依今日推算。`,
    "時間解析規則：",
    "- 「下午三時」或「下午3點」= 15:00，「上午九時」= 09:00",
    "- 未提及時間時 startTime 與 endTime 留空字串",
    "- 若提及時長（如「一小時」），據此推算 endTime",
    "- 多日活動（跨天）須輸出 endDate（結束日，YYYY-MM-DD）；單日活動 endDate 留空字串",
    "",
    "日曆分類（calendarId）請從以下選擇最貼切的：",
    categoryList,
    "",
    ...(profile
      ? [
          "用戶畫像（僅供歸類參考）：",
          profile,
          "分類偏置：依用戶畫像與文檔內容歸類；畫像顯示常用或偏好的分類時，優先選那些分類。",
          "",
        ]
      : []),
    tableRule,
    "",
    "只返回一個 JSON 陣列，不要加任何說明文字或 markdown 格式符號：",
    '[{"title":"事件標題","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","calendarId":"work","notes":"備註","quote":"支持此事件的原文段落（節錄原文文字）"}]',
    "quote 必須節錄自文檔原文，不得自行編造。若無對應原文，quote 留空字串。",
  ].join("\n");
}

function extractJson(content) {
  if (typeof content !== "string" || !content.trim()) {
    return null;
  }

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);

  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through to raw extraction
    }
  }

  try {
    return JSON.parse(content);
  } catch {
    // fall through to array extraction
  }

  const arrayStart = content.indexOf("[");
  const arrayEnd = content.lastIndexOf("]");

  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(content.slice(arrayStart, arrayEnd + 1));
    } catch {
      // not an array
    }
  }

  return null;
}

function cleanEvents(parsed) {
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      title: typeof entry.title === "string" ? entry.title.trim() : "",
      date: typeof entry.date === "string" ? entry.date.trim() : "",
      endDate: typeof entry.endDate === "string" ? entry.endDate.trim() : "",
      startTime: typeof entry.startTime === "string" ? entry.startTime : "",
      endTime: typeof entry.endTime === "string" ? entry.endTime : "",
      calendarId: typeof entry.calendarId === "string" ? entry.calendarId : "",
      notes: typeof entry.notes === "string" ? entry.notes.trim() : "",
      quote: typeof entry.quote === "string" ? entry.quote.trim() : "",
    }))
    .filter((event) => event.title && event.date);
}

// 文本分析走 Anthropic 兼容端點（與 /api/ai 相同）。
async function callMultimodalTextAi({ system, userText, aiConfig }) {
  const response = await fetch(aiConfig.visionEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiConfig.visionApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiConfig.visionModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `多模态模型回應錯誤（${response.status}）。`);
  }

  return data?.choices?.[0]?.message?.content ?? "";
}

async function callTextAi({ system, userText, aiConfig }) {
  if (!aiConfig.apiKey?.trim()) {
    return callMultimodalTextAi({ system, userText, aiConfig });
  }

  const response = await fetch(aiConfig.remoteEndpoint, {
    method: "POST",
    headers: {
      "x-api-key": aiConfig.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiConfig.model,
      max_tokens: 2048,
      thinking: { type: "disabled" },
      reasoning_effort: aiConfig.reasoningEffort,
      system,
      messages: [{ role: "user", content: userText }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `AI 服務回應錯誤（${response.status}）。`);
  }

  return (Array.isArray(data?.content) ? data.content : [])
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}

// 圖片走 OpenAI 兼容視覺端點（base64 image_url；現有 coding 端點圖像支持未證實，見 ADR 0006）。
async function callVisionAi({ base64, mimeType, prompt, aiConfig }) {
  const response = await fetch(aiConfig.visionEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiConfig.visionApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiConfig.visionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `視覺模型回應錯誤（${response.status}）。`);
  }

  return data?.choices?.[0]?.message?.content ?? "";
}

export async function analyzeDocument({
  mimeType,
  filename,
  buffer,
  calendars,
  profile = "",
  aiConfig,
}) {
  const type = normalizeType(mimeType, filename);

  if (!type) {
    throw Object.assign(new Error("不支援的檔案格式。"), {
      code: "UNSUPPORTED_TYPE",
    });
  }

  if (type === "image") {
    const prompt = buildAnalyzePrompt(calendars, false, profile);
    const content = await callVisionAi({
      base64: buffer.toString("base64"),
      mimeType,
      prompt,
      aiConfig,
    });
    const events = cleanEvents(extractJson(content));

    if (events.length === 0) {
      throw Object.assign(new Error("未能從圖片中解析出任何事件，請檢查圖片內容。"), {
        code: "NO_EVENTS",
      });
    }

    // 圖片路徑無統一文本，檢視原檔走影像顯示。
    return { events, extractedText: "" };
  }

  let text = "";
  let isSpreadsheet = false;

  if (type === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value ?? "";
  } else if (type === "xlsx" || type === "xls") {
    text = extractSpreadsheet(buffer);
    isSpreadsheet = true;
  } else if (type === "pdf") {
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      text = result?.text ?? "";
    } finally {
      await parser.destroy();
    }

    if (text.trim().length < SCANNED_PDF_THRESHOLD) {
      throw Object.assign(
        new Error("此 PDF 為掃描型，無法直接抽文字；請將頁面轉成圖片後再上傳。"),
        { code: "SCANNED_PDF" },
      );
    }
  }

  const unified = normalizeUnifiedText(text);

  if (!unified) {
    throw Object.assign(new Error("無法從文檔中抽取任何文字。"), {
      code: "EMPTY_CONTENT",
    });
  }

  const system = buildAnalyzePrompt(calendars, isSpreadsheet, profile);
  const content = await callTextAi({ system, userText: unified, aiConfig });
  const events = cleanEvents(extractJson(content));

  if (events.length === 0) {
    throw Object.assign(new Error("未能從文檔中解析出任何事件，請檢查文檔內容。"), {
      code: "NO_EVENTS",
    });
  }

  // 規整文本隨事件一併返回，供前端存檔後以原文型式檢視（見計劃步驟 2）。
  return { events, extractedText: unified };
}
