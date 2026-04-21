import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, CheckCircle2, AlertTriangle, RotateCcw, Printer, ShieldCheck,
  BookOpen, ExternalLink, Home, Loader2, Download, PenLine, Users, Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SpeakerTranscript } from "@/components/SpeakerTranscript";
import { useToast } from "@/hooks/use-toast";
import { getRecommendations } from "@/lib/practiceData";
import { supabase } from "@/integrations/supabase/client";
import { generateReportPdf } from "@/lib/generateReportPdf";
import { useAuth } from "@/hooks/useAuth";

export interface AssessmentResult {
  overallBand: string;
  overallScore: number;
  criteria: { name: string; score: number; maxScore: number; feedback: string; confidence?: number }[];
  strengths: string[];
  areasForImprovement: string[];
}

export interface MultiCandidateResult {
  candidates: (AssessmentResult & { candidateName: string })[];
  transcript: string;
  examinerNotes: string;
}

interface DraftReportProps {
  result: MultiCandidateResult;
  level: string;
  levelCode: string;
  language: string;
  institution?: string;
  group?: string;
  candidateNames: string[];
  audioBlob?: Blob | null;
  /** Stable id used to autosave draft edits to localStorage (e.g. batch item id). */
  draftKey?: string;
  onReset: () => void;
}

const DRAFT_STORAGE_PREFIX = "oralassess-draft:";

interface PersistedDraft {
  drafts: MultiCandidateResult["candidates"];
  sharedDraft: { transcript: string; examinerNotes: string };
  allOverrides: Record<number, Record<number, string>>;
  allAcceptedStrengths: boolean[][];
  allAcceptedImprovements: boolean[][];
  officialStatus: boolean[];
  savedAt: number;
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

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence == null) return null;
  const label = confidence >= 90 ? "High" : confidence >= 70 ? "Good" : confidence >= 50 ? "Low" : "Very Low";
  const color =
    confidence >= 90 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
    confidence >= 70 ? "border-primary/30 bg-primary/10 text-primary" :
    confidence >= 50 ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" :
    "border-destructive/30 bg-destructive/10 text-destructive";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`text-xs gap-1 cursor-help ${color}`}>
          <Info className="h-3 w-3" /> {label} ({confidence}%)
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-xs">
        AI confidence in this score based on audio evidence quality. Low confidence means the examiner should review carefully.
      </TooltipContent>
    </Tooltip>
  );
}

const COPYRIGHT_TEXT = "© 2026 Int'l Oral Exam Assistant. Evaluation methodology and AI results are subject to teacher supervision.";

export function DraftReport({ result, level, levelCode, language, institution, group, candidateNames, audioBlob, draftKey, onReset }: DraftReportProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeCandidate, setActiveCandidate] = useState(0);
  const [saving, setSaving] = useState(false);

  // Try to restore a previously auto-saved draft for this exam.
  const persisted = useMemo<PersistedDraft | null>(() => {
    if (!draftKey) return null;
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_PREFIX + draftKey);
      if (!raw) return null;
      return JSON.parse(raw) as PersistedDraft;
    } catch {
      return null;
    }
  }, [draftKey]);

  // Per-candidate draft state
  const [drafts, setDrafts] = useState<MultiCandidateResult["candidates"]>(() =>
    persisted?.drafts ?? JSON.parse(JSON.stringify(result.candidates))
  );
  const [sharedDraft, setSharedDraft] = useState(() =>
    persisted?.sharedDraft ?? {
      transcript: result.transcript,
      examinerNotes: result.examinerNotes,
    }
  );

  // Per-candidate overrides
  const [allOverrides, setAllOverrides] = useState<Record<number, Record<number, string>>>(() =>
    persisted?.allOverrides ?? Object.fromEntries(result.candidates.map((_, i) => [i, {}]))
  );

  // Per-candidate original scores (always from the AI response, never persisted)
  const allOriginalScores = useMemo(() =>
    result.candidates.map(c => c.criteria.map(cr => cr.score)),
    [result]
  );

  // Per-candidate accepted evidence
  const [allAcceptedStrengths, setAllAcceptedStrengths] = useState<boolean[][]>(() =>
    persisted?.allAcceptedStrengths ?? result.candidates.map(c => c.strengths.map(() => true))
  );
  const [allAcceptedImprovements, setAllAcceptedImprovements] = useState<boolean[][]>(() =>
    persisted?.allAcceptedImprovements ?? result.candidates.map(c => c.areasForImprovement.map(() => true))
  );

  // Per-candidate official status
  const [officialStatus, setOfficialStatus] = useState<boolean[]>(() =>
    persisted?.officialStatus ?? result.candidates.map(() => false)
  );

  // Auto-save: persist editable state to localStorage whenever anything changes.
  // Debounced lightly via microtask coalescing — localStorage is sync but small.
  useEffect(() => {
    if (!draftKey) return;
    try {
      const payload: PersistedDraft = {
        drafts,
        sharedDraft,
        allOverrides,
        allAcceptedStrengths,
        allAcceptedImprovements,
        officialStatus,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_STORAGE_PREFIX + draftKey, JSON.stringify(payload));
    } catch (err) {
      // Quota exceeded or disabled — silently ignore; sign & save still works.
      console.warn("[DraftReport] autosave failed:", err);
    }
  }, [draftKey, drafts, sharedDraft, allOverrides, allAcceptedStrengths, allAcceptedImprovements, officialStatus]);

  // Notify the user once if we restored from autosave (only on initial mount).
  useEffect(() => {
    if (persisted) {
      const ageMin = Math.round((Date.now() - persisted.savedAt) / 60000);
      toast({
        title: "Draft restored",
        description: `Recovered your edits from ${ageMin === 0 ? "moments ago" : `${ageMin} min ago`}.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allOfficial = officialStatus.every(Boolean);
  const institutionName = institution || localStorage.getItem("oralassess-institution") || "";

  const draft = drafts[activeCandidate];
  const overrides = allOverrides[activeCandidate] || {};
  const originalScores = allOriginalScores[activeCandidate] || [];
  const acceptedStrengths = allAcceptedStrengths[activeCandidate] || [];
  const acceptedImprovements = allAcceptedImprovements[activeCandidate] || [];
  const isOfficial = officialStatus[activeCandidate];

  const updateCriterion = (index: number, field: "score" | "feedback", value: any) => {
    setDrafts(prev => {
      const next = [...prev];
      const c = { ...next[activeCandidate] };
      c.criteria = c.criteria.map((cr, i) => i === index ? { ...cr, [field]: value } : cr);
      const total = c.criteria.reduce((s, cr) => s + cr.score, 0);
      const maxTotal = c.criteria.reduce((s, cr) => s + cr.maxScore, 0);
      c.overallScore = maxTotal > 0 ? (total / maxTotal) * 5 : 0;
      next[activeCandidate] = c;
      return next;
    });
    if (field === "score" && value !== originalScores[index]) {
      setAllOverrides(prev => ({
        ...prev,
        [activeCandidate]: { ...prev[activeCandidate], [index]: prev[activeCandidate]?.[index] ?? "" }
      }));
    } else if (field === "score" && value === originalScores[index]) {
      setAllOverrides(prev => {
        const next = { ...prev[activeCandidate] };
        delete next[index];
        return { ...prev, [activeCandidate]: next };
      });
    }
  };

  const updateListItem = (list: "strengths" | "areasForImprovement", index: number, value: string) => {
    setDrafts(prev => {
      const next = [...prev];
      const c = { ...next[activeCandidate] };
      c[list] = c[list].map((item, i) => i === index ? value : item);
      next[activeCandidate] = c;
      return next;
    });
  };

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
      const finalStrengths = draft.strengths.filter((_, i) => acceptedStrengths[i]);
      const finalImprovements = draft.areasForImprovement.filter((_, i) => acceptedImprovements[i]);

      const overrideNotes = Object.entries(overrides)
        .map(([idx, comment]) => {
          const c = draft.criteria[Number(idx)];
          return `[Override] ${c.name}: ${originalScores[Number(idx)]} → ${c.score} — ${comment}`;
        })
        .join("\n");

      const finalNotes = overrideNotes
        ? `${sharedDraft.examinerNotes}\n\n--- Score Overrides ---\n${overrideNotes}`
        : sharedDraft.examinerNotes;

      const candidateName = draft.candidateName || candidateNames[activeCandidate] || `Candidate ${String.fromCharCode(65 + activeCandidate)}`;
      const examTitle = `${levelCode} ${language} Oral — ${candidateName}`;

      const { data: insertData, error } = await supabase.from("exams").insert({
        title: examTitle,
        level_code: levelCode,
        language,
        institution: institutionName,
        group: group || "",
        candidate_name: candidateName,
        candidates: candidateNames.length,
        overall_band: draft.overallBand,
        overall_score: draft.overallScore,
        criteria: draft.criteria as any,
        strengths: finalStrengths as any,
        areas_for_improvement: finalImprovements as any,
        transcript: sharedDraft.transcript,
        examiner_notes: finalNotes,
        status: "completed",
        user_id: (await supabase.auth.getUser()).data.user?.id,
      }).select("id").single();
      if (error) throw error;

      // Upload audio to storage if available (only for the first candidate to avoid duplicates)
      if (audioBlob && insertData?.id && !officialStatus.some(Boolean)) {
        const path = `${insertData.id}.wav`;
        const { error: uploadError } = await supabase.storage
          .from("exam-audio")
          .upload(path, audioBlob, { contentType: "audio/wav", upsert: true });
        if (uploadError) {
          console.warn("Audio upload failed:", uploadError.message);
        }
      }

      setOfficialStatus(prev => {
        const next = prev.map((v, i) => i === activeCandidate ? true : v);
        // If every candidate is now signed, drop the autosave entry — it's no longer needed.
        if (draftKey && next.every(Boolean)) {
          try { localStorage.removeItem(DRAFT_STORAGE_PREFIX + draftKey); } catch { /* ignore */ }
        }
        return next;
      });
      toast({ title: `Report confirmed for ${candidateName}`, description: "Saved to your records." });

      // Auto-advance to next unconfirmed candidate
      const nextUnconfirmed = officialStatus.findIndex((v, i) => i !== activeCandidate && !v);
      if (nextUnconfirmed >= 0) {
        setActiveCandidate(nextUnconfirmed);
      }
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
    const candidateName = draft.candidateName || candidateNames[activeCandidate] || `Candidate ${String.fromCharCode(65 + activeCandidate)}`;
    const examTitle = `${levelCode} ${language} Oral — ${candidateName}`;
    generateReportPdf({
      title: examTitle,
      candidateName,
      institution: institutionName,
      group: group || "",
      levelCode,
      language,
      overallBand: draft.overallBand,
      overallScore: draft.overallScore,
      criteria: draft.criteria,
      strengths: finalStrengths,
      areasForImprovement: finalImprovements,
      examinerNotes: sharedDraft.examinerNotes,
      transcript: sharedDraft.transcript,
      date: new Date().toLocaleDateString(),
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:space-y-4">
      {/* Top actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between print:hidden">
        <div className="flex items-start gap-4 min-w-0">
          <div className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 text-center">
            <span className="text-[9px] leading-tight text-muted-foreground/60 px-1">Upload Logo in Settings</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {allOfficial ? "Official Assessment Reports" : "Draft Assessment Reports"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {allOfficial
                ? "All candidates reviewed and signed."
                : `${officialStatus.filter(Boolean).length}/${officialStatus.length} candidates confirmed · Review each candidate below.`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {allOfficial && (
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
          {!allOfficial && (
            <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
              <RotateCcw className="h-4 w-4" /> New Exam
            </Button>
          )}
        </div>
      </div>

      {/* Candidate Tabs */}
      <Tabs value={String(activeCandidate)} onValueChange={(v) => setActiveCandidate(Number(v))}>
        <TabsList className={`grid w-full grid-cols-${drafts.length}`}>
          {drafts.map((c, i) => (
            <TabsTrigger key={i} value={String(i)} className="gap-2">
              <Users className="h-3.5 w-3.5" />
              {c.candidateName || candidateNames[i] || `Candidate ${String.fromCharCode(65 + i)}`}
              {officialStatus[i] && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
            </TabsTrigger>
          ))}
        </TabsList>

        {drafts.map((_, candidateIdx) => (
          <TabsContent key={candidateIdx} value={String(candidateIdx)}>
            {/* Render nothing here — content is below outside TabsContent for simplicity */}
          </TabsContent>
        ))}
      </Tabs>

      {/* Status banner */}
      {isOfficial ? (
        <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span className="font-medium">Official Report — Confirmed and signed for {draft.candidateName || candidateNames[activeCandidate]}.</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="font-medium">Draft — Scores and feedback are editable for {draft.candidateName || candidateNames[activeCandidate]}. Click "Confirm &amp; Sign" when ready.</span>
        </div>
      )}

      {/* Overall Score */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-6 pt-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <span className="font-display text-3xl font-bold">{draft.overallBand}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">
              {draft.candidateName || candidateNames[activeCandidate]} — Overall CEFR Band
            </p>
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
                    <ConfidenceBadge confidence={c.confidence} />
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
                {wasOverridden && !isOfficial && (
                  <div className="mt-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                    <label className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1 mb-1.5">
                      <PenLine className="h-3 w-3" /> Override justification (required)
                    </label>
                    <Input
                      placeholder="Explain why you changed this score…"
                      value={overrides[i] || ""}
                      onChange={(e) => setAllOverrides(prev => ({
                        ...prev,
                        [activeCandidate]: { ...prev[activeCandidate], [i]: e.target.value }
                      }))}
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

      {/* Strengths & Improvements */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Strengths
            </CardTitle>
            {!isOfficial && <CardDescription>Uncheck to reject AI-flagged evidence.</CardDescription>}
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
                          setAllAcceptedStrengths(prev => prev.map((arr, idx) =>
                            idx === activeCandidate ? arr.map((v, j) => j === i ? !!checked : v) : arr
                          ))
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
            {!isOfficial && <CardDescription>Uncheck to reject AI-flagged evidence.</CardDescription>}
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
                          setAllAcceptedImprovements(prev => prev.map((arr, idx) =>
                            idx === activeCandidate ? arr.map((v, j) => j === i ? !!checked : v) : arr
                          ))
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

      {/* Examiner Notes (shared) */}
      {sharedDraft.examinerNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" /> Examiner Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allOfficial ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sharedDraft.examinerNotes}</p>
            ) : (
              <Textarea value={sharedDraft.examinerNotes} onChange={(e) => setSharedDraft(prev => ({ ...prev, examinerNotes: e.target.value }))} className="text-sm min-h-[80px]" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Transcript (shared) */}
      {sharedDraft.transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Transcript</CardTitle>
            <CardDescription>AI-generated transcription with speaker labels</CardDescription>
          </CardHeader>
          <CardContent>
            <SpeakerTranscript transcript={sharedDraft.transcript} maxHeight="24rem" />
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
              <CardDescription>Personalised resources for {draft.candidateName || candidateNames[activeCandidate]} based on the lowest-scoring criteria.</CardDescription>
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
            {saving ? "Saving…" : `Confirm & Sign — ${draft.candidateName || candidateNames[activeCandidate]}`}
          </Button>
        </div>
      )}

      {/* Copyright footer */}
      <div className="border-t pt-4 text-center text-xs text-muted-foreground">{COPYRIGHT_TEXT}</div>
    </div>
  );
}
