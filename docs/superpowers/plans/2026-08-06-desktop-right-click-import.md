# 桌面右鍵匯入（Desktop Right-Click Import）實施計劃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows 桌面對文件按右鍵，經本地代理抽取後自動把日期事件寫入日曆；同時所有匯入（拖曳＋右鍵）取消橫幅撤銷，文件刪除／回溯統一收歸管理中心。

**Architecture:** 右鍵選單腳本呼叫既有 `/api/documents/analyze` 並附 `X-Stash: 1` 旗標；server 抽取後把結果放入一次性記憶體收件箱（`server/inbox.js`）；瀏覽器每 2 秒輪詢收件箱，以共用入庫函數 `importAnalyzedResult` 寫入 localStorage／IndexedDB 並 ack。詳細決策見 docs/adr/0008。

**Tech Stack:** Node ≥19（http 代理、global `crypto.randomUUID`）、busboy/mammoth/xlsx/pdf-parse、Vue 3、Vitest（jsdom）、PowerShell 5.1＋curl.exe（Windows 10 1803+ 內建）。

## Global Constraints

- 繁體中文 UI／註解／錯誤訊息（與全專案一致）。
- Server 無狀態；收件箱為記憶體態，重啟即清（ADR 0008）。
- 所有匯入一律無橫幅撤銷；文件刪除只能透過管理中心。
- 瀏覽器必須開啟才生效。
- 抽取結果的事件在入庫時經 `normalizeParsedEvents` 以用戶分類歸一，未知 `calendarId` 回落 `"personal"`。
- 每檔右鍵 = 獨立文檔紀錄（各自 docId／來源追溯），不設逐份撤銷。
- localStorage key 沿用版本前綴 `general-calendar.*.v1`。
- TDD：每步先寫測試確認紅、再實作轉綠。Commit 訊息 `feat:/refactor:/test:/chore:` 前綴。
- 既有測試套件 `npm test` 任何任務結束時必須全綠。

---

## 決策點與取捨（已在 grilling 定案，實作時不得翻盤）

| # | 決策 | 選擇 | 備選與否決理由 |
|---|---|---|---|
| DP1 | 右鍵匯入的原檔保留 | **收件箱只存抽取結果、不存原檔**（ADR 0008）。右鍵匯入的文檔無 blob，DocumentViewDialog 只能顯示規整文本 | 若要求原檔檢視，server 須暫存檔案＋下載端點＋瀏覽器 fetch 存 blob，打破「收件箱不存檔」，否決 |
| DP2 | 收件箱容量 | **FIFO cap 20，超限丟最舊** | 無上限會在瀏覽器長期未開時無限增長；一行防護，值得做 |
| DP3 | pending 消費方式 | **GET＋ack**（瀏覽器拉到即入庫再 ack），多分頁重複入庫列為已知限制 | GET-consumes（讀取即消費）可免重複且少一端點，但瀏覽器「讀取後、入庫前」崩潰會丟匯入，偏離 ADR 措辭 |
| DP4 | 腳本傳檔 | **curl.exe**（-F multipart） | PowerShell 手刻 multipart boundary 易錯 |
| DP5 | 抽取時無日曆 | 腳本不帶 `calendars` → 抽取 prompt 無 categoryList → AI 任選分類 → 前端 ingest 時歸一到用戶分類 | 若要分類精準需瀏覽器參與抽取（已否決的雙重上傳路線） |
| DP6 | ingest 失敗重試 | **一律 ack**（失敗顯示錯誤橫幅，不重試） | FIFO 卡頭會阻塞後續匯入；永久失敗重試也無意義 |
| DP7 | 腳本 key 出口 | server 啟動時寫 `server/.desktop-key`（= proxyKey），腳本讀取 | 獨立 desktop key 多一個 secret 要管理，無必要；config.js 是 ESM，PowerShell 讀不到，故需此明文出口 |

---

## 任務與依賴

```
T1 移除橫幅撤銷鈕 ──▶ T2 移除 lastImport 死碼 ──▶ T3 抽取入庫迴圈 ──┬─▶ T6 前端輪詢 ──▶ T8 全量驗證
T4 server 收件箱 ──▶ T5 server 接線（stash＋端點＋key）──────────┘
                                                                 └─▶ T7 右鍵腳本＋註冊 ──▶ T8
```

### Task 1：移除橫幅撤銷鈕

**Files:**
- Modify: `src/components/ImportBanner.vue`（移除「撤銷」按鈕與 `emit("undo")`、保留 error／close）
- Modify: `src/App.vue`（移除 `<ImportBanner @undo="undoLastImport" ...>` 綁定）
- Test: `tests/import-banner.test.js`

**為什麼：** ADR 0008 — 所有匯入取消橫幅撤銷，刪除統一收歸管理中心（管理中心文件分頁已內建 `removeDocument`）。

**步驟：**
- [ ] 1. 改測試：刪除「emits undo and close」（`#undo-import` 觸發＋`emitted("undo")` 斷言），改為只測 `close`；「renders the error message and hides the undo action」保留（`#undo-import` 不存在仍成立）
- [ ] 2. 跑 `npm test tests/import-banner.test.js` 確認測試改動語意正確
- [ ] 3. 實作 ImportBanner.vue：刪撤銷按鈕與 undo emit
- [ ] 4. 實作 App.vue：刪 `@undo="undoLastImport"` 綁定
- [ ] 5. `npm test` 全綠
- [ ] 6. Commit（`refactor:`）

**完成標準：** `npm test` 全綠；手動拖曳匯入 docx → 橫幅「已匯入 N 筆（來源：X）」且**無**「撤銷」按鈕；管理中心文件 tab 可刪除該文件並連動清除事件。

### Task 2：移除 lastImport／undoLastImport 死碼

**Files:**
- Modify: `src/lib/document-store.js`（移除 `LAST_IMPORT_KEY`、`getLastImport`、`setLastImport`、`clearLastImport`）
- Modify: `src/composables/useCalendar.js`（移除對上列函數的 import；移除 `undoLastImport`；`removeDocument` 內「`getLastImport()?.docId === docId` 則 `clearLastImport()`」分支一併刪除）
- Test: `tests/document-store.test.js`（移除 lastImport 測試區塊，約 L181–186）、`tests/use-calendar-import.test.js`（移除 `undoLastImport` 三個測試；`importDocument`／`removeDocument` 測試移除 `getLastImport` 斷言）

**為什麼：** Task 1 移除唯一呼叫者後，lastImport 機制成為死碼（YAGNI／DRY）。刪除能力仍存在——經管理中心 `removeDocument`。

**依賴：** Task 1（確保先移除呼叫者再刪定義）。

**完成標準：** `npm test` 全綠；`grep -rn "LastImport\|undoLastImport\|LAST_IMPORT" src/ tests/` 零命中。

### Task 3：抽取入庫迴圈 `importAnalyzedResult`

**Files:**
- Modify: `src/composables/useCalendar.js`
- Test: `tests/use-calendar-import.test.js`

**介面（供 Task 6 消費）：**
- `importAnalyzedResult({ events, extractedText, name, mimeType, blob }) → Promise<boolean>`
  - `events` 經 `normalizeParsedEvents(events, new Set(calendars.value.map(c => c.id)))` 歸一（未知 calendarId → `"personal"`）
  - 歸一後 0 事件 → 設 `importError`＋開 `importBannerOpen`、回傳 `false`（不 throw）
  - 每筆 `createEvent({ ...event, sourceDocId: docId, sourceQuote: event.quote })`，單筆失敗不阻斷整批
  - `createDocument({ id: docId, name, mimeType, size: blob?.size ?? 0, hasText: !!extractedText })`
  - `blob` 存在才 `saveDocumentBlob(docId, blob)`；`extractedText` 非空才 `saveDocumentText(docId, extractedText)`（兩者 try/catch 不阻斷）
  - 設 `importCount`／`importDocName`／開 banner；`eventsVersion.value++`
- `importDocument(file)` 變薄：`analyzeDocument(file, calendars.value)` → `importAnalyzedResult({ events, extractedText, name: file.name, mimeType: file.type, blob: file })`；catch 只負責 analyze 階段的錯誤

**為什麼：** 收件箱路徑（右鍵匯入）拿到的已是 server 抽取結果、沒有原檔，必須能直接入庫；拖曳路徑重複一次歸一是無害冪等。DP5 的 personal 回落在此兌現。

**依賴：** Task 2。

**完成標準：** `npm test` 全綠（新增 `importAnalyzedResult` 測試：正常入庫含 blob/text 存檔、0 事件錯誤橫幅並回傳 false、無 blob 不呼叫 saveDocumentBlob）；拖曳匯入行為與改前一致（事件、橫幅、管理中心可刪）。

### Task 4：server 收件箱模組

**Files:**
- Create: `server/inbox.js`
- Test: `tests/server-inbox.test.js`

**介面（供 Task 5 消費）：**
- `pushImport({ events, extractedText, docName, mimeType }) → id`（`id = crypto.randomUUID()`；FIFO，超 20 丟最舊）
- `getPendingImports() → Array`（回傳淺拷貝）
- `ackImport(id) → boolean`

**為什麼：** 收件箱邏輯獨立成模組才能被單元測試覆蓋；server.js 端點保持薄包裝。DP2 的 cap 在此實作。

**完成標準：** 單元測試綠：push 後可取得、ack 移除、cap 20 丟最舊、ack 不存在回傳 false、getPendingImports 不洩漏內部陣列引用。

### Task 5：server 接線（stash 旗標＋pending/ack 端點＋key 出口）

**Files:**
- Modify: `server/server.js`
  - `handleDocumentAnalyze`：成功後若 `req.headers["x-stash"] === "1"`，`pushImport({ events, extractedText, docName: filename, mimeType })`（於寫回傳前）
  - 新端點 `GET /api/imports/pending` → `{ imports: getPendingImports() }`（須 `enforceSecurity`）
  - 新端點 `POST /api/imports/:id/ack` → `{ ok: true }`，找不到 id → 404 `{ error: { message: "找不到待處理匯入。" } }`（須 `enforceSecurity`）
  - 端點匹配沿用現有 `urlPath.split("?")[0]` 邏輯；`/api/imports` 前綴掛在既有「AI_CONFIG 非 null 才服務」之外（收件箱無需 AI key，但 enforceSecurity 依賴 AI_CONFIG 的 proxyKey/allowedOrigins，故仍須 AI_CONFIG）
  - listen 前：`AI_CONFIG` 非 null 時 `fs.writeFileSync("server/.desktop-key", AI_CONFIG.proxyKey)`（DP7）
- Modify: `.gitignore`（＋ `server/.desktop-key`）

**為什麼：** 右鍵腳本是無 Origin 的本地程序，直接呼叫既有 analyze 端點；stash 旗標讓結果也進收件箱供瀏覽器拉取（ADR 0008 傳輸架構）。

**依賴：** Task 4。

**完成標準（curl smoke，`npm run ai-proxy` 後）：**
- 帶 `X-Proxy-Key`＋`X-Stash: 1` POST 一個 docx 到 `/api/documents/analyze` → 200
- `GET /api/imports/pending`（帶 key）→ 含該筆 `{ id, events, extractedText, docName, mimeType }`
- `POST /api/imports/<id>/ack`（帶 key）→ `{ ok: true }`；再 `GET pending` 為空
- 不帶 key 或帶非白名單 origin → 403

### Task 6：前端輪詢 `useDesktopImports`

**Files:**
- Create: `src/composables/useDesktopImports.js`
- Modify: `src/App.vue`（`const { importAnalyzedResult, isImporting, calendars } = useCalendar()` 已存在；新增 `useDesktopImports({ importAnalyzedResult, isImporting, calendars })`，onMounted 啟動）
- Modify: `.env.example`（＋ `VITE_AI_IMPORTS_ENDPOINT=http://localhost:3000/api/imports`，註解與 VITE_AI_PROXY_KEY 一致）
- Modify: `README.md`（「AI 功能設定」補一行：桌面右鍵匯入的收件箱端點由 `VITE_AI_IMPORTS_ENDPOINT` 指定）
- Test: `tests/desktop-imports.test.js`

**介面：**
- `useDesktopImports({ importAnalyzedResult, isImporting, calendars })`
  - 無 `VITE_AI_PROXY_KEY`（`import.meta.env`）→ 靜默不啟動
  - base 端點：`import.meta.env.VITE_AI_IMPORTS_ENDPOINT ?? "http://localhost:3000/api/imports"`
  - `setInterval(poll, 2000)`；`poll()` 內先檢查 `document.visibilityState === "visible"` 與 `isImporting.value`，任一不符 skip
  - poll：`fetch(base + "/pending", { headers: { "X-Proxy-Key": key } })`；逐筆 `await importAnalyzedResult({ events, extractedText, name: docName, mimeType })`；**無論成功與否**都 `POST /{id}/ack`（DP6）；`/pending` 或 ack 網路失敗 → 靜默，下次再試
  - `onUnmounted` 清 interval

**為什麼：** 瀏覽器是唯一能寫 localStorage 的一方；輪詢是最小橋接（無需 SSE/WS）。DP6 的一律 ack 在此兌現。

**依賴：** Task 3（`importAnalyzedResult`）、Task 5（端點）。

**完成標準：** `npm test` 全綠（fake timers＋stub fetch：pending 時入庫並 ack、空 pending 不動作、無 key 不 fetch、visibility hidden 不 poll）；手動：curl 塞一筆 stash 匯入 → 開日曆，2 秒內事件自動入庫且橫幅顯示來源名。

### Task 7：PowerShell 右鍵腳本＋註冊

**Files:**
- Create: `scripts/desktop-import.ps1`
  - 參數：`[string[]] FilePath`（右鍵選單逐檔傳入）
  - 讀 key：`Join-Path $PSScriptRoot "..\server\.desktop-key"`；檔案不存在 → MessageBox「尚未啟動本地代理」並 Exit 1
  - 逐檔：`curl.exe -sS -o NUL -X POST -H "X-Proxy-Key: <key>" -H "X-Stash: 1" -F "file=@<path>" http://localhost:3000/api/documents/analyze`
  - `$LASTEXITCODE` 非 0 → MessageBox「無法連接 AI 服務…」並 Exit 1；成功無聲 Exit 0（DP4）
- Create: `scripts/install-desktop-import.ps1`
  - `reg add "HKCU\Software\Classes\*\shell\加入一戶通日曆\command" /ve /d "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"<absolute>\scripts\desktop-import.ps1\" -FilePath \"%1\"" /f`（免管理員）
- Modify: `README.md`（新增「桌面右鍵匯入」一節：前置條件＝server 跑著＋瀏覽器開著＋已安裝右鍵項；安裝指令；已知限制＝瀏覽器必須開、server 重啟清空收件箱、無原檔檢視）

**為什麼：** Windows shell verb 對多選檔案**逐檔呼叫一次** command → 每檔各自一個 stash → 天然對應「每份獨立一批」，無需額外批次邏輯。DP4/DP7 在此兌現。

**依賴：** Task 5（key 出口與 stash 端點）。

**完成標準：** 跑 install 腳本後右鍵真實 docx → 瀏覽器內自動入曆且橫幅顯示來源；server 關閉時右鍵 → MessageBox 提示無法連接。

### Task 8：全量驗證

**Files:** 無新增改動。

**依賴：** Task 1–7 全部。

**完成標準：**
- `npm test` 全綠
- `npm run build` 成功
- 端到端演示：`npm run ai-proxy`＋`npm run dev` → 右鍵一個 docx → 日曆出現事件 → 管理中心文件 tab 刪除該文件 → 事件連動清除、橫幅已無撤銷鈕

---

## Self-Review

- **Spec coverage**：ADR 0008 決策逐項對應——取消撤銷（T1/T2）、共用入庫迴圈（T3）、收件箱（T4）、stash＋端點＋key 出口（T5）、輪詢（T6）、腳本＋註冊（T7）、文件與 .gitignore（T5/T6/T7）、已知限制已寫進 ADR（grilling 階段完成）。無缺項。
- **Placeholder scan**：無 TODO／TBD；每步有明確文件、動作、驗證。
- **Type consistency**：`importAnalyzedResult({ events, extractedText, name, mimeType, blob })`（T3 定義、T6 消費）與 `pushImport/getPendingImports/ackImport`（T4 定義、T5 消費）跨任務簽名一致；`X-Stash`／`X-Proxy-Key` 標頭在 T5/T7 兩端一致。
