// 檢視原檔用的規則分段與引用匹配工具（見計劃步驟 4b）。
// 分段以確定性邊界（段落／換行／句末標點）保證不切句子；
// 引用匹配用 includes 比對，找不到即跳過該高亮（AI 節錄未必是文本子串）。

export function splitTextIntoSections(text) {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  let rawSections;

  if (text.includes("\n\n")) {
    rawSections = text.split(/\n\s*\n/);
  } else if (text.includes("\n")) {
    rawSections = text.split("\n");
  } else {
    // 單段長文：依句末標點切分，標點保留在句尾。
    rawSections = text.match(/[^。；!?！？]+[。；!?！？]?/g) ?? [text];
  }

  return rawSections.map((section) => section.trim()).filter(Boolean);
}

export function findQuoteMatches(text, quotes) {
  const normalized = typeof text === "string" ? text : "";

  if (!normalized) {
    return [];
  }

  return (Array.isArray(quotes) ? quotes : [])
    .map((quote) => (typeof quote === "string" ? quote.trim() : ""))
    .filter((quote) => quote && normalized.includes(quote));
}
