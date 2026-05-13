// Deterministic weighted Speaking score.
//
// Scope of officially-aligned weighting (per Cambridge handbook excerpts):
//   • B1 Preliminary: GV + DM + P + IC + (GA × 2)        → /30
//   • B2 First:       (GV + DM + P + IC) × 2 + (GA × 4)  → /60
//
// A2 / C1 / C2 use a TEMPORARY equal-weight fallback (every criterion ×1, /25).
// This is NOT an officially-aligned weighting — it is a placeholder pending
// review of the official weighting for those levels. Do not present results
// at A2/C1/C2 as officially aligned. See `isOfficiallyWeighted()` below.

import type { CambridgeLevel } from "@/lib/cambridgeRubrics";

export interface CriterionScore {
  name: string;
  score: number;
  maxScore: number;
}

interface Weights {
  GV: number; DM: number; P: number; IC: number; GA: number;
}

const WEIGHTS: Record<CambridgeLevel, Weights> = {
  // TEMPORARY equal-weight fallback — pending official weighting review.
  A2: { GV: 1, DM: 1, P: 1, IC: 1, GA: 1 },
  // Official Cambridge weighting.
  B1: { GV: 1, DM: 1, P: 1, IC: 1, GA: 2 },
  // Official Cambridge weighting.
  B2: { GV: 2, DM: 2, P: 2, IC: 2, GA: 4 },
  // TEMPORARY equal-weight fallback — pending official weighting review.
  C1: { GV: 1, DM: 1, P: 1, IC: 1, GA: 1 },
  // TEMPORARY equal-weight fallback — pending official weighting review.
  C2: { GV: 1, DM: 1, P: 1, IC: 1, GA: 1 },
};

const OFFICIALLY_WEIGHTED: CambridgeLevel[] = ["B1", "B2"];

export function isOfficiallyWeighted(level: string): boolean {
  return OFFICIALLY_WEIGHTED.includes(level as CambridgeLevel);
}

const CRITERION_TO_KEY: Record<string, keyof Weights> = {
  "Grammar and Vocabulary": "GV",
  "Discourse Management": "DM",
  "Pronunciation": "P",
  "Interactive Communication": "IC",
  "Global Achievement": "GA",
};

export interface WeightedSpeakingScore {
  raw: number;          // weighted sum, e.g. 42
  max: number;          // weighted max, e.g. 60
  percent: number;      // 0–100
  approxLevel: string;  // pedagogical label, includes the level name
  isOfficial: boolean;  // true only for B1/B2
}

function bandLabel(percent: number, level: string): string {
  if (percent >= 80) return `Performing confidently at ${level}`;
  if (percent >= 60) return `Performing at ${level} level`;
  if (percent >= 45) return `Approaching ${level} level`;
  return `Currently below ${level} level`;
}

export function computeWeightedSpeakingScore(
  criteria: CriterionScore[],
  level: string,
): WeightedSpeakingScore {
  const lvl = (level as CambridgeLevel);
  const w = WEIGHTS[lvl] ?? WEIGHTS.B2;

  let raw = 0;
  let max = 0;
  for (const c of criteria) {
    const key = CRITERION_TO_KEY[c.name];
    if (!key) continue;
    const weight = w[key];
    raw += (Number(c.score) || 0) * weight;
    max += (Number(c.maxScore) || 5) * weight;
  }

  const percent = max > 0 ? (raw / max) * 100 : 0;
  return {
    raw: Math.round(raw * 10) / 10,
    max,
    percent: Math.round(percent * 10) / 10,
    approxLevel: bandLabel(percent, level),
    isOfficial: isOfficiallyWeighted(level),
  };
}
