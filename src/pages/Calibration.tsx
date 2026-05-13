import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Scale, CheckCircle2, RotateCcw, Eye, TrendingUp, ShieldCheck, Save, Sparkles, ArrowRight, Library } from "lucide-react";
import { CALIBRATION_CASES, type CalibrationCase, type SpeakingTaskType } from "@/lib/calibrationCases";
import { useRoles } from "@/hooks/useRoles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LS_KEY = "oralassess-calibration:results";
const TASK_TYPES: SpeakingTaskType[] = ["Interview", "Collaborative Task", "Long Turn", "Discussion", "Picture Comparison"];

interface CalibrationResult {
  caseId: string;
  level: string;
  agreement: number;
  totalDelta: number;
  date: string;
}

interface SeniorOverride {
  score: number;
  rationale: string;
}

interface ApprovedExample {
  id: string;
  case_id: string;
  level: string;
  task_type: string;
  approved_at: string;
  senior_notes: string;
  examiner_id: string;
  score_differences: { criterion: string; original: number; senior: number; delta: number }[];
  rationale_differences: { criterion: string; original: string; senior: string }[];
  senior_corrections: { name: string; score: number; rationale: string }[];
  original_gold: { name: string; goldScore: number; rationale: string }[];
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
  const { user } = useAuth();
  const { isAdmin } = useRoles();

  const [caseId, setCaseId] = useState<string>(CALIBRATION_CASES[0].id);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState<CalibrationResult[]>(() => loadHistory());

  // Senior Examiner override state
  const [seniorMode, setSeniorMode] = useState(false);
  const [seniorOverrides, setSeniorOverrides] = useState<Record<string, SeniorOverride>>({});
  const [seniorNotes, setSeniorNotes] = useState("");
  const [taskTypeOverride, setTaskTypeOverride] = useState<SpeakingTaskType | "">("");
  const [saving, setSaving] = useState(false);

  // Approved examples library
  const [approved, setApproved] = useState<ApprovedExample[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterTask, setFilterTask] = useState<string>("all");

  const current: CalibrationCase = useMemo(
    () => CALIBRATION_CASES.find((c) => c.id === caseId) ?? CALIBRATION_CASES[0],
    [caseId]
  );

  useEffect(() => {
    const initial: Record<string, number> = {};
    current.criteria.forEach((c) => { initial[c.name] = 3; });
    setScores(initial);
    setNotes({});
    setRevealed(false);
    // Reset senior overrides to mirror gold standard for easy editing
    const so: Record<string, SeniorOverride> = {};
    current.criteria.forEach((c) => { so[c.name] = { score: c.goldScore, rationale: c.rationale }; });
    setSeniorOverrides(so);
    setSeniorNotes("");
    setTaskTypeOverride(current.taskType);
  }, [current]);

  const fetchApproved = async () => {
    const { data, error } = await supabase
      .from("calibration_examples")
      .select("*")
      .order("approved_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setApproved((data ?? []) as unknown as ApprovedExample[]);
  };

  useEffect(() => { fetchApproved(); }, []);

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

  const seniorChangedCount = current.criteria.filter((c) => {
    const o = seniorOverrides[c.name];
    if (!o) return false;
    return o.score !== c.goldScore || o.rationale.trim() !== c.rationale.trim();
  }).length;

  const handleSaveApproved = async () => {
    if (!user) return;
    setSaving(true);
    const score_differences = current.criteria.map((c) => {
      const s = seniorOverrides[c.name]?.score ?? c.goldScore;
      return { criterion: c.name, original: c.goldScore, senior: s, delta: +(s - c.goldScore).toFixed(1) };
    });
    const rationale_differences = current.criteria
      .map((c) => ({
        criterion: c.name,
        original: c.rationale,
        senior: seniorOverrides[c.name]?.rationale ?? c.rationale,
      }))
      .filter((d) => d.original.trim() !== d.senior.trim());
    const senior_corrections = current.criteria.map((c) => ({
      name: c.name,
      score: seniorOverrides[c.name]?.score ?? c.goldScore,
      rationale: seniorOverrides[c.name]?.rationale ?? c.rationale,
    }));
    const original_gold = current.criteria.map((c) => ({
      name: c.name, goldScore: c.goldScore, rationale: c.rationale,
    }));

    const { error } = await supabase.from("calibration_examples").insert({
      case_id: current.id,
      level: current.level,
      task_type: taskTypeOverride || current.taskType,
      transcript: current.transcript,
      original_gold,
      senior_corrections,
      score_differences,
      rationale_differences,
      senior_notes: seniorNotes,
      examiner_id: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to save approved calibration", { description: error.message });
      return;
    }
    toast.success("Approved calibration example saved", {
      description: "Available for retrieval-based AI calibration.",
    });
    fetchApproved();
  };

  const filteredApproved = approved.filter((a) =>
    (filterLevel === "all" || a.level === filterLevel) &&
    (filterTask === "all" || a.task_type === filterTask)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-7 w-7 text-primary" /> Calibration Mode
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Score a sample exam, reveal the gold standard, and (Senior Examiners) refine and approve calibration examples.
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
            <CardDescription>
              {current.description}
              <span className="ml-2 inline-flex items-center gap-1">
                <Badge variant="outline" className="font-mono text-[10px]">{current.level}</Badge>
                <Badge variant="secondary" className="text-[10px]">{current.taskType}</Badge>
              </span>
            </CardDescription>
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
                  min={0} max={5} step={0.5}
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
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">Reference rationale (Gold)</p>
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

      {/* Senior Examiner Override */}
      {isAdmin && revealed && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Senior Examiner Override
                </CardTitle>
                <CardDescription>
                  Adjust gold standard scores and rationales, then approve as a reference example for AI calibration.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="senior-mode" checked={seniorMode} onCheckedChange={setSeniorMode} />
                <Label htmlFor="senior-mode" className="text-sm">Edit mode</Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Speaking task type</Label>
                <Select value={taskTypeOverride || current.taskType} onValueChange={(v) => setTaskTypeOverride(v as SpeakingTaskType)} disabled={!seniorMode}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Senior examiner notes (overall disagreements / context)</Label>
                <Textarea
                  placeholder="Explain disagreements with the standard, context, or guidance for AI…"
                  value={seniorNotes}
                  onChange={(e) => setSeniorNotes(e.target.value)}
                  disabled={!seniorMode}
                  className="mt-1 min-h-[44px] text-xs"
                />
              </div>
            </div>

            <Separator />

            {current.criteria.map((c, i) => {
              const so = seniorOverrides[c.name] ?? { score: c.goldScore, rationale: c.rationale };
              const sDelta = so.score - c.goldScore;
              const rationaleChanged = so.rationale.trim() !== c.rationale.trim();
              return (
                <div key={c.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{c.name}</span>
                    {(sDelta !== 0 || rationaleChanged) && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                        Disagrees with gold
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Gold */}
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gold standard</span>
                        <Badge variant="secondary" className="font-mono text-xs">{c.goldScore.toFixed(1)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{c.rationale}</p>
                    </div>
                    {/* Senior */}
                    <div className={`rounded-md border p-3 ${sDelta !== 0 || rationaleChanged ? "border-primary/50 bg-primary/5" : "bg-background"}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Senior examiner version</span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="font-mono text-xs">{so.score.toFixed(1)}</Badge>
                          {sDelta !== 0 && (
                            <Badge variant="outline" className={`font-mono text-[10px] ${deltaColor(sDelta)}`}>
                              Δ {sDelta > 0 ? "+" : ""}{sDelta.toFixed(1)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Slider
                        min={0} max={5} step={0.5}
                        value={[so.score]}
                        onValueChange={([v]) => setSeniorOverrides((s) => ({ ...s, [c.name]: { ...so, score: v } }))}
                        disabled={!seniorMode}
                        className="mb-2"
                      />
                      <Textarea
                        value={so.rationale}
                        onChange={(e) => setSeniorOverrides((s) => ({ ...s, [c.name]: { ...so, rationale: e.target.value } }))}
                        disabled={!seniorMode}
                        className="min-h-[64px] text-xs"
                        placeholder="Improved rationale / justification…"
                      />
                    </div>
                  </div>
                  {i < current.criteria.length - 1 && <Separator />}
                </div>
              );
            })}

            <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {seniorChangedCount > 0
                  ? `${seniorChangedCount} criteria adjusted from gold standard`
                  : "Approving without changes will store gold as the calibration reference"}
              </p>
              <Button onClick={handleSaveApproved} disabled={!seniorMode || saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save as Approved Calibration Example"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approved Calibration Library */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Library className="h-5 w-5 text-primary" /> Approved Calibration Examples
              </CardTitle>
              <CardDescription>
                Senior-approved references retrievable by CEFR level, task type, and criterion for AI guidance.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  {["A2","B1","B2","C1","C2"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTask} onValueChange={setFilterTask}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All task types</SelectItem>
                  {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredApproved.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No approved calibration examples yet{isAdmin ? " — reveal a case above and save your senior version." : "."}
            </p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {filteredApproved.map((ex) => {
                const totalSeniorDelta = ex.score_differences.reduce((s, d) => s + Math.abs(d.delta), 0);
                return (
                  <AccordionItem key={ex.id} value={ex.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2 flex-wrap text-left">
                        <Badge variant="outline" className="font-mono">{ex.level}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{ex.task_type}</Badge>
                        <span className="text-sm">{CALIBRATION_CASES.find((c) => c.id === ex.case_id)?.title.split("—")[1]?.trim() ?? ex.case_id}</span>
                        <span className="text-xs text-muted-foreground">· {new Date(ex.approved_at).toLocaleDateString()}</span>
                        {totalSeniorDelta > 0 && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400">
                            Δ {totalSeniorDelta.toFixed(1)} from gold
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      {ex.senior_notes && (
                        <div className="rounded-md border-l-2 border-primary/40 bg-primary/5 p-2 text-xs">
                          <p className="font-semibold uppercase tracking-wider text-[10px] text-primary mb-0.5">Senior notes</p>
                          {ex.senior_notes}
                        </div>
                      )}
                      <div className="space-y-2">
                        {ex.score_differences.map((d) => (
                          <div key={d.criterion} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-xs">
                            <span className="font-medium">{d.criterion}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="font-mono">Gold {d.original.toFixed(1)}</Badge>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <Badge variant="outline" className="font-mono">Final {d.senior.toFixed(1)}</Badge>
                              {d.delta !== 0 && (
                                <Badge variant="outline" className={`font-mono ${deltaColor(d.delta)}`}>
                                  Δ {d.delta > 0 ? "+" : ""}{d.delta.toFixed(1)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {ex.rationale_differences.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rationale changes</p>
                          {ex.rationale_differences.map((r, idx) => (
                            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              <div className="rounded-md border bg-muted/30 p-2">
                                <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">{r.criterion} — Gold</p>
                                <p className="text-muted-foreground">{r.original}</p>
                              </div>
                              <div className="rounded-md border border-primary/40 bg-primary/5 p-2">
                                <p className="text-[10px] font-semibold text-primary mb-0.5">{r.criterion} — Senior</p>
                                <p>{r.senior}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
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
