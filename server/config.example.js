// 複製此檔為 server/config.js，填入你自己的設定。
// server/config.js 已被 .gitignore 排除，不會進入版本庫。
export const AI_CONFIG = {
  // DeepSeek 官方 API 金鑰（文本／搜索用）
  apiKey: "sk-你的-deepseek-key",
  // DeepSeek Anthropic 兼容端點（支援 /v1/messages 與原生 web_search 伺服器端執行）
  remoteEndpoint: "https://api.deepseek.com/anthropic/v1/messages",
  // 文本模型（deepseek-v4-flash：純文字最快）
  model: "deepseek-v4-flash",
  // 推理強度（OpenAI 參數；deepseek 接受，medium 下加速）
  reasoningEffort: "medium",
  // 視覺模型端點（OpenAI 兼容，接受 base64 image_url；deepseek 無多模態，識圖須走此端點）
  visionEndpoint: "https://www.micuapi.ai/v1/chat/completions",
  // 視覺模型金鑰（中轉站 key，與文本 key 分開）
  visionApiKey: "sk-你的-micuapi-key",
  // 視覺模型名稱（terra 支援視覺理解；luna 在中轉站 vip_2 分組無渠道，勿用）
  visionModel: "gpt-5.6-terra",
  // Serper 搜尋 API 金鑰（deepseek 原生 web_search 後暫未使用，保留作回退；免卡註冊）
  serperKey: "sk-你的-serper-key",
  // 搜尋地域與語言（澳門無專用 Google 網域，用香港地域與繁體中文）
  serperGl: "hk",
  serperHl: "zh-Hant",
  // 前端呼叫代理須附帶的自訂標頭值（X-Proxy-Key），防止任意網站驅動本地代理；HTTP 標頭僅容許 ASCII，請用隨機字串（如 UUID）
  proxyKey: "change-me-0f3c9a",
  // 允許跨域呼叫代理的來源白名單（Vite dev 為 5173，preview 為 4173）
  allowedOrigins: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
  ],
};
