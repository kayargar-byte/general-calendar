# Spike 0001:文檔抽取管線前置驗證

> Step 0 of the document-import plan. Verifies the two technical assumptions behind
> the extraction pipeline **before** they get locked into an ADR (Step 2) and server
> code (Step 5). No project code was changed — probes live in `tmp/spike/`.

## 結論摘要

| 假設 | 結果 | 關鍵點 |
|---|---|---|
| A. Ark 支援圖像輸入 | ✅ 可(OpenAI 兼容端點) | `/api/v3/chat/completions` + base64 `image_url`;`/api/coding/v1/messages` 圖像支持**未證實** |
| B. 掃描 PDF 回退 | ⚠️ 概念可行,Node 側有風險 | 渲染 PDF→圖可行;但需 Node 渲染器,Windows 構建風險 |
| C. 四格式抽取 | ✅ 可行 | docx/xlsx 實測通過;PDF 發現**空白不規整**問題,統一格式需規整化 |

## 環境

- Node v24.17.0 / npm 11.13.0;Python 3.12.10(docx/fitz/pypdf/PIL/openpyxl)
- 無 LibreOffice(已排除此方案);無 `server/config.js`(無 Ark API key → **真機 API 調用無法在本步驗證**,留待用戶提供 key 時補測)
- 樣本與腳本: `tmp/spike/out/`(四格式樣本)與 `tmp/spike/run_all.py`(可重跑)

## A. Ark 視覺支持

**事實(來自公開資料,需驗證官方最新文檔)**:
- 視覺走 OpenAI 兼容端點 `https://ark.cn-beijing.volces.com/api/v3/chat/completions`,以 `content` 陣列中的 `{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,..."}}` 傳圖。
- 支援格式: JPEG/PNG/WEBP/GIF/BMP;可多張。
- 視覺模型建議:`doubao-seed-1-6-vision-250815`;其他如 `doubao-1-5-vision-pro-32k-250115`。
- base64 膨脹實測 1.33×(4/3),demo 檔案規模無壓力。

**風險(需驗證)**:
- 現有 server 用 `/api/coding/v1/messages`(Anthropic 兼容)。此端點是否接受圖像 content block **無公開文檔**。備選:視覺統一走 `/api/v3/chat/completions`,文本分析繼續走現有端點或一併遷移。
- Doubao-1.5 及之前**不支援視覺與 function calling 同時開啟**——本管線不用 function calling,無礙,但記錄在案。

來源(二次資料,官方 API 參考於實施時核對):
- [CSDN:基於 doubao-1-5-thinking-pro 開發的視覺識別](https://adg.csdn.net/695257fd5b9f5f31781ba0ef.html)
- [doubao-vision-mcp(GitHub)](https://github.com/dehuadong/doubao-vision-mcp)
- [火山引擎文檔:豆包系列(embedding 入口)](https://docs.volcengine.com/docs/6492/2165107?lang=zh)

## B. 掃描 PDF 回退

- 概念驗證:PyMuPDF 成功把樣本 PDF 頁渲染為 150dpi PNG(`sample-pdf-page.png`),文字層完整。
- **Node 側風險**:pdf-parse 對掃描 PDF 抽不出文字,回退需 PDF 渲染器(`pdf-to-img`/`mupdf`,含原生/二進制模組,Windows 構建有風險)。
- 備選降級:掃描 PDF 提示用戶「轉成圖片再上傳」(圖片路徑已通),避免 Node 渲染依賴。

## C. 四格式抽取實測

| 格式 | 抽取 | 結果 | 注意 |
|---|---|---|---|
| DOCX | python-docx(對應 Node `mammoth`) | ✅ 中英葡段落完整 | — |
| XLSX | openpyxl(對應 Node `xlsx`) | ✅ 表列映射可行 | 空單元格為 `null` → 統一格式需轉空字串 |
| PDF | PyMuPDF(對應 Node `pdf-parse`) | ⚠️ 中文字抽取完整,但**拉丁字被逐字拆散**(`M e e t i n g … 2 0 2 6 - 0 8 - 1 5`) | 樣本用中文字體渲染導致;但足證 PDF 抽取結果**空白/標點可能不規整**,日期會被拆破 |
| 圖片 | 生成驗證;無本機 OCR | ✅ 圖片路徑依賴 vision 模型讀圖 | 不需本地 OCR(設計已定) |

**由此鎖定的統一格式需求**:抽出的原始文字在送入 LLM 前須**規整化**——壓縮連續空白、trim、必要時統一全/半形;否則 `2026-08-15` 被拆成 `2 0 2 6 - 0 8 - 1 5` 會讓 AI 解析失敗。

## 對 Step 2 / Step 5 的決策輸入

1. **視覺端點**:優先驗證現有 `/api/coding/v1/messages` 的圖像支持;若不可行,視覺走 `/api/v3/chat/completions` + 指定 vision 模型名(建議 `doubao-seed-1-6-vision-250815`,需官方確認可用模型)。
2. **掃描 PDF**:Step 5 首選「渲染→vision」;若 Node 渲染器裝不起,降級為提示轉圖上傳。此點應在 ADR 記為已知取捨。
3. **統一格式規整化**:列為管道內必備步驟(空白壓縮 + trim),影響抽取後處理與 prompt 設計。
4. **XLSX 空單元格**:統一格式序列化時 `null`→`""`。
5. **真機 API**:Step 5 驗收時若用戶提供 Ark key,補一次真實圖像調用確認附件格式。
