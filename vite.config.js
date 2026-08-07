import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const calendarEntry = fileURLToPath(
  new URL("./calendar.html", import.meta.url),
);
const indexEntry = fileURLToPath(new URL("./index.html", import.meta.url));

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.js",
    include: ["tests/**/*.test.js"],
    exclude: ["**/node_modules/**", "**/.worktrees/**", "**/dist/**"],
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
