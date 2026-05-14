// IndexedDB persistence for the Batch Session queue.
// Recordings can be large (multi-MB Blobs), so we store them outside React state.
// Survives page reloads and accidental tab closes during long exam days.
//
// v2 adds an `active` store for the *currently in-progress* recording so it can
// be recovered if the page reloads / tab is killed mid-recording.

import type { BatchItem } from "@/hooks/useBatchQueue";

const DB_NAME = "oralassess-batch";
const DB_VERSION = 2;
const STORE = "queue";
const ACTIVE_STORE = "active";
const ACTIVE_KEY = "current";

export interface ActiveRecordingSnapshot {
  id: typeof ACTIVE_KEY;
  audioBlob: Blob;
  durationSeconds: number;
  candidateNames: string[];
  level: string;
  institution: string;
  group: string;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(ACTIVE_STORE)) {
        db.createObjectStore(ACTIVE_STORE, { keyPath: "id" });
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
        items.sort((a, b) => a.recordedAt - b.recordedAt);
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

// ── Active recording (crash recovery) ────────────────────────────────────────

export async function saveActiveRecording(
  snapshot: Omit<ActiveRecordingSnapshot, "id" | "updatedAt">
): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ACTIVE_STORE, "readwrite");
      tx.objectStore(ACTIVE_STORE).put({
        ...snapshot,
        id: ACTIVE_KEY,
        updatedAt: Date.now(),
      } satisfies ActiveRecordingSnapshot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[batchQueueDb] saveActiveRecording failed:", err);
  }
}

export async function loadActiveRecording(): Promise<ActiveRecordingSnapshot | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ACTIVE_STORE, "readonly");
      const req = tx.objectStore(ACTIVE_STORE).get(ACTIVE_KEY);
      req.onsuccess = () => resolve((req.result as ActiveRecordingSnapshot) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[batchQueueDb] loadActiveRecording failed:", err);
    return null;
  }
}

export async function clearActiveRecording(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ACTIVE_STORE, "readwrite");
      tx.objectStore(ACTIVE_STORE).delete(ACTIVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[batchQueueDb] clearActiveRecording failed:", err);
  }
}
