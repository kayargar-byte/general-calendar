# 一戶通智能日曆

澳門創新比賽項目（Falcons 團隊）：結合一戶通個人資料的 AI 日曆應用。

## 開發指令

- `npm run dev`：啟動 Vite 開發伺服器
- `npm test`：執行 Vitest 測試
- `npm run build`：產出 `dist/` 生產構建（含團隊頁與日曆頁）
- `npm run preview`：預覽 `dist/` 產物
- `npm run ai-proxy`：啟動 AI 代理伺服器（供「AI 輸入日程」使用）

## AI 功能設定

AI 日程解析需要 Ark API 金鑰。金鑰只存在伺服器端，不會進入前端：

1. 複製 `server/config.example.js` 為 `server/config.js`，填入 API 金鑰與模型名稱。
2. 啟動代理：`npm run ai-proxy`（預設 `http://localhost:3000`）。
3. 另開一個終端跑 `npm run dev`（或 `npm run preview`），開啟日曆後點右下角「AI 輸入日程」。

前端透過環境變數 `VITE_AI_ENDPOINT` 指定代理位址（預設 `http://localhost:3000/api/ai`）。

## 目錄

- `index.html`＋`styles.css`：Falcons 團隊介紹頁（靜態，無 JS）
- `calendar.html`：日曆應用入口（Vue 3）
- `src/`：Vue 原始碼（`components/`、`composables/`、`lib/`、`styles/`）
- `server/`：AI 代理伺服器（`server.js`＋`config.example.js`）
- `tests/`：Vitest 測試
- `docs/`：ADR 與設計文件
