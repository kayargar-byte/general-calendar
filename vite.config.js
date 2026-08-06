import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const calendarEntry = fileURLToPath(
  new URL("./calendar.html", import.meta.url),
);
const indexEntry = fileURLToPath(new URL("./index.html", import.meta.url));

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.js",
    include: ["tests/**/*.test.js"],
    exclude: ["**/node_modules/**", "**/.worktrees/**", "**/dist/**"],
    // ai.js 的 VITE_AI_PROXY_KEY 不再有默認值；測試需給非空值才能通過 assertProxyKey。
    env: { VITE_AI_PROXY_KEY: "test-proxy-key" },
  },
  build: {
    rollupOptions: {
      input: {
        calendar: calendarEntry,
        index: indexEntry,
      },
    },
  },
});
