# 0008：桌面右鍵匯入 — 既有抽取管線的新觸發入口

在 Windows 桌面對文件按右鍵即自動解析其日期事件入曆。觸發通道改為「右鍵選單」，但抽取、統一格式、事件來源與匯入批次等領域概念與既有「文檔匯入」完全一致——右鍵只是輸入通道，不是新領域概念。

決策：**瀏覽器必須開啟**，server 維持無狀態（ADR 0004 邊界不動）；右鍵腳本呼叫既有 `/api/documents/analyze` 並附 `X-Stash` 旗標，server 抽取後把結果放入一次性記憶體收件箱，瀏覽器每 ~2 秒輪詢、拉到即入庫並 ack。右鍵事件**全自動寫入**（與 ADR 0005 一致），但**所有匯入一律取消橫幅撤銷**，文件刪除／回溯統一收歸管理中心（ManageDialog 文件分頁，經 `removeDocument` 連動刪事件＋原檔＋文本）。多選文件時每份建立獨立文檔紀錄（各自 docId／來源追溯），不設逐份撤銷。

右鍵註冊採 `HKCU\Software\Classes\*\shell\加入一戶通日曆` 指向無聲 PowerShell 腳本（免管理員、per-user 可逆）。成功時桌面端無聲、瀏覽器橫幅顯示「已匯入 N 筆（來源：X）」；server 連不上時腳本改彈 Windows 訊息框。收件箱端點沿用 proxyKey，腳本須能讀取金鑰，故新增「腳本可讀的 key 出口」（如 server 啟動時寫入 `server/.desktop-key`）。

## Considered Options

- **Server 持倉待補拉**（瀏覽器未開也生效）：需 server 引入持久狀態與「待處理匯入」新概念，打破 ADR 0004 邊界，demo 無此需求，否決。
- **Server 暫存檔案、前端重跑 analyzeDocument**：前端零新邏輯，但檔案傳兩遍、server 須存檔而非存結果，否決。
- **入曆前確認閘門**（同 AI 搜尋）：與文檔匯入「全自動」行為分裂，且「自動」名不符實，否決。
- **逐份獨立撤銷（撤銷堆疊）**：需把單槽 `LAST_IMPORT_KEY` 擴成堆疊並改 ImportBanner，機械成本最高；改以管理中心統一刪除取代。

## 已知限制（接受）

- 收件箱為記憶體態，server 重啟即清空（瀏覽器開啟為前提，重啟通常已斷頁面，可接受）。
- 多分頁同時輪詢且無原子 claim，可能重複入庫；demo 採單分頁假設。
- 知道 proxyKey 的本地程序可注入事件或消耗 API 額度；事件僅入瀏覽器 session，危害有限，demo 可接受。
- 取消橫幅撤銷會動到 `import-banner.test.js`、`use-calendar-import.test.js` 與 `importDocument`（入庫迴圈需抽成「匯入已抽取結果」供收件箱路徑共用）。
