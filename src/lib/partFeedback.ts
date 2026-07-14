// Per-part examiner feedback — presentation-only types and helpers.
// No persistence: this data lives on the in-memory AI result for fresh
// reports. Saved (legacy) reports fall back to a placeholder structure.

import { getPhases } from "@/lib/examPhases";

export interface PartCriterionComment {
  /** e.g. "Grammar and Vocabulary". */
  criterion: string;
  /** 1–2 sentence evidence-grounded comment for this criterion in this part. */
  comment: string;
}

export interface PartFeedback {
  /** Stable label, e.g. "Part 1". */
  part: string;
  /** Optional human title, e.g. "Interview". */
  title?: string;
  /** 2–4 sentence examiner commentary, descriptor-informed. */
  commentary: string;
  /** Short evidence-grounded observations from the transcript (legacy). */
  observations?: string[];
  /** Criterion names this part most clearly informs (legacy tag list). */
  criteriaTouched?: string[];
  /** Per-criterion breakdown for this part. Preferred over observations. */
  criteriaBreakdown?: PartCriterionComment[];
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
