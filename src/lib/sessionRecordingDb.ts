// IndexedDB backup of the in-progress Speaking Session recording.
// The audio only lives in memory until "Stop" is pressed, so a screen lock,
// tab kill, or browser reload would otherwise lose the whole oral exam.
// We persist the audio as ArrayBuffer + mimeType (iOS Safari can silently drop
// the binary content of a stored Blob after a reload — same pattern as
// batchQueueDb.ts).

const DB_NAME = "oralassess-session-recording";
const DB_VERSION = 1;
const STORE = "active";
const KEY = "current";

export interface SessionRecordingSnapshot {
  audioBlob: Blob;
  durationSeconds: number;
  sessionId: string | null;
  candidateNames: string[];
  candidateIds: (string | null)[];
  transcriptionMode: string;
  liveTranscript: string;
  updatedAt: number;
}

interface StoredSessionRecording {
  id: typeof KEY;
  audioBuffer: ArrayBuffer;
  mimeType: string;
  durationSeconds: number;
  sessionId: string | null;
  candidateNames: string[];
  candidateIds: (string | null)[];
  transcriptionMode: string;
  liveTranscript: string;
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
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSessionRecording(
  snapshot: Omit<SessionRecordingSnapshot, "updatedAt">
): Promise<void> {
  try {
    const audioBuffer = await snapshot.audioBlob.arrayBuffer();
    const mimeType = snapshot.audioBlob.type || "audio/webm";
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const stored: StoredSessionRecording = {
        id: KEY,
        audioBuffer,
        mimeType,
        durationSeconds: snapshot.durationSeconds,
        sessionId: snapshot.sessionId,
        candidateNames: snapshot.candidateNames,
        candidateIds: snapshot.candidateIds,
        transcriptionMode: snapshot.transcriptionMode,
        liveTranscript: snapshot.liveTranscript,
        updatedAt: Date.now(),
      };
      tx.objectStore(STORE).put(stored);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[sessionRecordingDb] saveSessionRecording failed:", err);
  }
}

export async function loadSessionRecording(): Promise<SessionRecordingSnapshot | null> {
  try {
    const db = await openDb();
    const stored = await new Promise<StoredSessionRecording | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as StoredSessionRecording) || null);
      req.onerror = () => reject(req.error);
    });
    if (!stored || !(stored.audioBuffer instanceof ArrayBuffer)) return null;
    const blob = new Blob([stored.audioBuffer], { type: stored.mimeType || "audio/webm" });
    // Discard trivial leftovers (a couple of hundred bytes / under 3 seconds).
    if (blob.size < 4000 && (stored.durationSeconds ?? 0) < 3) return null;
    return {
      audioBlob: blob,
      durationSeconds: stored.durationSeconds ?? 0,
      sessionId: stored.sessionId ?? null,
      candidateNames: stored.candidateNames ?? [],
      candidateIds: stored.candidateIds ?? [],
      transcriptionMode: stored.transcriptionMode ?? "manual",
      liveTranscript: stored.liveTranscript ?? "",
      updatedAt: stored.updatedAt ?? 0,
    };
  } catch (err) {
    console.warn("[sessionRecordingDb] loadSessionRecording failed:", err);
    return null;
  }
}

export async function clearSessionRecording(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[sessionRecordingDb] clearSessionRecording failed:", err);
  }
}
