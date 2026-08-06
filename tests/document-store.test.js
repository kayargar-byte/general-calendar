import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import {
  DOCUMENTS_STORAGE_KEY,
  createDocument,
  deleteDocument,
  deleteDocumentBlob,
  deleteDocumentText,
  getDocument,
  getDocumentBlob,
  getDocuments,
  getDocumentText,
  saveDocumentBlob,
  saveDocumentText,
} from "../src/lib/document-store.js";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}

function installFakeIndexedDB() {
  const store = new Map();
  const calls = { put: [], delete: [] };
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    close: () => {},
    transaction: () => {
      const transaction = {
        objectStore: () => ({
          put: (value, key) => {
            calls.put.push({ value, key });
            store.set(key, value);
          },
          delete: (key) => {
            calls.delete.push(key);
            store.delete(key);
          },
          get: (key) => {
            const request = {};
            queueMicrotask(() => {
              request.result = store.get(key) ?? null;
              request.onsuccess?.();
            });
            return request;
          },
        }),
      };
      queueMicrotask(() => transaction.oncomplete?.());
      return transaction;
    },
  };
  const request = { onupgradeneeded: null, onsuccess: null, onerror: null };
  globalThis.indexedDB = {
    open: () => {
      request.result = fakeDb;
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  return calls;
}

afterEach(() => {
  delete globalThis.indexedDB;
});

test("createDocument, getDocument, deleteDocument manage records", () => {
  const storage = new MemoryStorage();

  const record = createDocument(
    { id: "doc-1", name: "a.docx", mimeType: "application/pdf", size: 10 },
    storage,
  );

  assert.equal(record.blobKey, "doc-1");
  assert.equal(getDocuments(storage).length, 1);
  assert.equal(getDocument("doc-1", storage).name, "a.docx");
  assert.equal(deleteDocument("doc-1", storage), true);
  assert.equal(getDocuments(storage).length, 0);
  assert.equal(deleteDocument("doc-1", storage), false);
});

test("getDocuments ignores malformed records", () => {
  const storage = new MemoryStorage();
  storage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify([{ id: "bad" }]));

  assert.deepEqual(getDocuments(storage), []);
});

test("saveDocumentBlob stores the blob under its id", async () => {
  const calls = installFakeIndexedDB();
  const blob = new Blob(["abc"]);

  await saveDocumentBlob("doc-1", blob);

  assert.equal(calls.put.length, 1);
  assert.equal(calls.put[0].key, "doc-1");
  assert.equal(calls.put[0].value, blob);
});

test("deleteDocumentBlob removes the blob by id", async () => {
  const calls = installFakeIndexedDB();

  await deleteDocumentBlob("doc-1");

  assert.deepEqual(calls.delete, ["doc-1"]);
});

test("getDocumentBlob reads the stored blob", async () => {
  installFakeIndexedDB();
  const blob = new Blob(["abc"]);

  await saveDocumentBlob("doc-1", blob);
  const read = await getDocumentBlob("doc-1");

  assert.equal(read, blob);
});

test("getDocumentBlob returns null for a missing key", async () => {
  installFakeIndexedDB();

  assert.equal(await getDocumentBlob("doc-1"), null);
});

test("document text round-trips under a text: prefixed key", async () => {
  const calls = installFakeIndexedDB();

  await saveDocumentText("doc-1", "原文內容");

  assert.equal(calls.put[0].key, "text:doc-1");
  assert.equal(await getDocumentText("doc-1"), "原文內容");
  assert.equal(await getDocumentText("missing"), null);

  await deleteDocumentText("doc-1");

  assert.deepEqual(calls.delete, ["text:doc-1"]);
  assert.equal(await getDocumentText("doc-1"), null);
});

test("createDocument records hasText when provided", () => {
  const storage = new MemoryStorage();

  const record = createDocument(
    {
      id: "doc-2",
      name: "a.pdf",
      mimeType: "application/pdf",
      size: 5,
      hasText: true,
    },
    storage,
  );

  assert.equal(record.hasText, true);
  assert.equal(getDocument("doc-2", storage).hasText, true);
});
