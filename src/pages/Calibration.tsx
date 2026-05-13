import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, CheckCircle2, RotateCcw, Eye, TrendingUp } from "lucide-react";
import { CALIBRATION_CASES, type CalibrationCase } from "@/lib/calibrationCases";

const LS_KEY = "oralassess-calibration:results";

interface CalibrationResult {
  caseId: string;
  level: string;
  agreement: number; // 0-100
  totalDelta: number;
  date: string;
}

function loadHistory(): CalibrationResult[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function saveHistory(r: CalibrationResult) {
  const all = loadHistory();
  all.unshift(r);
  localStorage.setItem(LS_KEY, JSON.stringify(all.slice(0, 100)));
}

function deltaColor(d: number) {
  const a = Math.abs(d);
  if (a <= 0.5) return "text-emerald-600 dark:text-emerald-400";
  if (a <= 1) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

export default function CalibrationPage() {
  const [caseId, setCaseId] = useState<string>(CALIBRATION_CASES[0].id);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState<CalibrationResult[]>(() => loadHistory());

  const current: CalibrationCase = useMemo(
    () => CALIBRATION_CASES.find((c) => c.id === caseId) ?? CALIBRATION_CASES[0],
    [caseId]
  );

  // Reset when changing case
  useEffect(() => {
    const initial: Record<string, number> = {};
    current.criteria.forEach((c) => { initial[c.name] = 3; });
    setScores(initial);
    setNotes({});
    setRevealed(false);
  }, [current]);

  const totalDelta = current.criteria.reduce(
    (sum, c) => sum + Math.abs((scores[c.name] ?? 3) - c.goldScore),
    0
  );
  const agreement = Math.max(0, Math.round(100 - totalDelta * 10));

  const handleReveal = () => {
    setRevealed(true);
    const result: CalibrationResult = {
      caseId: current.id,
      level: current.level,
      agreement,
      totalDelta: +totalDelta.toFixed(1),
      date: new Date().toISOString(),
    };
    saveHistory(result);
    setHistory(loadHistory());
  };

  const avgAgreement = history.length
    ? Math.round(history.reduce((s, r) => s + r.agreement, 0) / history.length)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" /> Calibration Mode
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Score a sample exam, then reveal the gold standard to check inter-rater agreement.
          </p>
        </div>
        {avgAgreement != null && (
          <Card className="px-4 py-3">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Your average agreement</p>
                <p className="font-display text-xl font-bold">{avgAgreement}%</p>
                <p className="text-[10px] text-muted-foreground">across {history.length} session{history.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="font-display">{current.title}</CardTitle>
            <CardDescription>{current.description}</CardDescription>
          </div>
          <Select value={caseId} onValueChange={setCaseId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CALIBRATION_CASES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="font-mono text-xs mr-1.5">{c.level}</span>{c.title.split("—")[1]?.trim() ?? c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Transcript</p>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{current.transcript}</pre>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Training samples for examiner calibration. Not official Cambridge materials.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Your Scoring</CardTitle>
          <CardDescription>
            Score each criterion on the Cambridge 0–5 scale (0.5 increments). Add a brief justification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {current.criteria.map((c, i) => {
            const score = scores[c.name] ?? 3;
            const delta = score - c.goldScore;
            return (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">{score.toFixed(1)} / 5</Badge>
                    {revealed && (
                      <>
                        <Badge variant="secondary" className="font-mono">Gold {c.goldScore.toFixed(1)}</Badge>
                        <Badge variant="outline" className={`font-mono ${deltaColor(delta)}`}>
                          Δ {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
                <Slider
                  min={0}
                  max={5}
                  step={0.5}
                  value={[score]}
                  onValueChange={([v]) => setScores((s) => ({ ...s, [c.name]: v }))}
                  disabled={revealed}
                  className="mb-2"
                />
                <Textarea
                  placeholder="One-line rationale for this score…"
                  value={notes[c.name] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [c.name]: e.target.value }))}
                  disabled={revealed}
                  className="min-h-[44px] text-xs"
                />
                {revealed && (
                  <div className="mt-2 rounded-md border-l-2 border-primary/40 bg-primary/5 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">Reference rationale</p>
                    <p className="text-xs text-muted-foreground">{c.rationale}</p>
                  </div>
                )}
                {i < current.criteria.length - 1 && <Separator className="mt-4" />}
              </div>
            );
          })}

          <div className="flex items-center justify-between pt-2">
            {revealed ? (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-display text-lg font-bold">
                    Agreement: <span className={agreement >= 80 ? "text-emerald-600" : agreement >= 60 ? "text-amber-600" : "text-destructive"}>{agreement}%</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Total deviation: {totalDelta.toFixed(1)} band points</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Submit your scores to compare with the gold standard.</p>
            )}
            <div className="flex gap-2">
              {revealed && (
                <Button variant="outline" onClick={() => { setRevealed(false); setScores(Object.fromEntries(current.criteria.map((c) => [c.name, 3]))); setNotes({}); }} className="gap-2">
                  <RotateCcw className="h-4 w-4" /> Try again
                </Button>
              )}
              {!revealed && (
                <Button onClick={handleReveal} className="gap-2">
                  <Eye className="h-4 w-4" /> Reveal gold standard
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Recent Sessions</CardTitle>
            <CardDescription>Your last calibration attempts (stored locally on this device).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-60 overflow-auto">
              {history.slice(0, 15).map((r, i) => {
                const c = CALIBRATION_CASES.find((x) => x.id === r.caseId);
                return (
                  <div key={i} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{r.level}</Badge>
                      <span className="text-muted-foreground">{new Date(r.date).toLocaleString()}</span>
                      {c && <span className="hidden sm:inline text-muted-foreground">· {c.title.split("—")[1]?.trim()}</span>}
                    </div>
                    <Badge className={r.agreement >= 80 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : r.agreement >= 60 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" : "bg-destructive/10 text-destructive border-destructive/30"} variant="outline">
                      {r.agreement}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
