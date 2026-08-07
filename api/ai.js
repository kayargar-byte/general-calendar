export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(404).json({ error: { message: "Not Found" } });
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

  const body =
    typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};

  try {
    const upstream = await fetch(remoteEndpoint, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: body.max_tokens ?? 1024,
        thinking: { type: "disabled" },
        system: body.system,
        messages: body.messages,
      }),
    });

    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(upstream.status).send(text);
  } catch {
    return res.status(502).json({
      error: { message: "無法連接 AI 服務，請檢查網路連線。" },
    });
  }
}
