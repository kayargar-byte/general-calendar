import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, test } from "vitest";

const configUrl = pathToFileURL(resolve(process.cwd(), "server/config.example.js"));
const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalVisionKey = process.env.VISION_API_KEY;

async function loadConfig() {
  return import(`${configUrl.href}?test=${Date.now()}-${Math.random()}`);
}

afterEach(() => {
  if (originalDeepSeekKey === undefined) {
    delete process.env.DEEPSEEK_API_KEY;
  } else {
    process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
  }

  if (originalVisionKey === undefined) {
    delete process.env.VISION_API_KEY;
  } else {
    process.env.VISION_API_KEY = originalVisionKey;
  }
});

test("server configuration example prefers a process-only DeepSeek key", async () => {
  process.env.DEEPSEEK_API_KEY = "session-only-test-key";

  const { AI_CONFIG } = await loadConfig();

  assert.equal(AI_CONFIG.apiKey, "session-only-test-key");
});

test("server configuration example prefers a process-only multimodal key", async () => {
  process.env.VISION_API_KEY = "session-only-vision-key";

  const { AI_CONFIG } = await loadConfig();

  assert.equal(AI_CONFIG.visionApiKey, "session-only-vision-key");
});

test("server configuration example allows the dedicated local verification server", async () => {
  const { AI_CONFIG } = await loadConfig();

  assert.ok(AI_CONFIG.allowedOrigins.includes("http://localhost:5174"));
});
