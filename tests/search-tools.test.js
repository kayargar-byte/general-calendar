import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import {
  WEB_SEARCH_TOOL,
  runSearchToolLoop,
  searchWeb,
} from "../server/search-tools.js";

// 用 URL 區分 fetch 的兩條上游：relay（Anthropic 兼容）與 Serper（搜尋 API）。
const RELAY_URL = "https://relay.example/v1/messages";
const SERPER_URL = "https://google.serper.dev/search";

const AI_CONFIG = {
  remoteEndpoint: RELAY_URL,
  apiKey: "test-key",
  model: "test-model",
  serperKey: "serper-test-key",
  serperGl: "hk",
  serperHl: "zh-Hant",
};

function textBlock(text) {
  return { type: "text", text };
}

function toolUseBlock(id, input = {}) {
  return { type: "tool_use", id, name: "web_search", input };
}

function mockUpstream(content) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: "r1",
      type: "message",
      role: "assistant",
      content,
      stop_reason: "end_turn",
    }),
  };
}

function mockSerper(organic) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ organic }),
  };
}

function loopArgs(messages = [{ role: "user", content: "hello" }]) {
  return {
    system: "sys",
    messages,
    maxTokens: 2048,
    aiConfig: AI_CONFIG,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("searchWeb sends X-API-KEY and returns sanitized organic results", async () => {
  let sentHeaders;
  let sentBody;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      assert.equal(url, SERPER_URL);
      sentHeaders = options.headers;
      sentBody = JSON.parse(options.body);
      return mockSerper([
        { title: "A", link: "https://a.example", snippet: "snippet a" },
        { title: "", link: "https://no-title.example", snippet: "x" },
        { link: "https://no-title2.example" },
        { title: "B", link: "https://b.example" },
      ]);
    }),
  );

  const results = await searchWeb("美食節", AI_CONFIG);

  assert.equal(sentHeaders["X-API-KEY"], "serper-test-key");
  assert.equal(sentBody.q, "美食節");
  assert.equal(sentBody.gl, "hk");
  // 無標題者過濾；缺 snippet 者補空字串。
  assert.deepEqual(results, [
    { title: "A", link: "https://a.example", snippet: "snippet a" },
    { title: "B", link: "https://b.example", snippet: "" },
  ]);
});

test("runSearchToolLoop returns directly when the model does not call the tool", async () => {
  // callUpstream 解出的是 data（含 content），不是 fetch response 包裝。
  const upstreamData = {
    id: "r1",
    type: "message",
    role: "assistant",
    content: [textBlock('{"type":"events","events":[]}')],
    stop_reason: "end_turn",
  };
  const fetchMock = vi.fn(async (url) => {
    if (url === RELAY_URL) {
      return { ok: true, status: 200, json: async () => upstreamData };
    }
    throw new Error("Serper should not be called");
  });
  vi.stubGlobal("fetch", fetchMock);

  const result = await runSearchToolLoop(loopArgs());

  assert.equal(result, upstreamData);
  assert.equal(fetchMock.mock.calls.length, 1);
});

test("runSearchToolLoop fulfills web_search via Serper and continues", async () => {
  let continuationBody;
  const fetchMock = vi.fn(async (url, options) => {
    const sent = JSON.parse(options.body);

    if (url === RELAY_URL) {
      if (sent.tools) {
        // 第一回合帶工具宣告。
        assert.deepEqual(sent.tools, [WEB_SEARCH_TOOL]);
        return mockUpstream([toolUseBlock("call_1", { query: "澳門美食節 日期" })]);
      }

      // 續輪：messages 為 [user, assistant(tool_use), user(tool_result)]。
      continuationBody = sent;
      return mockUpstream([
        textBlock('{"type":"events","events":[],"candidates":[]}'),
      ]);
    }

    if (url === SERPER_URL) {
      assert.equal(sent.q, "澳門美食節 日期");
      return mockSerper([
        { title: "官方", link: "https://m.gov.mo", snippet: "日期" },
      ]);
    }

    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const result = await runSearchToolLoop(loopArgs());

  assert.equal(continuationBody.messages.length, 3);
  assert.equal(continuationBody.messages[1].role, "assistant");
  // 續輪 assistant 只帶 tool_use block（連同 text 會令中轉站 id 轉換偶發失敗）。
  assert.equal(continuationBody.messages[1].content.length, 1);
  assert.equal(continuationBody.messages[1].content[0].type, "tool_use");

  const toolResult = continuationBody.messages[2].content[0];
  assert.equal(toolResult.type, "tool_result");
  assert.equal(toolResult.tool_use_id, "call_1");
  assert.deepEqual(JSON.parse(toolResult.content), {
    query: "澳門美食節 日期",
    results: [{ title: "官方", link: "https://m.gov.mo", snippet: "日期" }],
  });

  const finalText = result.content.find((block) => block.type === "text");
  assert.match(finalText.text, /"type":"events"/);
  assert.equal(fetchMock.mock.calls.length, 3); // 第一回合 + Serper + 續輪
});

test("runSearchToolLoop does not search twice and strips a second tool_use", async () => {
  let serperCalls = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      const sent = JSON.parse(options.body);

      if (url === RELAY_URL) {
        if (sent.tools) {
          return mockUpstream([toolUseBlock("call_1", { query: "q1" })]);
        }
        // 續輪仍發出 tool_use → 應降級、不再呼叫第二次 Serper。
        return mockUpstream([toolUseBlock("call_2", { query: "q2" })]);
      }

      if (url === SERPER_URL) {
        serperCalls++;
        return mockSerper([]);
      }

      throw new Error(`unexpected fetch ${url}`);
    }),
  );

  const result = await runSearchToolLoop(loopArgs());

  assert.equal(serperCalls, 1);
  assert.equal(result.content.some((block) => block.type === "tool_use"), false);
  assert.match(result.content[0].text, /未能完成搜尋/);
});

test("runSearchToolLoop degrades to a memory answer when Serper fails", async () => {
  let toolResultContent;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      const sent = JSON.parse(options.body);

      if (url === RELAY_URL) {
        if (sent.tools) {
          return mockUpstream([toolUseBlock("call_1", { query: "q" })]);
        }
        toolResultContent = sent.messages[2].content[0].content;
        return mockUpstream([textBlock('{"type":"events","events":[]}')]);
      }

      if (url === SERPER_URL) {
        return {
          ok: false,
          status: 429,
          json: async () => ({ message: "rate limit" }),
        };
      }

      throw new Error(`unexpected fetch ${url}`);
    }),
  );

  const result = await runSearchToolLoop(loopArgs());

  assert.match(toolResultContent, /搜尋失敗/);
  assert.match(toolResultContent, /rate limit/);
  assert.equal(result.content.length, 1);
});

test("runSearchToolLoop falls back to the last user message when tool input has no query", async () => {
  let serperQuery;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      const sent = JSON.parse(options.body);

      if (url === RELAY_URL) {
        if (sent.tools) {
          // 主機化工具探測回傳 input:{}——查詢詞需回退取 user 訊息。
          return mockUpstream([toolUseBlock("call_1")]);
        }
        return mockUpstream([textBlock("ok")]);
      }

      if (url === SERPER_URL) {
        serperQuery = sent.q;
        return mockSerper([]);
      }

      throw new Error(`unexpected fetch ${url}`);
    }),
  );

  await runSearchToolLoop(loopArgs());

  assert.equal(serperQuery, "hello");
});
