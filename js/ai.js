import { AI_CONFIG } from "./config.js";
import { CALENDARS } from "./calendar-catalog.js";
import { toDateKey } from "./date-utils.js";

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
const DEFAULT_CALENDAR_IDS = new Set(CALENDARS.map((calendar) => calendar.id));

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

function buildSystemPrompt() {
  const today = new Date();
  const todayKey = toDateKey(today);
  const weekday = WEEKDAY_LABELS[today.getDay()];
  const categoryList = CALENDARS.map(
    (calendar) => `- ${calendar.id}：${calendar.label}`,
  ).join("\n");

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
    '只返回一個 JSON 物件，不要加任何說明文字或 markdown 格式符號：',
    '{"title":"事件標題","date":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","calendarId":"personal","notes":"備註"}',
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
    // fall through to brace extraction
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

function normalizeParsedEvent(parsed) {
  if (!parsed || typeof parsed !== "object") {
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
    DEFAULT_CALENDAR_IDS.has(parsed.calendarId)
      ? parsed.calendarId
      : "personal";

  const notes =
    typeof parsed.notes === "string" ? parsed.notes.trim() : "";

  return { title: title || "未命名事件", date, startTime, endTime, calendarId, notes };
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

export async function parseSchedule(text) {
  const trimmedText = typeof text === "string" ? text.trim() : "";

  if (!trimmedText) {
    throw new Error("請先輸入日程描述。");
  }

  let response;

  try {
    response = await fetch(AI_CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: trimmedText }],
      }),
    });
  } catch {
    throw new Error("無法連接 AI 服務，請確認已啟動本地代理伺服器（npm start）。");
  }

  if (!response.ok) {
    let message = `AI 服務回應錯誤（${response.status}）。`;

    if (response.status === 404 || response.status === 405) {
      message = "無法連接 AI 服務，請確認已啟動本地代理伺服器（npm start）。";
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
  const event = normalizeParsedEvent(parsed);

  if (!event) {
    throw new Error("AI 無法解析此日程，請嘗試更具體的描述。");
  }

  return event;
}
