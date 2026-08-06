# 0007：AI 搜尋以確認閘門入曆

設計摘要列「AI 搜尋：任意主題即時搜尋；有日期錨點的結果自動入日曆（帶來源 URL），無日期的回覆『找不到可排程內容』」，但只有兩行規格、無檢索依託。現有後端（/api/ai）是純 LLM 代理，無工具呼叫、無檢索——讓模型憑記憶回日期與 URL 就是幻覺，且不像文檔匯入有原文可對照。決策：AI 搜尋併入「AI 輸入日程」面板，以 Serper 真檢索為數據源（server 端 tool-use 循環），並以「意圖閘＋結果閘」兩道條件確認閘門先問後寫——與 ADR 0005 文檔全自動寫入並存為兩種刻意不同的路徑。

## 探測事實（2026-08-06）

- 中轉站 micuapi 接受 Anthropic 標準 `web_search_20250305` 工具，模型會發出 `tool_use`；但續輪回傳 400「No tool output found」，證明**中轉站不執行搜尋**，client 須自行呼叫搜尋並回填 `tool_result`。
- 主機化 `web_search_20250305` 雖被接受，但模型回傳的 `input` 為空 `{}`，拿不到查詢詞；改用自訂 function 工具（`type:"function"`，name `web_search`）可保證模型填 `input.query`，另以「回退取最後一條 user 訊息」兜底。
- Serper 免信用卡、純 email 註冊即送 2500 次查詢（一次性免費額度）；Bing／Google Search API 需綁定銀行卡——澳門用戶有卡障礙，故選 Serper。

## 決策

- **入口**：AI 搜尋併入「AI 輸入日程」面板（單一自然語言入口）；工具列 EventSearch 保留作本機查詢。
- **真檢索**：tool-use 循環實現在獨立模組 `server/search-tools.js`（`server.js` 只做 HTTP 黏合，依請求 body 的 `search:true` 旗標進入循環）——模型發出 `web_search` tool_use → server 調 Serper → 結果包成 `tool_result` 回填 → 模型據真實結果附來源。每查詢限一輪搜索；Serper 失敗降級為記憶作答或明確報錯。純排程路徑（`search` 缺省）完全向後相容、不帶工具。
- **兩道確認閘門（條件觸發）**：
  - 意圖閘：AI 偵測到查詢多義才發澄清請求（如「颱風」）；明確查詢直接搜。
  - 結果閘：搜索後多候選或低置信才列出來源確認；單一高置信事件進既有 EventDialog 預填。
- **來源模型**：搜尋事件攜 `sourceUrl`／`sourceTitle`／`sourceSnippet`（全部可選，`normalizeEvent` 容忍缺欄位，不需 bump storage key）；與文檔事件的 `sourceDocId`／`sourceQuote` 雙軌並存。
- **回應協定**：`/api/ai` 回覆改為判別式 `{type:"events"}` 或 `{type:"clarify"}`；流程無狀態，面板在客戶端續上下文（原始查詢＋已選選項），不違反 ADR 0004 薄後端。

## 實作事實（2026-08-06 落地）

- 判別式回應由前端 `src/lib/ai.js` 的 `parseAiResponse` 寬容解析（帶 type 物件／裸陣列／帶 events 鍵物件皆相容）；`parseSchedule` 保留為向後相容的薄包裝，回扁平事件陣列。
- 面板多步流程：`AiSchedulePanel` 以 `conversation` 在客戶端續澄清上下文，每次呼叫獨立無狀態（`askAi(text, calendars, {search, contextMessages})`）。
- `sourceUrl`／`sourceTitle`／`sourceSnippet` 為事件可選欄位（`normalizeEvent` 缺省空字串，不 bump storage key）；經 `EventDialog` 三 refs 打通 prefill→儲存，編輯既有搜尋事件亦保留。
- 日格 hover 浮窗共用：文檔事件顯示原文引用（`sourceQuote`），搜尋事件顯示標題／URL／摘錄。
- Serper 設定欄位：`serperKey`／`serperGl`／`serperHl`（`server/config.js`，已 gitignore）。
- **續輪陷阱（實測）**：工具循環續輪的 assistant 訊息**只帶被滿足的 tool_use block**——若連同 text 一起回傳，中轉站對工具呼叫 id 的轉換偶發不穩定，回「No tool output found」。

## 後果與風險

- **哲學分歧是刻意的**：文檔匯入仍全自動寫入（有原文對照＋整批撤銷），搜尋路徑改「先問後寫」——未來讀者不得擅自統一兩者。
- **意圖閘依賴 LLM 自我判斷「歧義才問」**，不可靠，可能過問或漏問；結果閘是硬性保險。
- Serper 免費額度一次性，正式上線需評估付費成本。
- 澳門本地資訊（政府活動、巴士等）靠通用搜索結果，品質依賴來源網站；必要時評估專用資料源（留待未來）。

## Considered Options

- **純 LLM 記憶搜尋（不檢索）**：日期與來源無法驗證，幻覺直接入曆，否定。
- **另開 /api/search 端點**：被併入 /api/ai 工具循環取代，不另開端點。
- **Bing／Google Search API**：需綁銀行卡，澳門用戶卡障礙；Google 級結果可由 Serper 取代。
- **先只做澄清請求、檢索後補**：探測證實 Serper 免卡免費後，檢索成本極低，改為一次做全（F1）。
