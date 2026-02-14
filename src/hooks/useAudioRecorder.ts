import { useState, useRef, useCallback } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export function useAudioRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current - pausedDurationRef.current) / 1000));
    }, 200);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;
      setState("recording");
      startTimer();
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, [startTimer]);

  const pause = useCallback(() => {
    mediaRecorderRef.current?.pause();
    stopTimer();
    pausedDurationRef.current += Date.now() - startTimeRef.current;
    setState("paused");
  }, [stopTimer]);

  const resume = useCallback(() => {
    mediaRecorderRef.current?.resume();
    startTimeRef.current = Date.now();
    startTimer();
    setState("recording");
  }, [startTimer]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopTimer();
    setState("stopped");
  }, [stopTimer]);

  const reset = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setState("idle");
  }, [audioUrl]);

  return { state, duration, audioBlob, audioUrl, start, pause, resume, stop, reset };
}
