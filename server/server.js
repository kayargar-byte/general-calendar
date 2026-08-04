import http from "node:http";
import busboy from "busboy";
import {
  assertFileSize,
  analyzeDocument,
  MAX_FILE_BYTES,
} from "./extractors.js";

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

function isAllowedOrigin(origin) {
  return Boolean(origin && (AI_CONFIG?.allowedOrigins ?? []).includes(origin));
}

function isAuthorized(req) {
  return req.headers["x-proxy-key"] === AI_CONFIG?.proxyKey;
}

function reject(res, code, message) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: { message } }));
}

function enforceSecurity(req, res) {
  const origin = req.headers.origin;

  if (origin && !isAllowedOrigin(origin)) {
    reject(res, 403, "不允許的來源。");
    return false;
  }

  if (!isAuthorized(req)) {
    reject(res, 403, "代理金鑰無效。");
    return false;
  }

  return true;
}

async function handleDocumentAnalyze(req, res) {
  let mimeType = "";
  let filename = "";
  let calendars = [];
  let exceededLimit = false;
  const fileChunks = [];

  await new Promise((resolve, rejectPromise) => {
    const bb = busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: MAX_FILE_BYTES },
    });

    bb.on("file", (name, file, info) => {
      mimeType = info.mimeType;
      filename = info.filename;
      file.on("limit", () => {
        exceededLimit = true;
      });
      file.on("data", (chunk) => {
        fileChunks.push(chunk);
      });
    });

    bb.on("field", (name, value) => {
      if (name === "calendars") {
        try {
          calendars = JSON.parse(value);
        } catch {
          calendars = [];
        }
      }
    });

    bb.on("error", (err) => rejectPromise(err));
    bb.on("close", resolve);
    req.pipe(bb);
  });

  if (exceededLimit) {
    reject(res, 413, "檔案超過 10MB 上限。");
    return;
  }

  if (fileChunks.length === 0) {
    reject(res, 400, "未收到檔案。");
    return;
  }

  const buffer = Buffer.concat(fileChunks);

  try {
    assertFileSize(buffer.length);
    const events = await analyzeDocument({
      mimeType,
      filename,
      buffer,
      calendars,
      aiConfig: AI_CONFIG,
    });
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ events, docName: filename, mimeType }));
  } catch (err) {
    const status =
      err?.code === "FILE_TOO_LARGE"
        ? 413
        : err?.code === "UNSUPPORTED_TYPE"
          ? 400
          : err?.code === "SCANNED_PDF" ||
              err?.code === "EMPTY_CONTENT" ||
              err?.code === "NO_EVENTS"
            ? 422
            : 502;
    reject(res, status, err?.message ?? "文件分析失敗。");
  }
}

const server = http.createServer((req, res) => {
  // CORS：僅對白名單內的來源回應 ACAO。自訂標頭 X-Proxy-Key 觸發 preflight，
  // 攔截任意網站驅動本地代理——multipart 屬「簡單請求」無 preflight，單靠 origin 擋不住副作用。
  const origin = req.headers.origin;
  const allowedOrigin = isAllowedOrigin(origin) ? origin : null;

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Proxy-Key");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url.split("?")[0];

  if (urlPath === "/api/ai" || urlPath === "/api/documents/analyze") {
    if (!AI_CONFIG) {
      reject(
        res,
        503,
        "尚未設定 API 金鑰，請複製 server/config.example.js 為 server/config.js 並填入金鑰。",
      );
      return;
    }

    if (!enforceSecurity(req, res)) {
      return;
    }

    if (urlPath === "/api/ai" && req.method === "POST") {
      handleAiProxy(req, res);
      return;
    }

    if (urlPath === "/api/documents/analyze" && req.method === "POST") {
      handleDocumentAnalyze(req, res);
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`AI 代理伺服器已啟動：http://localhost:${PORT}`);
});
