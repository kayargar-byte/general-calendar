import assert from "node:assert/strict";
import { afterEach, test } from "vitest";
import {
  DOCUMENTS_STORAGE_KEY,
  LAST_IMPORT_KEY,
  clearLastImport,
  createDocument,
  deleteDocument,
  deleteDocumentBlob,
  getDocument,
  getDocuments,
  getLastImport,
  saveDocumentBlob,
  setLastImport,
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
  const calls = { put: [], delete: [] };
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    close: () => {},
    transaction: () => {
      const transaction = {
        objectStore: () => ({
          put: (value, key) => calls.put.push({ value, key }),
          delete: (key) => calls.delete.push(key),
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

test("last-import pointer round-trips and clears", () => {
  const storage = new MemoryStorage();

  assert.equal(getLastImport(storage), null);
  setLastImport("doc-1", storage);
  assert.equal(getLastImport(storage).docId, "doc-1");
  assert.equal(storage.getItem(LAST_IMPORT_KEY) !== null, true);
  clearLastImport(storage);
  assert.equal(getLastImport(storage), null);
});
