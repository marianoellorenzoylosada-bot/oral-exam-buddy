import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mic, Square, Pause, Play, Upload, FileText, BookOpen, Trash2, Clock, Users,
  Loader2, Plus, X, CheckCircle2, AlertTriangle, ListChecks, PlayCircle, Sparkles, ChevronRight,
  LifeBuoy,
} from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useBatchQueue, type BatchItem } from "@/hooks/useBatchQueue";
import { CAMBRIDGE_EXAMS } from "@/lib/cambridgeRubrics";
import { extractTextFromFile } from "@/lib/extractText";
import { useToast } from "@/hooks/use-toast";
import { DraftReport } from "@/components/DraftReport";
import { GroupPicker } from "@/components/GroupPicker";
import { CandidatePicker } from "@/components/CandidatePicker";
import { SUPPORTED_LANGUAGES, getExamLevels, getExamLabel } from "@/lib/examLevels";
import {
  saveActiveRecording, loadActiveRecording, clearActiveRecording,
  type ActiveRecordingSnapshot,
} from "@/lib/batchQueueDb";

const LANGUAGES = SUPPORTED_LANGUAGES;

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function FileDrop({ label, icon: Icon, file, extracted, onFile, onClear, accept }: {
  label: string; icon: React.ElementType; file: File | null; extracted: string;
  onFile: (f: File) => void; onClear: () => void; accept: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className="relative flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-center transition-colors hover:border-accent hover:bg-muted/30 cursor-pointer"
      onClick={() => !file && inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      {file ? (
        <>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Icon className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate max-w-[200px]">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          {extracted && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <FileText className="h-3 w-3" /> {extracted.length} chars
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClear(); }}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
        </>
      ) : (
        <>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">PDF, DOCX or images</p>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: BatchItem["status"] }) {
  const map: Record<BatchItem["status"], { label: string; className: string; icon: React.ElementType }> = {
    recorded:  { label: "Recorded",  className: "border-muted-foreground/30 bg-muted text-muted-foreground", icon: Mic },
    queued:    { label: "Queued",    className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400", icon: ListChecks },
    analyzing: { label: "Analyzing", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: Loader2 },
    done:      { label: "Done",      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
    failed:    { label: "Failed",    className: "border-destructive/30 bg-destructive/10 text-destructive", icon: AlertTriangle },
  };
  const v = map[status];
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${v.className}`}>
      <Icon className={`h-3 w-3 ${status === "analyzing" ? "animate-spin" : ""}`} /> {v.label}
    </Badge>
  );
}

export default function BatchSessionPage() {
  const { toast } = useToast();
  const recorder = useAudioRecorder();
  const queue = useBatchQueue();

  // Shared exam context
  const [level, setLevel] = useState<string>("B2");
  const language = "en";
  const [institution, setInstitution] = useState(() => localStorage.getItem("oralassess-institution") ?? "");
  const [group, setGroup] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [bookletFile, setBookletFile] = useState<File | null>(null);
  const [bookletText, setBookletText] = useState("");
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [rubricText, setRubricText] = useState("");

  // Per-exam candidate names
  const [candidateNames, setCandidateNames] = useState<string[]>(["", ""]);
  const [contextLocked, setContextLocked] = useState(false);
  const [reviewItemId, setReviewItemId] = useState<string | null>(null);

  const langLabel = useMemo(() => LANGUAGES.find(l => l.value === language)?.label ?? "English", [language]);
  const examLevels = useMemo(() => getExamLevels(language), [language]);
  const examMeta = useMemo(() => ({ value: level, label: getExamLabel(level, language) }), [level, language]);

  const handleFileUpload = useCallback(async (file: File, type: "booklet" | "rubric") => {
    const text = await extractTextFromFile(file);
    if (type === "booklet") {
      setBookletFile(file); setBookletText(text);
    } else {
      setRubricFile(file); setRubricText(text);
    }
    toast({ title: "Text extracted", description: `${text.length} characters from ${file.name}.` });
  }, [toast]);

  const updateCandidateName = (i: number, v: string) => {
    setCandidateNames(prev => prev.map((n, idx) => (idx === i ? v : n)));
  };

  const addCandidate = () => {
    if (candidateNames.length < 3) setCandidateNames(prev => [...prev, ""]);
  };

  const removeCandidate = () => {
    if (candidateNames.length > 2) setCandidateNames(prev => prev.slice(0, -1));
  };

  const handleSaveExam = useCallback(() => {
    if (!recorder.audioBlob) {
      toast({ title: "No recording", description: "Stop the recording before saving.", variant: "destructive" });
      return;
    }
    queue.addItem({
      candidateNames: [...candidateNames],
      audioBlob: recorder.audioBlob,
      durationSeconds: recorder.duration,
    });
    toast({ title: "Exam saved to queue", description: "Ready to record the next one." });
    recorder.reset();
    setCandidateNames(prev => prev.map(() => ""));
  }, [recorder, queue, candidateNames, toast]);

  const handleAnalyzeAll = useCallback(() => {
    if (!level) {
      toast({ title: "Missing exam level", description: "Pick a Cambridge level first.", variant: "destructive" });
      return;
    }
    queue.analyzeAll({
      level,
      language: langLabel,
      bookletText,
      rubricText,
    });
  }, [queue, level, langLabel, bookletText, rubricText, toast]);

  const reviewItem = reviewItemId ? queue.items.find(i => i.id === reviewItemId) : null;

  if (reviewItem && reviewItem.result) {
    return (
      <DraftReport
        result={reviewItem.result}
        level={examMeta?.label ?? level}
        levelCode={level}
        language={langLabel}
        institution={institution}
        group={group}
        candidateNames={reviewItem.candidateNames}
        audioBlob={reviewItem.audioBlob}
        scribeWords={reviewItem.scribeWords}
        draftKey={`batch-${reviewItem.id}`}
        onReset={() => setReviewItemId(null)}
      />
    );
  }

  const pendingCount = queue.items.filter(i => i.status === "recorded" || i.status === "queued" || i.status === "failed").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Batch Session</h1>
        <p className="mt-1 text-muted-foreground">
          Record many Cambridge oral exams back-to-back, then analyze them all in one go.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* ── Left column: shared context + recorder ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="font-display flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" /> Shared Context
                </CardTitle>
                <CardDescription>Set once for all exams in this session.</CardDescription>
              </div>
              {contextLocked ? (
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
                  Locked
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Exam</Label>
                <Select value={level} onValueChange={setLevel} disabled={contextLocked}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {examLevels.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-institution">Institution</Label>
                <Input id="batch-institution" value={institution} onChange={(e) => setInstitution(e.target.value)} disabled={contextLocked} placeholder="e.g. Cambridge Academy" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-group">Group (free-text)</Label>
                <Input id="batch-group" value={group} onChange={(e) => setGroup(e.target.value)} disabled={contextLocked} placeholder="e.g. Group A" />
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Active Class Roster
                </Label>
                <GroupPicker
                  value={groupId}
                  filterInstitution={institution}
                  onChange={(id, info) => {
                    setGroupId(id);
                    if (info) {
                      if (info.institution) setInstitution(info.institution);
                      if (info.name) setGroup(info.name);
                      if (info.level_code) setLevel(info.level_code);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Pick a class to autocomplete candidate names from the roster. Manage rosters in <strong>Class Roster</strong>.
                </p>
              </div>

              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                <FileDrop
                  label="Cambridge Handbook (optional)"
                  icon={BookOpen}
                  file={bookletFile}
                  extracted={bookletText}
                  onFile={(f) => handleFileUpload(f, "booklet")}
                  onClear={() => { setBookletFile(null); setBookletText(""); }}
                  accept=".pdf,.docx,image/*"
                />
                <FileDrop
                  label="Sample Paper / Rubric (optional)"
                  icon={FileText}
                  file={rubricFile}
                  extracted={rubricText}
                  onFile={(f) => handleFileUpload(f, "rubric")}
                  onClear={() => { setRubricFile(null); setRubricText(""); }}
                  accept=".pdf,.docx,image/*"
                />
              </div>

              {!contextLocked ? (
                <div className="sm:col-span-2 flex justify-end">
                  <Button onClick={() => setContextLocked(true)} disabled={!level} className="gap-2">
                    Lock context & start recording <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="sm:col-span-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setContextLocked(false)}>Edit context</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {contextLocked && (
            <Card>
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Mic className="h-5 w-5 text-accent" /> Record Next Exam
                </CardTitle>
                <CardDescription>Enter candidate names, record, then save to the queue.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Candidate names */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" /> Candidates ({candidateNames.length})
                    </Label>
                    <div className="flex gap-2">
                      {candidateNames.length < 3 && (
                        <Button variant="outline" size="sm" onClick={addCandidate} className="gap-1">
                          <Plus className="h-3.5 w-3.5" /> Add Candidate C
                        </Button>
                      )}
                      {candidateNames.length > 2 && (
                        <Button variant="ghost" size="sm" onClick={removeCandidate} className="gap-1 text-muted-foreground">
                          <X className="h-3.5 w-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {candidateNames.map((name, i) => (
                      <div key={i} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Candidate {String.fromCharCode(65 + i)}</Label>
                        <CandidatePicker
                          value={name}
                          onChange={(v) => updateCandidateName(i, v)}
                          groupId={groupId}
                          placeholder={`e.g. ${i === 0 ? "María García" : i === 1 ? "João Silva" : "Anna Müller"}`}
                          excludeNames={candidateNames}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recorder */}
                <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/20 p-5">
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
                  <div className="flex items-center gap-3">
                    {recorder.state === "idle" && (
                      <Button size="lg" className="gap-2 rounded-full px-6" onClick={recorder.start}>
                        <Mic className="h-5 w-5" /> Start Recording
                      </Button>
                    )}
                    {recorder.state === "recording" && (
                      <>
                        <Button size="icon" variant="outline" className="h-11 w-11 rounded-full" onClick={recorder.pause}>
                          <Pause className="h-5 w-5" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-11 w-11 rounded-full" onClick={recorder.stop}>
                          <Square className="h-5 w-5" />
                        </Button>
                      </>
                    )}
                    {recorder.state === "paused" && (
                      <>
                        <Button size="icon" className="h-11 w-11 rounded-full" onClick={recorder.resume}>
                          <Play className="h-5 w-5" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-11 w-11 rounded-full" onClick={recorder.stop}>
                          <Square className="h-5 w-5" />
                        </Button>
                      </>
                    )}
                    {recorder.state === "stopped" && (
                      <Button variant="outline" onClick={recorder.reset}>Record again</Button>
                    )}
                  </div>
                  {recorder.audioUrl && (
                    <audio controls src={recorder.audioUrl} className="w-full max-w-md" />
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    disabled={recorder.state !== "stopped"}
                    onClick={handleSaveExam}
                    className="gap-2"
                  >
                    Save & next exam <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column: queue ── */}
        <Card className="self-start">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-accent" /> Exam Queue ({queue.items.length})
                </CardTitle>
                <CardDescription>Recordings waiting for analysis or review.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {queue.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No exams queued yet. Record one to get started.
              </div>
            ) : (
              <ul className="space-y-2">
                {queue.items.map((item, idx) => {
                  const names = item.candidateNames.filter(Boolean).join(" & ") || "Unnamed candidates";
                  return (
                    <li key={item.id} className="rounded-lg border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">#{idx + 1} · {names}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.candidateNames.length} candidate{item.candidateNames.length > 1 ? "s" : ""} · {formatTime(item.durationSeconds)}
                          </p>
                          {item.error && (
                            <p className="text-xs text-destructive mt-1">{item.error}</p>
                          )}
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.status === "done" ? (
                          <Button size="sm" variant="default" className="gap-1" onClick={() => setReviewItemId(item.id)}>
                            <PlayCircle className="h-3.5 w-3.5" /> Review report
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={item.status === "analyzing" || queue.analyzingAll}
                            onClick={() => queue.analyzeOne(item, { level, language: langLabel, bookletText, rubricText })}
                          >
                            {item.status === "analyzing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            {item.status === "failed" ? "Retry" : "Analyze"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-muted-foreground hover:text-destructive"
                          disabled={item.status === "analyzing"}
                          onClick={() => queue.removeItem(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {queue.items.length > 0 && (
              <div className="flex flex-col gap-2 pt-2 border-t">
                <Button
                  className="w-full gap-2"
                  disabled={pendingCount === 0 || queue.analyzingAll}
                  onClick={handleAnalyzeAll}
                >
                  {queue.analyzingAll ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing {pendingCount}…</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Analyze all ({pendingCount})</>
                  )}
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={queue.clearAll} disabled={queue.analyzingAll}>
                  Clear queue
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
