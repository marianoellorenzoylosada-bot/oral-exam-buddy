import { flags } from "./featureFlags";

// Exam-name labels per CEFR level. App is currently English-only;
// helpers retain a `language` parameter for forward compatibility and to
// avoid touching call sites, but only the English mapping is used.


export type CefrLevel = "A2" | "B1" | "B2" | "C1" | "C2";

export const SUPPORTED_LANGUAGES = [
  { value: "en", label: "English" },
] as const;

const LEVELS: CefrLevel[] = flags.onlyPetFce
  ? ["B1", "B2"]
  : ["A2", "B1", "B2", "C1", "C2"];


const EXAM_NAMES: Record<CefrLevel, string> = {
  A2: "A2 Key (KET)",
  B1: "B1 Preliminary (PET)",
  B2: "B2 First (FCE)",
  C1: "C1 Advanced (CAE)",
  C2: "C2 Proficiency (CPE)",
};

export interface ExamLevelOption {
  value: CefrLevel;
  label: string;
}

export function getExamLevels(_language?: string): ExamLevelOption[] {
  return LEVELS.map((lvl) => ({ value: lvl, label: EXAM_NAMES[lvl] }));
}

export function getExamLabel(level: string, _language?: string): string {
  return EXAM_NAMES[level as CefrLevel] ?? level;
}
