import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Mic, Square, Plus, Save, Loader2, AlertCircle, RefreshCw, Play, Pause, Trash2,
  Upload, Users, FileText, Image, ChevronLeft, Headphones, CheckCircle2, ArrowRight,
  Download, AlertTriangle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import {
  saveSessionRecording, loadSessionRecording, clearSessionRecording,
  type SessionRecordingSnapshot,
} from "@/lib/sessionRecordingDb";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { LiveTranscript } from "@/components/LiveTranscript";
import { CandidatePicker } from "@/components/CandidatePicker";
import { GroupPicker } from "@/components/GroupPicker";
import { SUPPORTED_LANGUAGES, getExamLevels } from "@/lib/examLevels";
import {
  useSessions, useSession, useCreateSession, useUpdateSession, useCloseSession, useDeleteSession,
  useCreateAttempt, useUpdateAttempt, useDeleteAttempt, useStudentGroups,
  type SessionWithDetails, type SessionAttempt, type TranscriptionMode, type AttemptStatus,
} from "@/hooks/useSpeakingSession";
import { SessionMaterialPanel } from "@/components/session/SessionMaterialPanel";
import { DraftReport, type MultiCandidateResult } from "@/components/DraftReport";

import { SpeakerReviewPanel } from "@/components/SpeakerReviewPanel";
import { MicCheck } from "@/components/MicCheck";
import { PhaseTimer } from "@/components/PhaseTimer";

import { transcribeStoragePath, TranscriptionError, type ScribeWord } from "@/lib/transcribe";
import { applySpeakerMap, speakerStats, type SpeakerMap, type SpeakerRole } from "@/lib/applySpeakerMap";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { getSignedAudioUrl } from "@/lib/audioStorage";

const LANGUAGES = SUPPORTED_LANGUAGES;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function readError(err: any): string {
  return err?.message || String(err);
}

export default function SpeakingSessionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const online = useOnlineStatus();
  const qc = useQueryClient();
  

  // The active session id lives in the URL so that returning from the camera /
  // file picker (which can reload the tab on mobile) keeps the session open.
  const activeSessionId = searchParams.get("id");
  const setActiveSessionId = useCallback(
    (id: string | null) => {
      setSearchParams(id ? { id } : {}, { replace: true });
    },
    [setSearchParams]
  );
  const [activeTab, setActiveTab] = useState("prepare");


  // Setup form
  const [title, setTitle] = useState("");
  const [levelCode, setLevelCode] = useState("");
  const [language, setLanguage] = useState("en");
  const [notes, setNotes] = useState("");
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>("manual");

  // Candidates
  const [candidateNames, setCandidateNames] = useState<string[]>(["", ""]);
  const [candidateIds, setCandidateIds] = useState<(string | null)[]>([null, null]);
  const [groupId, setGroupId] = useState<string | null>(null);

  // Live transcription
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveWords, setLiveWords] = useState<ScribeWord[]>([]);

  const { data: existingSessions } = useSessions();
  const { data: session } = useSession(activeSessionId);
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const closeSession = useCloseSession();
  const createAttempt = useCreateAttempt();
  const updateAttempt = useUpdateAttempt();
  const deleteAttempt = useDeleteAttempt();
  const deleteSession = useDeleteSession();
  const studentGroups = useStudentGroups(candidateIds);

  const [workingAttemptId, setWorkingAttemptId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);

  const [signedAudioUrl, setSignedAudioUrl] = useState<string | null>(null);
  const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
  const [localAudioPlaying, setLocalAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── Crash / screen-lock protection ────────────────────────────────────────
  // The recorder keeps audio in memory only, so we mirror it into IndexedDB
  // while recording. A screen lock, tab kill or reload can then be recovered.
  const [recovered, setRecovered] = useState<SessionRecordingSnapshot | null>(null);
  const [recoveredBlob, setRecoveredBlob] = useState<Blob | null>(null);
  const [recoveredDuration, setRecoveredDuration] = useState(0);
  const [recordingWarning, setRecordingWarning] = useState<string | null>(null);

  // Latest context the snapshot should be stored with (ref so the recorder
  // callbacks stay stable).
  const snapshotCtxRef = useRef({
    sessionId: activeSessionId,
    candidateNames,
    candidateIds,
    transcriptionMode,
    liveTranscript,
  });
  useEffect(() => {
    snapshotCtxRef.current = { sessionId: activeSessionId, candidateNames, candidateIds, transcriptionMode, liveTranscript };
  }, [activeSessionId, candidateNames, candidateIds, transcriptionMode, liveTranscript]);

  const lastSnapshotAtRef = useRef(0);
  const recorder = useAudioRecorder({
    onChunk: (blob, durationSeconds) => {
      // Throttle IDB writes: the recorder emits a chunk every second.
      const now = Date.now();
      if (now - lastSnapshotAtRef.current < 5000) return;
      lastSnapshotAtRef.current = now;
      const ctx = snapshotCtxRef.current;
      return saveSessionRecording({
        audioBlob: blob,
        durationSeconds,
        sessionId: ctx.sessionId,
        candidateNames: ctx.candidateNames,
        candidateIds: ctx.candidateIds,
        transcriptionMode: ctx.transcriptionMode,
        liveTranscript: ctx.liveTranscript,
      });
    },
    onError: (reason) => {
      setRecordingWarning(
        `Recording stopped unexpectedly (${reason}). The audio captured so far was saved — check the recovery notice below or press "Save attempt".`
      );
    },
  });

  // Recover an unsaved recording left behind by a reload / crash.
  const checkedRecoveryRef = useRef(false);
  useEffect(() => {
    if (checkedRecoveryRef.current) return;
    checkedRecoveryRef.current = true;
    (async () => {
      const snap = await loadSessionRecording();
      if (snap) setRecovered(snap);
    })();
  }, []);

  // Keep the screen awake while recording so the OS doesn't kill the mic.
  useEffect(() => {
    if (recorder.state !== "recording") return;
    type WakeLockSentinel = { release: () => Promise<void> };
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } }).wakeLock;
      if (!wl) return;
      try {
        const s = await wl.request("screen");
        if (cancelled) { void s.release(); return; }
        sentinel = s;
      } catch (err) {
        console.debug("[SpeakingSession] wakeLock request failed:", err);
      }
    };
    void request();
    const onVis = () => {
      if (document.visibilityState === "visible" && !sentinel) void request();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, [recorder.state]);

  // Mobile can kill MediaRecorder without unmounting: when the tab becomes
  // visible again, verify the recorder is still alive and finalize if not.
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== "visible") return;
      try { await recorder.healthCheck(); } catch { /* ignore */ }
      const snap = await loadSessionRecording();
      if (snap && !recorder.audioBlob) setRecovered(snap);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.healthCheck, recorder.audioBlob]);

  const pendingBlob = recorder.audioBlob ?? recoveredBlob;
  const pendingDuration = recorder.audioBlob ? recorder.duration : recoveredDuration;

  const acceptRecovered = () => {
    if (!recovered) return;
    setRecoveredBlob(recovered.audioBlob);
    setRecoveredDuration(recovered.durationSeconds);
    setLocalAudioUrl(URL.createObjectURL(recovered.audioBlob));
    if (recovered.candidateNames.length >= 2) {
      setCandidateNames(recovered.candidateNames);
      setCandidateIds(recovered.candidateIds.length ? recovered.candidateIds : recovered.candidateNames.map(() => null));
    }
    if (recovered.liveTranscript) setLiveTranscript(recovered.liveTranscript);
    setRecovered(null);
    setActiveTab("record");
    toast({ title: "Recording recovered", description: "Check the candidates and press \"Save attempt\" to queue it." });
  };

  const downloadRecovered = () => {
    const blob = recovered?.audioBlob ?? pendingBlob;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recovered-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const discardRecovered = async () => {
    await clearSessionRecording();
    setRecovered(null);
  };


  // Reset form when creating a new session
  const resetForm = useCallback(() => {
    setTitle("");
    setLevelCode("");
    setLanguage("en");
    setNotes("");
    setTranscriptionMode("manual");
    setCandidateNames(["", ""]);
    setCandidateIds([null, null]);
    setGroupId(null);
    setLiveTranscript("");
    setLiveWords([]);
    setLocalAudioUrl(null);
    setActiveSessionId(null);
    setActiveTab("prepare");
  }, [setActiveSessionId]);

  useEffect(() => {
    if (recorder.audioUrl) setLocalAudioUrl(recorder.audioUrl);
  }, [recorder.audioUrl]);

  // Load existing session into form
  useEffect(() => {
    if (!session) return;
    setTitle(session.title);
    setLevelCode(session.level_code);
    setLanguage(session.language);
    setNotes(session.notes);
    setTranscriptionMode(session.transcription_mode);
  }, [session]);

  const examLevels = getExamLevels(language);
  const selectedLang = LANGUAGES.find((l) => l.value === language);

  const handleCreateSession = async () => {
    if (!title.trim() || !levelCode) {
      toast({ title: "Missing fields", description: "Enter a title and select a level.", variant: "destructive" });
      return;
    }
    try {
      const s = await createSession.mutateAsync({
        title: title.trim(),
        level_code: levelCode,
        language,
        notes,
        transcription_mode: transcriptionMode,
      });
      setActiveSessionId(s.id);
      toast({ title: "Session created", description: "Now add materials and candidates." });
    } catch (e: any) {
      toast({ title: "Could not create session", description: e.message, variant: "destructive" });
    }
  };

  const handleStartRecording = async () => {
    if (!activeSessionId) {
      await handleCreateSession();
    }
    if (candidateNames.filter(Boolean).length < 2) {
      toast({ title: "Missing candidates", description: "Select at least two candidates.", variant: "destructive" });
      return;
    }
    try {
      await clearSessionRecording();
      setRecovered(null);
      setRecoveredBlob(null);
      setRecoveredDuration(0);
      setRecordingWarning(null);
      lastSnapshotAtRef.current = 0;
      await recorder.start();
      setLiveTranscript("");
      setLiveWords([]);
      setLastError(null);
    } catch (e: any) {
      toast({ title: "Microphone error", description: e.message, variant: "destructive" });
    }
  };

  const handleStopRecording = async () => {
    try {
      await recorder.stop();
    } catch (e: any) {
      toast({ title: "Recording error", description: e.message, variant: "destructive" });
    }
  };

  const handleSaveAttempt = async () => {
    const blob = pendingBlob;
    if (!blob || !activeSessionId) {
      toast({ title: "No recording", description: "Record audio before saving.", variant: "destructive" });
      return;
    }
    if (candidateNames.filter(Boolean).length < 2) {
      toast({ title: "Missing candidates", description: "Select at least two candidates.", variant: "destructive" });
      return;
    }
    try {
      await createAttempt.mutateAsync({
        sessionId: activeSessionId,
        candidateNames: candidateNames.filter((n) => n.trim()),
        candidateIds,
        audioBlob: blob,
        durationSeconds: pendingDuration,
        transcriptionMode: transcriptionMode,
        liveTranscript: transcriptionMode === "live" ? liveTranscript : undefined,
        liveWords: transcriptionMode === "live" ? liveWords : undefined,
      });
      recorder.reset();
      await clearSessionRecording();
      setRecoveredBlob(null);
      setRecoveredDuration(0);
      setRecordingWarning(null);
      setLiveTranscript("");
      setLiveWords([]);
      toast({ title: "Attempt saved", description: "It was added to the queue for this session." });
      setActiveTab("queue");
    } catch (e: any) {
      toast({ title: "Could not save attempt", description: e.message, variant: "destructive" });
    }
  };

  const handleTranscribe = async (attempt: SessionAttempt) => {
    setWorkingAttemptId(attempt.id);
    setProcessing(true);
    setProcessingStep("Transcribing…");
    setLastError(null);
    try {
      await updateAttempt.mutateAsync({ id: attempt.id, status: "transcribing" });
      const out = await transcribeStoragePath(attempt.audio_path, "audio/webm");
      const stats = speakerStats(out.words);
      let status: AttemptStatus = "reviewing_speakers";
      let speakerMap: SpeakerMap | null = null;
      if (stats.length < 2) {
        status = "analyzing";
      } else {
        const byShare = [...stats].sort((a, b) => b.totalSeconds - a.totalSeconds);
        const roles: SpeakerRole[] = ["Examiner", "Candidate A", "Candidate B", "Candidate C"];
        speakerMap = {};
        byShare.forEach((s, i) => { speakerMap![s.id] = roles[i] ?? "Speaker unclear"; });
      }
      await updateAttempt.mutateAsync({
        id: attempt.id,
        status,
        transcript: out.transcript,
        // Keep the timestamped words so the examiner can review who is who.
        live_words: out.words,
        speaker_map: speakerMap,
      });
      toast({
        title: "Transcription ready",
        description: status === "reviewing_speakers"
          ? "Confirm who is who before running the analysis."
          : "Only one speaker was detected — you can analyze directly.",
      });
    } catch (e: any) {
      const msg = e instanceof TranscriptionError ? e.userMessage : readError(e);
      setLastError(msg);
      await updateAttempt.mutateAsync({ id: attempt.id, status: "failed" }).catch(() => undefined);
      toast({ title: "Transcription failed", description: msg, variant: "destructive" });
    } finally {
      setProcessing(false);
      setWorkingAttemptId(null);
    }
  };

  const handleConfirmSpeakers = async (
    attempt: SessionAttempt,
    map: SpeakerMap,
    rebuiltTranscript: string
  ) => {
    if (!attempt.transcript) return;
    const transcript = rebuiltTranscript.trim() || attempt.transcript;
    setWorkingAttemptId(attempt.id);
    try {
      await updateAttempt.mutateAsync({
        id: attempt.id,
        speaker_map: map,
        transcript,
        status: "analyzing",
      });
      toast({ title: "Speakers confirmed", description: "Running the analysis…" });
      await handleAnalyze({ ...attempt, speaker_map: map, transcript });
    } catch (e: any) {
      toast({ title: "Could not confirm speakers", description: readError(e), variant: "destructive" });
    } finally {
      setWorkingAttemptId(null);
    }
  };



  const handleAnalyze = async (attempt: SessionAttempt) => {
    setWorkingAttemptId(attempt.id);
    setProcessing(true);
    setProcessingStep("Analyzing…");
    setLastError(null);
    try {
      await updateAttempt.mutateAsync({ id: attempt.id, status: "analyzing" });
      const materials = session?.materials ?? [];
      const examContext = materials.map((m) => ({
        kind: m.kind,
        title: m.kind === "examiner_script" ? "Examiner script" : "Visual material",
        text: m.description || m.ai_description || "",
      }));
      if (notes.trim()) {
        examContext.push({ kind: "notes", title: "Session notes", text: notes.trim() });
      }

      const runAnalysis = async (names: string[], ids: (string | null)[]) => {
        const { data, error } = await supabase.functions.invoke("analyze-exam", {
          body: {
            level: levelCode,
            language: selectedLang?.label ?? "English",
            candidateNames: names,
            candidateIds: ids,
            transcript: attempt.transcript,
            examContext,
          },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        return data as any;
      };

      const data = await runAnalysis(attempt.candidate_names, attempt.candidate_ids);

      // Every candidate of the same recording must get the SAME report shape.
      // If the model skipped the per-part breakdown for someone, ask again for
      // that candidate only (up to two passes) and merge the result in.
      const list: any[] = Array.isArray(data?.candidates) ? data.candidates : [data];
      const hasParts = (c: any) => Array.isArray(c?.partFeedback) && c.partFeedback.length > 0;
      for (let pass = 0; pass < 2 && !list.every(hasParts); pass++) {
        setProcessingStep("Completing the per-part breakdown…");
        for (let i = 0; i < list.length; i++) {
          if (hasParts(list[i])) continue;
          try {
            const single = await runAnalysis(
              [attempt.candidate_names[i]],
              [attempt.candidate_ids?.[i] ?? null]
            );
            const fixed = Array.isArray(single?.candidates) ? single.candidates[0] : single;
            if (hasParts(fixed)) {
              list[i] = {
                ...list[i],
                partFeedback: fixed.partFeedback,
                overallSummary: list[i].overallSummary || fixed.overallSummary,
              };
            }
          } catch (retryErr) {
            console.warn("[SpeakingSession] part breakdown retry failed:", retryErr);
          }
        }
      }
      if (Array.isArray(data?.candidates)) data.candidates = list;

      const missing = list.filter((c) => !hasParts(c)).length;
      if (missing > 0) {
        setLastError(
          `The per-part breakdown is still missing for ${missing} candidate(s). Use "Complete per-part breakdown" in the queue before signing the reports.`
        );
      }

      // Hold the analysis for examiner review — reports are only created on sign-off.
      await updateAttempt.mutateAsync({
        id: attempt.id,
        status: "reviewing_report",
        analysis_result: data,
      });
      if (missing === 0) setReviewAttemptId(attempt.id);

      toast({ title: "Analysis ready", description: "Review the report, then confirm and sign it." });


    } catch (e: any) {
      const msg = readError(e);
      setLastError(msg);
      await updateAttempt.mutateAsync({ id: attempt.id, status: "failed" }).catch(() => undefined);
      toast({ title: "Analysis failed", description: msg, variant: "destructive" });
    } finally {
      setProcessing(false);
      setWorkingAttemptId(null);
    }
  };

  /** Ask the model again only for candidates whose per-part breakdown is empty. */
  const handleCompleteBreakdown = async (attempt: SessionAttempt) => {
    const stored: any = attempt.analysis_result;
    if (!stored) return;
    const list: any[] = Array.isArray(stored?.candidates) ? [...stored.candidates] : [stored];
    const hasParts = (c: any) => Array.isArray(c?.partFeedback) && c.partFeedback.length > 0;
    setWorkingAttemptId(attempt.id);
    setProcessing(true);
    setProcessingStep("Completing the per-part breakdown…");
    setLastError(null);
    try {
      const materials = session?.materials ?? [];
      const examContext = materials.map((m) => ({
        kind: m.kind,
        title: m.kind === "examiner_script" ? "Examiner script" : "Visual material",
        text: m.description || m.ai_description || "",
      }));
      for (let i = 0; i < list.length; i++) {
        if (hasParts(list[i])) continue;
        const { data, error } = await supabase.functions.invoke("analyze-exam", {
          body: {
            level: levelCode,
            language: selectedLang?.label ?? "English",
            candidateNames: [attempt.candidate_names[i]],
            candidateIds: [attempt.candidate_ids?.[i] ?? null],
            transcript: attempt.transcript,
            examContext,
          },
        });
        if (error) throw error;
        const fixed = Array.isArray((data as any)?.candidates) ? (data as any).candidates[0] : data;
        if (hasParts(fixed)) {
          list[i] = {
            ...list[i],
            partFeedback: fixed.partFeedback,
            overallSummary: list[i].overallSummary || fixed.overallSummary,
          };
        }
      }
      const next = Array.isArray(stored?.candidates) ? { ...stored, candidates: list } : list[0];
      await updateAttempt.mutateAsync({ id: attempt.id, analysis_result: next });
      const stillMissing = list.filter((c) => !hasParts(c)).length;
      if (stillMissing > 0) {
        setLastError(`Still missing the per-part breakdown for ${stillMissing} candidate(s). Try again in a moment.`);
      } else {
        toast({ title: "Per-part breakdown completed", description: "You can review and sign the reports now." });
      }
    } catch (e: any) {
      setLastError(readError(e));
    } finally {
      setProcessing(false);
      setWorkingAttemptId(null);
    }
  };



  const handlePlayAudio = async (attempt: SessionAttempt) => {
    const url = await getSignedAudioUrl(attempt.audio_path);
    if (!url) {
      toast({ title: "Audio unavailable", description: "Could not load the recording.", variant: "destructive" });
      return;
    }
    setSignedAudioUrl(url);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => undefined);
      }
    }, 0);
  };

  const handleFinishSession = async () => {
    if (!activeSessionId) return;
    try {
      await closeSession.mutateAsync(activeSessionId);
      toast({ title: "Session finished for today", description: "You can reopen it later from the dropdown to keep using the same materials." });
      resetForm();
      navigate("/speaking-session");
    } catch (e: any) {
      toast({ title: "Could not finish session", description: e.message, variant: "destructive" });
    }
  };

  const handleReopenSession = async () => {
    if (!activeSessionId) return;
    try {
      await updateSession.mutateAsync({ id: activeSessionId, status: "open" });
      toast({ title: "Session reopened", description: "Materials are ready for reuse." });
    } catch (e: any) {
      toast({ title: "Could not reopen session", description: e.message, variant: "destructive" });
    }
  };

  const updateCandidate = (index: number, name: string, id?: string | null) => {
    const names = [...candidateNames];
    names[index] = name;
    const ids = [...candidateIds];
    ids[index] = id ?? null;
    setCandidateNames(names);
    setCandidateIds(ids);
  };

  const addCandidate = () => {
    if (candidateNames.length < 3) {
      setCandidateNames([...candidateNames, ""]);
      setCandidateIds([...candidateIds, null]);
    }
  };

  const removeCandidate = () => {
    if (candidateNames.length > 2) {
      setCandidateNames(candidateNames.slice(0, -1));
      setCandidateIds(candidateIds.slice(0, -1));
    }
  };

  // Show selected session or create form
  const showCreateForm = !activeSessionId;
  const showSession = !!activeSessionId && !!session;

  const reviewAttempt = session?.attempts.find((a) => a.id === reviewAttemptId) ?? null;
  const reviewResult: MultiCandidateResult | null = (() => {
    if (!reviewAttempt?.analysis_result) return null;
    const raw = reviewAttempt.analysis_result as any;
    const list: any[] = Array.isArray(raw?.candidates) ? raw.candidates : [raw];
    return {
      candidates: reviewAttempt.candidate_names.map((name, i) => {
        const c = list[i] ?? list[0] ?? {};
        return {
          candidateName: c.candidateName || name || `Candidate ${String.fromCharCode(65 + i)}`,
          overallBand: c.overallBand ?? "",
          overallScore: c.overallScore ?? 0,
          criteria: c.criteria ?? [],
          strengths: c.strengths ?? [],
          areasForImprovement: c.areasForImprovement ?? [],
          partFeedback: c.partFeedback ?? undefined,
          overallSummary: c.overallSummary ?? undefined,
        };
      }),
      transcript: reviewAttempt.transcript || "",
      examinerNotes: raw?.examinerNotes ?? "",
    };
  })();



  return (
    <div className="mx-auto max-w-5xl space-y-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Speaking Session</h1>
          <p className="text-muted-foreground">
            Prepare materials, record attempts, and process them when ready.
          </p>
          {session && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Status: <span className={session.status === "open" ? "text-emerald-600" : "text-amber-600"}>{session.status === "open" ? "Open — ready for recording" : "Finished — can be reopened"}</span>
              </span>
              {session.status === "closed" && (
                <Button size="sm" variant="outline" onClick={handleReopenSession} disabled={updateSession.isPending}>Reopen</Button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {existingSessions && existingSessions.length > 0 && (
            <Select
              value={activeSessionId ?? "__new__"}
              onValueChange={async (v) => {
                if (v === "__new__") resetForm();
                else {
                  const selected = existingSessions.find((s) => s.id === v);
                  setActiveSessionId(v);
                  if (selected && selected.status === "closed") {
                    await updateSession.mutateAsync({ id: v, status: "open" });
                  }
                }
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Open a session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">+ New session</SelectItem>
                {existingSessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {session && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete session
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{session.title}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the session, its uploaded material, its photos and every queued
                    recording that has not been signed yet. Reports you already confirmed and signed stay in
                    Reports and are not deleted. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await deleteSession.mutateAsync(session.id);
                        toast({ title: "Session deleted" });
                        resetForm();
                      } catch (e: any) {
                        toast({ title: "Could not delete session", description: e.message, variant: "destructive" });
                      }
                    }}
                  >
                    Delete session
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>


      {!navigator.onLine && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4" />
          You are offline. Recordings can still be captured, but analysis requires a connection.
        </div>
      )}

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Create session</CardTitle>
            <CardDescription>
              Set the level and language. The session stays open so you can reuse the materials across different days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FCE Mock 12A" />
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={levelCode} onValueChange={setLevelCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select CEFR level" />
                  </SelectTrigger>
                  <SelectContent>
                    {examLevels.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Transcription mode</Label>
                <Select
                  value={transcriptionMode}
                  onValueChange={(v) => setTranscriptionMode(v as TranscriptionMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (process later)</SelectItem>
                    <SelectItem value="live">Live captions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Session notes visible to the AI during analysis" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Live captions use ElevenLabs Scribe and consume credits during the recording.
              </p>
              <Button onClick={handleCreateSession} disabled={createSession.isPending}>
                {createSession.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {reviewAttempt && reviewResult && (
        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={() => setReviewAttemptId(null)}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Back to queue
          </Button>
          <DraftReport
            result={reviewResult}
            level={levelCode}
            levelCode={levelCode}
            language={selectedLang?.label ?? "English"}
            candidateNames={reviewAttempt.candidate_names}
            candidateIds={reviewAttempt.candidate_ids}
            audioPath={reviewAttempt.audio_path}
            sessionId={reviewAttempt.session_id}
            attemptId={reviewAttempt.id}
            scribeWords={(reviewAttempt.live_words ?? []) as ScribeWord[]}
            draftKey={`session-attempt-${reviewAttempt.id}`}
            onReset={async () => {
              await updateAttempt.mutateAsync({ id: reviewAttempt.id, status: "done" }).catch(() => undefined);
              setReviewAttemptId(null);
            }}
          />
        </div>
      )}

      {showSession && session && !reviewAttempt && (

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="prepare"><Upload className="mr-2 h-4 w-4" /> Prepare</TabsTrigger>
            <TabsTrigger value="record"><Mic className="mr-2 h-4 w-4" /> Record</TabsTrigger>
            <TabsTrigger value="queue"><FileText className="mr-2 h-4 w-4" /> Queue ({session.attempts.length})</TabsTrigger>
          </TabsList>

          <p className="mt-3 text-xs text-muted-foreground">
            Order of work: <strong>Prepare</strong> the materials → <strong>Record</strong> each pair or trio → process the <strong>Queue</strong> when you finish for the day.
          </p>

          <TabsContent value="prepare" className="space-y-4">

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Session setup</CardTitle>
                <CardDescription>Level, language, and shared notes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={levelCode} onValueChange={setLevelCode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {examLevels.map((l) => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
                <div className="flex items-center gap-4">
                  <Switch
                    id="live-mode"
                    checked={transcriptionMode === "live"}
                    onCheckedChange={(v) => setTranscriptionMode(v ? "live" : "manual")}
                  />
                  <Label htmlFor="live-mode">Live captions during recording</Label>
                </div>
                <Button
                  variant="outline"
                  onClick={() => updateSession.mutate({ id: session.id, title, level_code: levelCode, language, notes, transcription_mode: transcriptionMode })}
                  disabled={updateSession.isPending}
                >
                  {updateSession.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save changes
                </Button>
              </CardContent>
            </Card>

            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              You can upload all the material before knowing which candidates are coming — candidates are chosen later, in the Record tab. The same material stays available for every recording in this session, on any day, until you close it.
            </div>

            <SessionMaterialPanel sessionId={session.id} materials={session.materials} />


            <div className="flex justify-end">
              <Button onClick={() => setActiveTab("record")}>
                Next: Record <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="record" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Candidates</CardTitle>
                <CardDescription>
                  Pick the group and the candidates. Free-form names are allowed if you skip the group picker.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Group</Label>
                  <GroupPicker value={groupId} onChange={setGroupId} />
                </div>
                <div className="space-y-3">
                  {candidateNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Badge variant="outline" className="shrink-0">Candidate {String.fromCharCode(65 + i)}</Badge>
                      <div className="flex-1">
                        <CandidatePicker
                          value={name}
                          groupId={groupId}
                          placeholder={`Candidate ${String.fromCharCode(65 + i)}`}
                          excludeNames={candidateNames.filter((_, idx) => idx !== i)}
                          onChange={(n, id) => updateCandidate(i, n, id)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  {candidateNames.length < 3 && (
                    <Button variant="outline" size="sm" onClick={addCandidate}><Plus className="mr-1 h-4 w-4" /> Add candidate</Button>
                  )}
                  {candidateNames.length > 2 && (
                    <Button variant="outline" size="sm" onClick={removeCandidate}><Trash2 className="mr-1 h-4 w-4" /> Remove last</Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Recording</CardTitle>
                <CardDescription>Record the full speaking test. The attempt is queued after you stop.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {recovered && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Unsaved recording found</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>
                        A recording of {formatTime(recovered.durationSeconds)} was left behind
                        {recovered.candidateNames.filter(Boolean).length
                          ? ` (${recovered.candidateNames.filter(Boolean).join(" & ")})`
                          : ""}. It was backed up automatically on this device.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={acceptRecovered} className="gap-2">
                          <RefreshCw className="h-4 w-4" /> Recover
                        </Button>
                        <Button size="sm" variant="outline" onClick={downloadRecovered} className="gap-2">
                          <Download className="h-4 w-4" /> Download audio
                        </Button>
                        <Button size="sm" variant="ghost" onClick={discardRecovered} className="gap-2">
                          <Trash2 className="h-4 w-4" /> Discard
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {recordingWarning && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Recording interrupted</AlertTitle>
                    <AlertDescription>{recordingWarning}</AlertDescription>
                  </Alert>
                )}

                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  Keep the app in the foreground and don't lock the phone while recording — the screen is kept awake automatically, but some phones still stop the microphone when locked. A backup copy is saved on this device every few seconds, so an interrupted recording can be recovered here.
                </div>

                <div className="flex items-center justify-center gap-4 py-6">
                  {recorder.state !== "recording" ? (
                    <Button size="lg" onClick={handleStartRecording} className="gap-2">
                      <Mic className="h-5 w-5" /> Start recording
                    </Button>
                  ) : (
                    <Button size="lg" variant="destructive" onClick={handleStopRecording} className="gap-2">
                      <Square className="h-5 w-5" /> Stop ({formatTime(recorder.duration)})
                    </Button>
                  )}
                </div>

                {pendingBlob && recorder.state !== "recording" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <Button variant="outline" onClick={() => {
                        if (localAudioRef.current) {
                          if (localAudioPlaying) {
                            localAudioRef.current.pause();
                          } else {
                            localAudioRef.current.play().catch(() => undefined);
                          }
                        }
                      }} className="gap-2">
                        {localAudioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {localAudioPlaying ? "Pause" : "Play back"}
                      </Button>
                      <Button variant="outline" onClick={downloadRecovered} className="gap-2">
                        <Download className="h-4 w-4" /> Download audio
                      </Button>
                      <Button variant="outline" onClick={() => {
                        recorder.reset();
                        setRecoveredBlob(null);
                        setRecoveredDuration(0);
                        setRecordingWarning(null);
                        void clearSessionRecording();
                      }} className="gap-2"><Trash2 className="h-4 w-4" /> Discard</Button>
                      <Button onClick={handleSaveAttempt} disabled={createAttempt.isPending} className="gap-2">
                        {createAttempt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save attempt ({formatTime(pendingDuration)})
                      </Button>
                    </div>
                    {localAudioUrl && (
                      <audio
                        ref={localAudioRef}
                        src={localAudioUrl}
                        onEnded={() => setLocalAudioPlaying(false)}
                        onPause={() => setLocalAudioPlaying(false)}
                        onPlay={() => setLocalAudioPlaying(true)}
                        controls
                        className="w-full"
                      />
                    )}
                  </div>
                )}

                {transcriptionMode === "live" && (
                  <LiveTranscript
                    isRecording={recorder.state === "recording"}
                    onTranscriptUpdate={(t) => setLiveTranscript(t)}
                    enabled={transcriptionMode === "live"}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Attempt queue</CardTitle>
                <CardDescription>
                  Process recordings when you are ready. Transcription, speaker review, and analysis are done here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {session.attempts.length === 0 && (
                  <p className="text-sm text-muted-foreground">No attempts yet. Go to Record to capture one.</p>
                )}
                {session.attempts.map((attempt) => (
                  <div key={attempt.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{attempt.candidate_names.join(" & ")}</span>
                        <Badge variant="outline" className="text-xs">{attempt.status.replace("_", " ")}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatTime(attempt.duration_seconds || 0)}</span>
                        <Button size="sm" variant="ghost" onClick={() => handlePlayAudio(attempt)}><Headphones className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteAttempt.mutate(attempt)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>

                    {attempt.status === "recorded" && (
                      <Button size="sm" onClick={() => handleTranscribe(attempt)} disabled={processing || workingAttemptId === attempt.id}>
                        {workingAttemptId === attempt.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Transcribe
                      </Button>
                    )}

                    {attempt.status === "reviewing_speakers" && attempt.speaker_map && (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Assign each voice, scroll the full script to check the attribution, then confirm.
                        </p>
                        <SpeakerReviewPanel
                          words={(attempt.live_words ?? []) as ScribeWord[]}
                          initialMap={attempt.speaker_map}
                          suggestedMap={attempt.speaker_map}
                          confirming={workingAttemptId === attempt.id}
                          onConfirm={(map, transcript) => handleConfirmSpeakers(attempt, map, transcript)}
                        />
                        <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => handleAnalyze(attempt)} disabled={processing || workingAttemptId === attempt.id}>
                          {workingAttemptId === attempt.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Analyze without confirming speakers
                        </Button>

                      </div>
                    )}

                    {attempt.status === "reviewing_report" && (() => {
                      const stored: any = attempt.analysis_result;
                      const list: any[] = Array.isArray(stored?.candidates) ? stored.candidates : stored ? [stored] : [];
                      const missing = list.filter(
                        (c) => !Array.isArray(c?.partFeedback) || c.partFeedback.length === 0
                      ).length;
                      return (
                        <div className="space-y-2">
                          {missing > 0 && (
                            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-2">
                              <p className="text-xs text-amber-700 dark:text-amber-300">
                                The per-part commentary is missing for {missing} candidate(s). Complete it so every
                                report has the same structure.
                              </p>
                              <Button size="sm" variant="outline" onClick={() => handleCompleteBreakdown(attempt)} disabled={processing || workingAttemptId === attempt.id}>
                                {workingAttemptId === attempt.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Complete per-part breakdown
                              </Button>
                            </div>
                          )}
                          <Button size="sm" onClick={() => setReviewAttemptId(attempt.id)}>
                            <FileText className="mr-2 h-4 w-4" /> Review &amp; sign report
                          </Button>
                        </div>
                      );
                    })()}


                    {(attempt.status === "analyzing" || attempt.status === "done" || attempt.status === "failed") && (
                      <Button size="sm" onClick={() => handleAnalyze(attempt)} disabled={processing || workingAttemptId === attempt.id || attempt.status === "done"}>
                        {workingAttemptId === attempt.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                        {attempt.status === "done" ? "Analyzed" : "Analyze"}
                      </Button>
                    )}


                    {workingAttemptId === attempt.id && processingStep && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> {processingStep}
                      </p>
                    )}
                  </div>
                ))}

                {lastError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="inline h-4 w-4 mr-1" /> {lastError}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("record")}><ChevronLeft className="mr-2 h-4 w-4" /> Back to record</Button>
              <Button variant="secondary" onClick={handleFinishSession}>Finish for today</Button>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {signedAudioUrl && (
        <audio
          ref={audioRef}
          src={signedAudioUrl}
          controls
          className="w-full"
        />
      )}
    </div>
  );
}
