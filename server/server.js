import http from "node:http";

let AI_CONFIG = null;

try {
  const module = await import("./config.js");
  AI_CONFIG = module.AI_CONFIG;
} catch {
  console.warn("警告：找不到 server/config.js，AI 代理功能不可用。");
  console.warn(
    "請複製 server/config.example.js 為 server/config.js 並填入 API 金鑰。",
  );
}

const PORT = process.env.PORT || 3000;

async function handleAiProxy(req, res) {
  if (!AI_CONFIG) {
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error: {
          message:
            "尚未設定 API 金鑰，請複製 server/config.example.js 為 server/config.js 並填入金鑰。",
        },
      }),
    );
    return;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const requestBody = Buffer.concat(chunks).toString();

  let parsedBody;
  try {
    parsedBody = JSON.parse(requestBody);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: "請求格式無效。" } }));
    return;
  }

  try {
    const upstream = await fetch(AI_CONFIG.remoteEndpoint, {
      method: "POST",
      headers: {
        "x-api-key": AI_CONFIG.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        max_tokens: parsedBody.max_tokens ?? 1024,
        thinking: { type: "disabled" },
        system: parsedBody.system,
        messages: parsedBody.messages,
      }),
    });

    const text = await upstream.text();

    res.writeHead(upstream.status, {
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(text);
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error: { message: "無法連接 AI 服務，請檢查網路連線。" },
      }),
    );
  }
}

const server = http.createServer((req, res) => {
  // CORS headers for cross-origin requests (e.g. Vite dev server)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.url.split("?")[0] === "/api/ai") {
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST") {
      handleAiProxy(req, res);
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`AI 代理伺服器已啟動：http://localhost:${PORT}`);
});
