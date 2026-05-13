import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Renders a transcript as a clear speaking script.
 * - One utterance per row, with a labelled speaker tag.
 * - Recognised speakers: Examiner, Candidate A/B/C.
 * - Anything else (Speaker 1, Unknown, raw "speaker_0", etc.) → "Speaker unclear".
 * - When `words` (ElevenLabs Scribe per-word timeline) is provided, a small
 *   timestamp is shown for each utterance based on the first matched word.
 * Original transcript text is preserved verbatim — only formatting changes.
 */

export interface ScribeWordLite {
  text: string;
  start: number;
  end: number;
  speaker?: string | null;
}

interface SpeakerTranscriptProps {
  transcript: string;
  /** Hide full text (anonymization mode) */
  hidden?: boolean;
  maxHeight?: string;
  /** Optional Scribe word timeline used to derive per-utterance timestamps. */
  words?: ScribeWordLite[];
}

interface TranscriptLine {
  rawSpeaker: string;
  label: SpeakerLabel;
  text: string;
}

type SpeakerLabel =
  | "Examiner"
  | "Candidate A"
  | "Candidate B"
  | "Candidate C"
  | "Speaker unclear";

const STYLES: Record<SpeakerLabel, { dot: string; tag: string; accent: string }> = {
  Examiner: {
    dot: "bg-muted-foreground",
    tag: "text-muted-foreground",
    accent: "border-l-muted-foreground/40",
  },
  "Candidate A": {
    dot: "bg-primary",
    tag: "text-primary",
    accent: "border-l-primary/60",
  },
  "Candidate B": {
    dot: "bg-accent-foreground",
    tag: "text-accent-foreground",
    accent: "border-l-accent-foreground/50",
  },
  "Candidate C": {
    // `--warning` may not exist in every theme — fall back via tailwind amber tones.
    dot: "bg-amber-500",
    tag: "text-amber-600 dark:text-amber-400",
    accent: "border-l-amber-500/60",
  },
  "Speaker unclear": {
    dot: "bg-destructive/70",
    tag: "text-destructive",
    accent: "border-l-destructive/40",
  },
};

function normaliseSpeaker(raw: string): SpeakerLabel {
  const k = raw.toLowerCase().replace(/[:\s]+$/, "").trim();
  if (k === "examiner" || k === "teacher" || k === "interlocutor") return "Examiner";
  const candMatch = k.match(/^candidate\s+([a-c])\b/);
  if (candMatch) {
    const letter = candMatch[1].toUpperCase();
    if (letter === "A") return "Candidate A";
    if (letter === "B") return "Candidate B";
    if (letter === "C") return "Candidate C";
  }
  return "Speaker unclear";
}

function parseTranscript(raw: string): TranscriptLine[] {
  if (!raw) return [];
  const regex = /(?:^|\n)\s*((?:Examiner|Teacher|Interlocutor|Candidate\s+[A-Z]|Speaker\s*\d*|Unknown|Narrator)\s*(?:\([^)]*\))?)\s*:\s*/gi;

  const lines: TranscriptLine[] = [];
  let lastIndex = 0;
  let lastSpeaker = "";

  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    if (lastSpeaker && match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index).trim();
      if (text) lines.push({ rawSpeaker: lastSpeaker, label: normaliseSpeaker(lastSpeaker), text });
    } else if (!lastSpeaker && match.index > 0) {
      const text = raw.slice(0, match.index).trim();
      if (text) lines.push({ rawSpeaker: "", label: "Speaker unclear", text });
    }
    lastSpeaker = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  if (lastSpeaker) {
    const text = raw.slice(lastIndex).trim();
    if (text) lines.push({ rawSpeaker: lastSpeaker, label: normaliseSpeaker(lastSpeaker), text });
  } else if (raw.trim()) {
    lines.push({ rawSpeaker: "", label: "Speaker unclear", text: raw.trim() });
  }

  return lines;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, " ").trim();

function formatTs(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** Find the timestamp of the first word of `text` inside `words`. */
function firstTimestamp(text: string, words: ScribeWordLite[], cursor: { i: number }): number | null {
  if (!words.length) return null;
  const tokens = norm(text).split(/\s+/).filter(Boolean).slice(0, 6);
  if (!tokens.length) return null;
  // Sliding scan from cursor forward; allow some tolerance.
  for (let i = cursor.i; i <= words.length - 1; i++) {
    let hits = 0;
    const window = Math.min(tokens.length, words.length - i);
    for (let j = 0; j < window; j++) {
      if (norm(words[i + j].text) === tokens[j]) hits++;
    }
    if (hits >= Math.max(1, Math.floor(tokens.length / 2))) {
      cursor.i = i + window;
      return words[i].start;
    }
  }
  return null;
}

export function SpeakerTranscript({ transcript, hidden, maxHeight = "20rem", words }: SpeakerTranscriptProps) {
  const lines = useMemo(() => parseTranscript(transcript), [transcript]);

  const timestamps = useMemo(() => {
    if (!words || words.length === 0) return [];
    const cursor = { i: 0 };
    return lines.map((l) => firstTimestamp(l.text, words, cursor));
  }, [lines, words]);

  if (hidden) {
    return (
      <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground italic">
        [Transcript hidden — anonymization enabled]
      </div>
    );
  }

  // No speaker labels detected → plain fallback (preserve original text).
  if (lines.length === 0 || (lines.length === 1 && lines[0].rawSpeaker === "")) {
    return (
      <ScrollArea className="rounded-lg bg-muted/30 p-4" style={{ maxHeight }}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="rounded-lg border bg-card" style={{ maxHeight }}>
      <ol className="divide-y divide-border">
        {lines.map((line, i) => {
          const style = STYLES[line.label];
          const ts = timestamps[i] ?? null;
          return (
            <li
              key={i}
              className={cn(
                "group border-l-2 px-3 py-2.5 transition-colors hover:bg-muted/40",
                style.accent
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden
                    className={cn("inline-block h-2 w-2 shrink-0 rounded-full", style.dot)}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider",
                      style.tag
                    )}
                  >
                    {line.label}
                  </span>
                </div>
                {ts !== null && (
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    {formatTs(ts)}
                  </span>
                )}
              </div>
              <p className="mt-1 pl-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {line.text}
              </p>
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}
