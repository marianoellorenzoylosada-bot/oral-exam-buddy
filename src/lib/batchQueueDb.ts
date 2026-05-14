// IndexedDB persistence for the Batch Session queue.
// Recordings can be large (multi-MB Blobs), so we store them outside React state.
// Survives page reloads and accidental tab closes during long exam days.
//
// v2 added an `active` store for the *currently in-progress* recording so it
// can be recovered if the page reloads / tab is killed mid-recording.
// v3 stores the active recording as an ArrayBuffer + mimeType (iOS Safari can
// silently drop the binary content of a stored Blob after a reload) and adds
// `contextLocked` to the snapshot so we can restore the recording view.

import type { BatchItem } from "@/hooks/useBatchQueue";

const DB_NAME = "oralassess-batch";
const DB_VERSION = 3;
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
  contextLocked: boolean;
  updatedAt: number;
}

interface StoredActiveRecording {
  id: typeof ACTIVE_KEY;
  audioBuffer: ArrayBuffer;
  mimeType: string;
  durationSeconds: number;
  candidateNames: string[];
  level: string;
  institution: string;
  group: string;
  contextLocked: boolean;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(ACTIVE_STORE)) {
        db.createObjectStore(ACTIVE_STORE, { keyPath: "id" });
      } else if ((ev.oldVersion ?? 0) < 3) {
        // v2 → v3: previous schema stored a Blob directly; clear it so we
        // don't try to interpret it as ArrayBuffer on next load.
        try {
          const tx = req.transaction;
          tx?.objectStore(ACTIVE_STORE).clear();
        } catch { /* ignore */ }
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
    const audioBuffer = await snapshot.audioBlob.arrayBuffer();
    const mimeType = snapshot.audioBlob.type || "audio/webm";
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ACTIVE_STORE, "readwrite");
      const stored: StoredActiveRecording = {
        id: ACTIVE_KEY,
        audioBuffer,
        mimeType,
        durationSeconds: snapshot.durationSeconds,
        candidateNames: snapshot.candidateNames,
        level: snapshot.level,
        institution: snapshot.institution,
        group: snapshot.group,
        contextLocked: snapshot.contextLocked,
        updatedAt: Date.now(),
      };
      tx.objectStore(ACTIVE_STORE).put(stored);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    console.debug(
      "[batchQueueDb] saveActiveRecording ok",
      { bytes: audioBuffer.byteLength, dur: snapshot.durationSeconds, names: snapshot.candidateNames }
    );
  } catch (err) {
    console.warn("[batchQueueDb] saveActiveRecording failed:", err);
  }
}

export async function loadActiveRecording(): Promise<ActiveRecordingSnapshot | null> {
  try {
    const db = await openDb();
    const stored = await new Promise<StoredActiveRecording | null>((resolve, reject) => {
      const tx = db.transaction(ACTIVE_STORE, "readonly");
      const req = tx.objectStore(ACTIVE_STORE).get(ACTIVE_KEY);
      req.onsuccess = () => resolve((req.result as StoredActiveRecording) || null);
      req.onerror = () => reject(req.error);
    });
    if (!stored) {
      console.debug("[batchQueueDb] loadActiveRecording: empty");
      return null;
    }
    // Tolerate both legacy (Blob) and new (ArrayBuffer) shapes.
    let blob: Blob;
    if ((stored as any).audioBuffer instanceof ArrayBuffer) {
      blob = new Blob([(stored as any).audioBuffer], { type: stored.mimeType || "audio/webm" });
    } else if ((stored as any).audioBlob instanceof Blob) {
      blob = (stored as any).audioBlob;
    } else {
      console.debug("[batchQueueDb] loadActiveRecording: unknown shape, ignoring");
      return null;
    }
    const snap: ActiveRecordingSnapshot = {
      id: ACTIVE_KEY,
      audioBlob: blob,
      durationSeconds: stored.durationSeconds ?? 0,
      candidateNames: stored.candidateNames ?? [],
      level: stored.level ?? "",
      institution: stored.institution ?? "",
      group: stored.group ?? "",
      contextLocked: stored.contextLocked ?? false,
      updatedAt: stored.updatedAt ?? 0,
    };
    console.debug(
      "[batchQueueDb] loadActiveRecording ok",
      { bytes: blob.size, dur: snap.durationSeconds, names: snap.candidateNames, locked: snap.contextLocked }
    );
    return snap;
  } catch (err) {
    console.warn("[batchQueueDb] loadActiveRecording failed:", err);
    return null;
  }
}

export async function clearActiveRecording(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ACTIVE_STORE, "readwrite");
      tx.objectStore(ACTIVE_STORE).delete(ACTIVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    console.debug("[batchQueueDb] clearActiveRecording ok");
  } catch (err) {
    console.warn("[batchQueueDb] clearActiveRecording failed:", err);
  }
}
