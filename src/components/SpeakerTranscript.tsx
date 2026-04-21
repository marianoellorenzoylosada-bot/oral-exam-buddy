import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Parses a transcript string with "Speaker:" prefixes and renders
 * colour-coded blocks per speaker (Examiner, Candidate A/B/C…).
 */

interface SpeakerTranscriptProps {
  transcript: string;
  /** Hide full text (anonymization mode) */
  hidden?: boolean;
  maxHeight?: string;
}

interface TranscriptLine {
  speaker: string;
  text: string;
}

// Speaker colour palette — using CSS-variable–friendly Tailwind classes
const SPEAKER_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  examiner: {
    bg: "bg-muted/60",
    border: "border-muted-foreground/20",
    label: "text-muted-foreground",
  },
  "candidate a": {
    bg: "bg-primary/8",
    border: "border-primary/20",
    label: "text-primary",
  },
  "candidate b": {
    bg: "bg-accent/40",
    border: "border-accent-foreground/20",
    label: "text-accent-foreground",
  },
  "candidate c": {
    bg: "bg-warning/10",
    border: "border-warning/30",
    label: "text-warning",
  },
};

function getStyle(speaker: string) {
  const key = speaker.toLowerCase().replace(/[:\s]+$/, "").trim();
  return (
    SPEAKER_STYLES[key] ??
    // fallback: match partial name
    Object.entries(SPEAKER_STYLES).find(([k]) => key.includes(k))?.[1] ?? {
      bg: "bg-secondary/30",
      border: "border-secondary/20",
      label: "text-secondary-foreground",
    }
  );
}

function parseTranscript(raw: string): TranscriptLine[] {
  if (!raw) return [];

  // Split on speaker labels like "Examiner:", "Candidate A:", etc.
  const regex = /(?:^|\n)((?:Examiner|Candidate\s+[A-Z]|Teacher|Interlocutor|Speaker\s*\d*)\s*(?:\([^)]*\))?)\s*:\s*/gi;

  const lines: TranscriptLine[] = [];
  let lastIndex = 0;
  let lastSpeaker = "";

  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    // Capture text before this match under the previous speaker
    if (lastSpeaker && match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index).trim();
      if (text) lines.push({ speaker: lastSpeaker, text });
    } else if (!lastSpeaker && match.index > 0) {
      // Text before any speaker label
      const text = raw.slice(0, match.index).trim();
      if (text) lines.push({ speaker: "Narrator", text });
    }
    lastSpeaker = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last speaker
  if (lastSpeaker) {
    const text = raw.slice(lastIndex).trim();
    if (text) lines.push({ speaker: lastSpeaker, text });
  } else if (raw.trim()) {
    // No speaker labels found — show as plain text
    lines.push({ speaker: "", text: raw.trim() });
  }

  return lines;
}

export function SpeakerTranscript({ transcript, hidden, maxHeight = "20rem" }: SpeakerTranscriptProps) {
  const lines = useMemo(() => parseTranscript(transcript), [transcript]);

  if (hidden) {
    return (
      <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground italic">
        [Transcript hidden — anonymization enabled]
      </div>
    );
  }

  // No speaker labels detected — plain fallback
  if (lines.length <= 1 && lines[0]?.speaker === "") {
    return (
      <ScrollArea className="rounded-lg bg-muted/50 p-4" style={{ maxHeight }}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="rounded-lg bg-muted/30 p-2" style={{ maxHeight }}>
      <div className="space-y-1.5">
        {lines.map((line, i) => {
          const style = getStyle(line.speaker);
          return (
            <div
              key={i}
              className={`rounded-md border px-3 py-2 ${style.bg} ${style.border}`}
            >
              {line.speaker && (
                <span className={`text-xs font-semibold uppercase tracking-wide ${style.label}`}>
                  {line.speaker}
                </span>
              )}
              <p className="text-sm leading-relaxed mt-0.5">{line.text}</p>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
