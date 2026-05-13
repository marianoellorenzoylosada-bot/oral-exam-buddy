// IndexedDB persistence for the in-progress New Exam screen.
// Keeps a single draft (form state + recorded blob + transcript + tags + phase marks)
// so a tab refresh, browser crash, or accidental close doesn't lose data.

const DB_NAME = "oralassess-exam-draft";
const DB_VERSION = 1;
const STORE = "draft";
const KEY = "current";

export interface ExamDraft {
  id: string;
  savedAt: number;
  pendingAnalysis?: boolean;
  // Form state
  title: string;
  language: string;
  institution: string;
  group: string;
  candidateNames: string[];
  bookletText: string;
  rubricText: string;
  // Recording
  audioBlob: Blob | null;
  duration: number;
  liveTranscript: string;
  scribeWords: any[];
  phaseMarks: any[];
  quickTags: any[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraft(draft: Omit<ExamDraft, "id" | "savedAt"> & { pendingAnalysis?: boolean }): Promise<void> {
  try {
    const db = await openDb();
    const record: ExamDraft = { ...draft, id: KEY, savedAt: Date.now() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[examDraftDb] saveDraft failed:", err);
  }
}

export async function loadDraft(): Promise<ExamDraft | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as ExamDraft) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[examDraftDb] loadDraft failed:", err);
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[examDraftDb] clearDraft failed:", err);
  }
}
