// Cambridge Speaking exam parts with target durations (in seconds).
// Used by the PhaseTimer on the Record tab.

export interface ExamPhase {
  name: string;
  targetSeconds: number;
}

export const EXAM_PHASES: Record<string, ExamPhase[]> = {
  A2: [
    { name: "Part 1 — Interview", targetSeconds: 210 },     // 3-4 min
    { name: "Part 2 — Collaborative", targetSeconds: 330 }, // 5-6 min
  ],
  B1: [
    { name: "Part 1 — Interview", targetSeconds: 150 },
    { name: "Part 2 — Long turn", targetSeconds: 150 },
    { name: "Part 3 — Collaborative", targetSeconds: 240 },
    { name: "Part 4 — Discussion", targetSeconds: 180 },
  ],
  B2: [
    { name: "Part 1 — Interview", targetSeconds: 120 },
    { name: "Part 2 — Long turn", targetSeconds: 240 },
    { name: "Part 3 — Collaborative", targetSeconds: 240 },
    { name: "Part 4 — Discussion", targetSeconds: 240 },
  ],
  C1: [
    { name: "Part 1 — Interview", targetSeconds: 120 },
    { name: "Part 2 — Long turn", targetSeconds: 240 },
    { name: "Part 3 — Collaborative", targetSeconds: 240 },
    { name: "Part 4 — Discussion", targetSeconds: 300 },
  ],
  C2: [
    { name: "Part 1 — Interview", targetSeconds: 120 },
    { name: "Part 2 — Long turn", targetSeconds: 240 },
    { name: "Part 3 — Collaborative", targetSeconds: 240 },
    { name: "Part 4 — Discussion", targetSeconds: 300 },
  ],
};

export function getPhases(level: string): ExamPhase[] {
  return EXAM_PHASES[level] ?? EXAM_PHASES.B2;
}

export function totalSeconds(phases: ExamPhase[]): number {
  return phases.reduce((s, p) => s + p.targetSeconds, 0);
}
