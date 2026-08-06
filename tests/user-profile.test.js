import assert from "node:assert/strict";
import { test } from "vitest";
import {
  PROFILE_STORAGE_KEY,
  SEARCH_HISTORY_STORAGE_KEY,
  buildProfile,
  getProfile,
  getSearchHistory,
  markSearchEntryAdopted,
  profileToText,
  recordSearchEntry,
  saveProfile,
} from "../src/lib/user-profile.js";
import { createEvent } from "../src/lib/storage.js";
import { createDocument } from "../src/lib/document-store.js";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

function buildEvent(overrides = {}) {
  return {
    title: "看醫生",
    date: "2026-08-15",
    startTime: "09:30",
    endTime: "10:30",
    notes: "",
    ...overrides,
  };
}

function buildDocument(overrides = {}) {
  return {
    id: "doc-1",
    name: "檢查報告.pdf",
    mimeType: "application/pdf",
    size: 1024,
    hasText: true,
    ...overrides,
  };
}

const CALENDARS = [
  { id: "personal", label: "個人" },
  { id: "medical", label: "醫療" },
  { id: "work", label: "工作" },
];

test("buildProfile returns an empty profile when there is no data", () => {
  const storage = new MemoryStorage();
  const profile = buildProfile(storage);

  assert.deepEqual(profile.categoryCounts, {});
  assert.equal(profile.totalEvents, 0);
  assert.deepEqual(profile.documentTypeCounts, {});
  assert.deepEqual(profile.topQueries, []);
  assert.deepEqual(profile.prefs, {
    priorityCalendarIds: [],
    interests: [],
    identity: {},
  });
});

test("buildProfile tallies event counts by calendar id", () => {
  const storage = new MemoryStorage();
  createEvent(buildEvent({ title: "覆診", calendarId: "medical" }), storage);
  createEvent(
    buildEvent({ title: "體檢", date: "2026-08-20", calendarId: "medical" }),
    storage,
  );
  createEvent(
    buildEvent({ title: "會議", date: "2026-08-22", calendarId: "work" }),
    storage,
  );

  const profile = buildProfile(storage);

  assert.equal(profile.totalEvents, 3);
  assert.deepEqual(profile.categoryCounts, { medical: 2, work: 1 });
});

test("buildProfile tallies document types from imported documents", () => {
  const storage = new MemoryStorage();
  createDocument(buildDocument({ id: "doc-1" }), storage);
  createDocument(
    buildDocument({
      id: "doc-2",
      name: "表.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    storage,
  );
  createDocument(
    buildDocument({ id: "doc-3", name: "截圖.png", mimeType: "image/png" }),
    storage,
  );

  const profile = buildProfile(storage);

  assert.deepEqual(profile.documentTypeCounts, { pdf: 1, xlsx: 1, image: 1 });
});

test("buildProfile merges manual prefs and aggregates search topics", () => {
  const storage = new MemoryStorage();
  saveProfile(
    {
      priorityCalendarIds: ["medical"],
      interests: ["政府補助", "足球"],
      identity: { occupation: "上班族", region: "澳門" },
    },
    storage,
  );
  recordSearchEntry(
    { query: "流感疫苗", adopted: true, at: "2026-08-06T10:00:00Z" },
    storage,
  );
  recordSearchEntry(
    { query: "流感疫苗", adopted: false, at: "2026-08-06T11:00:00Z" },
    storage,
  );
  recordSearchEntry(
    { query: "巴士路線", at: "2026-08-06T12:00:00Z" },
    storage,
  );

  const profile = buildProfile(storage);

  assert.deepEqual(profile.prefs, {
    priorityCalendarIds: ["medical"],
    interests: ["政府補助", "足球"],
    identity: { occupation: "上班族", region: "澳門" },
  });
  assert.deepEqual(profile.topQueries, [
    { query: "流感疫苗", count: 2 },
    { query: "巴士路線", count: 1 },
  ]);
});

test("profileToText renders an aggregated summary without event content", () => {
  const storage = new MemoryStorage();
  createEvent(buildEvent({ calendarId: "medical" }), storage);
  createEvent(
    buildEvent({ title: "覆診", date: "2026-08-20", calendarId: "medical" }),
    storage,
  );
  createDocument(buildDocument(), storage);
  recordSearchEntry(
    { query: "流感疫苗", adopted: true, at: "2026-08-06T10:00:00Z" },
    storage,
  );
  saveProfile(
    {
      priorityCalendarIds: ["medical"],
      interests: ["政府補助"],
      identity: { occupation: "上班族" },
    },
    storage,
  );

  const text = profileToText(buildProfile(storage), CALENDARS);

  assert.match(text, /事件傾向：醫療 2 筆/);
  assert.match(text, /近期匯入文檔：pdf 1 份/);
  assert.match(text, /近期搜索主題：流感疫苗/);
  assert.match(text, /手動偏好：優先分類：醫療；興趣：政府補助；身份：上班族/);
  // 隱私：不包含事件標題或文檔名稱。
  assert.ok(!text.includes("看醫生"));
  assert.ok(!text.includes("覆診"));
  assert.ok(!text.includes("檢查報告"));
});

test("profileToText returns an empty string for an empty profile", () => {
  const storage = new MemoryStorage();

  assert.equal(profileToText(buildProfile(storage), CALENDARS), "");
});

test("profileToText resolves calendar labels and falls back to the id", () => {
  const storage = new MemoryStorage();
  createEvent(buildEvent({ calendarId: "medical" }), storage);
  // family 為有效分類但不在傳入的 label 清單：回退顯示 id。
  createEvent(
    buildEvent({ title: "家庭聚餐", date: "2026-08-22", calendarId: "family" }),
    storage,
  );

  const text = profileToText(buildProfile(storage), CALENDARS);

  assert.match(text, /醫療 1 筆/);
  assert.match(text, /family 1 筆/);
});

test("profileToText caps the total summary length", () => {
  const storage = new MemoryStorage();
  saveProfile({ identity: { occupation: "X".repeat(500) } }, storage);

  const text = profileToText(buildProfile(storage), CALENDARS);

  // 身份段落被限 80 字，總長遠小於 500 字的原始輸入。
  assert.ok(text.length < 120);
});

test("recordSearchEntry keeps at most the latest 50 entries", () => {
  const storage = new MemoryStorage();

  for (let index = 0; index < 55; index += 1) {
    const minute = String(index % 60).padStart(2, "0");
    recordSearchEntry(
      { query: `查詢${index}`, at: `2026-08-06T10:00:${minute}Z` },
      storage,
    );
  }

  const history = getSearchHistory(storage);

  assert.equal(history.length, 50);
  assert.equal(history[0].query, "查詢5");
  assert.equal(history[49].query, "查詢54");
});

test("recordSearchEntry rejects an empty query", () => {
  const storage = new MemoryStorage();

  assert.throws(() => recordSearchEntry({ query: "  " }, storage), /不可為空/);
});

test("markSearchEntryAdopted marks the latest matching query as adopted", () => {
  const storage = new MemoryStorage();
  recordSearchEntry(
    { query: "疫苗", at: "2026-08-06T10:00:00Z" },
    storage,
  );
  recordSearchEntry(
    { query: "巴士", at: "2026-08-06T11:00:00Z" },
    storage,
  );

  markSearchEntryAdopted("疫苗", storage);

  const history = getSearchHistory(storage);
  assert.equal(
    history.find((entry) => entry.query === "疫苗").adopted,
    true,
  );
  assert.equal(history.find((entry) => entry.query === "巴士").adopted, false);
});

test("markSearchEntryAdopted ignores an empty query and unknown queries", () => {
  const storage = new MemoryStorage();
  recordSearchEntry({ query: "疫苗", at: "2026-08-06T10:00:00Z" }, storage);

  assert.equal(markSearchEntryAdopted("", storage), null);
  assert.equal(markSearchEntryAdopted("不存在", storage), null);
  assert.equal(getSearchHistory(storage)[0].adopted, false);
});

test("saveProfile persists a normalized profile", () => {
  const storage = new MemoryStorage();
  saveProfile(
    {
      priorityCalendarIds: ["medical"],
      interests: [" 足球 "],
      identity: { occupation: " 上班族 " },
    },
    storage,
  );

  assert.deepEqual(getProfile(storage), {
    priorityCalendarIds: ["medical"],
    interests: ["足球"],
    identity: { occupation: "上班族" },
  });
});

test("getProfile safely ignores damaged stored data", () => {
  const storage = new MemoryStorage();

  storage.setItem(PROFILE_STORAGE_KEY, "not-json");
  assert.deepEqual(getProfile(storage), {
    priorityCalendarIds: [],
    interests: [],
    identity: {},
  });

  storage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      priorityCalendarIds: ["medical", ""],
      interests: ["ok", 42],
      identity: { occupation: "上班族", bogus: "忽略" },
    }),
  );
  const profile = getProfile(storage);

  assert.deepEqual(profile.priorityCalendarIds, ["medical"]);
  assert.deepEqual(profile.interests, ["ok"]);
  assert.deepEqual(profile.identity, { occupation: "上班族" });
});

test("getSearchHistory safely ignores damaged stored data", () => {
  const storage = new MemoryStorage();

  storage.setItem(SEARCH_HISTORY_STORAGE_KEY, "not-json");
  assert.deepEqual(getSearchHistory(storage), []);

  storage.setItem(
    SEARCH_HISTORY_STORAGE_KEY,
    JSON.stringify([{ query: "  疫苗  ", adopted: 1 }, { query: "" }]),
  );
  const history = getSearchHistory(storage);

  assert.equal(history.length, 1);
  assert.equal(history[0].query, "疫苗");
  assert.equal(history[0].adopted, false);
});
