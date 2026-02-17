import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileText, CheckCircle2, AlertTriangle, RotateCcw, Printer, ShieldCheck, BookOpen, ExternalLink, Home, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getRecommendations } from "@/lib/practiceData";
import { supabase } from "@/integrations/supabase/client";

export interface AssessmentResult {
  overallBand: string;
  overallScore: number;
  criteria: { name: string; score: number; maxScore: number; feedback: string }[];
  strengths: string[];
  areasForImprovement: string[];
  transcript: string;
  examinerNotes: string;
}

interface DraftReportProps {
  result: AssessmentResult;
  level: string;
  levelCode: string;
  language: string;
  institution?: string;
  group?: string;
  candidates?: number;
  onReset: () => void;
}

function EditableScore({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  const pct = (value / max) * 100;
  const color = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-destructive";
  return (
    <Input
      type="number"
      min={0}
      max={max}
      step={0.5}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={`w-20 text-right font-display text-lg font-bold ${color}`}
    />
  );
}

const COPYRIGHT_TEXT = "© 2026 [Tu Nombre/Institución]. All rights reserved. Evaluation methodology and pedagogical structure are protected intellectual property. AI results are subject to teacher supervision.";

export function DraftReport({ result, level, levelCode, language, institution, group, candidates, onReset }: DraftReportProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isOfficial, setIsOfficial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AssessmentResult>(() => JSON.parse(JSON.stringify(result)));

  const institutionName = institution || localStorage.getItem("oralassess-institution") || "";

  const updateCriterion = (index: number, field: "score" | "feedback", value: any) => {
    setDraft((prev) => {
      const next = { ...prev, criteria: prev.criteria.map((c, i) => i === index ? { ...c, [field]: value } : c) };
      const total = next.criteria.reduce((s, c) => s + c.score, 0);
      const maxTotal = next.criteria.reduce((s, c) => s + c.maxScore, 0);
      next.overallScore = maxTotal > 0 ? (total / maxTotal) * 5 : 0;
      return next;
    });
  };

  const updateListItem = (list: "strengths" | "areasForImprovement", index: number, value: string) => {
    setDraft((prev) => ({ ...prev, [list]: prev[list].map((item, i) => i === index ? value : item) }));
  };

  const handleConfirmSign = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("exams").insert({
        title: `${levelCode} ${language} Oral`,
        level_code: levelCode,
        language,
        institution: institutionName,
        group: group || "",
        candidates: candidates || 1,
        overall_band: draft.overallBand,
        overall_score: draft.overallScore,
        criteria: draft.criteria as any,
        strengths: draft.strengths as any,
        areas_for_improvement: draft.areasForImprovement as any,
        transcript: draft.transcript,
        examiner_notes: draft.examinerNotes,
        status: "completed",
      });
      if (error) throw error;
      setIsOfficial(true);
      toast({ title: "Report confirmed & saved", description: "This report is now Official and saved to your records." });
    } catch (err: any) {
      console.error("Save error:", err);
      toast({ title: "Failed to save report", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:space-y-4">
      {/* Logo + Top actions */}
      <div className="flex items-start justify-between print:hidden">
        <div className="flex items-start gap-4">
          {/* Institutional Logo Placeholder */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 text-center">
            <span className="text-[9px] leading-tight text-muted-foreground/60 px-1">Upload Logo in Settings</span>
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {isOfficial ? "Official Assessment Report" : "Draft Assessment Report"}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {isOfficial
                ? "This report has been reviewed and signed by the examiner."
                : "AI-generated preliminary evaluation · Review and edit before confirming."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isOfficial && (
            <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
              <Home className="h-4 w-4" /> Return to Dashboard
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
          {!isOfficial && (
            <Button variant="outline" onClick={onReset} className="gap-2">
              <RotateCcw className="h-4 w-4" /> New Exam
            </Button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {isOfficial ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span className="font-medium">Official Report — Confirmed and signed by the examiner.</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="font-medium">Draft — Scores and feedback are editable. Click "Confirm &amp; Sign" when ready.</span>
        </div>
      )}

      {/* Overall Score */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-6 pt-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <span className="font-display text-3xl font-bold">{draft.overallBand}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Overall CEFR Band</p>
            <p className="font-display text-2xl font-bold">{draft.overallBand} — Score: {draft.overallScore.toFixed(1)}/5.0</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">Level: {level}</Badge>
              <Badge variant="outline">{language}</Badge>
              {institutionName && <Badge variant="outline">{institutionName}</Badge>}
              {isOfficial ? (
                <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700">
                  <ShieldCheck className="h-3 w-3" /> Official
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">
                  <AlertTriangle className="mr-1 h-3 w-3" /> Draft
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Criteria Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Assessment Criteria</CardTitle>
          <CardDescription>
            {isOfficial ? "Final scores confirmed by the examiner." : "Scores are editable — adjust as needed before confirming."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {draft.criteria.map((c, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{c.name}</span>
                {isOfficial ? (
                  <span className={`font-display text-2xl font-bold ${(c.score / c.maxScore) * 100 >= 80 ? "text-emerald-600" : (c.score / c.maxScore) * 100 >= 50 ? "text-amber-600" : "text-destructive"}`}>
                    {c.score}/{c.maxScore}
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <EditableScore value={c.score} max={c.maxScore} onChange={(v) => updateCriterion(i, "score", v)} />
                    <span className="text-muted-foreground text-sm">/ {c.maxScore}</span>
                  </div>
                )}
              </div>
              <Progress value={(c.score / c.maxScore) * 100} className="h-2 mb-2" />
              {isOfficial ? (
                <p className="text-sm text-muted-foreground">{c.feedback}</p>
              ) : (
                <Textarea value={c.feedback} onChange={(e) => updateCriterion(i, "feedback", e.target.value)} className="text-sm min-h-[60px]" />
              )}
              {i < draft.criteria.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Strengths & Improvements */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {draft.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {isOfficial ? s : <Input value={s} onChange={(e) => updateListItem("strengths", i, e.target.value)} className="text-sm h-8" />}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {draft.areasForImprovement.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  {isOfficial ? a : <Input value={a} onChange={(e) => updateListItem("areasForImprovement", i, e.target.value)} className="text-sm h-8" />}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Examiner Notes */}
      {draft.examinerNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" /> Examiner Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isOfficial ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{draft.examinerNotes}</p>
            ) : (
              <Textarea value={draft.examinerNotes} onChange={(e) => setDraft((prev) => ({ ...prev, examinerNotes: e.target.value }))} className="text-sm min-h-[80px]" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      {draft.transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Transcript</CardTitle>
            <CardDescription>AI-generated approximate transcription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap">{draft.transcript}</div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Practice */}
      {(() => {
        const recommendations = getRecommendations(draft.criteria, levelCode, 2);
        return (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Recommended Practice
              </CardTitle>
              <CardDescription>Personalised resources based on the lowest-scoring criteria.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations.length > 0 ? recommendations.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40">
                  <div>
                    <p className="text-sm font-medium">{link.title}</p>
                    <p className="text-xs text-muted-foreground">{link.source} · {link.skill} · {link.level}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              )) : (
                <p className="text-sm text-muted-foreground">No specific recommendations available for this level.</p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Confirm & Sign */}
      {!isOfficial && (
        <div className="flex justify-center print:hidden">
          <Button size="lg" onClick={handleConfirmSign} disabled={saving} className="gap-2 px-8">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
            {saving ? "Saving…" : "Confirm & Sign as Official"}
          </Button>
        </div>
      )}

      {/* Copyright footer */}
      <div className="border-t pt-4 text-center text-xs text-muted-foreground">{COPYRIGHT_TEXT}</div>
    </div>
  );
}
