import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useDesktopImports } from "../src/composables/useDesktopImports.js";

const ENDPOINT = "http://localhost:3000/api/imports";

let activeWrappers = [];

function mountDesktopImports(overrides = {}) {
  const importAnalyzedResult =
    overrides.importAnalyzedResult ?? vi.fn().mockResolvedValue(true);
  const isImporting = overrides.isImporting ?? ref(false);

  const wrapper = mount(
    defineComponent({
      setup() {
        useDesktopImports({ importAnalyzedResult, isImporting });
        return () => null;
      },
    }),
  );

  activeWrappers.push(wrapper);
  return { wrapper, importAnalyzedResult };
}

function mockPendingResponse(imports) {
  return { ok: true, json: async () => ({ imports }) };
}

function makeEntry(id, docName) {
  return {
    id,
    events: [{ title: docName, date: "2026-08-06" }],
    extractedText: "統一文本",
    docName,
    mimeType: "application/pdf",
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  for (const wrapper of activeWrappers) {
    wrapper.unmount();
  }
  activeWrappers = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test("polls pending imports, ingests them, and acks each entry", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      mockPendingResponse([makeEntry("a", "a.pdf"), makeEntry("b", "b.docx")]),
    )
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ ok: true });
  vi.stubGlobal("fetch", fetchMock);

  const { importAnalyzedResult } = mountDesktopImports();

  await vi.advanceTimersByTimeAsync(2000);

  assert.equal(importAnalyzedResult.mock.calls.length, 2);
  assert.equal(importAnalyzedResult.mock.calls[0][0].name, "a.pdf");
  assert.equal(importAnalyzedResult.mock.calls[1][0].name, "b.docx");
  assert.equal(fetchMock.mock.calls.length, 3);
  assert.equal(fetchMock.mock.calls[1][0], `${ENDPOINT}/a/ack`);
  assert.equal(fetchMock.mock.calls[2][0], `${ENDPOINT}/b/ack`);
  assert.equal(fetchMock.mock.calls[1][1].method, "POST");
  assert.equal(
    fetchMock.mock.calls[1][1].headers["X-Proxy-Key"],
    "test-proxy-key",
  );
});

test("does nothing when there are no pending imports", async () => {
  const fetchMock = vi.fn().mockResolvedValue(mockPendingResponse([]));
  vi.stubGlobal("fetch", fetchMock);

  const { importAnalyzedResult } = mountDesktopImports();

  await vi.advanceTimersByTimeAsync(2000);

  assert.equal(importAnalyzedResult.mock.calls.length, 0);
  assert.equal(fetchMock.mock.calls.length, 1);
});

test("does not poll when the proxy key is missing", async () => {
  vi.stubEnv("VITE_AI_PROXY_KEY", "");
  vi.resetModules();
  const freshModule = await import("../src/composables/useDesktopImports.js");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const wrapper = mount(
    defineComponent({
      setup() {
        freshModule.useDesktopImports({
          importAnalyzedResult: vi.fn(),
          isImporting: ref(false),
        });
        return () => null;
      },
    }),
  );
  activeWrappers.push(wrapper);

  await vi.advanceTimersByTimeAsync(2000);

  assert.equal(fetchMock.mock.calls.length, 0);
});

test("skips polling while the document is hidden", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  mountDesktopImports();

  await vi.advanceTimersByTimeAsync(2000);

  assert.equal(fetchMock.mock.calls.length, 0);
});

test("skips polling while an import is already running", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  mountDesktopImports({ isImporting: ref(true) });

  await vi.advanceTimersByTimeAsync(2000);

  assert.equal(fetchMock.mock.calls.length, 0);
});

test("acks an entry even when ingestion fails", async () => {
  const importAnalyzedResult = vi.fn().mockRejectedValue(new Error("boom"));
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(mockPendingResponse([makeEntry("a", "a.pdf")]))
    .mockResolvedValueOnce({ ok: true });
  vi.stubGlobal("fetch", fetchMock);

  mountDesktopImports({ importAnalyzedResult });

  await vi.advanceTimersByTimeAsync(2000);

  assert.equal(importAnalyzedResult.mock.calls.length, 1);
  assert.equal(fetchMock.mock.calls.length, 2);
  assert.equal(fetchMock.mock.calls[1][0], `${ENDPOINT}/a/ack`);
});
