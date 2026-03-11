import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText, CheckCircle2, AlertTriangle, RotateCcw, Printer, ShieldCheck,
  BookOpen, ExternalLink, Home, Loader2, Download, PenLine,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getRecommendations } from "@/lib/practiceData";
import { supabase } from "@/integrations/supabase/client";
import { generateReportPdf } from "@/lib/generateReportPdf";
import { useAuth } from "@/hooks/useAuth";

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
  candidateName?: string;
  candidates?: number;
  audioBlob?: Blob | null;
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

export function DraftReport({ result, level, levelCode, language, institution, group, candidateName, candidates, audioBlob, onReset }: DraftReportProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isOfficial, setIsOfficial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AssessmentResult>(() => JSON.parse(JSON.stringify(result)));

  // Track which criteria were overridden and the teacher's justification
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  // Track original scores for comparison
  const originalScores = useMemo(() => result.criteria.map((c) => c.score), [result]);

  // Track accepted/rejected status for strengths and improvements
  const [acceptedStrengths, setAcceptedStrengths] = useState<boolean[]>(() => result.strengths.map(() => true));
  const [acceptedImprovements, setAcceptedImprovements] = useState<boolean[]>(() => result.areasForImprovement.map(() => true));

  const institutionName = institution || localStorage.getItem("oralassess-institution") || "";

  const updateCriterion = (index: number, field: "score" | "feedback", value: any) => {
    setDraft((prev) => {
      const next = { ...prev, criteria: prev.criteria.map((c, i) => i === index ? { ...c, [field]: value } : c) };
      const total = next.criteria.reduce((s, c) => s + c.score, 0);
      const maxTotal = next.criteria.reduce((s, c) => s + c.maxScore, 0);
      next.overallScore = maxTotal > 0 ? (total / maxTotal) * 5 : 0;
      return next;
    });
    // If score changed from original, ensure override entry exists
    if (field === "score" && value !== originalScores[index]) {
      setOverrides((prev) => ({ ...prev, [index]: prev[index] ?? "" }));
    } else if (field === "score" && value === originalScores[index]) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const updateListItem = (list: "strengths" | "areasForImprovement", index: number, value: string) => {
    setDraft((prev) => ({ ...prev, [list]: prev[list].map((item, i) => i === index ? value : item) }));
  };

  // Check if all overrides have comments
  const hasUnjustifiedOverrides = Object.entries(overrides).some(([, comment]) => !comment.trim());

  const handleConfirmSign = async () => {
    if (hasUnjustifiedOverrides) {
      toast({
        title: "Override comments required",
        description: "Please provide a justification for each score you changed before signing.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Filter out rejected evidence
      const finalStrengths = draft.strengths.filter((_, i) => acceptedStrengths[i]);
      const finalImprovements = draft.areasForImprovement.filter((_, i) => acceptedImprovements[i]);

      // Append override comments to examiner notes
      const overrideNotes = Object.entries(overrides)
        .map(([idx, comment]) => {
          const c = draft.criteria[Number(idx)];
          return `[Override] ${c.name}: ${originalScores[Number(idx)]} → ${c.score} — ${comment}`;
        })
        .join("\n");

      const finalNotes = overrideNotes
        ? `${draft.examinerNotes}\n\n--- Score Overrides ---\n${overrideNotes}`
        : draft.examinerNotes;

      const examTitle = candidateName
        ? `${levelCode} ${language} Oral — ${candidateName}`
        : `${levelCode} ${language} Oral`;

      const { data: insertData, error } = await supabase.from("exams").insert({
        title: examTitle,
        level_code: levelCode,
        language,
        institution: institutionName,
        group: group || "",
        candidate_name: candidateName || "",
        candidates: candidates || 1,
        overall_band: draft.overallBand,
        overall_score: draft.overallScore,
        criteria: draft.criteria as any,
        strengths: finalStrengths as any,
        areas_for_improvement: finalImprovements as any,
        transcript: draft.transcript,
        examiner_notes: finalNotes,
        status: "completed",
        user_id: (await supabase.auth.getUser()).data.user?.id,
      }).select("id").single();
      if (error) throw error;

      // Upload audio to storage if available
      if (audioBlob && insertData?.id) {
        const path = `${insertData.id}.wav`;
        const { error: uploadError } = await supabase.storage
          .from("exam-audio")
          .upload(path, audioBlob, { contentType: "audio/wav", upsert: true });
        if (uploadError) {
          console.warn("Audio upload failed:", uploadError.message);
        }
      }
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

  const handleDownloadPdf = () => {
    const finalStrengths = draft.strengths.filter((_, i) => acceptedStrengths[i]);
    const finalImprovements = draft.areasForImprovement.filter((_, i) => acceptedImprovements[i]);
    const examTitle = candidateName
      ? `${levelCode} ${language} Oral — ${candidateName}`
      : `${levelCode} ${language} Oral`;
    generateReportPdf({
      title: examTitle,
      candidateName: candidateName || "",
      institution: institutionName,
      group: group || "",
      levelCode,
      language,
      overallBand: draft.overallBand,
      overallScore: draft.overallScore,
      criteria: draft.criteria,
      strengths: finalStrengths,
      areasForImprovement: finalImprovements,
      examinerNotes: draft.examinerNotes,
      transcript: draft.transcript,
      date: new Date().toLocaleDateString(),
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:space-y-4">
      {/* Logo + Top actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div className="flex items-start gap-4 min-w-0">
          <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 text-center">
            <span className="text-[9px] leading-tight text-muted-foreground/60 px-1">Upload Logo in Settings</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {isOfficial ? "Official Assessment Report" : "Draft Assessment Report"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOfficial
                ? "This report has been reviewed and signed by the examiner."
                : "AI-generated preliminary evaluation · Review and edit before confirming."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOfficial && (
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
              <Home className="h-4 w-4" /> Dashboard
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-2">
            <Download className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
          {!isOfficial && (
            <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
              <RotateCcw className="h-4 w-4" /> New Exam
            </Button>
          )}
        </div>
      </div>

      {/* Status banner */}
      {isOfficial ? (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span className="font-medium">Official Report — Confirmed and signed by the examiner.</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
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
              {Object.keys(overrides).length > 0 && !isOfficial && (
                <Badge variant="outline" className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-700">
                  <PenLine className="h-3 w-3" /> {Object.keys(overrides).length} override{Object.keys(overrides).length > 1 ? "s" : ""}
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
            {isOfficial ? "Final scores confirmed by the examiner." : "Scores are editable — adjust as needed before confirming. Changed scores require a justification comment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {draft.criteria.map((c, i) => {
            const wasOverridden = i in overrides;
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{c.name}</span>
                    {wasOverridden && !isOfficial && (
                      <Badge variant="outline" className="text-xs gap-1 border-blue-500/30 text-blue-600">
                        <PenLine className="h-3 w-3" /> Modified (was {originalScores[i]})
                      </Badge>
                    )}
                  </div>
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
                {/* Override justification */}
                {wasOverridden && !isOfficial && (
                  <div className="mt-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                    <label className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1 mb-1.5">
                      <PenLine className="h-3 w-3" /> Override justification (required)
                    </label>
                    <Input
                      placeholder="Explain why you changed this score…"
                      value={overrides[i] || ""}
                      onChange={(e) => setOverrides((prev) => ({ ...prev, [i]: e.target.value }))}
                      className="text-sm h-8"
                    />
                  </div>
                )}
                {i < draft.criteria.length - 1 && <Separator className="mt-4" />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Strengths & Improvements with accept/reject */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Strengths
            </CardTitle>
            {!isOfficial && (
              <CardDescription>Uncheck to reject AI-flagged evidence.</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {draft.strengths.map((s, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${!acceptedStrengths[i] && !isOfficial ? "opacity-40 line-through" : ""}`}>
                  {!isOfficial ? (
                    <>
                      <Checkbox
                        checked={acceptedStrengths[i]}
                        onCheckedChange={(checked) =>
                          setAcceptedStrengths((prev) => prev.map((v, idx) => idx === i ? !!checked : v))
                        }
                        className="mt-0.5"
                      />
                      <Input value={s} onChange={(e) => updateListItem("strengths", i, e.target.value)} className="text-sm h-8 flex-1" />
                    </>
                  ) : (
                    <>
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {s}
                    </>
                  )}
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
            {!isOfficial && (
              <CardDescription>Uncheck to reject AI-flagged evidence.</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {draft.areasForImprovement.map((a, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${!acceptedImprovements[i] && !isOfficial ? "opacity-40 line-through" : ""}`}>
                  {!isOfficial ? (
                    <>
                      <Checkbox
                        checked={acceptedImprovements[i]}
                        onCheckedChange={(checked) =>
                          setAcceptedImprovements((prev) => prev.map((v, idx) => idx === i ? !!checked : v))
                        }
                        className="mt-0.5"
                      />
                      <Input value={a} onChange={(e) => updateListItem("areasForImprovement", i, e.target.value)} className="text-sm h-8 flex-1" />
                    </>
                  ) : (
                    <>
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      {a}
                    </>
                  )}
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
        <div className="flex flex-col items-center gap-3 print:hidden">
          {hasUnjustifiedOverrides && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Please justify all score overrides before signing.
            </p>
          )}
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
