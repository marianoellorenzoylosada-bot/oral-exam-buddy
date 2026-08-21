import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  RefreshCw, History, Loader2, Share2, MessageCircle, Mail, Copy, FileText, Users,

} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getRecommendations } from "@/lib/practiceData";
import { generateReportPdf } from "@/lib/generateReportPdf";
import { generateStudentPdf } from "@/lib/generateStudentPdf";
import { TeacherPartsSection } from "@/components/TeacherPartsSection";
import { buildTeacherReportModel } from "@/lib/teacherReportModel";
import type { PartFeedback } from "@/lib/partFeedback";
import { useToast } from "@/hooks/use-toast";
import { useRoles } from "@/hooks/useRoles";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { SpeakerTranscript } from "@/components/SpeakerTranscript";
import { SpeakerReviewPanel } from "@/components/SpeakerReviewPanel";
import { QuotedAudio, type ScribeWord } from "@/components/QuotedAudio";
import { computeWeightedSpeakingScore } from "@/lib/speakingScore";
import { createShareablePdfLink, buildShareMessage, openWhatsAppShare, openEmailShare } from "@/lib/shareReport";



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
  speaker_map?: any;
  split_points?: any;
  speaker_overrides?: any;
  part_feedback?: any;
  overall_summary?: string | null;
  confirmed_at?: string | null;
  revision?: number | null;
  revision_reason?: string | null;
  user_id?: string | null;
  phase_marks?: any;
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
  const { isSenior } = useRoles();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");
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
  const [correctionReason, setCorrectionReason] = useState("");
  const [viewingPrevIdx, setViewingPrevIdx] = useState<number | null>(null);

  // Share state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareType, setShareType] = useState<"teacher" | "student" | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [shareLoading, setShareLoading] = useState(false);



  const previousAnalyses: any[] = Array.isArray(exam.previous_analyses) ? exam.previous_analyses : [];

  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [fixSpeakersOpen, setFixSpeakersOpen] = useState(false);
  const [correctedSpeakers, setCorrectedSpeakers] = useState<
    { map: any; splitPoints: number[]; overrides: Record<number, string> } | null
  >(null);

  useEffect(() => {
    const path = exam.audio_path ?? `${exam.id}.wav`;
    supabase.storage
      .from("exam-audio")
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!error && data?.signedUrl) setAudioUrl(data.signedUrl);
        else setAudioUnavailable(true);
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
  const displayedPartFeedback: PartFeedback[] | undefined =
    (viewing?.part_feedback ?? exam.part_feedback) as PartFeedback[] | undefined;
  const displayedOverallSummary: string | undefined =
    (viewing?.overall_summary ?? exam.overall_summary) as string | undefined;

  const criteria = Array.isArray(displayedCriteria)
    ? (displayedCriteria as { name: string; score: number; maxScore: number; feedback: string; confidence?: number }[])
    : [];
  const strengths = Array.isArray(displayedStrengths) ? (displayedStrengths as string[]) : [];
  const improvements = Array.isArray(displayedImprovements) ? (displayedImprovements as string[]) : [];
  const recommendations = getRecommendations(criteria, exam.level_code, 3, improvements);

  const displayName = anonymize ? mask(exam.candidate_name) : (exam.candidate_name || null);
  const displayInstitution = anonymize ? mask(exam.institution) : (exam.institution || "—");
  const displayGroup = anonymize ? mask(exam.group) : (exam.group || "—");

  const teacherPdfData = {
    title: exam.title,
    candidateName: anonymize ? "Anonymous" : (exam.candidate_name || ""),
    institution: anonymize ? "Anonymous" : (exam.institution || ""),
    group: anonymize ? "" : (exam.group || ""),
    levelCode: exam.level_code,
    language: exam.language,
    overallBand: String(displayedBand),
    overallScore: Number(displayedScore),
    criteria,
    strengths,
    areasForImprovement: improvements,
    examinerNotes: exam.examiner_notes || "",
    transcript: anonymize ? "[Anonymized]" : (exam.transcript || ""),
    date: new Date(exam.created_at).toLocaleDateString(),
    partFeedback: Array.isArray(displayedPartFeedback) ? (displayedPartFeedback as PartFeedback[]) : undefined,
    overallSummary: displayedOverallSummary,
  };

  // Single source of truth: the on-screen report and the teacher PDF are both
  // rendered from this model, so they can never show different content.
  const teacherModel = buildTeacherReportModel(teacherPdfData);


  const studentPdfData = {
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
    partFeedback: Array.isArray(displayedPartFeedback) ? (displayedPartFeedback as PartFeedback[]) : undefined,
    overallSummary: displayedOverallSummary,
  };


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

  const [generatingParts, setGeneratingParts] = useState(false);

  /**
   * Repair path: some analyses came back without the per-part breakdown.
   * This re-asks the model for THIS candidate only and stores just the
   * per-part commentary — bands, scores and criteria are left untouched.
   */
  const handleGeneratePartFeedback = async () => {
    setGeneratingParts(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-exam", {
        body: {
          level: exam.level_code,
          language: langLabel[exam.language] || exam.language,
          candidateNames: [exam.candidate_name],
          transcript: exam.transcript,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const first = (data as any).candidates?.[0] ?? data;
      const parts = Array.isArray(first?.partFeedback) ? first.partFeedback : [];
      if (parts.length === 0) throw new Error("The model did not return a per-part breakdown. Please try again.");
      const summary =
        exam.overall_summary ?? (typeof first?.overallSummary === "string" ? first.overallSummary : null);
      if (exam.confirmed_at) {
        // Confirmed reports are frozen: this repair path only fills the empty
        // per-part commentary, never bands, scores or criteria.
        const { data: filled, error: rpcErr } = await supabase.rpc("fill_missing_part_feedback", {
          _exam_id: exam.id,
          _part_feedback: parts as any,
          _overall_summary: summary,
        });
        if (rpcErr) throw rpcErr;
        if (!filled) throw new Error("This report already has per-part commentary.");
      } else {
        const { error: updErr } = await supabase
          .from("exams")
          .update({ part_feedback: parts as any, overall_summary: summary })
          .eq("id", exam.id);
        if (updErr) throw updErr;
      }
      queryClient.invalidateQueries({ queryKey: ["exams-reports"] });
      toast({ title: "Per-part commentary added", description: "The bands and scores were not changed." });
    } catch (err: any) {
      toast({ title: "Could not generate the commentary", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingParts(false);
    }
  };


  const handleRegrade = async () => {
    if (editTranscript.trim().split(/\s+/).filter(Boolean).length < 30) {
      toast({ title: "Transcript too short", description: "Need at least 30 words to re-analyze.", variant: "destructive" });
      return;
    }
    if (exam.confirmed_at && !correctionReason.trim()) {
      toast({ title: "Correction reason required", description: "Please explain why you are creating a new version of a confirmed report.", variant: "destructive" });
      return;
    }
    setRegrading(true);
    try {
      // Build optional examiner tag from extra observation
      const tags = extraObservation.trim()
        ? [{ atSec: 0, candidate: "?", label: extraObservation.trim() }]
        : [];

      // Re-invoke analysis
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

      const first = (data as any).candidates?.[0];
      if (!first) throw new Error("No analysis returned.");

      if (exam.confirmed_at) {
        // Confirmed reports are frozen: create a new revision instead of editing.
        const revisionNote = `Corrected version of ${exam.title} (${exam.id}).\nReason: ${correctionReason.trim()}${extraObservation.trim() ? "\nObservation: " + extraObservation.trim() : ""}`;
        const { error: insertErr } = await supabase.from("exams").insert({
          title: exam.title,
          level_code: exam.level_code,
          language: exam.language,
          institution: exam.institution,
          group: exam.group,
          candidate_name: exam.candidate_name,
          candidates: exam.candidates,
          overall_band: first.overallBand,
          overall_score: first.overallScore,
          criteria: first.criteria,
          strengths: first.strengths,
          areas_for_improvement: first.areasForImprovement,
          transcript: editTranscript,
          examiner_notes: editNotes + "\n\n--- Correction ---\n" + revisionNote,
          status: "completed",
          user_id: exam.user_id,
          words_json: exam.words_json,
          phase_marks: exam.phase_marks,
          audio_path: exam.audio_path,
          audio_expires_at: exam.audio_expires_at,
          part_feedback: Array.isArray(first.partFeedback) && first.partFeedback.length > 0 ? (first.partFeedback as any) : null,
          overall_summary: typeof first.overallSummary === "string" ? first.overallSummary : null,
          revision: (exam.revision ?? 0) + 1,
          revision_reason: correctionReason.trim(),
          speaker_map: (correctedSpeakers?.map ?? exam.speaker_map ?? null) as any,
          split_points: (correctedSpeakers?.splitPoints ?? exam.split_points ?? []) as any,
          speaker_overrides: (correctedSpeakers?.overrides ?? exam.speaker_overrides ?? {}) as any,
        });
        if (insertErr) throw insertErr;
        toast({ title: "Corrected version created", description: "The original report remains unchanged and the new version is in your records." });
      } else {
        // Unconfirmed reports can be updated in place.
        const snapshot = {
          regraded_at: new Date().toISOString(),
          overall_band: exam.overall_band,
          overall_score: exam.overall_score,
          criteria: exam.criteria,
          strengths: exam.strengths,
          areas_for_improvement: exam.areas_for_improvement,
          examiner_notes: exam.examiner_notes,
          transcript: exam.transcript,
          part_feedback: exam.part_feedback ?? null,
          overall_summary: exam.overall_summary ?? null,
        };
        const newHistory = [snapshot, ...previousAnalyses];
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
            part_feedback: Array.isArray(first.partFeedback) && first.partFeedback.length > 0
              ? (first.partFeedback as any)
              : null,
            overall_summary: typeof first.overallSummary === "string" ? first.overallSummary : null,
            ...(correctedSpeakers
              ? {
                  speaker_map: correctedSpeakers.map as any,
                  split_points: correctedSpeakers.splitPoints as any,
                  speaker_overrides: correctedSpeakers.overrides as any,
                }
              : {}),
          })
          .eq("id", exam.id);
        if (updErr) throw updErr;
        toast({ title: "Re-analysis complete", description: "Previous version saved to history." });
      }

      setRegradeOpen(false);
      setCorrectedSpeakers(null);
      setExtraObservation("");
      setCorrectionReason("");
      queryClient.invalidateQueries({ queryKey: ["exams-reports"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Re-analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setRegrading(false);
    }
  };


  // Approve current scores as a senior calibration reference.
  // Uses the earliest AI-produced criteria (from previous_analyses) as
  // `original_gold` when available; otherwise the current criteria.
  const handleApproveCalibration = async () => {
    if (!user) return;
    if (!exam.transcript || exam.transcript.trim().split(/\s+/).filter(Boolean).length < 30) {
      toast({ title: "Transcript too short", description: "Need at least 30 words to approve.", variant: "destructive" });
      return;
    }
    setApproving(true);
    try {
      const firstAnalysis = previousAnalyses[previousAnalyses.length - 1];
      const original: any[] = Array.isArray(firstAnalysis?.criteria) ? firstAnalysis.criteria : (Array.isArray(exam.criteria) ? exam.criteria : []);
      const current: any[] = Array.isArray(exam.criteria) ? exam.criteria : [];
      const scoreDiff = current.map((c) => {
        const o = original.find((x) => x?.name === c.name);
        return {
          name: c.name,
          original: typeof o?.score === "number" ? o.score : null,
          senior: typeof c.score === "number" ? c.score : null,
          delta: (typeof o?.score === "number" && typeof c.score === "number") ? Math.round((c.score - o.score) * 10) / 10 : null,
        };
      });
      const { error } = await supabase.from("calibration_examples").insert({
        case_id: exam.id,
        level: exam.level_code,
        task_type: "",
        transcript: exam.transcript,
        original_gold: original as any,
        senior_corrections: current as any,
        score_differences: scoreDiff as any,
        rationale_differences: [] as any,
        senior_notes: approveNotes.trim(),
        examiner_id: user.id,
      });
      if (error) throw error;
      toast({ title: "Calibration reference approved", description: "Future analyses at this level will use it as an anchor." });
      setApproveOpen(false);
      setApproveNotes("");
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const handleShare = async (type: "teacher" | "student") => {
    if (!user) {
      toast({ title: "Sign in required", description: "You must be signed in to share a report.", variant: "destructive" });
      return;
    }
    setShareType(type);
    setShareLoading(true);
    setShareLink("");
    try {
      const link = await createShareablePdfLink({
        type,
        userId: user.id,
        fileNamePrefix: exam.title || exam.id,
        pdfData: type === "teacher" ? teacherPdfData : studentPdfData,
      });
      setShareLink(link);
    } catch (err: any) {
      toast({ title: "Could not create share link", description: err.message, variant: "destructive" });
      setShareOpen(false);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast({ title: "Link copied", description: "Paste it into any chat or email." });
  };

  const handleWhatsAppShare = () => {
    const candidateName = anonymize ? "the candidate" : (exam.candidate_name || "the candidate");
    openWhatsAppShare(buildShareMessage(candidateName, shareLink));
  };

  const handleEmailShare = () => {
    const candidateName = anonymize ? "the candidate" : (exam.candidate_name || "the candidate");
    const subject = `Speaking assessment report — ${exam.title}`;
    openEmailShare(subject, buildShareMessage(candidateName, shareLink));
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
          {exam.confirmed_at && (
            <Badge variant="outline" className="gap-1 text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Confirmed
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

        {/* Overall (deterministic, weighted) */}
        {(() => {
          const weighted = computeWeightedSpeakingScore(criteria, exam.level_code);
          return (
            <div className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <span className="font-display text-lg font-bold tabular-nums">
                  {weighted.raw}<span className="text-sm opacity-80">/{weighted.max}</span>
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Weighted Speaking Score</p>
                <p className="font-display text-base font-bold">{weighted.approxLevel}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant="secondary">{exam.level_code}</Badge>
                  <Badge variant="outline">{langLabel[exam.language] || exam.language}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Diagnostic estimate based on weighted criterion scores. Not an official exam result.
                  {!weighted.isOfficial && " Weighting for this level is a temporary equal-weight fallback pending official review."}
                </p>
              </div>
            </div>
          );
        })()}

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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-display font-semibold text-sm flex items-center gap-1.5">
                <Volume2 className="h-4 w-4 text-primary" /> Exam Recording
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {expiryNotice != null && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {expiryNotice === 0 ? "Expires today" : `${expiryNotice} day${expiryNotice === 1 ? "" : "s"} left`}
                  </Badge>
                )}
                <Button asChild size="sm" variant="ghost" className="gap-1 text-muted-foreground hover:text-foreground">
                  <a href={audioUrl} download={`${exam.title || exam.id}.wav`}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </Button>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive gap-1" onClick={handleDeleteAudio} disabled={deletingAudio}>
                  <Trash2 className="h-3.5 w-3.5" /> {deletingAudio ? "Deleting…" : "Delete audio"}
                </Button>
              </div>
            </div>
            <audio
              ref={audioRef}
              controls
              className="w-full h-10"
              src={audioUrl}
              preload="metadata"
              onTimeUpdate={(e) => setAudioTime((e.target as HTMLAudioElement).currentTime)}
            >
              Your browser does not support audio playback.
            </audio>

            {words.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Tip: click any quoted phrase below — or any utterance timestamp — to hear it.
              </p>
            )}
          </div>
        )}

        {/* Audio unavailable / expired state */}
        {!audioUrl && (audioGone || audioUnavailable) && (
          <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
            <Volume2 className="h-4 w-4 shrink-0" />
            {audioGone
              ? "Audio was deleted for this report. Speaker mapping and click-to-play are unavailable."
              : "Audio is no longer available (expired or removed from storage). Re-analysis from audio is not possible."}
          </div>
        )}



        {/* Marks — compact table. The narrative lives inside each exam part below. */}
        {criteria.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-sm">
              {teacherModel.criteriaOnly ? "Assessment Criteria" : "Marks"}
            </h3>
            {criteria.map((c, i) => {
              const pct = (c.score / c.maxScore) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {/* AI confidence is an auditing signal: shown in the Draft only. */}
                    </div>

                    <span className={`font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-destructive"}`}>
                      {c.score}/{c.maxScore}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2 mb-1" />
                  {teacherModel.criteriaOnly && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        <QuotedAudio text={c.feedback} words={words} onSeek={audioUrl && !audioGone ? seekAudio : undefined} />
                      </p>
                      {i < criteria.length - 1 && <Separator className="mt-3" />}
                    </>
                  )}
                </div>
              );
            })}
            {isSenior && !viewing && (
              <div className="pt-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setApproveOpen(true)}>
                  <GraduationCap className="h-3.5 w-3.5" />
                  Approve as calibration reference
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save the current scores as an anchor. Future analyses at {exam.level_code} will use it to calibrate.
                </p>
              </div>
            )}
          </div>
        )}


        <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Approve calibration reference</DialogTitle>
              <DialogDescription>
                The current transcript and criterion scores will be saved as an anchor for level {exam.level_code}.
                Future AI analyses at this level will use it to align scoring with your judgment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Why this performance anchors the level (e.g. borderline B2/C1; strong DM despite pronunciation slips)…"
                  className="min-h-[80px] text-sm mt-1"
                />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <div className="font-medium mb-1">Scores being anchored</div>
                <ul className="space-y-0.5">
                  {criteria.map((c) => (
                    <li key={c.name} className="flex justify-between">
                      <span>{c.name}</span>
                      <span className="font-mono">{c.score}/{c.maxScore}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setApproveOpen(false)} disabled={approving}>Cancel</Button>
              <Button onClick={handleApproveCalibration} disabled={approving}>
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Part → relevant criteria → evidence (same model as the teacher PDF). */}
        {!teacherModel.criteriaOnly || teacherModel.overallSummary ? (
          <TeacherPartsSection
            model={teacherModel}
            words={words}
            onSeek={audioUrl && !audioGone ? seekAudio : undefined}
          />
        ) : (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              This report has no per-part commentary. It can be generated from the stored transcript
              without changing the bands already awarded.
            </p>
            {exam.confirmed_at && (
              <p className="text-xs text-muted-foreground">
                The report stays frozen: only the missing per-part commentary and overall summary are added.
              </p>
            )}
            <Button size="sm" variant="outline" onClick={handleGeneratePartFeedback} disabled={generatingParts} className="gap-1.5">
              {generatingParts ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Generate per-part commentary
            </Button>
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

        {/* Full transcript — collapsible, at the end of the report. */}
        {exam.transcript && (
          <Accordion type="single" collapsible>
            <AccordionItem value="transcript" className="border rounded-lg px-3">
              <AccordionTrigger className="text-sm font-display py-2 hover:no-underline">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Full transcript
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-2">
                  <SpeakerTranscript
                    transcript={exam.transcript}
                    hidden={anonymize}
                    maxHeight="20rem"
                    words={words}
                    onSeek={audioUrl && !audioGone ? seekAudio : undefined}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Correct script attribution (needs the diarized word timeline). */}
        {words.length > 0 && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-display font-semibold">Script attribution</p>
                <p className="text-xs text-muted-foreground">
                  If a turn mixes two voices or is assigned to the wrong speaker, fix it here and
                  re-analyze with the corrected script.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setFixSpeakersOpen((v) => !v)} className="gap-2">
                <Users className="h-4 w-4" /> {fixSpeakersOpen ? "Hide" : "Correct attribution"}
              </Button>
            </div>
            {fixSpeakersOpen && (
              <SpeakerReviewPanel
                words={words}
                initialMap={exam.speaker_map ?? null}
                suggestedMap={exam.speaker_map ?? null}
                initialSplitPoints={(exam.split_points ?? null) as any}
                initialOverrides={(exam.speaker_overrides ?? null) as any}
                onSeek={audioUrl && !audioGone ? seekAudio : undefined}
                onConfirm={(map, transcript, edits) => {
                  setEditTranscript(transcript);
                  setEditNotes(exam.examiner_notes ?? "");
                  setCorrectedSpeakers({ map, ...edits });
                  setFixSpeakersOpen(false);
                  setRegradeOpen(true);
                  toast({
                    title: "Corrected script ready",
                    description: "Review the reason and run the analysis to apply it.",
                  });
                }}
              />
            )}
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
              <RefreshCw className="h-4 w-4" /> {exam.confirmed_at ? "Corrected version" : "Re-analyze"}
            </Button>

            <Button variant="outline" size="sm" onClick={() => generateReportPdf(teacherPdfData)} className="gap-2">
              <Download className="h-4 w-4" /> PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateStudentPdf(studentPdfData)}
              className="gap-2"
            >
              <GraduationCap className="h-4 w-4" /> Student PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => generateReportPdf({ ...teacherPdfData, output: "print" })} className="gap-2">
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} className="gap-2">
              <Share2 className="h-4 w-4" /> Share
            </Button>
          </div>
        </div>
      </div>


      {/* Re-analyze dialog */}
      <Dialog open={regradeOpen} onOpenChange={setRegradeOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" /> {exam.confirmed_at ? "Create corrected version" : "Re-analyze Exam"}
            </DialogTitle>
            <DialogDescription>
              {exam.confirmed_at
                ? "This report is confirmed and frozen. You can create a new corrected version; the original will remain unchanged."
                : "Edit the transcript, add notes or extra observations, then run the AI again. The current scores will be saved to version history."}
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
            {exam.confirmed_at && (
              <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <Label htmlFor="rg-reason" className="text-xs text-amber-700 dark:text-amber-400">Reason for correction *</Label>
                <Textarea id="rg-reason" value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} placeholder="e.g. I noticed I missed a candidate turn, so the Interaction score was too low." className="min-h-[50px] text-xs bg-background" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400">A reason is required to create a new version of a confirmed report.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegradeOpen(false)} disabled={regrading}>Cancel</Button>
            <Button onClick={handleRegrade} disabled={regrading} className="gap-2">
              {regrading ? <><Loader2 className="h-4 w-4 animate-spin" /> Re-analyzing…</> : <><RefreshCw className="h-4 w-4" /> {exam.confirmed_at ? "Create corrected version" : "Run analysis"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share report dialog */}
      <Dialog open={shareOpen} onOpenChange={(open) => {
        setShareOpen(open);
        if (!open) {
          setShareType(null);
          setShareLink("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" /> Share report
            </DialogTitle>
            <DialogDescription>
              The PDF is uploaded to a temporary link (valid for 7 days) so you can send it by WhatsApp or email.
            </DialogDescription>
          </DialogHeader>

          {!shareType ? (
            <div className="grid grid-cols-2 gap-3 py-2">
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => handleShare("teacher")}>
                <FileText className="h-6 w-6" />
                <span className="text-xs">Teacher PDF</span>
              </Button>
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => handleShare("student")}>
                <GraduationCap className="h-6 w-6" />
                <span className="text-xs">Student PDF</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {shareLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating secure link…
                </div>
              ) : shareLink ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Secure link</Label>
                    <div className="flex gap-2">
                      <Input value={shareLink} readOnly className="text-xs" />
                      <Button size="icon" variant="outline" onClick={handleCopyLink}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Valid for 7 days. Anyone with the link can download the PDF.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="gap-2" onClick={handleWhatsAppShare}>
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={handleEmailShare}>
                      <Mail className="h-4 w-4" /> Email
                    </Button>
                  </div>
                </>
              ) : null}
              <Button variant="ghost" className="w-full text-xs" onClick={() => { setShareType(null); setShareLink(""); }}>
                Back
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </DialogContent>
  );
}

