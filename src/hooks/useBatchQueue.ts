import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/edgeClient";
import type { MultiCandidateResult } from "@/components/DraftReport";
import * as db from "@/lib/batchQueueDb";
import { checkAudioSize, checkAudioDuration, checkContextSize } from "@/lib/uploadGuards";
import { transcribeBlob, type ScribeWord } from "@/lib/transcribe";
import { labelTranscriptFromWords, hasClearSpeakerLabels } from "@/lib/labelTranscript";

export type BatchItemStatus =
  | "recorded"
  | "queued"
  | "analyzing"
  | "done"
  | "failed";

export interface BatchItem {
  id: string;
  candidateNames: string[];
  audioBlob: Blob;
  durationSeconds: number;
  recordedAt: number;
  status: BatchItemStatus;
  result?: MultiCandidateResult;
  scribeWords?: ScribeWord[];
  error?: string;
  stageLabel?: string;
  // Optional per-item context (populated by the New Exam flow so queued items
  // carry their own level / materials instead of relying on the Batch Session
  // shared context).
  level?: string;
  language?: string;
  bookletText?: string;
  rubricText?: string;
  examNotes?: string;
}

interface AnalyzeContext {
  level: string;
  language: string;
  bookletText: string;
  rubricText: string;
}


export function useBatchQueue() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const itemsRef = useRef<BatchItem[]>([]);
  itemsRef.current = items;

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    db.loadQueue().then(stored => {
      if (cancelled) return;
      if (stored.length > 0) setItems(stored);
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);

  const persistItem = useCallback((item: BatchItem) => {
    void db.saveItem(item);
  }, []);

  const addItem = useCallback((item: Omit<BatchItem, "id" | "status" | "recordedAt">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newItem: BatchItem = {
      ...item,
      id,
      status: "recorded",
      recordedAt: Date.now(),
    };
    setItems(prev => [...prev, newItem]);
    persistItem(newItem);
    return id;
  }, [persistItem]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    void db.deleteItem(id);
    try { localStorage.removeItem(`oralassess-draft:batch-${id}`); } catch { /* ignore */ }
  }, []);

  const clearAll = useCallback(() => {
    setItems(prev => {
      for (const i of prev) {
        try { localStorage.removeItem(`oralassess-draft:batch-${i.id}`); } catch { /* ignore */ }
      }
      return [];
    });
    void db.clearAll();
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<BatchItem>) => {
    setItems(prev => {
      const next = prev.map(i => (i.id === id ? { ...i, ...patch } : i));
      const updated = next.find(i => i.id === id);
      if (updated) persistItem(updated);
      return next;
    });
  }, [persistItem]);

  const analyzeOne = useCallback(async (item: BatchItem, ctx: AnalyzeContext) => {
    // Pre-flight guards: fail fast with a clear reason
    const sizeCheck = checkAudioSize(item.audioBlob);
    if (!sizeCheck.ok) {
      updateItem(item.id, { status: "failed", error: sizeCheck.reason });
      return;
    }
    const durCheck = checkAudioDuration(item.durationSeconds);
    if (!durCheck.ok) {
      updateItem(item.id, { status: "failed", error: durCheck.reason });
      return;
    }
    const ctxCheck = checkContextSize(ctx.bookletText, ctx.rubricText);
    if (!ctxCheck.ok) {
      updateItem(item.id, { status: "failed", error: ctxCheck.reason });
      return;
    }

    updateItem(item.id, { status: "analyzing", error: undefined, stageLabel: "Starting…" });

    // Use the item's stored context when available, otherwise fall back to the
    // shared context from the Batch Session page.
    const level = item.level ?? ctx.level;
    const language = item.language ?? ctx.language;
    const bookletText = item.bookletText ?? ctx.bookletText;
    const rubricText = item.rubricText ?? ctx.rubricText;

    try {
      // Step 1: Scribe transcription (always — gives us speaker diarization + word timing)
      const { transcript, words } = await transcribeBlob(item.audioBlob, (stage) =>
        updateItem(item.id, { stageLabel: stage })
      );
      if (transcript.trim().split(/\s+/).filter(Boolean).length < 30) {
        throw new Error("Not enough speech detected in this recording.");
      }
      updateItem(item.id, { stageLabel: "Scoring with AI…" });

      // Build exam context from stored materials (mirrors NewExam runScoring).
      const examContext: Array<{ kind: string; title: string; text: string }> = [];
      if (bookletText?.trim()) {
        examContext.push({ kind: "candidate_prompt", title: "Candidate prompt / booklet", text: bookletText });
      }
      if (rubricText?.trim()) {
        examContext.push({ kind: "examiner_script", title: "Examiner script", text: rubricText });
      }
      if (item.examNotes?.trim()) {
        examContext.push({ kind: "notes", title: "Mock-specific notes", text: item.examNotes });
      }

      // Step 2: AI scoring on transcript — with 120 s timeout so the item never
      // hangs forever if the network drops or the function stalls.
      const data = await callEdgeFunction<MultiCandidateResult & { transcript?: string; error?: string }>(
        "analyze-exam",
        {
          body: {
            level,
            language,
            candidateNames: item.candidateNames,
            bookletText,
            rubricText,
            transcript,
            examContext,
          },
          timeoutMs: 120_000,
        },
      );
      // Prefer the AI-labelled transcript when it already contains clear
      // speaker labels; otherwise rebuild labels from Scribe word-level
      // diarization; otherwise fall back to the raw verbatim transcript.
      const aiTranscript = (data as any)?.transcript as string | undefined;
      const displayTranscript =
        aiTranscript && hasClearSpeakerLabels(aiTranscript)
          ? aiTranscript
          : labelTranscriptFromWords(transcript, words);
      const enriched = { ...(data as MultiCandidateResult), transcript: displayTranscript };
      updateItem(item.id, { status: "done", result: enriched, scribeWords: words, stageLabel: undefined });
    } catch (err: any) {
      updateItem(item.id, {
        status: "failed",
        error: err?.message ?? "Analysis failed",
        stageLabel: undefined,
      });
    }

  }, [updateItem]);

  // Watchdog: same-session reclassification of items stuck in "analyzing" for
  // more than 5 minutes (e.g. user navigated away mid-analyze). loadQueue()
  // already handles this on fresh hydration; this covers in-session navigation.
  useEffect(() => {
    const STALE_MS = 5 * 60 * 1000;
    const tick = () => {
      const now = Date.now();
      setItems(prev => {
        let changed = false;
        const next = prev.map(i => {
          if (i.status === "analyzing" && now - i.recordedAt > STALE_MS) {
            changed = true;
            const updated: BatchItem = {
              ...i,
              status: "failed",
              error: "Analysis interrupted — tap Retry.",
            };
            void db.saveItem(updated);
            return updated;
          }
          return i;
        });
        return changed ? next : prev;
      });
    };
    const id = setInterval(tick, 30_000);
    tick();
    return () => clearInterval(id);
  }, []);

  const analyzeAll = useCallback(async (ctx: AnalyzeContext) => {
    setAnalyzingAll(true);
    try {
      // Snapshot current pending items to avoid analyzing newly added ones twice.
      const pending = itemsRef.current.filter(
        i => i.status === "recorded" || i.status === "queued" || i.status === "failed"
      );
      // Mark queued upfront for visual feedback
      setItems(prev =>
        prev.map(i => {
          if (pending.some(p => p.id === i.id)) {
            const next = { ...i, status: "queued" as BatchItemStatus, error: undefined };
            persistItem(next);
            return next;
          }
          return i;
        })
      );
      for (const item of pending) {
        await analyzeOne({ ...item, status: "queued" }, ctx);
      }
    } finally {
      setAnalyzingAll(false);
    }
  }, [analyzeOne, persistItem]);

  return {
    items,
    addItem,
    removeItem,
    clearAll,
    updateItem,
    analyzeOne,
    analyzeAll,
    analyzingAll,
    hydrated,
  };
}
