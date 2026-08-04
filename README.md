# ChronoMO 智能日曆

澳門居民智能日曆應用，支援自然語言 AI 日程解析、自訂標籤與顏色。

## 快速開始

### 1. 設定 API 金鑰

複製 `js/config.example.js` 為 `js/config.js`，填入你自己的設定：

```bash
cp js/config.example.js js/config.js
```

```js
export const AI_CONFIG = {
  apiKey: "ark-你的-api-key",                                    // 你的 Ark API 金鑰
  endpoint: "http://localhost:你的埠號/api/ai",                    // 本地代理伺服器地址
  remoteEndpoint: "https://ark.cn-beijing.volces.com/api/coding/v1/messages", // Ark API 遠端端點
  model: "你的模型名稱",                                          // 使用的模型
};
```

### 2. 啟動代理伺服器

由於 Ark API 的 CORS 限制，需透過本地代理伺服器轉發 AI 請求：

```bash
npm start
```

伺服器會在 `http://localhost:3000` 啟動，**保持終端開啟**。

### 3. 開啟日曆頁面

用以下任一方式開啟 `calendar.html`：

- 瀏覽器訪問 `http://localhost:3000/calendar.html`
- 或用 VS Code Live Server 開啟

## 功能

- **月曆檢視**：切換月份、今日定位、日期點擊新增事件
- **自訂標籤**：點擊「新增標籤」自選顏色，事件顏色與標籤一致
- **AI 日程解析**：點擊右下角 AI 按鈕，輸入自然語言（如「後天下午三點開會」），自動解析為結構化事件
- **事件管理**：新增、編輯、刪除事件，按標籤篩選

## 測試

```bash
npm test
```

## 技術棧

- 原生 JavaScript ES Modules（無框架、無建置步驟）
- Ark API（GLM-5.2 模型，Anthropic Messages API 格式）
- localStorage 本機儲存
- Node.js 原生測試框架
