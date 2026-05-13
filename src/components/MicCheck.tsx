import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Mic, Loader2, CheckCircle2, AlertTriangle, MicOff, Headphones } from "lucide-react";
import { transcribeBlob } from "@/lib/transcribe";

type Phase = "idle" | "recording" | "processing" | "ok" | "fail";

const TEST_DURATION_MS = 10_000;

/**
 * Pre-exam mic check. Records ~10s of audio, shows a live volume meter
 * and runs a dummy transcription via the same Scribe edge function the
 * real exam uses, so the teacher can confirm the mic, network and
 * transcription pipeline all work BEFORE the candidates start.
 */
export function MicCheck() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopAtRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const reset = () => {
    cleanup();
    setPhase("idle");
    setLevel(0);
    setRemaining(0);
    setTranscript("");
    setError(null);
  };

  const start = async () => {
    setError(null);
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Volume meter
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 3));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Recorder
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        await audioCtxRef.current?.close().catch(() => {});
        setPhase("processing");
        try {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const out = await transcribeBlob(blob);
          setTranscript(out.transcript || "");
          if ((out.transcript || "").trim().length < 3) {
            setPhase("fail");
            setError("Transcription returned no words. Check the mic level and try again.");
          } else {
            setPhase("ok");
          }
        } catch (err: any) {
          setPhase("fail");
          setError(err?.message || "Transcription failed.");
        }
      };
      recorder.start();
      stopAtRef.current = Date.now() + TEST_DURATION_MS;
      setRemaining(Math.ceil(TEST_DURATION_MS / 1000));
      timerRef.current = setInterval(() => {
        const left = Math.max(0, Math.ceil((stopAtRef.current - Date.now()) / 1000));
        setRemaining(left);
        if (left <= 0 && recorder.state === "recording") recorder.stop();
      }, 200);
      setPhase("recording");
    } catch (err: any) {
      setPhase("fail");
      setError(err?.name === "NotAllowedError"
        ? "Microphone access denied. Allow it in your browser settings and try again."
        : err?.message || "Could not access the microphone.");
    }
  };

  const meterColor =
    level < 0.05 ? "bg-destructive" : level < 0.15 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Headphones className="h-4 w-4" /> Test mic
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" /> Pre-exam mic check
          </DialogTitle>
          <DialogDescription>
            Records 10 seconds, then runs a quick test transcription so you can confirm everything works before the candidates start.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Volume meter */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {level < 0.05 && phase === "recording" ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                Input level
              </span>
              {phase === "recording" && <span className="tabular-nums">{remaining}s left</span>}
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-[width] duration-75 ${meterColor}`}
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
            {phase === "recording" && level < 0.05 && (
              <p className="text-[11px] text-destructive">No sound detected. Speak up, move closer to the mic, or check your input device.</p>
            )}
          </div>

          {/* Status */}
          {phase === "idle" && (
            <p className="text-sm text-muted-foreground">Click <strong>Start test</strong> and read a sentence aloud (e.g. <em>"Hello, this is a microphone test for an oral exam."</em>).</p>
          )}
          {phase === "processing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Transcribing the test clip…
            </div>
          )}
          {phase === "ok" && (
            <div className="space-y-2">
              <Badge variant="secondary" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Mic and transcription are working
              </Badge>
              <div className="rounded-md border bg-muted/30 p-2 text-xs">
                <p className="font-medium mb-1">We heard:</p>
                <p className="italic">"{transcript}"</p>
              </div>
            </div>
          )}
          {phase === "fail" && (
            <div className="space-y-2">
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Test failed
              </Badge>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {(phase === "idle" || phase === "ok" || phase === "fail") && (
            <Button onClick={start} className="gap-2">
              <Mic className="h-4 w-4" /> {phase === "idle" ? "Start test" : "Run again"}
            </Button>
          )}
          {phase === "recording" && (
            <Button variant="destructive" onClick={() => mediaRecorderRef.current?.stop()}>
              Stop early
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
