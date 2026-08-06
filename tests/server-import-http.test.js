import assert from "node:assert/strict";
import { test } from "vitest";
import { createImportQueue } from "../server/import-queue.js";
import {
  createDocumentUploadParser,
  documentUploadErrorStatus,
  handleImportHttpRequest,
} from "../server/import-http.js";

function createResponse() {
  return {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = body;
    },
    json() {
      return JSON.parse(this.body);
    },
  };
}

function request(method, url) {
  return { method, url };
}

async function settleQueue() {
  await Promise.resolve();
  await Promise.resolve();
}

async function parseMultipartFilename(body, headers) {
  return new Promise((resolve, reject) => {
    let filename = "";
    const parser = createDocumentUploadParser(headers);

    parser.on("file", (_name, file, info) => {
      filename = info.filename;
      file.resume();
    });
    parser.on("error", reject);
    parser.on("close", () => resolve(filename));
    parser.end(body);
  });
}

test("parses raw UTF-8 multipart filenames without mojibake", async () => {
  const boundary = "----calendar-upload";
  const filename = "一戶通智能日曆_設計摘要.docx";
  const body = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      "Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n" +
      "\r\n" +
      "document bytes\r\n" +
      `--${boundary}--\r\n`,
    "utf8",
  );

  const parsedFilename = await parseMultipartFilename(
    body,
    { "content-type": `multipart/form-data; boundary=${boundary}` },
  );

  assert.equal(parsedFilename, filename);
});

test("POST /api/imports enqueues an uploaded document and returns 202", async () => {
  const queue = createImportQueue();
  const response = createResponse();
  const upload = { docName: "notice.pdf", mimeType: "application/pdf" };

  const handled = await handleImportHttpRequest({
    req: request("POST", "/api/imports"),
    res: response,
    queue,
    readUpload: async () => upload,
    analyzeUpload: async () => ({ events: [], extractedText: "" }),
  });

  assert.equal(handled, true);
  assert.equal(response.status, 202);
  assert.equal(response.json().task.docName, "notice.pdf");
  assert.equal(response.json().task.status, "ANALYZING");
  await settleQueue();
});

test("GET /api/imports lists task snapshots", async () => {
  const queue = createImportQueue();
  queue.enqueue(
    { docName: "notice.pdf", mimeType: "application/pdf" },
    async () => ({ events: [], extractedText: "" }),
  );
  await settleQueue();
  const response = createResponse();

  await handleImportHttpRequest({
    req: request("GET", "/api/imports"),
    res: response,
    queue,
  });

  assert.equal(response.status, 200);
  assert.equal(response.json().imports.length, 1);
  assert.equal(response.json().imports[0].status, "COMPLETED");
});

test("retry and ack endpoints enforce task transitions", async () => {
  const queue = createImportQueue();
  let attempt = 0;
  const task = queue.enqueue(
    { docName: "broken.pdf", mimeType: "application/pdf" },
    async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error("bad file");
      }
      return { events: [], extractedText: "" };
    },
  );
  await settleQueue();

  const retryResponse = createResponse();
  await handleImportHttpRequest({
    req: request("POST", `/api/imports/${task.id}/retry`),
    res: retryResponse,
    queue,
  });
  assert.equal(retryResponse.status, 202);
  assert.equal(retryResponse.json().task.status, "ANALYZING");

  await settleQueue();
  const ackResponse = createResponse();
  await handleImportHttpRequest({
    req: request("POST", `/api/imports/${task.id}/ack`),
    res: ackResponse,
    queue,
  });
  assert.equal(ackResponse.status, 200);
  assert.deepEqual(ackResponse.json(), { ok: true });
  assert.deepEqual(queue.list(), []);
});

test("invalid retry and ack transitions return structured errors", async () => {
  const queue = createImportQueue();
  const response = createResponse();

  await handleImportHttpRequest({
    req: request("POST", "/api/imports/missing/retry"),
    res: response,
    queue,
  });

  assert.equal(response.status, 409);
  assert.deepEqual(response.json(), {
    error: { message: "匯入任務目前不可重試。" },
  });

  const ackResponse = createResponse();
  await handleImportHttpRequest({
    req: request("POST", "/api/imports/missing/ack"),
    res: ackResponse,
    queue,
  });
  assert.equal(ackResponse.status, 404);
  assert.deepEqual(ackResponse.json(), {
    error: { message: "找不到可關閉的匯入任務。" },
  });
});

test("does not handle unrelated routes", async () => {
  const handled = await handleImportHttpRequest({
    req: request("GET", "/api/ai"),
    res: createResponse(),
    queue: createImportQueue(),
  });

  assert.equal(handled, false);
});

test("maps missing and unsupported uploads to client errors", () => {
  assert.equal(documentUploadErrorStatus({ code: "FILE_REQUIRED" }), 400);
  assert.equal(documentUploadErrorStatus({ code: "UNSUPPORTED_TYPE" }), 400);
  assert.equal(documentUploadErrorStatus({ code: "FILE_TOO_LARGE" }), 413);
  assert.equal(documentUploadErrorStatus({ code: "NO_EVENTS" }), 422);
  assert.equal(documentUploadErrorStatus(new Error("upstream")), 502);
});
