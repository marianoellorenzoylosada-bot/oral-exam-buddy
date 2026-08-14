import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Rewind, FastForward, Loader2, AlertCircle } from "lucide-react";
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

interface Props {
  audioPath: string | null;
  /** Not-yet-uploaded recording (used in the draft review before signing). */
  localBlob?: Blob | null;
}

/**
 * Seekable player for a stored attempt recording.
 * Browser-recorded `.webm` files served over HTTP often lack duration metadata,
 * so we download the whole object once and play it from a local blob URL — that
 * makes arbitrary seeking (forward included) reliable.
 */
export const AttemptAudioPlayer = forwardRef<AttemptAudioPlayerHandle, Props>(
  function AttemptAudioPlayer({ audioPath, localBlob }, ref) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);

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
              onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
              onPlay={() => setPlaying(true)}
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
            </div>
          </>
        )}
      </div>
    );
  }
);
