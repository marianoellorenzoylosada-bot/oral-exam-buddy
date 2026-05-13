// Per-part examiner feedback — presentation-only types and helpers.
// No persistence: this data lives on the in-memory AI result for fresh
// reports. Saved (legacy) reports fall back to a placeholder structure.

import { getPhases } from "@/lib/examPhases";

export interface PartFeedback {
  /** Stable label, e.g. "Part 1". */
  part: string;
  /** Optional human title, e.g. "Interview". */
  title?: string;
  /** 2–4 sentence examiner commentary, descriptor-informed. */
  commentary: string;
  /** Short evidence-grounded observations from the transcript. */
  observations?: string[];
  /** Criterion names this part most clearly informs (for tags). */
  criteriaTouched?: string[];
  /** Optional single actionable improvement point. */
  improvement?: string;
}

/** Derive part labels from the level (mirrors examPhases). */
export function getPartsForLevel(levelCode: string): { part: string; title: string }[] {
  return getPhases(levelCode).map((p, i) => {
    // EXAM_PHASES names look like "Part 1 — Interview"; extract title.
    const m = p.name.match(/^Part\s*\d+\s*[—-]\s*(.+)$/i);
    return { part: `Part ${i + 1}`, title: m ? m[1].trim() : p.name };
  });
}
