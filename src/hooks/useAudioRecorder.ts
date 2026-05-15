import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export interface UseAudioRecorderOptions {
  /**
   * Called whenever a new chunk arrives (≈ once per second) and on stop.
   * Receives a snapshot Blob built from all chunks so far + the elapsed seconds.
   * Used by callers to persist a partial recording to IndexedDB for crash recovery.
   */
  onChunk?: (blob: Blob, durationSeconds: number) => void;
  /** Called when MediaRecorder errors or the audio track ends unexpectedly. */
  onError?: (reason: string) => void;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const { onChunk, onError } = options;

  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  // Stable refs so we don't recreate start() when callbacks change.
  const onChunkRef = useRef(onChunk);
  const onErrorRef = useRef(onError);
  useEffect(() => { onChunkRef.current = onChunk; }, [onChunk]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Keep latest state in a ref for the unmount cleanup.
  const stateRef = useRef<RecordingState>("idle");
  useEffect(() => { stateRef.current = state; }, [state]);

  const computeElapsed = useCallback(() => {
    return Math.floor((Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000);
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration(computeElapsed());
    }, 200);
  }, [computeElapsed]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => {
      try { t.stop(); } catch { /* ignore */ }
    });
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          // Snapshot for crash recovery.
          if (onChunkRef.current) {
            try {
              const snapshot = new Blob(chunksRef.current, { type: "audio/webm" });
              onChunkRef.current(snapshot, computeElapsed());
            } catch { /* ignore snapshot failures */ }
          }
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        // Final snapshot so callers see the closed blob too.
        try { onChunkRef.current?.(blob, computeElapsed()); } catch { /* ignore */ }
        releaseStream();
      };

      const finalizeSnapshot = () => {
        try {
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: "audio/webm" });
            onChunkRef.current?.(blob, computeElapsed());
          }
        } catch { /* ignore */ }
      };

      recorder.onerror = (event: Event) => {
        const err = (event as unknown as { error?: DOMException }).error;
        const reason = err?.message || "Recorder error";
        console.error("[useAudioRecorder] MediaRecorder error:", err);
        finalizeSnapshot();
        onErrorRef.current?.(reason);
        try { if (recorder.state !== "inactive") recorder.stop(); } catch { /* ignore */ }
        stopTimer();
        setState("stopped");
      };

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            console.warn("[useAudioRecorder] Audio track ended unexpectedly");
            finalizeSnapshot();
            onErrorRef.current?.("Microphone was disconnected.");
            try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
            stopTimer();
            setState("stopped");
          }
        };
      });

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;
      setDuration(0);
      setState("recording");
      startTimer();
    } catch (err: any) {
      console.error("Microphone access denied:", err);
      onErrorRef.current?.(err?.message || "Microphone access denied");
    }
  }, [startTimer, stopTimer, computeElapsed, releaseStream]);

  const pause = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (!r || r.state !== "recording") return;
    try { r.pause(); } catch { /* ignore */ }
    stopTimer();
    pausedDurationRef.current += Date.now() - startTimeRef.current;
    setState("paused");
  }, [stopTimer]);

  const resume = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (!r || r.state !== "paused") return;
    try { r.resume(); } catch { /* ignore */ }
    startTimeRef.current = Date.now();
    startTimer();
    setState("recording");
  }, [startTimer]);

  const stop = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (!r || r.state === "inactive") return;
    try { r.stop(); } catch { /* ignore */ }
    stopTimer();
    setState("stopped");
  }, [stopTimer]);

  /**
   * Inspects the underlying MediaRecorder + tracks. If the recorder has died
   * silently (e.g. mobile screen-lock killed the audio pipeline) while React
   * still thinks we're recording, finalize the latest snapshot, transition to
   * "stopped", and notify via onError. No-op when the recorder is genuinely
   * active or already idle.
   */
  const healthCheck = useCallback(() => {
    const r = mediaRecorderRef.current;
    const s = stateRef.current;
    if (s !== "recording" && s !== "paused") return;
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    const recorderDead = !r || r.state === "inactive";
    const tracksDead = tracks.length === 0 || tracks.every((t) => t.readyState === "ended");
    if (!recorderDead && !tracksDead) return;
    console.warn("[useAudioRecorder] healthCheck: recorder is stale, finalizing");
    try {
      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        onChunkRef.current?.(blob, computeElapsed());
      }
    } catch { /* ignore */ }
    try { if (r && r.state !== "inactive") r.stop(); } catch { /* ignore */ }
    releaseStream();
    stopTimer();
    setState("stopped");
    onErrorRef.current?.("Recording stopped while screen was off.");
  }, [computeElapsed, releaseStream, stopTimer]);

  const reset = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    chunksRef.current = [];
    setState("idle");
  }, [audioUrl]);

  // Unmount safety: if the component is being torn down mid-recording, finalize
  // the MediaRecorder so onstop fires and the partial snapshot is persisted.
  useEffect(() => {
    return () => {
      const r = mediaRecorderRef.current;
      if (r && r.state !== "inactive") {
        try { r.stop(); } catch { /* ignore */ }
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Stream will be released by recorder.onstop, but ensure tracks are closed
      // even if the recorder never fired onstop.
      setTimeout(() => {
        streamRef.current?.getTracks().forEach((t) => {
          try { t.stop(); } catch { /* ignore */ }
        });
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, duration, audioBlob, audioUrl, start, pause, resume, stop, reset, healthCheck };
}
