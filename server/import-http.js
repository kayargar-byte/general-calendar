import busboy from "busboy";
import { MAX_FILE_BYTES } from "./extractors.js";

export function createDocumentUploadParser(headers) {
  return busboy({
    headers,
    defParamCharset: "utf8",
    limits: { files: 1, fileSize: MAX_FILE_BYTES },
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function errorStatus(error) {
  if (error?.code === "IMPORT_QUEUE_FULL") {
    return 429;
  }

  if (error?.code === "FILE_TOO_LARGE") {
    return 413;
  }

  return 400;
}

export function documentUploadErrorStatus(error) {
  if (error?.code === "FILE_TOO_LARGE") {
    return 413;
  }

  if (["FILE_REQUIRED", "UNSUPPORTED_TYPE"].includes(error?.code)) {
    return 400;
  }

  if (["SCANNED_PDF", "EMPTY_CONTENT", "NO_EVENTS"].includes(error?.code)) {
    return 422;
  }

  return 502;
}

export async function handleImportHttpRequest({
  req,
  res,
  queue,
  readUpload,
  analyzeUpload,
}) {
  const urlPath = req.url.split("?")[0];

  if (urlPath === "/api/imports" && req.method === "GET") {
    sendJson(res, 200, { imports: queue.list() });
    return true;
  }

  if (urlPath === "/api/imports" && req.method === "POST") {
    try {
      const upload = await readUpload(req);
      const task = queue.enqueue(upload, analyzeUpload);
      sendJson(res, 202, { task });
    } catch (error) {
      sendJson(res, errorStatus(error), {
        error: { message: error?.message ?? "無法建立匯入任務。" },
      });
    }
    return true;
  }

  const retryMatch = /^\/api\/imports\/([^/]+)\/retry$/.exec(urlPath);

  if (retryMatch && req.method === "POST") {
    const task = queue.retry(retryMatch[1]);

    if (!task) {
      sendJson(res, 409, {
        error: { message: "匯入任務目前不可重試。" },
      });
      return true;
    }

    sendJson(res, 202, { task });
    return true;
  }

  const ackMatch = /^\/api\/imports\/([^/]+)\/ack$/.exec(urlPath);

  if (ackMatch && req.method === "POST") {
    if (!queue.ack(ackMatch[1])) {
      sendJson(res, 404, {
        error: { message: "找不到可關閉的匯入任務。" },
      });
      return true;
    }

    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}
