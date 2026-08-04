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
  { id, name, mimeType, size, blobKey = id, importedAt },
  storage,
) {
  const record = {
    id,
    name,
    mimeType,
    size,
    blobKey,
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

export const LAST_IMPORT_KEY = "general-calendar.imports.last.v1";

export function getLastImport(storage) {
  const storedValue = resolveStorage(storage).getItem(LAST_IMPORT_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedValue);
    return typeof parsed?.docId === "string" && parsed.docId ? parsed : null;
  } catch {
    return null;
  }
}

export function setLastImport(docId, storage) {
  resolveStorage(storage).setItem(LAST_IMPORT_KEY, JSON.stringify({ docId }));
}

export function clearLastImport(storage) {
  resolveStorage(storage).removeItem(LAST_IMPORT_KEY);
}
