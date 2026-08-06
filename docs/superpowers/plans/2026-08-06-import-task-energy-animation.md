# 匯入任務與能量球動效 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立瀏覽器與桌面共用的三路文件分析隊列，並在成功入曆時播放從任務項目到日期格的拋物線能量球動效。

**Architecture:** 後端 `import-queue` 擁有任務狀態與三路並行控制，HTTP 層只負責 multipart 邊界與資源路由。前端以獨立 composable 輪詢、入庫與 ACK，以任務列和 overlay 元件分別處理狀態呈現及無阻塞動效。

**Tech Stack:** Vue 3 Composition API、原生 Fetch/HTTP、Vitest、Vue Test Utils、CSS 動畫。

## Global Constraints

- 只支援桌面版。
- 同時最多分析 3 份文件，隊列只存進程記憶體。
- 飛行 650ms、落地 250ms、同文件連射間隔 100ms。
- 使用既有 `--color-accent`；支援 `prefers-reduced-motion`。
- 保留 `/api/documents/analyze` 同步相容路徑。

---

### Task 1: 後端任務隊列

**Files:**
- Create: `server/import-queue.js`
- Test: `tests/server-import-queue.test.js`

**Interfaces:**
- Produces: `createImportQueue({ concurrency, maxTasks })`，回傳 `enqueue(input, analyze)`、`list()`、`retry(id)`、`ack(id)`、`clear()`。
- Task shape: `{ id, status, docName, mimeType, createdAt, startedAt, completedAt, events, extractedText, error }`。

- [ ] **Step 1: Write failing queue tests** covering FIFO, maximum three active analyses, success, failure, retry, ACK and clone isolation.
- [ ] **Step 2: Run `npm test -- tests/server-import-queue.test.js`** and verify failure because `server/import-queue.js` does not exist.
- [ ] **Step 3: Implement the minimal in-memory queue** with enum strings `QUEUED`, `ANALYZING`, `COMPLETED`, `FAILED`; start queued work whenever an active slot opens.

```js
export function createImportQueue({ concurrency = 3, maxTasks = 20 } = {}) {
  return {
    enqueue(input, analyze) {},
    list() {},
    retry(id) {},
    ack(id) {},
    clear() {},
  };
}
```

- [ ] **Step 4: Run `npm test -- tests/server-import-queue.test.js`** and verify all queue tests pass.
- [ ] **Step 5: Commit** `feat: add bounded import task queue`.

### Task 2: 匯入任務 HTTP 契約

**Files:**
- Modify: `server/server.js`
- Modify: `scripts/desktop-import.ps1`
- Test: `tests/server-import-queue.test.js`

**Interfaces:**
- Consumes: singleton queue and existing `analyzeDocument`.
- Produces: `POST/GET /api/imports`, `POST /api/imports/:id/retry`, `POST /api/imports/:id/ack`.

- [ ] **Step 1: Add failing contract-level tests** for accepted task shape and invalid retry/ack transitions through exported queue helpers.
- [ ] **Step 2: Run the focused server tests** and confirm expected failures.
- [ ] **Step 3: Extract the existing multipart reader** so synchronous analyze and enqueue routes share file validation without changing `/api/documents/analyze` behavior.

```js
async function readDocumentUpload(req) {
  return { buffer, filename, mimeType, calendars, profile };
}
```

- [ ] **Step 4: Add additive REST routes and update the desktop script** to submit to `/api/imports` without `X-Stash`.

```js
if (urlPath === "/api/imports" && req.method === "POST") {
  const upload = await readDocumentUpload(req);
  const task = importQueue.enqueue(upload, analyzeUploadedDocument);
  return sendJson(res, 202, { task });
}
```

- [ ] **Step 5: Run `npm test -- tests/server-import-queue.test.js tests/server-inbox.test.js tests/server-extractors.test.js`** and verify pass.
- [ ] **Step 6: Commit** `feat: expose unified import task API`.

### Task 3: 前端任務客戶端與狀態

**Files:**
- Create: `src/lib/import-tasks.js`
- Create: `src/composables/useImportTasks.js`
- Test: `tests/import-tasks.test.js`

**Interfaces:**
- Produces: `submitImport(file, calendars)`, `listImports()`, `retryImport(id)`, `ackImport(id)`.
- Produces: `useImportTasks({ calendars, importAnalyzedResult })` with `tasks`, `visibleTasks`, `queuedCount`, `submitFiles`, `retryTask`, `dismissTask`, `animationRequests`.

- [ ] **Step 1: Write failing tests** for multiple submissions, polling states, completed result ingestion before ACK, failed retry/dismiss and blob retention for browser-selected files.
- [ ] **Step 2: Run `npm test -- tests/import-tasks.test.js`** and verify missing-module failure.
- [ ] **Step 3: Implement the API client and composable** using one polling timer and a task-id-to-File map.

```js
export async function submitImport(file, calendars) {}
export async function listImports() {}
export async function retryImport(id) {}
export async function ackImport(id) {}

export function useImportTasks({ calendars, importAnalyzedResult }) {
  return { tasks, visibleTasks, queuedCount, submitFiles, retryTask, dismissTask, animationRequests };
}
```

- [ ] **Step 4: Run focused tests** and verify pass.
- [ ] **Step 5: Commit** `feat: manage import tasks in the calendar client`.

### Task 4: 任務列 UI 與多選入口

**Files:**
- Modify: `src/components/ImportDocumentButton.vue`
- Create: `src/components/ImportTaskRail.vue`
- Modify: `src/App.vue`
- Modify: `src/styles/calendar.css`
- Test: `tests/import-document-button.test.js`
- Create: `tests/import-task-rail.test.js`

**Interfaces:**
- `ImportDocumentButton` emits `files: File[]` and keeps the input enabled.
- `ImportTaskRail` consumes `tasks`, `queuedCount`, emits `retry`/`dismiss`, and exposes `getTaskRect(id)`.

- [ ] **Step 1: Write failing component tests** for `multiple`, repeated selection, file-type icons, elapsed seconds, maximum three task items, waiting count and failure controls.
- [ ] **Step 2: Run focused component tests** and confirm failures.
- [ ] **Step 3: Implement semantic button/list/status markup** with icon buttons labelled for assistive technology.

```vue
<ul class="import-task-rail" aria-label="文件分析進度">
  <li v-for="task in tasks" :key="task.id" :data-import-task-id="task.id">
    <span aria-hidden="true">{{ fileIcon(task) }}</span>
    <span class="import-task-name">{{ task.docName }}</span>
    <span role="status">{{ statusText(task) }}</span>
  </li>
</ul>
```

- [ ] **Step 4: Add restrained toolbar styles** using existing tokens and stable dimensions.
- [ ] **Step 5: Run component and calendar-page tests** and verify pass.
- [ ] **Step 6: Commit** `feat: show concurrent import tasks in toolbar`.

### Task 5: 拋物線能量球與跨月份浮窗

**Files:**
- Create: `src/components/ImportEnergyOverlay.vue`
- Modify: `src/components/CalendarGrid.vue`
- Modify: `src/App.vue`
- Modify: `src/styles/calendar.css`
- Create: `tests/import-energy-overlay.test.js`

**Interfaces:**
- `ImportEnergyOverlay` consumes animation requests and source rectangles; emits `started(taskId)` and `finished(taskId)`.
- `CalendarGrid` exposes target cells through `data-date-key` without changing existing emits.

- [ ] **Step 1: Write failing tests** for unique-date grouping, 100ms staggering, 650ms flight variables, target lookup, cross-month grouping and reduced motion.
- [ ] **Step 2: Run `npm test -- tests/import-energy-overlay.test.js`** and verify failure.
- [ ] **Step 3: Implement fixed pointer-transparent overlay** using Web Animations API and quadratic Bezier sampling; use CSS classes for landing ripple and event reveal.

```js
function parabolaFrames(source, target) {
  const lift = Math.max(72, Math.abs(target.y - source.y) * 0.25);
  return Array.from({ length: 21 }, (_, index) => {
    const t = index / 20;
    return {
      transform: `translate(${source.x + (target.x - source.x) * t}px, ${source.y + (target.y - source.y) * t - 4 * lift * t * (1 - t)}px)`,
    };
  });
}
```

- [ ] **Step 4: Add month-target popup** with exact copy `已加入 YYYY 年 M 月 · N 個事件`.
- [ ] **Step 5: Run focused animation and calendar tests** and verify pass.
- [ ] **Step 6: Commit** `feat: animate imported events into calendar dates`.

### Task 6: 整合與驗證

**Files:**
- Modify tests only when an existing assertion must reflect the approved contract.

- [ ] **Step 1: Run `npm test`** and resolve only regressions caused by this feature.
- [ ] **Step 2: Run `npm run build`** and verify a production bundle is generated.
- [ ] **Step 3: Start the app and proxy**, exercise four-file import and desktop submission at a desktop viewport.
- [ ] **Step 4: Capture light, dark and reduced-motion screenshots**; verify no overlap, nonblank rendering and correct target geometry.
- [ ] **Step 5: Review the final diff** for secrets, unrelated changes and API consistency.
- [ ] **Step 6: Commit** `test: verify import task animation workflow`.
