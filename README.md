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
2. 複製 `.env.example` 為 `.env`，確保 `VITE_AI_PROXY_KEY` 與 `server/config.js` 的 `proxyKey` 一致（前端以此自訂標頭呼叫代理）。
3. 啟動代理：`npm run ai-proxy`（預設 `http://localhost:3000`）。
4. 另開一個終端跑 `npm run dev`（或 `npm run preview`），開啟日曆後點右下角「AI 輸入日程」。

前端透過環境變數 `VITE_AI_ENDPOINT` 指定代理位址（預設 `http://localhost:3000/api/ai`）；`VITE_AI_PROXY_KEY` 未設定時 AI 請求會拋明確錯誤，不會以默認值靜默出錯。桌面右鍵匯入的收件箱端點由 `VITE_AI_IMPORTS_ENDPOINT` 指定（預設 `http://localhost:3000/api/imports`）。

## 桌面右鍵匯入

Windows 桌面對文件按右鍵 →「加入一戶通日曆」，自動解析文件中的日期事件入曆。這是既有「文檔匯入」的一個新觸發入口，事件可從管理中心刪除（見 `docs/adr/0008`）。

**前置條件**

- 已按「AI 功能設定」完成 `server/config.js` 與 `.env` 設定（代理金鑰一致）。
- 瀏覽器日曆頁必須開啟（事件寫入瀏覽器的 localStorage）。
- 已安裝右鍵選單項（下方）。

**安裝**

1. 註冊右鍵選單（免管理員、僅當前使用者）：

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-desktop-import.ps1
   ```

2. 啟動代理：`npm run ai-proxy`（啟動時寫入 `server/.desktop-key` 供腳本讀取金鑰）。
3. 開啟日曆頁後，對 docx／pdf／xlsx／圖片按右鍵 →「加入一戶通日曆」。

**移除右鍵選單**

```powershell
reg delete "HKCU\Software\Classes\*\shell\加入一戶通日曆" /f
```

**已知限制**

- 瀏覽器必須開啟才生效；server 重啟會清空尚未入庫的收件箱。
- 右鍵匯入的文檔無原檔檢視（收件箱只存抽取結果與規整文本）。
- 多個日曆分頁同時開啟可能重複入庫。

## 目錄

- `index.html`＋`styles.css`：Falcons 團隊介紹頁（靜態，無 JS）
- `calendar.html`：日曆應用入口（Vue 3）
- `src/`：Vue 原始碼（`components/`、`composables/`、`lib/`、`styles/`）
- `server/`：AI 代理伺服器（`server.js`＋`config.example.js`）
- `tests/`：Vitest 測試
- `docs/`：ADR 與設計文件
