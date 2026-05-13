import { useState } from "react";

export interface ExamContext {
  title: string;
  institution: string;
  group: string;
  language: string;
  candidateNames: string[];
  bookletFile: File | null;
  bookletText: string;
  rubricFile: File | null;
  rubricText: string;
  audioBlob: Blob | null;
}

const buildDefaultContext = (): ExamContext => ({
  title: "",
  institution: typeof window !== "undefined" ? localStorage.getItem("oralassess-institution") ?? "" : "",
  group: "",
  language: "en",
  candidateNames: ["", ""],
  bookletFile: null,
  bookletText: "",
  rubricFile: null,
  rubricText: "",
  audioBlob: null,
});

export function useExamStore() {
  const [exam, setExam] = useState<ExamContext>(() => buildDefaultContext());

  const update = (partial: Partial<ExamContext>) =>
    setExam((prev) => ({ ...prev, ...partial }));

  const reset = () => setExam(buildDefaultContext());

  return { exam, update, reset };
}
