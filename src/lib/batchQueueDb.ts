// IndexedDB persistence for the Batch Session queue.
// Recordings can be large (multi-MB Blobs), so we store them outside React state.
// Survives page reloads and accidental tab closes during long exam days.

import type { BatchItem } from "@/hooks/useBatchQueue";

const DB_NAME = "oralassess-batch";
const DB_VERSION = 1;
const STORE = "queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadQueue(): Promise<BatchItem[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as BatchItem[]) || [];
        // Sort by recordedAt to keep insertion order
        items.sort((a, b) => a.recordedAt - b.recordedAt);
        // Reset any "analyzing" status (orphaned from a previous session)
        for (const item of items) {
          if (item.status === "analyzing") item.status = "failed";
        }
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[batchQueueDb] loadQueue failed:", err);
    return [];
  }
}

export async function saveItem(item: BatchItem): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[batchQueueDb] saveItem failed:", err);
  }
}

export async function deleteItem(id: string): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[batchQueueDb] deleteItem failed:", err);
  }
}

export async function clearAll(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[batchQueueDb] clearAll failed:", err);
  }
}
