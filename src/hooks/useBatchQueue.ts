import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MultiCandidateResult } from "@/components/DraftReport";

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

  const addItem = useCallback((item: Omit<BatchItem, "id" | "status" | "recordedAt">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems(prev => [
      ...prev,
      { ...item, id, status: "recorded", recordedAt: Date.now() },
    ]);
    return id;
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  const updateItem = useCallback((id: string, patch: Partial<BatchItem>) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const analyzeOne = useCallback(async (item: BatchItem, ctx: AnalyzeContext) => {
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
      const pending = items.filter(
        i => i.status === "recorded" || i.status === "queued" || i.status === "failed"
      );
      // Mark queued upfront for visual feedback
      setItems(prev =>
        prev.map(i =>
          pending.some(p => p.id === i.id) ? { ...i, status: "queued", error: undefined } : i
        )
      );
      for (const item of pending) {
        // Re-fetch fresh ref (needed because state has been replaced)
        await analyzeOne({ ...item, status: "queued" }, ctx);
      }
    } finally {
      setAnalyzingAll(false);
    }
  }, [items, analyzeOne]);

  return {
    items,
    addItem,
    removeItem,
    clearAll,
    updateItem,
    analyzeOne,
    analyzeAll,
    analyzingAll,
  };
}
