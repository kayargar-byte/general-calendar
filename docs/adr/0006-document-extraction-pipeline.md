# 0006：文檔抽取採「逐格式抽取 → 統一格式 → AI 分析」

文件輸入（Word／PDF／Excel／圖片）需抽出「日期＋事件描述」配對。早期假設全多模態直讀（文件直接送視覺模型繞過 OCR），但 docx／xlsx 是結構化文本，沒有掃描問題，純多模態仍須先轉檔（LibreOffice 為 Windows 重依賴），且讓 AI 從截圖推測文本易生幻覺；OCR 語言瓶頸僅存在於掃描型 PDF／圖片。

決策：docx 用 Mammoth、xlsx 用 SheetJS、pdf 用 pdf-parse 抽文字（掃描型回退渲染成圖送視覺模型；渲染器裝不起則降級提示轉圖上傳）、圖片用視覺模型；四路結果匯總為統一規整文本（壓縮連續空白＋trim，避免日期被拆破）後，再以既有文本分析 prompt 抽取事件。server 首次引入依賴：busboy（multipart）、mammoth、xlsx、pdf-parse。文件端點採 multipart，並要求自訂標頭（X-Proxy-Key）＋CORS origin 白名單，防止任意網站驅動本地代理。可行性實測見 docs/spike-0001-document-extraction-verification.md。

需驗證：現有 `/api/coding/v1/messages`（Anthropic 兼容）是否接受圖像附件；若否，視覺改走 OpenAI 兼容 `/api/v3/chat/completions`（Step 0 已確認該端點支援 base64 image_url）。

## Considered Options

- 全多模態直讀：docx／xlsx 無掃描問題仍需轉檔，LibreOffice 為重依賴，demo 部署風險高；AI 從截圖推測文本易幻覺。
- 前端文字抽取：處理在前端，與 ADR 0004「處理在後端」矛盾；引入 mammoth／pdf.js／SheetJS 三前端庫。
- 掃描 PDF 用 tesseract OCR：中英葡語言包重，品質依賴傳統 OCR，與「多模態繞過 OCR 語言瓶頸」取向相悖。
- 暫不支援 Excel：違背 design-brief 文件輸入清單（Excel 視為批量事件表）。
