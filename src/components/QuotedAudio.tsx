import { useMemo } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScribeWord {
  text: string;
  start: number;
  end: number;
  speaker?: string | null;
}

interface Props {
  text: string;
  words: ScribeWord[];
  onSeek?: (startSec: number, endSec: number) => void;
  className?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, "").trim();

/** Find a contiguous word range in `words` that best matches the quote text.
 *  Returns null if no good match (shared-token ratio < 0.5). */
function findRange(quote: string, words: ScribeWord[]): { start: number; end: number } | null {
  const tokens = norm(quote).split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || words.length === 0) return null;
  const wordTokens = words.map((w) => norm(w.text));
  let best = { score: 0, i: -1, len: tokens.length };
  // Scan windows of ~tokens.length around the transcript
  const windowLen = tokens.length;
  for (let i = 0; i <= wordTokens.length - 1; i++) {
    let hits = 0;
    for (let j = 0; j < windowLen && i + j < wordTokens.length; j++) {
      if (wordTokens[i + j] && tokens.includes(wordTokens[i + j])) hits++;
    }
    if (hits > best.score) best = { score: hits, i, len: windowLen };
  }
  const ratio = best.score / windowLen;
  if (best.i < 0 || ratio < 0.5) return null;
  const startWord = words[best.i];
  const endWord = words[Math.min(best.i + windowLen - 1, words.length - 1)];
  return { start: startWord.start, end: endWord.end };
}

/** Detect quoted spans inside a feedback string and render them clickable. */
export function QuotedAudio({ text, words, onSeek, className }: Props) {
  const segments = useMemo(() => {
    if (!words || words.length === 0) return [{ kind: "text" as const, value: text }];
    // Split on straight or curly quotes
    const re = /"([^"]{3,200})"|"([^"]{3,200})"/g;
    const out: Array<{ kind: "text" | "quote"; value: string; range?: { start: number; end: number } }> = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
      const quote = m[1] || m[2] || "";
      const range = findRange(quote, words) ?? undefined;
      out.push({ kind: "quote", value: quote, range });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
    return out;
  }, [text, words]);

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.kind === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : seg.range && onSeek ? (
          <button
            key={i}
            type="button"
            onClick={() => onSeek(seg.range!.start, seg.range!.end)}
            className={cn(
              "mx-0.5 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10",
              "px-1.5 py-0.5 text-[0.85em] italic text-primary hover:bg-primary/20 transition-colors"
            )}
            title={`Play ${seg.range.start.toFixed(1)}s – ${seg.range.end.toFixed(1)}s`}
          >
            <Play className="h-3 w-3" />
            "{seg.value}"
          </button>
        ) : (
          <span key={i} className="italic">"{seg.value}"</span>
        )
      )}
    </span>
  );
}
