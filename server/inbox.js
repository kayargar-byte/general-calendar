// server/inbox.js
// 一次性收件箱：桌面右鍵匯入的抽取結果暫存於此，瀏覽器輪詢取得並 ack（見 docs/adr/0008）。
// 記憶體態、重啟即清；FIFO 上限避免瀏覽器長期未開時無界增長。

const MAX_PENDING = 20;
const pendingImports = [];

export function pushImport({ events, extractedText, docName, mimeType }) {
  const id = crypto.randomUUID();
  pendingImports.push({ id, events, extractedText, docName, mimeType });

  if (pendingImports.length > MAX_PENDING) {
    pendingImports.shift();
  }

  return id;
}

// 回傳各條目的拷貝，避免呼叫端竄改內部狀態。
export function getPendingImports() {
  return pendingImports.map((entry) => ({ ...entry }));
}

export function ackImport(id) {
  const index = pendingImports.findIndex((entry) => entry.id === id);

  if (index === -1) {
    return false;
  }

  pendingImports.splice(index, 1);
  return true;
}
