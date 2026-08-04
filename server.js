import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AI_CONFIG } from "./js/config.js";

const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

function serveStaticFile(req, res) {
  let urlPath = req.url.split("?")[0];

  if (urlPath === "/") {
    urlPath = "/calendar.html";
  }

  const filePath = path.join(__dirname, urlPath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

async function handleAiProxy(req, res) {
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
  // CORS headers for cross-origin requests (e.g. VS Code Live Server)
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

  serveStaticFile(req, res);
});

server.listen(PORT, () => {
  console.log(`伺服器已啟動：http://localhost:${PORT}`);
});
