import busboy from "busboy";
import {
  analyzeDocument,
  assertFileSize,
} from "../../server/extractors.js";
import { documentUploadErrorStatus } from "../../server/import-http.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Proxy-Key");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(404).json({ error: { message: "Not Found" } });
  }

  const proxyKey = process.env.AI_PROXY_KEY;

  if (proxyKey && req.headers["x-proxy-key"] !== proxyKey) {
    return res.status(403).json({ error: { message: "代理金鑰無效。" } });
  }

  const apiKey = process.env.AI_API_KEY;
  const remoteEndpoint = process.env.AI_REMOTE_ENDPOINT;
  const model = process.env.AI_MODEL;

  if (!apiKey || !remoteEndpoint || !model) {
    return res.status(503).json({
      error: {
        message:
          "尚未設定 AI 環境變數（AI_API_KEY、AI_REMOTE_ENDPOINT、AI_MODEL）。",
      },
    });
  }

  const aiConfig = {
    apiKey,
    remoteEndpoint,
    model,
    reasoningEffort: process.env.AI_REASONING_EFFORT || undefined,
    visionEndpoint: process.env.AI_VISION_ENDPOINT || "",
    visionApiKey: process.env.AI_VISION_API_KEY || "",
    visionModel: process.env.AI_VISION_MODEL || "",
  };

  let mimeType = "";
  let filename = "";
  let calendars = [];
  let profile = "";
  const fileChunks = [];

  try {
    await new Promise((resolve, rejectPromise) => {
      const bb = busboy({
        headers: req.headers,
        defParamCharset: "utf8",
        limits: { files: 1, fileSize: 10 * 1024 * 1024 },
      });

      bb.on("file", (_name, file, info) => {
        mimeType = info.mimeType;
        filename = info.filename;
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
        } else if (name === "profile") {
          profile = value;
        }
      });

      bb.on("error", (err) => rejectPromise(err));
      bb.on("close", resolve);
      req.pipe(bb);
    });

    if (fileChunks.length === 0) {
      return res.status(400).json({ error: { message: "未收到檔案。" } });
    }

    const buffer = Buffer.concat(fileChunks);
    assertFileSize(buffer.length);

    const { events, extractedText } = await analyzeDocument({
      mimeType,
      filename,
      buffer,
      calendars,
      profile,
      aiConfig,
    });

    return res.status(200).json({
      events,
      extractedText,
      docName: filename,
      mimeType,
    });
  } catch (err) {
    const status = documentUploadErrorStatus(err);
    return res.status(status).json({
      error: { message: err?.message ?? "文件分析失敗。" },
    });
  }
}
