// src/lib/user-profile.js
// 用戶畫像資料層：從本地行為（事件／文檔／搜索歷史）與手動偏好聚合出畫像，
// 供 AI 請求以「聚合摘要」形式注入 prompt（見計劃 Step 2，注入於 Step 4 接線）。
// 隱私邊界：只統計聚合（分類頻率／文檔類型／主題），不取事件標題或文檔名稱；
// 「實時」＝每次 AI 請求時重新聚合（buildProfile 為純讀函數，零快取）。

import { getEvents } from "./storage.js";
import { getDocuments } from "./document-store.js";

export const PROFILE_STORAGE_KEY = "general-calendar.profile.v1";
export const SEARCH_HISTORY_STORAGE_KEY = "general-calendar.search-history.v1";

// 搜索歷史保留上限：FIFO 丟最舊，避免 localStorage 膨脹與畫像過時。
const MAX_SEARCH_HISTORY = 50;
// 畫像摘要文字總長度上限，控制注入 prompt 的 token 成本；段落各自再限 80 字。
const MAX_PROFILE_TEXT = 300;
const MAX_SECTION_TEXT = 80;

// 身份資訊允許的欄位；其餘欄位忽略，避免非預期欄位進入 prompt。
const IDENTITY_FIELDS = ["occupation", "ageGroup", "region"];

// mimeType → 簡短類型名，供文檔類型統計用；未列出的沿用原始 mimeType。
const DOCUMENT_TYPE_LABELS = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
};

function resolveStorage(storage) {
  const resolvedStorage = storage ?? globalThis.localStorage;

  if (!resolvedStorage) {
    throw new Error("此環境不支援本機儲存。");
  }

  return resolvedStorage;
}

function emptyProfile() {
  return {
    priorityCalendarIds: [],
    interests: [],
    identity: {},
  };
}

function normalizeIdentity(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const identity = {};

  for (const field of IDENTITY_FIELDS) {
    const fieldValue = value[field];

    if (typeof fieldValue === "string" && fieldValue.trim() !== "") {
      identity[field] = fieldValue.trim();
    }
  }

  return identity;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

// 手動偏好（優先分類／興趣／身份）的讀寫，供設定頁（Step 3）與聚合共用。
export function getProfile(storage) {
  const storedValue = resolveStorage(storage).getItem(PROFILE_STORAGE_KEY);

  if (!storedValue) {
    return emptyProfile();
  }

  try {
    const parsed = JSON.parse(storedValue);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return emptyProfile();
    }

    return {
      priorityCalendarIds: normalizeStringList(parsed.priorityCalendarIds),
      interests: normalizeStringList(parsed.interests),
      identity: normalizeIdentity(parsed.identity),
    };
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(prefs, storage) {
  if (typeof prefs !== "object" || prefs === null || Array.isArray(prefs)) {
    throw new Error("用戶畫像格式無效。");
  }

  const normalized = {
    priorityCalendarIds: normalizeStringList(prefs.priorityCalendarIds),
    interests: normalizeStringList(prefs.interests),
    identity: normalizeIdentity(prefs.identity),
  };

  resolveStorage(storage).setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify(normalized),
  );

  return normalized;
}

function isSearchEntry(entry) {
  return typeof entry?.query === "string" && entry.query.trim() !== "";
}

export function getSearchHistory(storage) {
  const storedValue = resolveStorage(storage).getItem(SEARCH_HISTORY_STORAGE_KEY);

  if (!storedValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(storedValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isSearchEntry)
      .map((entry) => ({
        query: entry.query.trim(),
        at: typeof entry.at === "string" ? entry.at : "",
        adopted: entry.adopted === true,
      }))
      .slice(-MAX_SEARCH_HISTORY);
  } catch {
    return [];
  }
}

function saveSearchHistory(entries, storage) {
  resolveStorage(storage).setItem(
    SEARCH_HISTORY_STORAGE_KEY,
    JSON.stringify(entries.slice(-MAX_SEARCH_HISTORY)),
  );
}

// 記錄一筆搜索行為（面板於 Step 6 接線）；超量 FIFO 丟最舊。
export function recordSearchEntry({ query, adopted = false, at }, storage) {
  if (typeof query !== "string" || query.trim() === "") {
    throw new Error("搜索內容不可為空。");
  }

  const entry = {
    query: query.trim(),
    at: typeof at === "string" && at ? at : new Date().toISOString(),
    adopted: adopted === true,
  };

  saveSearchHistory([...getSearchHistory(storage), entry], storage);

  return entry;
}

// 將指定查詢的最近一筆未採納搜索標記為已採納（供畫像加權後續使用，見計劃 Step 6）。
export function markSearchEntryAdopted(query, storage) {
  const trimmed = typeof query === "string" ? query.trim() : "";

  if (!trimmed) {
    return null;
  }

  const history = getSearchHistory(storage);

  for (let index = history.length - 1; index >= 0; index--) {
    if (history[index].query === trimmed && !history[index].adopted) {
      const next = [...history];
      next[index] = { ...next[index], adopted: true };
      saveSearchHistory(next, storage);
      return next[index];
    }
  }

  return null;
}

function documentTypeLabel(mimeType) {
  if (typeof mimeType !== "string" || !mimeType) {
    return "other";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  return DOCUMENT_TYPE_LABELS[mimeType] ?? mimeType;
}

// 從本地資料即時聚合畫像；回傳結構化物件，供 profileToText 與測試使用。
export function buildProfile(storage) {
  const events = getEvents(storage);
  const documents = getDocuments(storage);
  const searchHistory = getSearchHistory(storage);
  const prefs = getProfile(storage);

  const categoryCounts = {};

  for (const event of events) {
    categoryCounts[event.calendarId] =
      (categoryCounts[event.calendarId] ?? 0) + 1;
  }

  const documentTypeCounts = {};

  for (const document of documents) {
    const type = documentTypeLabel(document.mimeType);
    documentTypeCounts[type] = (documentTypeCounts[type] ?? 0) + 1;
  }

  // 搜索主題：以查詢詞頻率統計，取前 3 最常搜的詞（adopted 不加重，保持簡單）。
  const queryCounts = new Map();

  for (const entry of searchHistory) {
    queryCounts.set(entry.query, (queryCounts.get(entry.query) ?? 0) + 1);
  }

  const topQueries = [...queryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([query, count]) => ({ query, count }));

  return {
    categoryCounts,
    totalEvents: events.length,
    documentTypeCounts,
    topQueries,
    prefs,
  };
}

function truncate(text, maxLength) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}

// 畫像摘要文字：只含聚合統計，不含事件標題／文檔名稱；無資料時回空字串（注入方省略整段）。
export function profileToText(profile, calendars = []) {
  if (!profile || typeof profile !== "object") {
    return "";
  }

  const calendarLabels = new Map(
    (Array.isArray(calendars) ? calendars : []).map((calendar) => [
      calendar.id,
      calendar.label,
    ]),
  );
  const labelFor = (id) => calendarLabels.get(id) ?? id;

  const lines = [];

  const categoryEntries = Object.entries(profile.categoryCounts ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (categoryEntries.length > 0) {
    const labels = categoryEntries
      .map(([id, count]) => `${labelFor(id)} ${count} 筆`)
      .join("、");
    lines.push(`事件傾向：${labels}（共 ${profile.totalEvents ?? 0} 筆）`);
  }

  const documentEntries = Object.entries(profile.documentTypeCounts ?? {});

  if (documentEntries.length > 0) {
    const types = documentEntries
      .map(([type, count]) => `${type} ${count} 份`)
      .join("、");
    lines.push(`近期匯入文檔：${truncate(types, MAX_SECTION_TEXT)}`);
  }

  if (Array.isArray(profile.topQueries) && profile.topQueries.length > 0) {
    const topics = profile.topQueries
      .slice(0, 3)
      .map((entry) => entry.query)
      .join("、");
    lines.push(`近期搜索主題：${truncate(topics, MAX_SECTION_TEXT)}`);
  }

  const prefs = profile.prefs ?? emptyProfile();
  const prefParts = [];

  if (prefs.priorityCalendarIds.length > 0) {
    prefParts.push(
      `優先分類：${prefs.priorityCalendarIds.map(labelFor).join("、")}`,
    );
  }

  if (prefs.interests.length > 0) {
    prefParts.push(
      `興趣：${truncate(prefs.interests.slice(0, 5).join("、"), MAX_SECTION_TEXT)}`,
    );
  }

  const identityValues = Object.values(prefs.identity).filter(Boolean);

  if (identityValues.length > 0) {
    prefParts.push(
      `身份：${truncate(identityValues.join("、"), MAX_SECTION_TEXT)}`,
    );
  }

  if (prefParts.length > 0) {
    lines.push(
      `手動偏好：${truncate(prefParts.join("；"), MAX_PROFILE_TEXT)}`,
    );
  }

  if (lines.length === 0) {
    return "";
  }

  return truncate(lines.join("。"), MAX_PROFILE_TEXT);
}
