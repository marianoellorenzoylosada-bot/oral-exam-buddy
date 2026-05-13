import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Clock, RotateCcw } from "lucide-react";
import { getPhases, totalSeconds, type ExamPhase } from "@/lib/examPhases";
import { cn } from "@/lib/utils";

export interface PhaseMark {
  phaseIndex: number;
  startedAtSec: number;
}

interface Props {
  level: string;
  elapsedSeconds: number;
  isRecording: boolean;
  onMarksChange?: (marks: PhaseMark[]) => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}

export function PhaseTimer({ level, elapsedSeconds, isRecording, onMarksChange }: Props) {
  const phases = useMemo<ExamPhase[]>(() => getPhases(level), [level]);
  const total = useMemo(() => totalSeconds(phases), [phases]);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [marks, setMarks] = useState<PhaseMark[]>([{ phaseIndex: 0, startedAtSec: 0 }]);
  const chimedRef = useRef<Set<number>>(new Set());

  // Reset when recording resets to 0
  useEffect(() => {
    if (elapsedSeconds === 0 && !isRecording) {
      setCurrentPhase(0);
      setMarks([{ phaseIndex: 0, startedAtSec: 0 }]);
      chimedRef.current = new Set();
    }
  }, [elapsedSeconds, isRecording]);

  useEffect(() => {
    onMarksChange?.(marks);
  }, [marks, onMarksChange]);

  // Chime when target reached for the current phase
  useEffect(() => {
    const startOfPhase = marks[marks.length - 1]?.startedAtSec ?? 0;
    const inPhase = elapsedSeconds - startOfPhase;
    const target = phases[currentPhase]?.targetSeconds ?? 0;
    if (inPhase >= target && !chimedRef.current.has(currentPhase)) {
      chimedRef.current.add(currentPhase);
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.value = 0.05;
        o.connect(g); g.connect(ctx.destination);
        o.start();
        setTimeout(() => { o.stop(); ctx.close(); }, 220);
      } catch { /* ignore */ }
    }
  }, [elapsedSeconds, currentPhase, marks, phases]);

  const advance = () => {
    if (currentPhase >= phases.length - 1) return;
    const next = currentPhase + 1;
    setMarks((prev) => [...prev, { phaseIndex: next, startedAtSec: elapsedSeconds }]);
    setCurrentPhase(next);
  };

  const reset = () => {
    setCurrentPhase(0);
    setMarks([{ phaseIndex: 0, startedAtSec: 0 }]);
    chimedRef.current = new Set();
  };

  const phaseStart = marks[marks.length - 1]?.startedAtSec ?? 0;
  const inPhase = Math.max(0, elapsedSeconds - phaseStart);
  const target = phases[currentPhase]?.targetSeconds ?? 1;
  const overrun = inPhase > target;

  return (
    <Card className="w-full max-w-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-display text-sm font-semibold">Exam phase timer</span>
        </div>
        <Badge variant="outline" className="text-xs">Target {fmt(total)}</Badge>
      </div>

      {/* Segmented bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full border bg-muted">
        {phases.map((p, i) => {
          const widthPct = (p.targetSeconds / total) * 100;
          const isActive = i === currentPhase;
          const isPast = i < currentPhase;
          return (
            <div
              key={i}
              style={{ width: `${widthPct}%` }}
              className={cn(
                "h-full border-r border-background last:border-r-0 transition-colors",
                isPast && "bg-primary/60",
                isActive && (overrun ? "bg-amber-500" : "bg-primary"),
                !isPast && !isActive && "bg-muted",
              )}
            />
          );
        })}
      </div>

      {/* Current phase info */}
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{phases[currentPhase]?.name}</p>
          <span className={cn("font-display text-base tabular-nums", overrun ? "text-amber-600" : "text-foreground")}>
            {fmt(inPhase)} / {fmt(target)}
          </span>
        </div>
        {overrun && (
          <p className="mt-1 text-xs text-amber-600">Over target — consider moving on.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={reset} className="gap-1 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
        <Button
          size="sm"
          onClick={advance}
          disabled={currentPhase >= phases.length - 1}
          className="gap-1"
        >
          Next part <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Mini-list of phases */}
      <ol className="space-y-1 text-xs">
        {phases.map((p, i) => {
          const mark = marks.find((m) => m.phaseIndex === i);
          return (
            <li key={i} className={cn("flex justify-between", i === currentPhase && "font-medium text-foreground")}>
              <span className="text-muted-foreground">{i + 1}. {p.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {mark ? `started ${fmt(mark.startedAtSec)}` : `target ${fmt(p.targetSeconds)}`}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
