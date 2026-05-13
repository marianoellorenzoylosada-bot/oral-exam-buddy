import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MicOff, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LiveTranscriptProps {
  isRecording: boolean;
  onTranscriptUpdate?: (fullText: string) => void;
}

export function LiveTranscript({ isRecording, onTranscriptUpdate }: LiveTranscriptProps) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullTranscript, setFullTranscript] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const triedRef = useRef(false);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: () => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    },
    onCommittedTranscript: (data) => {
      setFullTranscript((prev) => {
        const updated = prev ? `${prev} ${data.text}` : data.text;
        onTranscriptUpdate?.(updated);
        return updated;
      });
    },
  });

  const startTranscription = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.token) throw new Error("No token received");

      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err: any) {
      console.error("Transcription start failed:", err);
      setError(err?.message || "Could not start live transcription.");
    } finally {
      setConnecting(false);
    }
  }, [scribe]);

  // Auto-connect when recording starts; auto-disconnect when it stops
  useEffect(() => {
    if (isRecording && !scribe.isConnected && !connecting && !triedRef.current) {
      triedRef.current = true;
      void startTranscription();
    }
    if (!isRecording) {
      triedRef.current = false;
      if (scribe.isConnected) scribe.disconnect();
    }
  }, [isRecording, scribe, connecting, startTranscription]);

  const committedTexts = scribe.committedTranscripts?.map((t) => t.text) ?? [];
  const displayText = [...committedTexts, scribe.partialTranscript].filter(Boolean).join(" ");

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Live Transcript</h3>
          {scribe.isConnected && (
            <Badge variant="default" className="gap-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-foreground" />
              </span>
              Listening
            </Badge>
          )}
          {connecting && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" /> Connecting…
            </Badge>
          )}
        </div>
        {scribe.isConnected && (
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => scribe.disconnect()}>
            <MicOff className="h-3.5 w-3.5" /> Stop
          </Button>
        )}
        {error && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { triedRef.current = false; void startTranscription(); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Live transcription unavailable: {error}. The recording will still be transcribed automatically when you submit.</span>
        </div>
      )}

      <div
        ref={scrollRef}
        className="rounded-lg border bg-muted/20 p-4 min-h-[120px] max-h-[240px] overflow-y-auto"
      >
        {displayText ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {committedTexts.join(" ")}
            {scribe.partialTranscript && (
              <span className="text-muted-foreground italic"> {scribe.partialTranscript}</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {scribe.isConnected
              ? "Listening… speak to see the transcript appear here."
              : connecting
              ? "Connecting to the transcription service…"
              : isRecording
              ? "Waiting for live transcription to start…"
              : "Live transcription will start automatically when you press record."}
          </p>
        )}
      </div>

      {fullTranscript && (
        <p className="text-xs text-muted-foreground">
          {fullTranscript.split(/\s+/).length} words transcribed live
        </p>
      )}
    </div>
  );
}
