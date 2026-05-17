import type { ScribeWord } from "@/lib/transcribe";

/**
 * Best-effort client-side speaker labelling from ElevenLabs Scribe word-level
 * diarization. Used when the upstream transcript has no labels.
 *
 * Heuristic mapping (revised — Phase B):
 *  - Group consecutive words by `speaker` id into utterances.
 *  - If <2 distinct speakers OR no usable speaker ids → return original text.
 *  - Identify the Examiner as the speaker with the smallest speaking-time
 *    share PROVIDED that share is at least moderately smaller than the largest
 *    candidate share (ratio ≤ 0.75). This produces an Examiner in typical
 *    2- or 3-candidate exams where the teacher speaks less than each student.
 *  - Remaining speakers, in order of first appearance, become Candidate A/B/C.
 *  - If we cannot confidently pick an Examiner, candidates are still labelled
 *    A/B/C by first appearance and the most-talkative speaker is tagged
 *    "Speaker unclear" so the transcript is ALWAYS rendered as a script,
 *    never as a flat paragraph.
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

  // Sort asc by speaking time. Smallest share is the Examiner candidate.
  const sorted = [...totals.entries()].sort((a, b) => a[1] - b[1]);
  const [minSpeaker, minTime] = sorted[0];
  const [, maxTime] = sorted[sorted.length - 1];
  const ratio = maxTime > 0 ? minTime / maxTime : 1;
  // Examiner heuristic: clearly less talkative than the busiest speaker.
  const examinerId = ratio <= 0.75 ? minSpeaker : null;
  // When we can't pick an Examiner, tag the busiest speaker as "unclear"
  // so we never silently mislabel a candidate as Examiner.
  const unclearId = examinerId ? null : sorted[sorted.length - 1][0];

  // Order remaining speakers by first appearance for A/B/C assignment.
  const candidateOrder: string[] = [];
  for (const u of utterances) {
    if (u.speaker === examinerId) continue;
    if (u.speaker === unclearId) continue;
    if (!candidateOrder.includes(u.speaker)) candidateOrder.push(u.speaker);
  }
  const candidateLetters = ["A", "B", "C"];

  const labelFor = (sp: string): string => {
    if (examinerId && sp === examinerId) return "Examiner";
    if (unclearId && sp === unclearId) return "Speaker unclear";
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
