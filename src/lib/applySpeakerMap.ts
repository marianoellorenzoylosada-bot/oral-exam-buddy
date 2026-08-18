import type { ScribeWord } from "@/lib/transcribe";

export type SpeakerRole =
  | "Examiner"
  | "Candidate A"
  | "Candidate B"
  | "Candidate C"
  | "Speaker unclear";

export type SpeakerMap = Record<string, SpeakerRole>;

/**
 * Rebuild a labelled transcript from Scribe word-level diarization + a
 * teacher-provided mapping of diarized speaker IDs to roles.
 *
 * - Consecutive words with the same speaker are joined into one utterance.
 * - Unmapped speakers fall back to "Speaker unclear".
 * - Output format matches what SpeakerTranscript and analyze-exam already
 *   understand ("Role: text" lines).
 */
export function applySpeakerMap(
  words: ScribeWord[] | undefined | null,
  map: SpeakerMap
): string {
  if (!words || words.length === 0) return "";
  type Utt = { speaker: string; text: string };
  const utts: Utt[] = [];
  for (const w of words) {
    const sp = (w.speaker ?? "").toString();
    if (!sp) continue;
    const t = (w.text ?? "").trim();
    if (!t) continue;
    const last = utts[utts.length - 1];
    if (last && last.speaker === sp) {
      last.text += (/^[.,!?;:]/.test(t) ? "" : " ") + t;
    } else {
      utts.push({ speaker: sp, text: t });
    }
  }
  return utts
    .map((u) => `${map[u.speaker] ?? "Speaker unclear"}: ${u.text.trim()}`)
    .join("\n");
}

/**
 * Summary stats per diarized speaker, used to drive the mapping UI.
 */
export interface SpeakerStat {
  id: string;
  totalSeconds: number;
  share: number; // 0..1 of total speaking time
  firstStart: number;
  sampleText: string;
}

export function speakerStats(words: ScribeWord[] | undefined | null): SpeakerStat[] {
  if (!words || words.length === 0) return [];
  const acc = new Map<
    string,
    { total: number; first: number; sample: string[] }
  >();
  for (const w of words) {
    const sp = (w.speaker ?? "").toString();
    if (!sp) continue;
    const dur = Math.max(0, (w.end ?? 0) - (w.start ?? 0));
    const cur = acc.get(sp) ?? { total: 0, first: w.start ?? 0, sample: [] };
    cur.total += dur;
    if ((w.start ?? 0) < cur.first) cur.first = w.start ?? 0;
    if (cur.sample.length < 18 && (w.text ?? "").trim()) cur.sample.push(w.text);
    acc.set(sp, cur);
  }
  const grand = Array.from(acc.values()).reduce((s, v) => s + v.total, 0) || 1;
  return Array.from(acc.entries())
    .map(([id, v]) => ({
      id,
      totalSeconds: v.total,
      share: v.total / grand,
      firstStart: v.first,
      sampleText: v.sample.join(" ").trim(),
    }))
    .sort((a, b) => a.firstStart - b.firstStart);
}

/** One token of an utterance, with its index in the original word array. */
export interface UtteranceToken {
  index: number;
  text: string;
  start: number;
  end: number;
}

/** One grouped intervention (consecutive words of the same diarized speaker). */
export interface Utterance {
  /** Position in the utterance list (changes when turns are split). */
  index: number;
  /** Index of the first word in the original word array — stable identity. */
  startWord: number;
  /** Diarized speaker id from Scribe. */
  speakerId: string;
  text: string;
  start: number;
  end: number;
  /** Words of this turn, for split-at-word editing. */
  tokens: UtteranceToken[];
  /** True when this turn starts at a manual split point. */
  manualStart?: boolean;
}

/**
 * Group the word timeline into utterances, preserving the original text.
 * `splitPoints` holds word indices that must force the start of a new turn,
 * letting the examiner cut a turn that actually mixes two voices.
 */
export function buildUtterances(
  words: ScribeWord[] | undefined | null,
  splitPoints?: Iterable<number> | null
): Utterance[] {
  if (!words || words.length === 0) return [];
  const splits = new Set<number>(splitPoints ?? []);
  const out: Utterance[] = [];
  words.forEach((w, wi) => {
    const sp = (w.speaker ?? "").toString();
    if (!sp) return;
    const t = (w.text ?? "").trim();
    if (!t) return;
    const token: UtteranceToken = {
      index: wi,
      text: t,
      start: w.start ?? 0,
      end: w.end ?? w.start ?? 0,
    };
    const last = out[out.length - 1];
    if (last && last.speakerId === sp && !splits.has(wi)) {
      last.text += (/^[.,!?;:]/.test(t) ? "" : " ") + t;
      last.end = token.end;
      last.tokens.push(token);
    } else {
      out.push({
        index: out.length,
        startWord: wi,
        speakerId: sp,
        text: t,
        start: token.start,
        end: token.end,
        tokens: [token],
        manualStart: splits.has(wi),
      });
    }
  });
  return out;
}

/**
 * Resolve the role of an utterance: per-line override wins over the global map.
 * Overrides are keyed by `startWord` so they survive splitting and merging.
 */
export function roleForUtterance(
  u: Utterance,
  map: SpeakerMap,
  overrides?: Record<number, SpeakerRole>
): SpeakerRole {
  return overrides?.[u.startWord] ?? map[u.speakerId] ?? "Speaker unclear";
}

/**
 * Rebuild the labelled transcript from the global mapping plus optional
 * per-utterance corrections. Without overrides the output matches
 * `applySpeakerMap`.
 */
export function applyUtteranceRoles(
  utterances: Utterance[],
  map: SpeakerMap,
  overrides?: Record<number, SpeakerRole>
): string {
  const merged: { role: SpeakerRole; text: string }[] = [];
  for (const u of utterances) {
    const role = roleForUtterance(u, map, overrides);
    const last = merged[merged.length - 1];
    if (last && last.role === role) last.text += " " + u.text.trim();
    else merged.push({ role, text: u.text.trim() });
  }
  return merged.map((m) => `${m.role}: ${m.text.trim()}`).join("\n");
}

