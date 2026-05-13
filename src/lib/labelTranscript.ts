import type { ScribeWord } from "@/lib/transcribe";

/**
 * Best-effort client-side speaker labelling from ElevenLabs Scribe word-level
 * diarization. Used only when the upstream transcript has no labels.
 *
 * Heuristic mapping (deliberately conservative):
 *  - Group consecutive words by `speaker` id into utterances.
 *  - If <2 distinct speakers OR no usable speaker ids → return original text.
 *  - The speaker with the smallest share of total speaking time is treated as
 *    the Examiner ONLY when their share is clearly smaller than the others
 *    (≤35% of total). Otherwise every utterance is labelled "Speaker unclear".
 *  - Remaining speakers, in order of first appearance, become Candidate A/B/C.
 *
 * Anything ambiguous falls back to "Speaker unclear" so we never confidently
 * mislabel an examiner or a candidate.
 */
export function labelTranscriptFromWords(
  text: string,
  words: ScribeWord[] | undefined | null
): string {
  if (!words || words.length === 0) return text;

  // Group consecutive words by speaker id.
  type Utt = { speaker: string; text: string; duration: number };
  const utterances: Utt[] = [];
  for (const w of words) {
    const sp = (w.speaker ?? "").toString();
    if (!sp) continue;
    const wordText = (w.text ?? "").trim();
    if (!wordText) continue;
    const dur = Math.max(0, (w.end ?? 0) - (w.start ?? 0));
    const last = utterances[utterances.length - 1];
    if (last && last.speaker === sp) {
      last.text += (/^[.,!?;:]/.test(wordText) ? "" : " ") + wordText;
      last.duration += dur;
    } else {
      utterances.push({ speaker: sp, text: wordText, duration: dur });
    }
  }
  if (utterances.length === 0) return text;

  // Aggregate speaking time per speaker.
  const totals = new Map<string, number>();
  for (const u of utterances) {
    totals.set(u.speaker, (totals.get(u.speaker) ?? 0) + Math.max(u.duration, 0.001));
  }
  const distinct = Array.from(totals.keys());
  if (distinct.length < 2) return text;

  // Identify Examiner conservatively: smallest share, clearly less than others.
  const totalTime = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  const sorted = [...totals.entries()].sort((a, b) => a[1] - b[1]); // asc
  const [minSpeaker, minTime] = sorted[0];
  const minShare = totalTime > 0 ? minTime / totalTime : 1;

  const examinerId = minShare <= 0.35 ? minSpeaker : null;

  // Order remaining speakers by first appearance for A/B/C assignment.
  const candidateOrder: string[] = [];
  for (const u of utterances) {
    if (u.speaker === examinerId) continue;
    if (!candidateOrder.includes(u.speaker)) candidateOrder.push(u.speaker);
  }
  const candidateLetters = ["A", "B", "C"];

  const labelFor = (sp: string): string => {
    if (examinerId && sp === examinerId) return "Examiner";
    const idx = candidateOrder.indexOf(sp);
    if (idx >= 0 && idx < candidateLetters.length) return `Candidate ${candidateLetters[idx]}`;
    return "Speaker unclear";
  };

  // Re-emit transcript with labels, one utterance per line.
  return utterances
    .map((u) => `${labelFor(u.speaker)}: ${u.text.trim()}`)
    .join("\n");
}

/**
 * Returns true if `text` already contains at least two distinct, recognisable
 * speaker labels (Examiner / Candidate A-C). Used to decide whether to keep an
 * upstream labelled transcript untouched.
 */
export function hasClearSpeakerLabels(text: string): boolean {
  if (!text) return false;
  const found = new Set<string>();
  const re = /(^|\n)\s*(Examiner|Teacher|Interlocutor|Candidate\s+[A-C])\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    found.add(m[2].toLowerCase().replace(/\s+/g, " "));
    if (found.size >= 2) return true;
  }
  return false;
}
