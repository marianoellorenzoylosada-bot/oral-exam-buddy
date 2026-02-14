import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, Pause, Play, Upload, FileText, BookOpen, Trash2, Clock, Users } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useExamStore } from "@/hooks/useExamStore";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "it", label: "Italian" },
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function FileDropZone({ label, icon: Icon, file, onFile, onClear, accept }: {
  label: string; icon: React.ElementType; file: File | null;
  onFile: (f: File) => void; onClear: () => void; accept: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      className="relative flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-accent hover:bg-muted/30"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
      role="button"
      tabIndex={0}
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
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
            <Icon className="h-6 w-6 text-success" />
          </div>
          <div>
            <p className="font-medium text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
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
            <p className="text-xs text-muted-foreground">PDF or images · Drag & drop or click</p>
          </div>
        </>
      )}
    </div>
  );
}

export default function NewExamPage() {
  const { exam, update } = useExamStore();
  const recorder = useAudioRecorder();
  const [activeTab, setActiveTab] = useState("setup");

  return (
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
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Exam Title</Label>
                <Input id="title" placeholder="e.g. B2 Speaking Part 3" value={exam.title} onChange={(e) => update({ title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Institution</Label>
                <Input id="institution" placeholder="e.g. Cambridge Academy" value={exam.institution} onChange={(e) => update({ institution: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group">Group</Label>
                <Input id="group" placeholder="e.g. Group A" value={exam.group} onChange={(e) => update({ group: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={exam.language} onValueChange={(v) => update({ language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Candidates</Label>
                <div className="flex flex-wrap gap-2">
                  {exam.candidates.map((c, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />{c}
                    </Badge>
                  ))}
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
              <CardDescription>Upload the exam booklet and rubric. The AI will extract target vocabulary and scoring criteria.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <FileDropZone
                label="Exam Booklet"
                icon={BookOpen}
                file={exam.bookletFile}
                onFile={(f) => update({ bookletFile: f })}
                onClear={() => update({ bookletFile: null, bookletText: "" })}
                accept=".pdf,image/*"
              />
              <FileDropZone
                label="Custom Rubric"
                icon={FileText}
                file={exam.rubricFile}
                onFile={(f) => update({ rubricFile: f })}
                onClear={() => update({ rubricFile: null, rubricText: "" })}
                accept=".pdf,image/*"
              />
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
              <CardTitle className="font-display">Live Recording</CardTitle>
              <CardDescription>Record the oral examination. Audio is cached locally for offline resilience.</CardDescription>
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

              {/* Context summary */}
              <div className="w-full max-w-md rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
                <p><span className="font-medium">Title:</span> {exam.title || "—"}</p>
                <p><span className="font-medium">Booklet:</span> {exam.bookletFile?.name || "Not uploaded"}</p>
                <p><span className="font-medium">Rubric:</span> {exam.rubricFile?.name || "Not uploaded"}</p>
                <p><span className="font-medium">Language:</span> {LANGUAGES.find(l => l.value === exam.language)?.label}</p>
              </div>

              <div className="w-full max-w-md flex justify-between">
                <Button variant="outline" onClick={() => setActiveTab("context")}>← Back</Button>
                <Button disabled={recorder.state !== "stopped"}>
                  Submit for Analysis →
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
