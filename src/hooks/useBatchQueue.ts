import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/edgeClient";
import type { MultiCandidateResult } from "@/components/DraftReport";
import * as db from "@/lib/batchQueueDb";
import { checkAudioSize, checkAudioDuration, checkContextSize } from "@/lib/uploadGuards";
import { transcribeBlob, type ScribeWord } from "@/lib/transcribe";
import { labelTranscriptFromWords, hasClearSpeakerLabels } from "@/lib/labelTranscript";
import { applySpeakerMap, type SpeakerMap } from "@/lib/applySpeakerMap";

export type BatchItemStatus =
  | "recorded"
  | "queued"
  | "analyzing"
  | "reviewing_speakers"
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
  // Timestamp when this item actually started analysis (not recording age).
  // Used by the watchdog to detect stuck analysis runs.
  analysisStartedAt?: number;
  // Optional per-item context (populated by the New Exam flow so queued items
  // carry their own level / materials instead of relying on the Batch Session
  // shared context).
  level?: string;
  language?: string;
  bookletText?: string;
  rubricText?: string;
  examNotes?: string;
  // Speaker review state (Batch Session now requires review before AI scoring).
  speakerMap?: SpeakerMap;
  pendingTranscript?: string;
  pendingWords?: ScribeWord[];
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

  const preFlightChecks = useCallback((item: BatchItem, ctx: AnalyzeContext) => {
    const sizeCheck = checkAudioSize(item.audioBlob);
    if (!sizeCheck.ok) {
      updateItem(item.id, { status: "failed", error: sizeCheck.reason });
      return sizeCheck.reason;
    }
    const durCheck = checkAudioDuration(item.durationSeconds);
    if (!durCheck.ok) {
      updateItem(item.id, { status: "failed", error: durCheck.reason });
      return durCheck.reason;
    }
    const ctxCheck = checkContextSize(ctx.bookletText, ctx.rubricText);
    if (!ctxCheck.ok) {
      updateItem(item.id, { status: "failed", error: ctxCheck.reason });
      return ctxCheck.reason;
    }
    return null;
  }, [updateItem]);

  const startAnalysis = useCallback(async (item: BatchItem, ctx: AnalyzeContext) => {
    const preFlight = preFlightChecks(item, ctx);
    if (preFlight) return;

    updateItem(item.id, { status: "analyzing", error: undefined, stageLabel: "Transcribing…", analysisStartedAt: Date.now() });

    try {
      const { transcript, words } = await transcribeBlob(item.audioBlob, (stage) =>
        updateItem(item.id, { stageLabel: stage })
      );
      if (transcript.trim().split(/\s+/).filter(Boolean).length < 30) {
        throw new Error("Not enough speech detected in this recording.");
      }
      updateItem(item.id, {
        status: "reviewing_speakers",
        stageLabel: "Waiting for speaker confirmation…",
        pendingTranscript: transcript,
        pendingWords: words,
        scribeWords: words,
      });
    } catch (err: any) {
      updateItem(item.id, {
        status: "failed",
        error: err?.message ?? "Transcription failed",
        stageLabel: undefined,
      });
    }
  }, [updateItem, preFlightChecks]);

  const confirmSpeakersAndAnalyze = useCallback(async (itemId: string, map: SpeakerMap, ctx: AnalyzeContext) => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (!item) return;

    const words = item.pendingWords ?? item.scribeWords;
    if (!words || words.length === 0) {
      updateItem(item.id, { status: "failed", error: "No transcription available to apply speaker mapping." });
      return;
    }

    const level = item.level ?? ctx.level;
    const language = item.language ?? ctx.language;
    const bookletText = item.bookletText ?? ctx.bookletText;
    const rubricText = item.rubricText ?? ctx.rubricText;

    updateItem(item.id, {
      status: "analyzing",
      error: undefined,
      stageLabel: "Scoring with AI…",
      speakerMap: map,
      analysisStartedAt: Date.now(),
    });

    try {
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

      const transcript = applySpeakerMap(words, map);
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
      const aiTranscript = (data as any)?.transcript as string | undefined;
      const displayTranscript =
        aiTranscript && hasClearSpeakerLabels(aiTranscript)
          ? aiTranscript
          : transcript;
      const enriched = { ...(data as MultiCandidateResult), transcript: displayTranscript };
      updateItem(item.id, {
        status: "done",
        result: enriched,
        scribeWords: words,
        stageLabel: undefined,
      });
    } catch (err: any) {
      updateItem(item.id, {
        status: "failed",
        error: err?.message ?? "Analysis failed",
        stageLabel: undefined,
      });
    }
  }, [updateItem]);

  /**
   * Backwards-compatible single-item analysis. When called without a pre-
   * confirmed speaker map, it starts with transcription and pauses at the
   * speaker-review stage. When called with a map, it proceeds directly to AI
   * scoring.
   */
  const analyzeOne = useCallback(async (item: BatchItem, ctx: AnalyzeContext, preConfirmedMap?: SpeakerMap) => {
    if (preConfirmedMap) {
      await confirmSpeakersAndAnalyze(item.id, preConfirmedMap, ctx);
    } else {
      await startAnalysis(item, ctx);
    }
  }, [startAnalysis, confirmSpeakersAndAnalyze]);

  // Watchdog: same-session reclassification of items stuck in "analyzing" for
  // more than 5 minutes of *processing* time (not recording age). This covers
  // in-session navigation; loadQueue() handles the fresh-hydration case.
  useEffect(() => {
    const STALE_MS = 5 * 60 * 1000;
    const tick = () => {
      const now = Date.now();
      setItems(prev => {
        let changed = false;
        const next = prev.map(i => {
          if (i.status !== "analyzing") return i;
          const started = i.analysisStartedAt ?? i.recordedAt;
          if (now - started > STALE_MS) {
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
