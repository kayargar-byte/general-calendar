import { runSearchToolLoop } from "../server/search-tools.js";

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

  const apiKey = process.env.AI_API_KEY;
  const remoteEndpoint = process.env.AI_REMOTE_ENDPOINT;
  const model = process.env.AI_MODEL;
  const reasoningEffort = process.env.AI_REASONING_EFFORT;
  const proxyKey = process.env.AI_PROXY_KEY;

  if (!apiKey || !remoteEndpoint || !model) {
    return res.status(503).json({
      error: {
        message:
          "尚未設定 AI 環境變數（AI_API_KEY、AI_REMOTE_ENDPOINT、AI_MODEL）。",
      },
    });
  }

  if (proxyKey && req.headers["x-proxy-key"] !== proxyKey) {
    return res.status(403).json({ error: { message: "代理金鑰無效。" } });
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};

  const aiConfig = {
    apiKey,
    remoteEndpoint,
    model,
    reasoningEffort: reasoningEffort || undefined,
    serperKey: process.env.AI_SERPER_KEY || "",
    serperGl: process.env.AI_SERPER_GL || "hk",
    serperHl: process.env.AI_SERPER_HL || "zh-Hant",
  };

  const maxTokens = body.max_tokens ?? 1024;

  try {
    if (body.search === true) {
      const data = await runSearchToolLoop({
        system: body.system,
        messages: body.messages,
        maxTokens,
        aiConfig,
      });
      return res.status(200).json(data);
    }

    const requestBody = {
      model,
      max_tokens: maxTokens,
      thinking: { type: "disabled" },
      system: body.system,
      messages: body.messages,
    };

    if (reasoningEffort) {
      requestBody.reasoning_effort = reasoningEffort;
    }

    const upstream = await fetch(remoteEndpoint, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(upstream.status).send(text);
  } catch (err) {
    const message =
      err?.cause?.code === "ECONNREFUSED" || err?.cause?.code === "ENOTFOUND"
        ? "無法連接 AI 服務，請檢查網路連線。"
        : (err?.message ?? "AI 服務失敗。");
    return res.status(502).json({ error: { message } });
  }
}
