// src/composables/useDesktopImports.js
// 桌面右鍵匯入的收件箱輪詢：瀏覽器每 2 秒拉取 server 的一次性收件箱（見 docs/adr/0008），
// 有已抽取結果即入庫並 ack。僅在已設定 VITE_AI_PROXY_KEY 時啟動；分頁隱藏或正在匯入時暫停。

import { onMounted, onUnmounted } from "vue";

const IMPORTS_ENDPOINT =
  import.meta.env.VITE_AI_IMPORTS_ENDPOINT ??
  "http://localhost:3000/api/imports";
const IMPORTS_PROXY_KEY = import.meta.env.VITE_AI_PROXY_KEY ?? "";
const POLL_INTERVAL_MS = 2000;

export function useDesktopImports({ importAnalyzedResult, isImporting }) {
  let pollTimer = null;
  let polling = false;

  async function poll() {
    if (polling) {
      return;
    }

    if (document.visibilityState !== "visible") {
      return;
    }

    if (isImporting?.value) {
      return;
    }

    polling = true;

    try {
      let pending;

      try {
        const response = await fetch(`${IMPORTS_ENDPOINT}/pending`, {
          headers: { "X-Proxy-Key": IMPORTS_PROXY_KEY },
        });

        if (!response.ok) {
          return;
        }

        pending = (await response.json())?.imports ?? [];
      } catch {
        return;
      }

      for (const entry of pending) {
        try {
          await importAnalyzedResult({
            events: entry.events,
            extractedText: entry.extractedText,
            name: entry.docName,
            mimeType: entry.mimeType,
          });
        } catch {
          // 入庫失敗也照常 ack，避免 FIFO 卡頭阻塞後續（見 docs/adr/0008）
        }

        try {
          await fetch(`${IMPORTS_ENDPOINT}/${entry.id}/ack`, {
            method: "POST",
            headers: { "X-Proxy-Key": IMPORTS_PROXY_KEY },
          });
        } catch {
          // ack 失敗靜默，下輪重試（重複入庫為已知限制，見 docs/adr/0008）
        }
      }
    } finally {
      polling = false;
    }
  }

  onMounted(() => {
    if (!IMPORTS_PROXY_KEY) {
      return;
    }

    pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });
}
