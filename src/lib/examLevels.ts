// Localized exam-name labels per CEFR level per assessment language.
// CEFR codes (A2–C2) are the universal underlying scale; the *exam name*
// shown in the UI changes with the language being assessed.

export type CefrLevel = "A2" | "B1" | "B2" | "C1" | "C2";

export const SUPPORTED_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "it", label: "Italian" },
] as const;

const LEVELS: CefrLevel[] = ["A2", "B1", "B2", "C1", "C2"];

// Per-language exam-name labels, indexed by CEFR level.
const EXAM_NAMES: Record<string, Record<CefrLevel, string>> = {
  en: {
    A2: "A2 Key (KET)",
    B1: "B1 Preliminary (PET)",
    B2: "B2 First (FCE)",
    C1: "C1 Advanced (CAE)",
    C2: "C2 Proficiency (CPE)",
  },
  es: {
    A2: "A2 DELE",
    B1: "B1 DELE",
    B2: "B2 DELE",
    C1: "C1 DELE",
    C2: "C2 DELE",
  },
  pt: {
    A2: "A2 CAPLE (ACESSO)",
    B1: "B1 CAPLE (CIPLE)",
    B2: "B2 CAPLE (DEPLE)",
    C1: "C1 CAPLE (DIPLE)",
    C2: "C2 CAPLE (DAPLE)",
  },
  de: {
    A2: "A2 Goethe-Zertifikat",
    B1: "B1 Goethe-Zertifikat",
    B2: "B2 Goethe-Zertifikat",
    C1: "C1 Goethe-Zertifikat",
    C2: "C2 Goethe-Zertifikat (GDS)",
  },
  fr: {
    A2: "A2 DELF",
    B1: "B1 DELF",
    B2: "B2 DELF",
    C1: "C1 DALF",
    C2: "C2 DALF",
  },
  it: {
    A2: "A2 CILS (Elementare)",
    B1: "B1 CILS Uno",
    B2: "B2 CILS Due",
    C1: "C1 CILS Tre",
    C2: "C2 CILS Quattro",
  },
};

export interface ExamLevelOption {
  value: CefrLevel;
  label: string;
}

export function getExamLevels(language: string): ExamLevelOption[] {
  const names = EXAM_NAMES[language] ?? EXAM_NAMES.en;
  return LEVELS.map((lvl) => ({ value: lvl, label: names[lvl] }));
}

export function getExamLabel(level: string, language: string): string {
  const names = EXAM_NAMES[language] ?? EXAM_NAMES.en;
  return names[level as CefrLevel] ?? level;
}
