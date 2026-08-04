import { toDateKey } from "./date-utils.js";

const AI_ENDPOINT =
  import.meta.env.VITE_AI_ENDPOINT ?? "http://localhost:3000/api/ai";
const AI_DOCUMENT_ENDPOINT =
  import.meta.env.VITE_AI_DOCUMENT_ENDPOINT ??
  "http://localhost:3000/api/documents/analyze";
const AI_PROXY_KEY = import.meta.env.VITE_AI_PROXY_KEY ?? "change-me-0f3c9a";

const WEEKDAY_LABELS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
];

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidDateKey(value) {
  const match = DATE_PATTERN.exec(value);

  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(year, monthIndex, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === monthIndex &&
    date.getDate() === day
  );
}

function buildSystemPrompt(calendars) {
  const today = new Date();
  const todayKey = toDateKey(today);
  const weekday = WEEKDAY_LABELS[today.getDay()];
  const categoryList = calendars
    .map((calendar) => `- ${calendar.id}：${calendar.label}`)
    .join("\n");

  return [
    "你是一個日曆助手。用戶會用自然語言描述日程，請將其解析為結構化的日曆事件。",
    "",
    `今日日期：${todayKey}（${weekday}）。請根據今日計算相對日期，例如「下週三」、「後天」、「下個月5號」。`,
    "",
    "時間解析規則：",
    "- 「下午三時」或「下午3點」= 15:00，「上午九時」= 09:00",
    "- 「三點半」需配合上下午判斷，未明確時預設下午 15:30",
    "- 若未提及時間，startTime 與 endTime 留空字串",
    "- 若提及時長（如「一小時」），據此推算 endTime",
    "",
    "日曆分類（calendarId）請從以下選擇最貼切的：",
    categoryList,
    "",
    "只返回一個 JSON 陣列，不要加任何說明文字或 markdown 格式符號：",
    '[{"title":"事件標題","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","calendarId":"personal","notes":"備註"}]',
    "若用戶只描述一個事件，仍返回包含一個物件的陣列。",
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
    // fall through to extraction
  }

  const arrayStart = content.indexOf("[");
  const arrayEnd = content.lastIndexOf("]");

  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(content.slice(arrayStart, arrayEnd + 1));
    } catch {
      // fall through to object extraction
    }
  }

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start !== -1 && end > start) {
    try {
      return JSON.parse(content.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeParsedEvent(parsed, validCalendarIds) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const title =
    typeof parsed.title === "string" ? parsed.title.trim() : "";

  const date =
    typeof parsed.date === "string" && isValidDateKey(parsed.date)
      ? parsed.date
      : toDateKey(new Date());

  const startTime =
    typeof parsed.startTime === "string" && TIME_PATTERN.test(parsed.startTime)
      ? parsed.startTime
      : "";

  const endTime =
    typeof parsed.endTime === "string" && TIME_PATTERN.test(parsed.endTime)
      ? parsed.endTime
      : "";

  const calendarId =
    typeof parsed.calendarId === "string" &&
    validCalendarIds.has(parsed.calendarId)
      ? parsed.calendarId
      : "personal";

  const notes =
    typeof parsed.notes === "string" ? parsed.notes.trim() : "";

  const quote =
    typeof parsed.quote === "string" ? parsed.quote.trim() : "";

  return {
    title: title || "未命名事件",
    date,
    startTime,
    endTime,
    calendarId,
    notes,
    quote,
  };
}

export function normalizeParsedEvents(parsed, validCalendarIds) {
  if (Array.isArray(parsed)) {
    const events = parsed
      .map((entry) => normalizeParsedEvent(entry, validCalendarIds))
      .filter(Boolean);

    return events;
  }

  const single = normalizeParsedEvent(parsed, validCalendarIds);

  if (!single) {
    return [];
  }

  return [single];
}

function extractTextFromContent(content) {
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}

export async function parseSchedule(text, calendars) {
  const trimmedText = typeof text === "string" ? text.trim() : "";

  if (!trimmedText) {
    throw new Error("請先輸入日程描述。");
  }

  const calendarList = Array.isArray(calendars) ? calendars : [];
  const validCalendarIds = new Set(calendarList.map((calendar) => calendar.id));

  let response;

  try {
    response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Proxy-Key": AI_PROXY_KEY,
      },
      body: JSON.stringify({
        max_tokens: 1024,
        system: buildSystemPrompt(calendarList),
        messages: [{ role: "user", content: trimmedText }],
      }),
    });
  } catch {
    throw new Error(
      "無法連接 AI 服務，請確認已啟動本地代理伺服器（npm run ai-proxy）。",
    );
  }

  if (!response.ok) {
    let message = `AI 服務回應錯誤（${response.status}）。`;

    if (response.status === 404 || response.status === 405) {
      message =
        "無法連接 AI 服務，請確認已啟動本地代理伺服器（npm run ai-proxy）。";
    }

    try {
      const errorBody = await response.json();

      if (errorBody?.error?.message) {
        message = errorBody.error.message;
      }
    } catch {
      // keep default message
    }

    throw new Error(message);
  }

  const data = await response.json();
  const content = extractTextFromContent(data?.content);
  const parsed = extractJson(content);
  const events = normalizeParsedEvents(parsed, validCalendarIds);

  if (events.length === 0) {
    throw new Error("AI 無法解析此日程，請嘗試更具體的描述。");
  }

  return events;
}

export async function analyzeDocument(file, calendars) {
  if (!(file instanceof File) || !file.name) {
    throw new Error("請先選擇要匯入的文檔。");
  }

  const form = new FormData();
  form.append("file", file);
  form.append(
    "calendars",
    JSON.stringify(Array.isArray(calendars) ? calendars : []),
  );

  let response;

  try {
    response = await fetch(AI_DOCUMENT_ENDPOINT, {
      method: "POST",
      headers: {
        "X-Proxy-Key": AI_PROXY_KEY,
      },
      body: form,
    });
  } catch {
    throw new Error(
      "無法連接 AI 服務，請確認已啟動本地代理伺服器（npm run ai-proxy）。",
    );
  }

  if (!response.ok) {
    let message = `AI 服務回應錯誤（${response.status}）。`;

    try {
      const errorBody = await response.json();

      if (errorBody?.error?.message) {
        message = errorBody.error.message;
      }
    } catch {
      // keep default message
    }

    throw new Error(message);
  }

  const data = await response.json();
  const calendarList = Array.isArray(calendars) ? calendars : [];
  const events = normalizeParsedEvents(
    data?.events,
    new Set(calendarList.map((calendar) => calendar.id)),
  );

  if (events.length === 0) {
    throw new Error("未能從文檔中解析出任何事件，請檢查文檔內容。");
  }

  return {
    events,
    extractedText:
      typeof data?.extractedText === "string" ? data.extractedText : "",
  };
}
