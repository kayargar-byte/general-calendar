// 複製此檔為 server/config.js，填入你自己的設定。
// server/config.js 已被 .gitignore 排除，不會進入版本庫。
export const AI_CONFIG = {
  // 你的中轉站（或直連 Ark）API 金鑰
  apiKey: "sk-你的-api-key",
  // Anthropic 兼容端點（中轉站如 micuapi.ai 支援 /v1/messages）
  remoteEndpoint: "https://www.micuapi.ai/v1/messages",
  // 使用的文本模型
  model: "gpt-5.6-sol",
  // 視覺模型端點（OpenAI 兼容，接受 base64 image_url）
  visionEndpoint: "https://www.micuapi.ai/v1/chat/completions",
  // 視覺模型名稱（圖片分析用；gpt-5.6-sol 系列支援視覺理解）
  visionModel: "gpt-5.6-sol",
  // 前端呼叫代理須附帶的自訂標頭值（X-Proxy-Key），防止任意網站驅動本地代理；HTTP 標頭僅容許 ASCII，請用隨機字串（如 UUID）
  proxyKey: "change-me-0f3c9a",
  // 允許跨域呼叫代理的來源白名單（Vite dev 為 5173，preview 為 4173）
  allowedOrigins: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
  ],
};
