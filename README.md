# 一戶通智能日曆

澳門創新比賽項目（Falcons 團隊）：結合一戶通個人資料的 AI 日曆應用。

## 開發指令

- `npm run dev`：啟動 Vite 開發伺服器
- `npm test`：執行 Vitest 測試
- `npm run build`：產出 `dist/` 生產構建（含團隊頁與日曆頁）
- `npm run preview`：預覽 `dist/` 產物

## 目錄

- `index.html`＋`styles.css`：Falcons 團隊介紹頁（靜態，無 JS）
- `calendar.html`：日曆應用入口（Vue 3）
- `src/`：Vue 原始碼（`components/`、`composables/`、`lib/`、`styles/`）
- `tests/`：Vitest 測試
- `docs/`：ADR 與設計文件
