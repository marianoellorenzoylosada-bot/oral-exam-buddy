import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Rewind, FastForward, Loader2, AlertCircle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedAudioUrl } from "@/lib/audioStorage";

export interface AttemptAudioPlayerHandle {
  /** Jump to a given second and start playing. */
  seek: (seconds: number) => void;
}

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

interface Props {
  audioPath: string | null;
  /** Not-yet-uploaded recording (used in the draft review before signing). */
  localBlob?: Blob | null;
  /** Reports the current playback position (used to follow the script). */
  onTime?: (seconds: number) => void;
  /** When set, a download button saves the recording with this file name. */
  downloadName?: string;
}


/**
 * Seekable player for a stored attempt recording.
 * Browser-recorded `.webm` files served over HTTP often lack duration metadata,
 * so we download the whole object once and play it from a local blob URL — that
 * makes arbitrary seeking (forward included) reliable.
 */
export const AttemptAudioPlayer = forwardRef<AttemptAudioPlayerHandle, Props>(
  function AttemptAudioPlayer({ audioPath, localBlob, onTime, downloadName }, ref) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blobRef = useRef<Blob | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [speed, setSpeed] = useState(1);


    useEffect(() => {
      let objectUrl: string | null = null;
      let cancelled = false;
      setUrl(null);
      setError(null);
      setCurrent(0);
      setDuration(0);
      setPlaying(false);

      if (!audioPath) {
        // Not uploaded yet: play the local recording directly.
        if (localBlob) {
          blobRef.current = localBlob;
          objectUrl = URL.createObjectURL(localBlob);
          setUrl(objectUrl);
        }
        return () => {
          cancelled = true;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
      }

      (async () => {
        setLoading(true);
        try {
          const { data, error: dlError } = await supabase.storage
            .from("exam-audio")
            .download(audioPath);
          if (cancelled) return;
          if (data && !dlError) {
            blobRef.current = data;
            objectUrl = URL.createObjectURL(data);
            setUrl(objectUrl);

          } else {
            const signed = await getSignedAudioUrl(audioPath);
            if (cancelled) return;
            if (signed) setUrl(signed);
            else setError("Audio unavailable for this recording.");
          }
        } catch {
          if (!cancelled) setError("Could not load the recording.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, [audioPath, localBlob]);

    useImperativeHandle(ref, () => ({
      seek: (seconds: number) => {
        const el = audioRef.current;
        if (!el) return;
        try {
          el.currentTime = Math.max(0, seconds);
          setCurrent(Math.max(0, seconds));
          void el.play().catch(() => undefined);
        } catch {
          /* ignore */
        }
      },
    }));

    const toggle = () => {
      const el = audioRef.current;
      if (!el) return;
      if (el.paused) void el.play().catch(() => undefined);
      else el.pause();
    };

    const nudge = (delta: number) => {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = Math.min(Math.max(0, el.currentTime + delta), duration || el.currentTime + delta);
    };

    const cycleSpeed = () => {
      const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
      setSpeed(next);
      if (audioRef.current) audioRef.current.playbackRate = next;
    };

    /** Save the recording locally instead of opening it in a new tab. */
    const download = () => {
      const blob = blobRef.current;
      const name = downloadName || "recording.webm";
      if (blob) {
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 4000);
      } else if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    };

    if (!audioPath && !localBlob) return null;


    return (
      <div className="rounded-md border bg-muted/20 p-2.5 space-y-2">
        {loading && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Preparing audio…
          </p>
        )}
        {error && (
          <p className="text-[11px] text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" /> {error}
          </p>
        )}
        {url && (
          <>
            <audio
              ref={audioRef}
              src={url}
              preload="auto"
              onLoadedMetadata={(e) => {
                const d = (e.target as HTMLAudioElement).duration;
                if (Number.isFinite(d)) setDuration(d);
              }}
              onDurationChange={(e) => {
                const d = (e.target as HTMLAudioElement).duration;
                if (Number.isFinite(d)) setDuration(d);
              }}
              onTimeUpdate={(e) => {
                const t = (e.target as HTMLAudioElement).currentTime;
                setCurrent(t);
                onTime?.(t);
              }}
              onPlay={(e) => {
                (e.target as HTMLAudioElement).playbackRate = speed;
                setPlaying(true);
              }}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => nudge(-5)} aria-label="Back 5 seconds">
                <Rewind className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="secondary" className="h-8 w-8" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => nudge(5)} aria-label="Forward 5 seconds">
                <FastForward className="h-3.5 w-3.5" />
              </Button>
              <Slider
                value={[Math.min(current, duration || current)]}
                min={0}
                max={duration || Math.max(current, 1)}
                step={0.5}
                onValueChange={([v]) => {
                  const el = audioRef.current;
                  setCurrent(v);
                  if (el) el.currentTime = v;
                }}
                className="flex-1"
                aria-label="Audio position"
              />
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground shrink-0">
                {fmt(current)} / {duration ? fmt(duration) : "--:--"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 font-mono text-[11px] shrink-0"
                onClick={cycleSpeed}
                aria-label="Playback speed"
                title="Playback speed"
              >
                {speed}×
              </Button>
              {downloadName && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={download}
                  aria-label="Download recording"
                  title="Download recording"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

          </>
        )}
      </div>
    );
  }
);
