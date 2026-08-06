// server/search-tools.js
// AI 搜尋的工具循環。deepseek（現行）以原生 web_search_20250305 伺服器端執行搜索，
// 單輪回傳 server_tool_use + web_search_tool_result + text，本循環偵測不到 client 端 tool_use 即原樣回傳。
// micuapi（備援）接受同型別但回 tool_use 需 client 回填，故保留 Serper 回填分支（見 docs/adr/0007）。

// 原生 Anthropic 伺服器端搜索工具：deepseek 會自行執行搜索並回填結果（單輪完成）。
// micuapi 亦接受此型別（探測證實），故兩種供應商共用同一宣告。
export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 1,
};

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const MAX_SEARCH_RESULTS = 5;

export async function searchWeb(query, aiConfig) {
  const response = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-KEY": aiConfig.serperKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      gl: aiConfig.serperGl ?? "hk",
      hl: aiConfig.serperHl ?? "zh-Hant",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message ?? `Serper 搜尋失敗（${response.status}）。`);
  }

  // 只保留有非空標題與連結的 organic 結果；摘要缺省為空字串。
  return (Array.isArray(data?.organic) ? data.organic : [])
    .filter(
      (item) =>
        typeof item?.title === "string" &&
        item.title.trim() !== "" &&
        typeof item?.link === "string" &&
        item.link.trim() !== "",
    )
    .map((item) => ({
      title: item.title.trim(),
      link: item.link.trim(),
      snippet: typeof item.snippet === "string" ? item.snippet.trim() : "",
    }));
}

// 模型若未把查詢詞寫進 tool_use.input（主機化工具探測為空），回退取最後一條 user 訊息文字。
function fallbackQuery(messages) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const content = messages[index]?.content;

    if (messages[index]?.role !== "user" || typeof content !== "string") {
      continue;
    }

    const trimmed = content.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return "";
}

function findWebSearchToolUse(response) {
  return (Array.isArray(response?.content) ? response.content : []).find(
    (block) => block?.type === "tool_use" && block?.name === "web_search",
  );
}

// 續輪後若模型又發出 tool_use，不再執行第二次搜索：過濾成純 text 回應（無文字則給明確訊息）。
function stripToolUse(response) {
  const textBlocks = (Array.isArray(response?.content) ? response.content : [])
    .filter((block) => block?.type === "text" && typeof block.text === "string");

  if (textBlocks.length > 0) {
    return { ...response, content: textBlocks };
  }

  return {
    ...response,
    content: [{ type: "text", text: "未能完成搜尋並整理結果，請重試。" }],
  };
}

async function callUpstream({ system, messages, maxTokens, aiConfig, tools }) {
  const response = await fetch(aiConfig.remoteEndpoint, {
    method: "POST",
    headers: {
      "x-api-key": aiConfig.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiConfig.model,
      max_tokens: maxTokens,
      thinking: { type: "disabled" },
      reasoning_effort: aiConfig.reasoningEffort,
      system,
      messages,
      tools,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `AI 服務回應錯誤（${response.status}）。`);
  }

  return data;
}

// 工具循環：最多兩回合。第一回合帶 web_search 工具；模型未呼叫 → 原樣回傳；
// 有呼叫 → 調 Serper 包成 tool_result 續輪；續輪仍有 tool_use → 降級純文字。
export async function runSearchToolLoop({ system, messages, maxTokens, aiConfig }) {
  const first = await callUpstream({
    system,
    messages,
    maxTokens,
    aiConfig,
    tools: [WEB_SEARCH_TOOL],
  });
  const toolUse = findWebSearchToolUse(first);

  if (!toolUse) {
    return first;
  }

  const query =
    typeof toolUse?.input?.query === "string" && toolUse.input.query.trim()
      ? toolUse.input.query.trim()
      : fallbackQuery(messages);
  let resultContent;

  try {
    const results = query ? await searchWeb(query, aiConfig) : [];
    resultContent = JSON.stringify({
      query,
      results: results.slice(0, MAX_SEARCH_RESULTS),
    });
  } catch (error) {
    resultContent = `搜尋失敗：${error?.message ?? "未知錯誤"}。請以現有知識回答並明確說明無法搜尋。`;
  }

  const second = await callUpstream({
    system,
    messages: [
      ...messages,
      // 續輪的 assistant 訊息只帶被滿足的 tool_use block：若連同 text 一起回傳，
      // 中轉站對工具呼叫 id 的轉換偶發不穩定，回「No tool output found」（實測見 docs/adr/0007）。
      { role: "assistant", content: [toolUse] },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: toolUse.id, content: resultContent },
        ],
      },
    ],
    maxTokens,
    aiConfig,
  });

  return stripToolUse(second);
}
