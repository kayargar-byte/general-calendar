import { toDateKey } from "./date-utils.js";
import { buildProfile, profileToText } from "./user-profile.js";

const AI_ENDPOINT =
  import.meta.env.VITE_AI_ENDPOINT ?? "http://localhost:3000/api/ai";
const AI_DOCUMENT_ENDPOINT =
  import.meta.env.VITE_AI_DOCUMENT_ENDPOINT ??
  "http://localhost:3000/api/documents/analyze";
// 代理金鑰不再有默認值：需在 .env 設定，避免默認 key 被任意網站驅動本地代理（見 README「AI 功能設定」）。
const AI_PROXY_KEY = import.meta.env.VITE_AI_PROXY_KEY ?? "";

function assertProxyKey() {
  if (!AI_PROXY_KEY) {
    throw new Error("未設定 VITE_AI_PROXY_KEY，請參閱 README 的 AI 功能設定。");
  }
}

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

// 內建分類的語義提示，輔助模型歸類；自訂分類無固定語義，僅列 id：label。
const CATEGORY_HINTS = {
  work: "工作、會議、學業、培訓等公務事項",
  family: "親子、家務與家人相關事項",
  medical: "就醫、覆診、疫苗、健康檢查等醫療事項",
  documents: "政府證件／文件（身份證、護照、簽證、稅單）的續期與截止",
  allowances: "政府津貼／福利的申請、續期與到期",
  leisure: "社交聚會、娛樂、運動、旅遊、購物等個人活動",
  other: "無法歸入以上分類的其他事項",
};

function buildSearchSystemPrompt(calendars, profileText = "") {
  const today = new Date();
  const todayKey = toDateKey(today);
  const weekday = WEEKDAY_LABELS[today.getDay()];
  const categoryList = calendars
    .map((calendar) => {
      const hint = CATEGORY_HINTS[calendar.id];

      return hint
        ? `- ${calendar.id}（${calendar.label}）：${hint}`
        : `- ${calendar.id}：${calendar.label}`;
    })
    .join("\n");

  const promptParts = [
    "你是一個日曆助手。用戶會用自然語言描述個人日程，或請你搜尋某個主題的日期資訊。",
    "",
    `今日日期：${todayKey}（${weekday}）。請根據今日計算相對日期，例如「下週三」、「後天」、「下個月5號」。`,
    "",
    "時間解析規則：",
    "- 「下午三時」或「下午3點」= 15:00，「上午九時」= 09:00",
    "- 「三點半」需配合上下午判斷，未明確時預設下午 15:30",
    "- 若未提及時間，startTime 與 endTime 留空字串",
    "- 若提及時長（如「一小時」），據此推算 endTime",
    "- 多日活動（跨天）須輸出 endDate（結束日，YYYY-MM-DD）；單日活動 endDate 留空字串",
    "",
    "日曆分類（calendarId）規則：",
    "- calendarId 只能從下列清單選取；不得自創、不得改寫清單中的 id。",
    "- 依事件內容與清單定義選最貼切的分類；同時符合多個時，選最主要的一個。",
    "- 外部搜尋結果無法確定歸類時選 other，不得以其他 id 作默認。",
    "日曆分類清單：",
    categoryList,
    "",
  ];

  // 用戶畫像段：僅在有畫像資料時注入，避免空畫像仍加偏置（見計劃 Step 4）。
  if (profileText) {
    promptParts.push(
      "用戶畫像（僅供歸類、澄清與推薦參考）：",
      profileText,
      "分類偏置：依用戶畫像與事件內容歸類；畫像顯示常用或偏好的分類時，優先選那些分類。",
      "澄清選項個性化：需要澄清時，選項應貼合用戶畫像的興趣與身份。",
      "主動推薦：若用戶畫像或本次搜索顯示相關但未問的主題，輸出 recommendations 建議（每筆含 topic 與 reason）。",
      "",
    );
  }

  promptParts.push(
    "搜尋規則：",
    "- 個人日程描述（用戶已知的行程）不搜尋，直接解析為事件。",
    "- 用戶要求外部或即時資訊（活動日期、政府公告、新聞、未來賽事等）時，必須先呼叫 web_search 工具搜尋；未搜尋前不得以「無法搜尋／無法核實」回應。",
    "- 依搜尋結果回答；不得編造 URL 或日期；搜尋不到才明說。",
    "",
    "輸出格式：只回傳一個 JSON 物件，不要加任何說明文字或 markdown 格式符號。",
    '{"type":"events","events":[{"title":"事件標題","date":"YYYY-MM-DD","endDate":"YYYY-MM-DD","startTime":"HH:MM","endTime":"HH:MM","calendarId":"work","notes":"備註","sourceUrl":"來源網頁 URL","sourceTitle":"來源標題","sourceSnippet":"來源摘錄"}],"candidates":[...],"recommendations":[{"topic":"相關主題","reason":"簡短理由"}],"explanation":"..."}',
    "- events 為確認可直接入曆的事件；搜尋結果有多個候選或來源低置信時，把事件放 candidates 供用戶選擇、events 留空。",
    "- recommendations 為相關未問主題的建議；無相關主題時留空陣列。",
    "- 完全沒有日期錨點時，events 與 candidates 皆為空陣列，用 explanation 說明為何找不到可排程內容。",
    "- 用戶意圖多義（如「颱風」可指放假／班次／預報）時，回傳 clarify 而非猜測：",
    '{"type":"clarify","question":"簡短問題","options":[{"id":"a","label":"選項文字"}]}',
    "- 搜尋事件帶來源欄位；個人日程事件 sourceUrl 等留空字串。",
  );

  return promptParts.join("\n");
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

// 判別式協定解析：{type:"events"}／{type:"clarify"}；相容舊協定（裸陣列或帶 events 鍵的物件當 events）。
function parseAiResponse(content) {
  const parsed = extractJson(content);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  if (Array.isArray(parsed)) {
    return { type: "events", events: parsed, candidates: [], recommendations: [] };
  }

  if (parsed.type === "clarify") {
    return {
      type: "clarify",
      question: typeof parsed.question === "string" ? parsed.question : "",
      options: Array.isArray(parsed.options) ? parsed.options : [],
    };
  }

  if (parsed.type === "events" || Array.isArray(parsed.events)) {
    return {
      type: "events",
      events: Array.isArray(parsed.events) ? parsed.events : [],
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
      recommendations: normalizeRecommendations(parsed.recommendations),
      explanation:
        typeof parsed.explanation === "string" ? parsed.explanation : "",
    };
  }

  return null;
}

function normalizeParsedEvent(parsed, validCalendarIds) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const title =
    typeof parsed.title === "string" ? parsed.title.trim() : "";

  const date = parsed.date;

  // 無效 date 剔除整筆：無日期錨點不構成日曆事件（見 CONTEXT.md）；
  // 回退今日會把「AI 不知道日期」誤判為「今天」，錯事件無跡象入曆。
  if (typeof date !== "string" || !isValidDateKey(date)) {
    return null;
  }

  const endDate = typeof parsed.endDate === "string" ? parsed.endDate.trim() : "";

  // 多日活動的 endDate 需為有效日期且不早於開始日，否則剔除整筆（與無效 date 一致）；
  // 與開始日相同規整為空字串，避免同日事件被誤判為多日長條。
  if (endDate && (!isValidDateKey(endDate) || endDate < date)) {
    return null;
  }

  const normalizedEndDate = endDate === date ? "" : endDate;

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
      : "other";

  const notes =
    typeof parsed.notes === "string" ? parsed.notes.trim() : "";

  const quote =
    typeof parsed.quote === "string" ? parsed.quote.trim() : "";
  const sourceUrl =
    typeof parsed.sourceUrl === "string" ? parsed.sourceUrl.trim() : "";
  const sourceTitle =
    typeof parsed.sourceTitle === "string" ? parsed.sourceTitle.trim() : "";
  const sourceSnippet =
    typeof parsed.sourceSnippet === "string" ? parsed.sourceSnippet.trim() : "";

  return {
    title: title || "未命名事件",
    date,
    endDate: normalizedEndDate,
    startTime,
    endTime,
    calendarId,
    notes,
    quote,
    sourceUrl,
    sourceTitle,
    sourceSnippet,
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

// 推薦主題規整：topic 為必填（trim 後非空）；reason 選填。
function normalizeRecommendations(parsed) {
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const topic = typeof entry.topic === "string" ? entry.topic.trim() : "";

      if (!topic) {
        return null;
      }

      return {
        topic,
        reason: typeof entry.reason === "string" ? entry.reason.trim() : "",
      };
    })
    .filter(Boolean);
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

// 統一 AI 請求：search=true 走搜索（server 端帶工具循環），search=false 純解析（向後相容）。
// 回判別式物件 {type:"events",events,candidates,explanation} 或 {type:"clarify",question,options}；
// contextMessages 讓面板在客戶端續澄清上下文（server 保持無狀態，見 docs/adr/0007）。
export async function askAi(
  text,
  calendars,
  { search = true, contextMessages = [] } = {},
) {
  const trimmedText = typeof text === "string" ? text.trim() : "";

  if (!trimmedText) {
    throw new Error("請先輸入日程描述。");
  }

  assertProxyKey();

  const calendarList = Array.isArray(calendars) ? calendars : [];
  const validCalendarIds = new Set(calendarList.map((calendar) => calendar.id));

  // 搜索路徑即時聚合用戶畫像並注入 prompt（資料層見 user-profile.js）；
  // search:false 純解析路徑保持向後相容，不帶畫像。
  const profileText = search
    ? profileToText(buildProfile(), calendarList)
    : "";

  let response;

  try {
    response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Proxy-Key": AI_PROXY_KEY,
      },
      body: JSON.stringify({
        max_tokens: 2048,
        search,
        // profile 同步給 server 快取，供桌面右鍵匯入的抽取 prompt 共用（見計劃 Step 7）。
        profile: profileText,
        system: buildSearchSystemPrompt(calendarList, profileText),
        messages: [
          ...(Array.isArray(contextMessages) ? contextMessages : []),
          { role: "user", content: trimmedText },
        ],
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
  const parsed = parseAiResponse(content);

  if (!parsed) {
    throw new Error("AI 無法解析此日程，請嘗試更具體的描述。");
  }

  if (parsed.type === "clarify") {
    return parsed;
  }

  return {
    type: "events",
    events: normalizeParsedEvents(parsed.events, validCalendarIds),
    candidates: normalizeParsedEvents(parsed.candidates, validCalendarIds),
    recommendations: parsed.recommendations ?? [],
    explanation: parsed.explanation ?? "",
  };
}

// 薄包裝：向後相容舊呼叫端（回扁平事件陣列）。
export async function parseSchedule(text, calendars) {
  const result = await askAi(text, calendars, { search: false });

  if (result.type !== "events" || result.events.length === 0) {
    throw new Error("AI 無法解析此日程，請嘗試更具體的描述。");
  }

  return result.events;
}

export async function analyzeDocument(file, calendars) {
  if (!(file instanceof File) || !file.name) {
    throw new Error("請先選擇要匯入的文檔。");
  }

  assertProxyKey();

  const calendarList = Array.isArray(calendars) ? calendars : [];

  const form = new FormData();
  form.append("file", file);
  form.append("calendars", JSON.stringify(calendarList));
  // 抽取也帶畫像聚合摘要，供 server 依畫像歸類（見計劃 Step 7）。
  form.append("profile", profileToText(buildProfile(), calendarList));

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
