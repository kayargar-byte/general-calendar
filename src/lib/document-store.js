// src/lib/document-store.js
// 文檔原檔與元數據的存儲：元數據存 localStorage（可注入、同步），blob 存 IndexedDB（異步，僅寫入階段用）。

export const DOCUMENTS_STORAGE_KEY = "general-calendar.documents.v1";

const BLOB_DB_NAME = "general-calendar";
const BLOB_STORE = "document-blobs";

function resolveStorage(storage) {
  const resolvedStorage = storage ?? globalThis.localStorage;

  if (!resolvedStorage) {
    throw new Error("此環境不支援本機儲存。");
  }

  return resolvedStorage;
}

function isDocumentRecord(record) {
  return (
    typeof record?.id === "string" &&
    record.id.length > 0 &&
    typeof record.name === "string" &&
    typeof record.mimeType === "string" &&
    typeof record.blobKey === "string"
  );
}

export function getDocuments(storage) {
  const storedValue = resolveStorage(storage).getItem(DOCUMENTS_STORAGE_KEY);

  if (!storedValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(storedValue);
    return Array.isArray(parsed) ? parsed.filter(isDocumentRecord) : [];
  } catch {
    return [];
  }
}

function saveDocuments(documents, storage) {
  resolveStorage(storage).setItem(
    DOCUMENTS_STORAGE_KEY,
    JSON.stringify(documents),
  );
}

export function createDocument(
  { id, name, mimeType, size, blobKey = id, importedAt, hasText },
  storage,
) {
  const record = {
    id,
    name,
    mimeType,
    size,
    blobKey,
    hasText: hasText === true,
    importedAt:
      typeof importedAt === "string"
        ? importedAt
        : new Date().toISOString(),
  };

  saveDocuments([...getDocuments(storage), record], storage);
  return record;
}

export function getDocument(id, storage) {
  return getDocuments(storage).find((document) => document.id === id) ?? null;
}

export function deleteDocument(id, storage) {
  const documents = getDocuments(storage);
  const remaining = documents.filter((document) => document.id !== id);

  if (remaining.length === documents.length) {
    return false;
  }

  saveDocuments(remaining, storage);
  return true;
}

function openBlobDb() {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(BLOB_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDocumentBlob(id, blob) {
  const db = await openBlobDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOB_STORE, "readwrite");
    transaction.objectStore(BLOB_STORE).put(blob, id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function deleteDocumentBlob(id) {
  const db = await openBlobDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOB_STORE, "readwrite");
    transaction.objectStore(BLOB_STORE).delete(id);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

// 原檔 blob 的讀取與統一文本（docx/xlsx/pdf 規整後）的存取：共用同一 store，
// 文本 key 加 text: 前綴，文本本體不入 localStorage 紀錄（長文檔有容量風險）。
async function readBlobEntry(key) {
  const db = await openBlobDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOB_STORE, "readonly");
    const request = transaction.objectStore(BLOB_STORE).get(key);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function writeBlobEntry(key, value) {
  const db = await openBlobDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOB_STORE, "readwrite");
    transaction.objectStore(BLOB_STORE).put(value, key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function deleteBlobEntry(key) {
  const db = await openBlobDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BLOB_STORE, "readwrite");
    transaction.objectStore(BLOB_STORE).delete(key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function getDocumentBlob(id) {
  return readBlobEntry(id);
}

export async function saveDocumentText(id, text) {
  await writeBlobEntry(`text:${id}`, text);
}

export async function getDocumentText(id) {
  return readBlobEntry(`text:${id}`);
}

export async function deleteDocumentText(id) {
  await deleteBlobEntry(`text:${id}`);
}
