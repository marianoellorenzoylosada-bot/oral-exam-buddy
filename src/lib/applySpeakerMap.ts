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
