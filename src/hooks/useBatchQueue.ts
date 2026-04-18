import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MultiCandidateResult } from "@/components/DraftReport";
import * as db from "@/lib/batchQueueDb";
import { checkAudioSize, checkAudioDuration, checkContextSize } from "@/lib/uploadGuards";

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
  error?: string;
}

interface AnalyzeContext {
  level: string;
  language: string;
  bookletText: string;
  rubricText: string;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
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

    updateItem(item.id, { status: "analyzing", error: undefined });
    try {
      const audioBase64 = await blobToBase64(item.audioBlob);
      const { data, error } = await supabase.functions.invoke("analyze-exam", {
        body: {
          level: ctx.level,
          language: ctx.language,
          candidateNames: item.candidateNames,
          bookletText: ctx.bookletText,
          rubricText: ctx.rubricText,
          audioBase64,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      updateItem(item.id, { status: "done", result: data as MultiCandidateResult });
    } catch (err: any) {
      updateItem(item.id, {
        status: "failed",
        error: err?.message ?? "Analysis failed",
      });
    }
  }, [updateItem]);

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
