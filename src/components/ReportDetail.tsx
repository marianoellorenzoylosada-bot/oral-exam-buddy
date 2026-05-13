import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DialogContent, DialogHeader, DialogTitle, DialogDescription,
  Dialog, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Printer, CheckCircle2, AlertTriangle, ShieldCheck, BookOpen,
  ExternalLink, Download, Trash2, EyeOff, Volume2, Info, Clock, GraduationCap,
  RefreshCw, History, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRecommendations } from "@/lib/practiceData";
import { generateReportPdf } from "@/lib/generateReportPdf";
import { generateStudentPdf } from "@/lib/generateStudentPdf";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { SpeakerTranscript } from "@/components/SpeakerTranscript";
import { QuotedAudio, type ScribeWord } from "@/components/QuotedAudio";

const langLabel: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian",
};

export type Exam = {
  id: string;
  title: string;
  level_code: string;
  language: string;
  institution: string | null;
  group: string | null;
  candidate_name: string | null;
  candidates: number | null;
  overall_band: string;
  overall_score: number;
  criteria: any;
  strengths: any;
  areas_for_improvement: any;
  transcript: string | null;
  examiner_notes: string | null;
  status: string;
  created_at: string;
  audio_path?: string | null;
  audio_expires_at?: string | null;
  words_json?: any;
  previous_analyses?: any;
  regrade_count?: number | null;
};

interface Props {
  exam: Exam;
  anonymize: boolean;
  onClose: () => void;
}

function mask(text: string | null | undefined) {
  return text ? "██████" : "—";
}

export function ReportDetail({ exam, anonymize, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [deletingAudio, setDeletingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioGone, setAudioGone] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Re-grade state
  const [regradeOpen, setRegradeOpen] = useState(false);
  const [regrading, setRegrading] = useState(false);
  const [editTranscript, setEditTranscript] = useState(exam.transcript ?? "");
  const [editNotes, setEditNotes] = useState(exam.examiner_notes ?? "");
  const [extraObservation, setExtraObservation] = useState("");
  const [viewingPrevIdx, setViewingPrevIdx] = useState<number | null>(null);

  const previousAnalyses: any[] = Array.isArray(exam.previous_analyses) ? exam.previous_analyses : [];

  useEffect(() => {
    const path = exam.audio_path ?? `${exam.id}.wav`;
    supabase.storage
      .from("exam-audio")
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!error && data?.signedUrl) setAudioUrl(data.signedUrl);
      });
  }, [exam.id, exam.audio_path]);

  const words: ScribeWord[] = Array.isArray(exam.words_json) ? (exam.words_json as ScribeWord[]) : [];

  const seekAudio = (start: number, end: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, start);
    a.play().catch(() => { /* ignore */ });
    const stopAt = Math.max(end + 0.2, start + 0.5);
    const onTime = () => {
      if (a.currentTime >= stopAt) {
        a.pause();
        a.removeEventListener("timeupdate", onTime);
      }
    };
    a.addEventListener("timeupdate", onTime);
  };

  // When viewing a previous version, swap displayed analysis (read-only).
  const viewing = viewingPrevIdx != null ? previousAnalyses[viewingPrevIdx] : null;
  const displayedCriteria = viewing?.criteria ?? exam.criteria;
  const displayedStrengths = viewing?.strengths ?? exam.strengths;
  const displayedImprovements = viewing?.areas_for_improvement ?? exam.areas_for_improvement;
  const displayedBand = viewing?.overall_band ?? exam.overall_band;
  const displayedScore = viewing?.overall_score ?? exam.overall_score;

  const criteria = Array.isArray(displayedCriteria)
    ? (displayedCriteria as { name: string; score: number; maxScore: number; feedback: string; confidence?: number }[])
    : [];
  const strengths = Array.isArray(displayedStrengths) ? (displayedStrengths as string[]) : [];
  const improvements = Array.isArray(displayedImprovements) ? (displayedImprovements as string[]) : [];
  const recommendations = getRecommendations(criteria, exam.level_code, 2);

  const displayName = anonymize ? mask(exam.candidate_name) : (exam.candidate_name || null);
  const displayInstitution = anonymize ? mask(exam.institution) : (exam.institution || "—");
  const displayGroup = anonymize ? mask(exam.group) : (exam.group || "—");

  const expiryNotice = (() => {
    if (!exam.audio_expires_at || audioGone) return null;
    const days = Math.max(0, Math.ceil((new Date(exam.audio_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    return days;
  })();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("exams").delete().eq("id", exam.id);
      if (error) throw error;
      toast({ title: "Report deleted" });
      queryClient.invalidateQueries({ queryKey: ["exams-reports"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAudio = async () => {
    if (!exam.audio_path) return;
    setDeletingAudio(true);
    try {
      await supabase.storage.from("exam-audio").remove([exam.audio_path]);
      const { error } = await supabase
        .from("exams")
        .update({ audio_path: null, audio_expires_at: null, words_json: null })
        .eq("id", exam.id);
      if (error) throw error;
      setAudioUrl(null);
      setAudioGone(true);
      queryClient.invalidateQueries({ queryKey: ["exams-reports"] });
      toast({ title: "Audio deleted", description: "The recording was removed; the report is kept." });
    } catch (err: any) {
      toast({ title: "Could not delete audio", description: err.message, variant: "destructive" });
    } finally {
      setDeletingAudio(false);
    }
  };

  const handleRegrade = async () => {
    if (editTranscript.trim().split(/\s+/).filter(Boolean).length < 30) {
      toast({ title: "Transcript too short", description: "Need at least 30 words to re-analyze.", variant: "destructive" });
      return;
    }
    setRegrading(true);
    try {
      // 1. Snapshot current analysis
      const snapshot = {
        regraded_at: new Date().toISOString(),
        overall_band: exam.overall_band,
        overall_score: exam.overall_score,
        criteria: exam.criteria,
        strengths: exam.strengths,
        areas_for_improvement: exam.areas_for_improvement,
        examiner_notes: exam.examiner_notes,
        transcript: exam.transcript,
      };
      const newHistory = [snapshot, ...previousAnalyses];

      // 2. Build optional examiner tag from extra observation
      const tags = extraObservation.trim()
        ? [{ atSec: 0, candidate: "?", label: extraObservation.trim() }]
        : [];

      // 3. Re-invoke analysis
      const { data, error } = await supabase.functions.invoke("analyze-exam", {
        body: {
          level: exam.level_code,
          language: langLabel[exam.language] || exam.language,
          candidateNames: exam.candidate_name ? [exam.candidate_name] : ["Candidate A"],
          transcript: editTranscript,
          examinerTags: tags,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      // analyze-exam returns { candidates: [...], examinerNotes }. Use first candidate.
      const first = (data as any).candidates?.[0];
      if (!first) throw new Error("No analysis returned.");

      const { error: updErr } = await supabase
        .from("exams")
        .update({
          overall_band: first.overallBand,
          overall_score: first.overallScore,
          criteria: first.criteria,
          strengths: first.strengths,
          areas_for_improvement: first.areasForImprovement,
          transcript: editTranscript,
          examiner_notes: editNotes,
          previous_analyses: newHistory as any,
          regrade_count: (exam.regrade_count ?? 0) + 1,
        })
        .eq("id", exam.id);
      if (updErr) throw updErr;

      toast({ title: "Re-analysis complete", description: "Previous version saved to history." });
      setRegradeOpen(false);
      setExtraObservation("");
      queryClient.invalidateQueries({ queryKey: ["exams-reports"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Re-analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setRegrading(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-xl flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          {exam.title}
          {anonymize && (
            <Badge variant="outline" className="gap-1 text-xs">
              <EyeOff className="h-3 w-3" /> Anonymized
            </Badge>
          )}
          {(exam.regrade_count ?? 0) > 0 && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" /> Re-graded {exam.regrade_count}×
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription>
          {displayName && <span className="font-medium">{displayName} · </span>}
          {displayInstitution} · {displayGroup} · {new Date(exam.created_at).toLocaleDateString()}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 mt-2">
        {viewing && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center justify-between">
            <span>Viewing previous version from {new Date(viewing.regraded_at).toLocaleString()}</span>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setViewingPrevIdx(null)}>Back to current</Button>
          </div>
        )}

        {/* Overall */}
        <div className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="font-display text-2xl font-bold">{displayedBand}</span>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overall Score</p>
            <p className="font-display text-xl font-bold">{Number(displayedScore).toFixed(1)}/5.0</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary">{exam.level_code}</Badge>
              <Badge variant="outline">{langLabel[exam.language] || exam.language}</Badge>
            </div>
          </div>
        </div>

        {/* Version history */}
        {previousAnalyses.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="history" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-display py-2 hover:no-underline">
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Version history ({previousAnalyses.length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1.5 pb-2">
                  {previousAnalyses.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs">
                      <div>
                        <span className="font-medium">{p.overall_band}</span>
                        <span className="text-muted-foreground"> · {Number(p.overall_score).toFixed(1)}/5</span>
                        <span className="text-muted-foreground ml-2">{new Date(p.regraded_at).toLocaleString()}</span>
                      </div>
                      <Button size="sm" variant={viewingPrevIdx === i ? "secondary" : "ghost"} className="h-6 text-xs" onClick={() => setViewingPrevIdx(viewingPrevIdx === i ? null : i)}>
                        {viewingPrevIdx === i ? "Hide" : "View"}
                      </Button>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Audio playback */}
        {audioUrl && !audioGone && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm flex items-center gap-1.5">
                <Volume2 className="h-4 w-4 text-primary" /> Exam Recording
              </h3>
              <div className="flex items-center gap-2">
                {expiryNotice != null && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {expiryNotice === 0 ? "Expires today" : `${expiryNotice} day${expiryNotice === 1 ? "" : "s"} left`}
                  </Badge>
                )}
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive gap-1" onClick={handleDeleteAudio} disabled={deletingAudio}>
                  <Trash2 className="h-3.5 w-3.5" /> {deletingAudio ? "Deleting…" : "Delete audio"}
                </Button>
              </div>
            </div>
            <audio ref={audioRef} controls className="w-full h-10" src={audioUrl} preload="metadata">
              Your browser does not support audio playback.
            </audio>
            {words.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Tip: click any quoted phrase below to hear it.
              </p>
            )}
          </div>
        )}

        {/* Criteria */}
        {criteria.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-sm">Assessment Criteria</h3>
            {criteria.map((c, i) => {
              const pct = (c.score / c.maxScore) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.confidence != null && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className={`text-xs gap-0.5 cursor-help ${
                              c.confidence >= 90 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                              c.confidence >= 70 ? "border-primary/30 bg-primary/10 text-primary" :
                              c.confidence >= 50 ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                              "border-destructive/30 bg-destructive/10 text-destructive"
                            }`}>
                              <Info className="h-3 w-3" /> {c.confidence}%
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-xs">
                            AI confidence in this score
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <span className={`font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-destructive"}`}>
                      {c.score}/{c.maxScore}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2 mb-1" />
                  <p className="text-xs text-muted-foreground">
                    <QuotedAudio text={c.feedback} words={words} onSeek={audioUrl && !audioGone ? seekAudio : undefined} />
                  </p>
                  {i < criteria.length - 1 && <Separator className="mt-3" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Strengths & Improvements */}
        <div className="grid gap-4 sm:grid-cols-2">
          {strengths.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-sm flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Strengths
              </h3>
              <ul className="space-y-1">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <QuotedAudio text={s} words={words} onSeek={audioUrl && !audioGone ? seekAudio : undefined} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-sm flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Areas for Improvement
              </h3>
              <ul className="space-y-1">
                {improvements.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <QuotedAudio text={a} words={words} onSeek={audioUrl && !audioGone ? seekAudio : undefined} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Examiner Notes */}
        {exam.examiner_notes && (
          <div>
            <h3 className="font-display font-semibold text-sm mb-1">Examiner Notes</h3>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{exam.examiner_notes}</p>
          </div>
        )}

        {/* Transcript */}
        {exam.transcript && (
          <div>
            <h3 className="font-display font-semibold text-sm mb-1">Transcript</h3>
            <SpeakerTranscript transcript={exam.transcript} hidden={anonymize} maxHeight="12rem" words={words} />
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div>
            <h3 className="font-display font-semibold text-sm flex items-center gap-1.5 mb-2">
              <BookOpen className="h-4 w-4 text-primary" /> Recommended Practice
            </h3>
            {recommendations.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 mb-1.5 text-xs transition-colors hover:bg-muted/40">
                <div>
                  <p className="font-medium">{link.title}</p>
                  <p className="text-muted-foreground">{link.source} · {link.skill} · {link.level}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}

        {/* Export + Delete */}
        <div className="flex justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. The assessment report will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleting ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" size="sm" onClick={() => { setEditTranscript(exam.transcript ?? ""); setEditNotes(exam.examiner_notes ?? ""); setRegradeOpen(true); }} className="gap-2" disabled={viewing != null}>
              <RefreshCw className="h-4 w-4" /> Re-analyze
            </Button>
            <Button variant="outline" size="sm" onClick={() => generateReportPdf({
              title: exam.title,
              candidateName: anonymize ? "Anonymous" : (exam.candidate_name || ""),
              institution: anonymize ? "Anonymous" : (exam.institution || ""),
              group: anonymize ? "" : (exam.group || ""),
              levelCode: exam.level_code,
              language: exam.language,
              overallBand: Number.isNaN(Number(displayedScore)) ? exam.overall_band : String(displayedBand),
              overallScore: Number(displayedScore),
              criteria,
              strengths,
              areasForImprovement: improvements,
              examinerNotes: exam.examiner_notes || "",
              transcript: anonymize ? "[Anonymized]" : (exam.transcript || ""),
              date: new Date(exam.created_at).toLocaleDateString(),
            })} className="gap-2">
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateStudentPdf({
                title: exam.title,
                candidateName: anonymize ? "Student" : (exam.candidate_name || "Student"),
                levelCode: exam.level_code,
                language: langLabel[exam.language] || exam.language,
                overallBand: String(displayedBand),
                overallScore: Number(displayedScore),
                criteria,
                strengths,
                areasForImprovement: improvements,
                date: new Date(exam.created_at).toLocaleDateString(),
                practice: recommendations.map((r) => ({ title: r.title, url: r.url })),
              })}
              className="gap-2"
            >
              <GraduationCap className="h-4 w-4" /> Student PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>
      </div>

      {/* Re-analyze dialog */}
      <Dialog open={regradeOpen} onOpenChange={setRegradeOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" /> Re-analyze Exam
            </DialogTitle>
            <DialogDescription>
              Edit the transcript, add notes or extra observations, then run the AI again. The current scores will be saved to version history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="rg-transcript" className="text-xs">Transcript</Label>
              <Textarea id="rg-transcript" value={editTranscript} onChange={(e) => setEditTranscript(e.target.value)} className="min-h-[180px] font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-notes" className="text-xs">Examiner notes</Label>
              <Textarea id="rg-notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="min-h-[60px] text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-extra" className="text-xs">Additional observation (optional)</Label>
              <Textarea id="rg-extra" value={extraObservation} onChange={(e) => setExtraObservation(e.target.value)} placeholder="e.g. Candidate was very nervous in the first minute and self-corrected several times" className="min-h-[50px] text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegradeOpen(false)} disabled={regrading}>Cancel</Button>
            <Button onClick={handleRegrade} disabled={regrading} className="gap-2">
              {regrading ? <><Loader2 className="h-4 w-4 animate-spin" /> Re-analyzing…</> : <><RefreshCw className="h-4 w-4" /> Run analysis</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DialogContent>
  );
}
