// Single source of truth for the teacher report.
// Both the on-screen report (ReportDetail) and the teacher PDF
// (generateReportPdf) are rendered from this model, so they can never drift.

import { getPartsForLevel, type PartFeedback } from "@/lib/partFeedback";
import { toTextList } from "@/lib/toText";

export interface TeacherMark {
  name: string;
  score: number;
  maxScore: number;
  /** Criterion narrative — only used when there is no per-part breakdown. */
  feedback?: string;
}

export interface TeacherPartCriterion {
  criterion: string;
  comment: string;
}

export interface TeacherReportPart {
  part: string;
  title: string;
  commentary?: string;
  /** Only the criteria that actually say something about this part. */
  criteria: TeacherPartCriterion[];
  improvement?: string;
}

export interface TeacherReportModel {
  title: string;
  candidateName?: string;
  institution: string;
  group: string;
  levelCode: string;
  language: string;
  date: string;
  overallBand: string;
  overallScore: number;
  /** Compact marks table (always shown). */
  marks: TeacherMark[];
  /** Hybrid structure: Part → relevant criteria → evidence. */
  parts: TeacherReportPart[];
  /** True when no usable per-part content exists (legacy reports). */
  criteriaOnly: boolean;
  overallSummary?: string;
  strengths: string[];
  areasForImprovement: string[];
  examinerNotes?: string;
  transcript?: string;
}

export interface TeacherReportSource {
  title: string;
  candidateName?: string;
  institution?: string;
  group?: string;
  levelCode: string;
  language: string;
  date: string;
  overallBand: string;
  overallScore: number;
  criteria: { name: string; score: number; maxScore: number; feedback?: string }[];
  strengths: string[];
  areasForImprovement: string[];
  examinerNotes?: string;
  transcript?: string;
  partFeedback?: PartFeedback[];
  overallSummary?: string;
}

const NO_EVIDENCE = /^\s*(no evidence|not covered|n\/?a|insufficient)\b/i;

function isUseful(text?: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 3) return false;
  return !NO_EVIDENCE.test(t);
}

/** Build the canonical teacher-report model. Pure, no side effects. */
export function buildTeacherReportModel(src: TeacherReportSource): TeacherReportModel {
  const levelParts = getPartsForLevel(src.levelCode);
  const byLabel = new Map(
    (src.partFeedback ?? [])
      .filter((p) => !!p && typeof p.part === "string")
      .map((p) => [p.part.trim().toLowerCase(), p])
  );

  const parts: TeacherReportPart[] = [];
  for (const { part, title } of levelParts) {
    const pf = byLabel.get(part.toLowerCase());
    if (!pf) continue;
    const criteria = (Array.isArray(pf.criteriaBreakdown) ? pf.criteriaBreakdown : [])
      .filter((cb) => cb && typeof cb.criterion === "string" && isUseful(cb.comment))
      .map((cb) => ({ criterion: cb.criterion.trim(), comment: (cb.comment ?? "").trim() }));

    // Legacy shape: observations instead of a criterion breakdown.
    if (criteria.length === 0 && Array.isArray(pf.observations)) {
      for (const o of pf.observations) {
        if (isUseful(o)) criteria.push({ criterion: "Observation", comment: String(o).trim() });
      }
    }

    const commentary = isUseful(pf.commentary) ? pf.commentary!.trim() : undefined;
    if (!commentary && criteria.length === 0) continue;

    parts.push({
      part,
      title: (pf.title || title || "").trim(),
      commentary,
      criteria,
      improvement: isUseful(pf.improvement) ? pf.improvement!.trim() : undefined,
    });
  }

  const criteriaOnly = parts.length === 0;

  return {
    title: src.title,
    candidateName: src.candidateName,
    institution: src.institution ?? "",
    group: src.group ?? "",
    levelCode: src.levelCode,
    language: src.language,
    date: src.date,
    overallBand: src.overallBand,
    overallScore: src.overallScore,
    marks: (src.criteria ?? []).map((c) => ({
      name: c.name,
      score: Number(c.score) || 0,
      maxScore: Number(c.maxScore) || 5,
      feedback: criteriaOnly ? (c.feedback ?? "") : undefined,
    })),
    parts,
    criteriaOnly,
    overallSummary: isUseful(src.overallSummary) ? src.overallSummary!.trim() : undefined,
    strengths: toTextList(src.strengths),
    areasForImprovement: toTextList(src.areasForImprovement),
    examinerNotes: (src.examinerNotes ?? "").trim() || undefined,
    transcript: (src.transcript ?? "").trim() || undefined,
  };
}
