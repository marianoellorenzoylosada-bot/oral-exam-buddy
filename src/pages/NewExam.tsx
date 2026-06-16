import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Pause, Play, Upload, FileText, BookOpen, Trash2, Clock, Users, ExternalLink, Info, Loader2, AlertCircle, Plus, X, WifiOff, ShieldCheck } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useExamStore } from "@/hooks/useExamStore";

import { DraftReport, type MultiCandidateResult } from "@/components/DraftReport";
import { extractTextFromFile } from "@/lib/extractText";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LiveTranscript } from "@/components/LiveTranscript";
import { PhaseTimer, type PhaseMark } from "@/components/PhaseTimer";
import { MicCheck } from "@/components/MicCheck";
import { QuickTags, type QuickTag } from "@/components/QuickTags";
import { transcribeBlob, type ScribeWord } from "@/lib/transcribe";
import { labelTranscriptFromWords, hasClearSpeakerLabels } from "@/lib/labelTranscript";
import { checkAudioSize, checkAudioDuration, checkContextSize } from "@/lib/uploadGuards";
import { GroupPicker } from "@/components/GroupPicker";
import { CandidatePicker } from "@/components/CandidatePicker";
import { SUPPORTED_LANGUAGES, getExamLevels } from "@/lib/examLevels";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { saveDraft, loadDraft, clearDraft } from "@/lib/examDraftDb";
import { applySpeakerMap, speakerStats, type SpeakerMap, type SpeakerRole } from "@/lib/applySpeakerMap";

const LANGUAGES = SUPPORTED_LANGUAGES;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function FileDropZone({ label, icon: Icon, file, extractedText, onFile, onClear, accept, hint }: {
  label: string; icon: React.ElementType; file: File | null; extractedText?: string;
  onFile: (f: File) => void; onClear: () => void; accept: string; hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    setExtracting(true);
    onFile(f);
    setExtracting(false);
  }, [onFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  return (
    <div
      className="relative flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-accent hover:bg-muted/30"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      role="group"
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      {file ? (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
            <Icon className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="font-medium text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          {extractedText && (
            <Badge variant="secondary" className="gap-1">
              <FileText className="h-3 w-3" /> Text extracted ({extractedText.length.toLocaleString()} chars)
            </Badge>
          )}
          {extracting && (
            <Badge variant="outline" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Extracting…
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClear(); }}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
        </>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">{hint ?? "PDF, DOCX, TXT or photo · OCR is applied to images"}</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1" /> Choose file
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()} className="sm:hidden">
              📷 Take photo
            </Button>
          </div>
        </>
      )}
    </div>
  );
}


export default function NewExamPage() {
  const { exam, update, reset } = useExamStore();
  const recorder = useAudioRecorder();
  const { toast } = useToast();
  const online = useOnlineStatus();
  const [activeTab, setActiveTab] = useState("setup");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingStep, setAnalyzingStep] = useState<"" | "transcribing" | "scoring">("");
  const [report, setReport] = useState<MultiCandidateResult | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [scribeWords, setScribeWords] = useState<ScribeWord[]>([]);
  const [phaseMarks, setPhaseMarks] = useState<PhaseMark[]>([]);
  const [quickTags, setQuickTags] = useState<QuickTag[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  // Pre-AI speaker review
  const [reviewStage, setReviewStage] = useState<"idle" | "awaiting">("idle");
  const [pendingTranscript, setPendingTranscript] = useState<string>("");
  const [pendingWords, setPendingWords] = useState<ScribeWord[]>([]);
  const [speakerMap, setSpeakerMap] = useState<SpeakerMap>({});
  // Offline support: blob restored from a previous session
  const [restoredBlob, setRestoredBlob] = useState<Blob | null>(null);
  const [restoredDuration, setRestoredDuration] = useState<number>(0);
  const [pendingAnalysis, setPendingAnalysis] = useState(false);
  const [examNotes, setExamNotes] = useState("");
  const draftRestoredRef = useRef(false);


  const examLevels = getExamLevels(exam.language);
  const selectedLevel = examLevels.find(l => l.value === exam.title);
  const selectedLang = LANGUAGES.find(l => l.value === exam.language);

  const audioBlobForSubmit = recorder.audioBlob ?? restoredBlob;

  const handleFileUpload = useCallback(async (file: File, type: "booklet" | "rubric") => {
    const text = await extractTextFromFile(file);
    if (type === "booklet") {
      update({ bookletFile: file, bookletText: text });
    } else {
      update({ rubricFile: file, rubricText: text });
    }
    toast({ title: "Text extracted", description: `Content extracted from ${file.name}` });
  }, [update, toast]);

  const updateCandidateName = (index: number, value: string) => {
    const names = [...exam.candidateNames];
    names[index] = value;
    update({ candidateNames: names });
  };

  const addCandidate = () => {
    if (exam.candidateNames.length < 3) {
      update({ candidateNames: [...exam.candidateNames, ""] });
    }
  };

  const removeCandidate = () => {
    if (exam.candidateNames.length > 2) {
      update({ candidateNames: exam.candidateNames.slice(0, -1) });
    }
  };


  // Run AI scoring against a (possibly speaker-corrected) transcript.
  const runScoring = useCallback(async (
    blob: Blob,
    dur: number,
    transcriptText: string,
    words: ScribeWord[],
  ) => {
    setAnalyzing(true);
    setAnalyzingStep("scoring");
    try {
      // Build typed Exam Context payload (Layer 1 in analyze-exam priority).
      // The legacy bookletText / rubricText still flow through for backwards compatibility.
      const examContext: Array<{ kind: string; title: string; text: string }> = [];
      if (exam.bookletText?.trim()) {
        examContext.push({ kind: "candidate_prompt", title: exam.bookletFile?.name ?? "Candidate prompt / booklet", text: exam.bookletText });
      }
      if (exam.rubricText?.trim()) {
        examContext.push({ kind: "examiner_script", title: exam.rubricFile?.name ?? "Examiner script", text: exam.rubricText });
      }
      if (examNotes.trim()) {
        examContext.push({ kind: "notes", title: "Mock-specific notes", text: examNotes.trim() });
      }
      const { data, error } = await supabase.functions.invoke("analyze-exam", {
        body: {
          level: exam.title,
          language: selectedLang?.label ?? "English",
          candidateNames: exam.candidateNames,
          bookletText: exam.bookletText,
          rubricText: exam.rubricText,
          transcript: transcriptText,
          examinerTags: quickTags,
          examContext,
        },
      });


      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const aiTranscript = (data as any)?.transcript as string | undefined;
      // If the examiner already corrected speakers, prefer that transcript verbatim.
      const displayTranscript = transcriptText.includes(":")
        ? transcriptText
        : aiTranscript && hasClearSpeakerLabels(aiTranscript)
          ? aiTranscript
          : labelTranscriptFromWords(transcriptText, words);
      const enriched = { ...(data as MultiCandidateResult), transcript: displayTranscript };
      setReport(enriched);
      setReviewStage("idle");
      setPendingAnalysis(false);
      clearDraft().catch(() => undefined);
    } catch (err: any) {
      console.error("Scoring error:", err);
      setPendingAnalysis(true);
      try {
        await saveDraft({
          pendingAnalysis: true,
          title: exam.title, language: exam.language, institution: exam.institution,
          group: exam.group, candidateNames: exam.candidateNames,
          bookletText: exam.bookletText, rubricText: exam.rubricText,
          audioBlob: blob, duration: dur,
          liveTranscript, scribeWords: words, phaseMarks, quickTags,
        });
      } catch { /* ignore */ }
      toast({
        title: "Analysis failed",
        description: err.message || "Could not score the exam. Your recording is saved — you can retry submission.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
      setAnalyzingStep("");
    }
  }, [exam, selectedLang, quickTags, liveTranscript, phaseMarks, toast, examNotes]);

  const handleSubmitForAnalysis = useCallback(async () => {
    const blob = recorder.audioBlob ?? restoredBlob;
    const dur = recorder.audioBlob ? recorder.duration : restoredDuration;
    if (!blob) return;
    if (!exam.title) {
      toast({ title: "Missing exam level", description: "Please select a CEFR level in the Setup tab.", variant: "destructive" });
      return;
    }

    // Offline guard — defer the analysis and let the auto-retry effect run it later.
    if (!navigator.onLine) {
      setPendingAnalysis(true);
      try {
        await saveDraft({
          pendingAnalysis: true,
          title: exam.title, language: exam.language, institution: exam.institution,
          group: exam.group, candidateNames: exam.candidateNames,
          bookletText: exam.bookletText, rubricText: exam.rubricText,
          audioBlob: blob, duration: dur,
          liveTranscript, scribeWords, phaseMarks, quickTags,
        });
      } catch { /* ignore */ }
      toast({ title: "You're offline", description: "Analysis is queued and will run automatically when you reconnect." });
      return;
    }

    // Pre-flight guards
    const sizeCheck = checkAudioSize(blob);
    if (!sizeCheck.ok) {
      toast({ title: "Recording too large", description: sizeCheck.reason, variant: "destructive" });
      return;
    }
    const durCheck = checkAudioDuration(dur);
    if (!durCheck.ok) {
      toast({ title: "Recording too long", description: durCheck.reason, variant: "destructive" });
      return;
    }
    const ctxCheck = checkContextSize(exam.bookletText ?? "", exam.rubricText ?? "");
    if (!ctxCheck.ok) {
      toast({ title: "Reference text too long", description: ctxCheck.reason, variant: "destructive" });
      return;
    }

    setAnalyzing(true);
    try {
      // Step 1: ALWAYS re-transcribe the full uploaded audio for final scoring.
      setAnalyzingStep("transcribing");
      const out = await transcribeBlob(blob);
      const transcriptText = out.transcript;
      setScribeWords(out.words);

      if (transcriptText.split(/\s+/).filter(Boolean).length < 30) {
        throw new Error("Not enough speech detected. Please record again with the candidates speaking clearly.");
      }

      // Step 2: If we have diarized speakers, open the Pre-AI review step.
      const stats = speakerStats(out.words);
      if (stats.length >= 2) {
        // Pre-fill a heuristic map: longest-speaking voice = Examiner, then A, B, C.
        const byShare = [...stats].sort((a, b) => b.totalSeconds - a.totalSeconds);
        const roles: SpeakerRole[] = ["Examiner", "Candidate A", "Candidate B", "Candidate C"];
        const suggested: SpeakerMap = {};
        byShare.forEach((s, i) => { suggested[s.id] = roles[i] ?? "Speaker unclear"; });
        setPendingTranscript(transcriptText);
        setPendingWords(out.words);
        setSpeakerMap(suggested);
        setReviewStage("awaiting");
        setAnalyzing(false);
        setAnalyzingStep("");
        return;
      }

      // No diarization → fall through to scoring directly (legacy path).
      await runScoring(blob, dur, transcriptText, out.words);
    } catch (err: any) {
      console.error("Transcription error:", err);
      setPendingAnalysis(true);
      try {
        await saveDraft({
          pendingAnalysis: true,
          title: exam.title, language: exam.language, institution: exam.institution,
          group: exam.group, candidateNames: exam.candidateNames,
          bookletText: exam.bookletText, rubricText: exam.rubricText,
          audioBlob: blob, duration: dur,
          liveTranscript, scribeWords, phaseMarks, quickTags,
        });
      } catch { /* ignore */ }
      toast({
        title: "Analysis failed",
        description: err.message || "Could not process the exam. Your recording is saved — you can retry submission.",
        variant: "destructive",
      });
      setAnalyzing(false);
      setAnalyzingStep("");
    }
  }, [recorder.audioBlob, recorder.duration, restoredBlob, restoredDuration, exam, toast, liveTranscript, scribeWords, quickTags, phaseMarks, runScoring]);

  const confirmReviewAndScore = useCallback(async () => {
    const blob = recorder.audioBlob ?? restoredBlob;
    const dur = recorder.audioBlob ? recorder.duration : restoredDuration;
    if (!blob || !pendingTranscript) return;
    const corrected = applySpeakerMap(pendingWords, speakerMap);
    await runScoring(blob, dur, corrected || pendingTranscript, pendingWords);
  }, [recorder.audioBlob, recorder.duration, restoredBlob, restoredDuration, pendingTranscript, pendingWords, speakerMap, runScoring]);

  const skipReviewAndScore = useCallback(async () => {
    const blob = recorder.audioBlob ?? restoredBlob;
    const dur = recorder.audioBlob ? recorder.duration : restoredDuration;
    if (!blob || !pendingTranscript) return;
    await runScoring(blob, dur, pendingTranscript, pendingWords);
  }, [recorder.audioBlob, recorder.duration, restoredBlob, restoredDuration, pendingTranscript, pendingWords, runScoring]);


  const handleReset = useCallback(() => {
    reset();
    recorder.reset();
    setReport(null);
    setLiveTranscript("");
    setRestoredBlob(null);
    setRestoredDuration(0);
    setPendingAnalysis(false);
    setReviewStage("idle");
    setPendingTranscript("");
    setPendingWords([]);
    setSpeakerMap({});
    clearDraft().catch(() => undefined);
    setActiveTab("setup");
  }, [reset, recorder]);

  // ── Draft restore on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    loadDraft().then((draft) => {
      if (!draft || !draft.audioBlob) return;
      toast({
        title: draft.pendingAnalysis ? "Recovered offline session" : "Previous draft found",
        description: draft.pendingAnalysis
          ? "Restoring your unsubmitted recording so analysis can run when you reconnect."
          : "Restoring your last unsubmitted recording.",
      });
      update({
        title: draft.title, language: draft.language, institution: draft.institution,
        group: draft.group, candidateNames: draft.candidateNames,
        bookletText: draft.bookletText, rubricText: draft.rubricText,
      });
      setRestoredBlob(draft.audioBlob);
      setRestoredDuration(draft.duration || 0);
      setLiveTranscript(draft.liveTranscript || "");
      setScribeWords(draft.scribeWords || []);
      setPhaseMarks(draft.phaseMarks || []);
      setQuickTags(draft.quickTags || []);
      setPendingAnalysis(!!draft.pendingAnalysis);
      setActiveTab("record");
    });
  }, [toast, update]);

  // ── Auto-save draft once a recording has been captured ────────────────
  useEffect(() => {
    const blob = recorder.audioBlob ?? restoredBlob;
    if (!blob) return;
    const handle = setTimeout(() => {
      saveDraft({
        pendingAnalysis,
        title: exam.title, language: exam.language, institution: exam.institution,
        group: exam.group, candidateNames: exam.candidateNames,
        bookletText: exam.bookletText, rubricText: exam.rubricText,
        audioBlob: blob,
        duration: recorder.audioBlob ? recorder.duration : restoredDuration,
        liveTranscript, scribeWords, phaseMarks, quickTags,
      });
    }, 800);
    return () => clearTimeout(handle);
  }, [recorder.audioBlob, recorder.duration, restoredBlob, restoredDuration, exam, liveTranscript, scribeWords, phaseMarks, quickTags, pendingAnalysis]);

  // ── Auto-retry pending analysis when we come back online ───────────────
  useEffect(() => {
    if (online && pendingAnalysis && !analyzing) {
      toast({ title: "Back online", description: "Resuming queued analysis…" });
      handleSubmitForAnalysis();
    }
  }, [online, pendingAnalysis, analyzing, handleSubmitForAnalysis, toast]);

  // Pre-AI speaker review screen
  if (reviewStage === "awaiting") {
    const stats = speakerStats(pendingWords);
    const ROLES: SpeakerRole[] = ["Examiner", "Candidate A", "Candidate B", "Candidate C", "Speaker unclear"];
    const fmtTs = (s: number) => {
      const m = Math.floor(s / 60), r = Math.floor(s % 60);
      return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
    };
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> Confirm speakers
          </h1>
          <p className="mt-1 text-muted-foreground">
            Verify who is who before the AI scores. This prevents the wrong candidate being graded if diarization is off.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Detected voices ({stats.length})</CardTitle>
            <CardDescription>Assign each diarized voice to a role. Defaults are heuristic — please review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2">
              {stats.map((s) => (
                <li key={s.id} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="font-mono text-[10px]">{s.id}</Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {fmtTs(s.totalSeconds)} · {(s.share * 100).toFixed(0)}% · first at {fmtTs(s.firstStart)}
                      </span>
                    </div>
                    <Select
                      value={speakerMap[s.id] ?? "Speaker unclear"}
                      onValueChange={(v) => setSpeakerMap((m) => ({ ...m, [s.id]: v as SpeakerRole }))}
                    >
                      <SelectTrigger className="h-8 w-[180px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {s.sampleText && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground italic">"{s.sampleText}…"</p>
                  )}
                </li>
              ))}
            </ul>

            {recorder.audioUrl && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-1">Listen back to verify:</p>
                <audio controls src={recorder.audioUrl} className="w-full" />
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={skipReviewAndScore}
                disabled={analyzing}
                title="Score with the original (unconfirmed) transcript"
              >
                Skip review
              </Button>
              <Button onClick={confirmReviewAndScore} disabled={analyzing} className="gap-2">
                {analyzing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Scoring…</>
                ) : (
                  <>Confirm & score →</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show draft report if available
  if (report) {
    return (
      <DraftReport
        result={report}
        level={selectedLevel?.label ?? exam.title}
        levelCode={exam.title}
        language={selectedLang?.label ?? "English"}
        institution={exam.institution}
        group={exam.group}
        candidateNames={exam.candidateNames}
        audioBlob={recorder.audioBlob}
        scribeWords={scribeWords}
        phaseMarks={phaseMarks}
        draftKey={`new-${exam.title}-${exam.candidateNames.filter(Boolean).join("|")}`}
        onReset={handleReset}
      />
    );
  }

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">New Exam Session</h1>
          <p className="mt-1 text-muted-foreground">Configure, upload context, and record an oral examination.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="setup">1 · Setup</TabsTrigger>
            <TabsTrigger value="context">2 · Context</TabsTrigger>
            <TabsTrigger value="record">3 · Record</TabsTrigger>
          </TabsList>

          {/* ── Setup Tab ── */}
          <TabsContent value="setup">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Exam Details</CardTitle>
                <CardDescription>Set the basic information for this session.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Exam Level</Label>
                  <Select value={exam.title} onValueChange={(v) => update({ title: v })}>
                    <SelectTrigger><SelectValue placeholder="Select level…" /></SelectTrigger>
                    <SelectContent>
                      {examLevels.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="institution">Institution</Label>
                  <Input id="institution" placeholder="e.g. Cambridge Academy" value={exam.institution} onChange={(e) => update({ institution: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group">Group (free-text)</Label>
                  <Input id="group" placeholder="e.g. Group A" value={exam.group} onChange={(e) => update({ group: e.target.value })} />
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Active Class Roster
                  </Label>
                  <GroupPicker
                    value={groupId}
                    filterInstitution={exam.institution}
                    onChange={(id, info) => {
                      setGroupId(id);
                      if (info) {
                        const patch: Record<string, string> = {};
                        if (info.institution) patch.institution = info.institution;
                        if (info.name) patch.group = info.name;
                        if (info.level_code) patch.title = info.level_code;
                        if (info.language) patch.language = info.language;
                        update(patch);
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pick a class to autocomplete candidate names. Manage rosters in <strong>Class Roster</strong>.
                  </p>
                </div>

                {/* Candidate Names */}
                <div className="sm:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" /> Candidates ({exam.candidateNames.length})
                    </Label>
                    <div className="flex gap-2">
                      {exam.candidateNames.length < 3 && (
                        <Button variant="outline" size="sm" onClick={addCandidate} className="gap-1">
                          <Plus className="h-3.5 w-3.5" /> Add Candidate C
                        </Button>
                      )}
                      {exam.candidateNames.length > 2 && (
                        <Button variant="ghost" size="sm" onClick={removeCandidate} className="gap-1 text-muted-foreground">
                          <X className="h-3.5 w-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {exam.candidateNames.map((name, i) => (
                      <div key={i} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Candidate {String.fromCharCode(65 + i)}
                        </Label>
                        <CandidatePicker
                          value={name}
                          onChange={(v) => updateCandidateName(i, v)}
                          groupId={groupId}
                          placeholder={`e.g. ${i === 0 ? "María García" : i === 1 ? "João Silva" : "Anna Müller"}`}
                          excludeNames={exam.candidateNames}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 rounded-lg border border-accent/20 bg-accent/5 p-3 flex items-start gap-3">
                  <Info className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Rubric adapts automatically</p>
                    <p className="text-muted-foreground">
                      The assessment rubric will be configured based on the selected <strong>{selectedLevel?.label ?? "level"}</strong> and <strong>{selectedLang?.label ?? "language"}</strong>. You can also upload a custom rubric in the next step.
                    </p>
                    <a
                      href="https://www.coe.int/en/web/common-european-framework-reference-languages"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-accent hover:text-accent/80 font-medium underline underline-offset-2"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View Official International Standards (CEFR)
                    </a>
                  </div>
                </div>

                <div className="sm:col-span-2 flex justify-end">
                  <Button onClick={() => setActiveTab("context")}>Next: Upload Context →</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Context Tab ── */}
          <TabsContent value="context">
            <Card>
              <CardHeader>
                <CardTitle className="font-display">Booklet & Rubric</CardTitle>
                <CardDescription>Upload the exam booklet and rubric. Text is automatically extracted to give the AI full context.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                <FileDropZone
                  label="Exam Booklet"
                  icon={BookOpen}
                  file={exam.bookletFile}
                  extractedText={exam.bookletText}
                  onFile={(f) => handleFileUpload(f, "booklet")}
                  onClear={() => update({ bookletFile: null, bookletText: "" })}
                  accept=".pdf,.docx,image/*"
                />
                <FileDropZone
                  label="Custom Rubric"
                  icon={FileText}
                  file={exam.rubricFile}
                  extractedText={exam.rubricText}
                  onFile={(f) => handleFileUpload(f, "rubric")}
                  onClear={() => update({ rubricFile: null, rubricText: "" })}
                  accept=".pdf,.docx,image/*"
                />

                {(exam.bookletText || exam.rubricText) && (
                  <div className="sm:col-span-2 space-y-3">
                    {exam.bookletText && (
                      <details className="rounded-lg border bg-muted/30 p-3">
                        <summary className="text-sm font-medium cursor-pointer">Preview: Booklet text ({exam.bookletText.length} chars)</summary>
                        <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">{exam.bookletText.slice(0, 2000)}{exam.bookletText.length > 2000 ? "…" : ""}</p>
                      </details>
                    )}
                    {exam.rubricText && (
                      <details className="rounded-lg border bg-muted/30 p-3">
                        <summary className="text-sm font-medium cursor-pointer">Preview: Rubric text ({exam.rubricText.length} chars)</summary>
                        <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">{exam.rubricText.slice(0, 2000)}{exam.rubricText.length > 2000 ? "…" : ""}</p>
                      </details>
                    )}
                  </div>
                )}

                <div className="sm:col-span-2 flex justify-between">
                  <Button variant="outline" onClick={() => setActiveTab("setup")}>← Back</Button>
                  <Button onClick={() => setActiveTab("record")}>Next: Record →</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Record Tab ── */}
          <TabsContent value="record">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="font-display">Live Recording</CardTitle>
                    <CardDescription>Record the oral examination. Audio will be sent to the AI for transcription and assessment.</CardDescription>
                  </div>
                  <MicCheck />
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6">
                {/* Timer */}
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className="font-display text-4xl font-bold tabular-nums tracking-tight">
                    {formatTime(recorder.duration)}
                  </span>
                  {recorder.state === "recording" && (
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
                    </span>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                  {recorder.state === "idle" && (
                    <Button size="lg" className="gap-2 rounded-full px-8" onClick={recorder.start}>
                      <Mic className="h-5 w-5" /> Start Recording
                    </Button>
                  )}
                  {recorder.state === "recording" && (
                    <>
                      <Button size="icon" variant="outline" className="h-12 w-12 rounded-full" onClick={recorder.pause}>
                        <Pause className="h-5 w-5" />
                      </Button>
                      <Button size="icon" variant="destructive" className="h-12 w-12 rounded-full" onClick={recorder.stop}>
                        <Square className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                  {recorder.state === "paused" && (
                    <>
                      <Button size="icon" className="h-12 w-12 rounded-full" onClick={recorder.resume}>
                        <Play className="h-5 w-5" />
                      </Button>
                      <Button size="icon" variant="destructive" className="h-12 w-12 rounded-full" onClick={recorder.stop}>
                        <Square className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                  {recorder.state === "stopped" && (
                    <Button variant="outline" onClick={recorder.reset}>Record Again</Button>
                  )}
                </div>

                {/* Playback */}
                {recorder.audioUrl && (
                  <audio controls src={recorder.audioUrl} className="w-full max-w-md" />
                )}

                {/* Phase timer */}
                {(recorder.state === "recording" || recorder.state === "paused") && exam.title && (
                  <PhaseTimer
                    level={exam.title}
                    elapsedSeconds={recorder.duration}
                    isRecording={recorder.state === "recording"}
                    onMarksChange={setPhaseMarks}
                  />
                )}

                {/* Live Transcription — always mounted while recording so it auto-connects */}
                {(recorder.state === "recording" || recorder.state === "paused" || liveTranscript) && (
                  <div className="w-full max-w-md">
                    <LiveTranscript
                      isRecording={recorder.state === "recording"}
                      onTranscriptUpdate={setLiveTranscript}
                    />
                  </div>
                )}

                {/* Per-candidate quick tags during the exam */}
                {(recorder.state === "recording" || recorder.state === "paused" || quickTags.length > 0) && (
                  <QuickTags
                    elapsedSeconds={recorder.duration}
                    active={recorder.state === "recording" || recorder.state === "paused"}
                    candidateLetters={exam.candidateNames.map((_, i) => String.fromCharCode(65 + i))}
                    onChange={setQuickTags}
                  />
                )}

                {/* Context summary */}
                <div className="w-full max-w-md rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
                  <p><span className="font-medium">Level:</span> {selectedLevel?.label || "—"}</p>
                  <p><span className="font-medium">Candidates:</span> {exam.candidateNames.filter(n => n).join(", ") || "Not named"}</p>
                  <p><span className="font-medium">Booklet:</span> {exam.bookletFile?.name || "Not uploaded"} {exam.bookletText ? `(${exam.bookletText.length} chars extracted)` : ""}</p>
                  <p><span className="font-medium">Rubric:</span> {exam.rubricFile?.name || "Not uploaded"} {exam.rubricText ? `(${exam.rubricText.length} chars extracted)` : ""}</p>
                  <p><span className="font-medium">Language:</span> {selectedLang?.label}</p>
                </div>

                {/* Missing level warning */}
                {!exam.title && (
                  <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Please select an exam level in the Setup tab before submitting.
                  </div>
                )}

                {/* Pending offline analysis notice */}
                {pendingAnalysis && (
                  <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                    <WifiOff className="h-4 w-4 shrink-0" />
                    Analysis queued — will run automatically when you're back online.
                  </div>
                )}

                {/* Restored draft notice */}
                {restoredBlob && !recorder.audioBlob && (
                  <div className="w-full max-w-md rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                    <p className="font-medium">Recovered recording ready ({Math.floor(restoredDuration / 60)}:{String(restoredDuration % 60).padStart(2, "0")})</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Submit below, or use "Record Again" to discard and re-record.</p>
                  </div>
                )}

                <div className="w-full max-w-md flex justify-between">
                  <Button variant="outline" onClick={() => setActiveTab("context")}>← Back</Button>
                  <Button
                    disabled={(!audioBlobForSubmit || (recorder.state !== "stopped" && !restoredBlob)) || analyzing || !exam.title}
                    onClick={handleSubmitForAnalysis}
                    className="gap-2"
                  >
                    {analyzing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {analyzingStep === "transcribing" ? "Transcribing…" : "Scoring…"}</>
                    ) : !online ? (
                      <><WifiOff className="h-4 w-4" /> Queue for analysis</>
                    ) : (
                      "Submit for Analysis →"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
