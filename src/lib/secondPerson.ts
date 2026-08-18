/**
 * Rewrite examiner-facing feedback into second person, so the student PDF
 * speaks directly to the learner ("you use…" instead of "the candidate uses…").
 *
 * Deliberately conservative: only well-known third-person references to the
 * candidate are rewritten. Quoted evidence is left untouched.
 */

const VERB_FIXES: [RegExp, string][] = [
  // Common irregulars first.
  [/\byou\s+is\b/gi, "you are"],
  [/\byou\s+was\b/gi, "you were"],
  [/\byou\s+has\b/gi, "you have"],
  [/\byou\s+does\b/gi, "you do"],
  [/\byou\s+doesn't\b/gi, "you don't"],
  [/\byou\s+isn't\b/gi, "you aren't"],
  [/\byou\s+hasn't\b/gi, "you haven't"],
  [/\byou\s+wasn't\b/gi, "you weren't"],
];

/** Third-person -s verb after "you": "you uses" → "you use". */
function fixAgreement(text: string): string {
  let out = text;
  for (const [re, rep] of VERB_FIXES) out = out.replace(re, rep);
  out = out.replace(/\byou\s+([a-z]+)(es|s)\b/gi, (m, stem: string, suffix: string) => {
    // Don't touch words where the -s is part of the stem or a plural noun cue.
    if (/^(is|was|has|does|always|sometimes|this|thus|less|across)$/i.test(stem + suffix)) return m;
    if (suffix.toLowerCase() === "es" && /(s|sh|ch|x|z|o)$/i.test(stem)) return `you ${stem}`;
    if (suffix.toLowerCase() === "es") return `you ${stem}e`;
    return `you ${stem}`;
  });
  return out;
}

/**
 * Convert a feedback sentence to second person.
 * `name` is the candidate's name, when known, so "Juana shows…" also works.
 */
export function toSecondPerson(text: string, name?: string): string {
  if (!text) return text;
  let out = text;

  const first = (name ?? "").trim().split(/\s+/)[0];
  if (first && first.length > 1) {
    const esc = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${esc}'s\\b`, "gi"), "your");
    out = out.replace(new RegExp(`\\b${esc}\\b`, "gi"), "you");
  }

  out = out
    .replace(/\bthe candidate's\b/gi, "your")
    .replace(/\bcandidate's\b/gi, "your")
    .replace(/\bthe candidate\b/gi, "you")
    .replace(/\bcandidate\s+[A-C]'s\b/gi, "your")
    .replace(/\bcandidate\s+[A-C]\b/gi, "you")
    .replace(/\bthe student's\b/gi, "your")
    .replace(/\bthe student\b/gi, "you")
    .replace(/\bthe speaker's\b/gi, "your")
    .replace(/\bthe speaker\b/gi, "you")
    .replace(/\bhe or she\b/gi, "you")
    .replace(/\bhis or her\b/gi, "your")
    .replace(/\bs\/he\b/gi, "you")
    .replace(/\bhimself\b/gi, "yourself")
    .replace(/\bherself\b/gi, "yourself")
    .replace(/\bthey should\b/gi, "you should")
    .replace(/\bshe should\b/gi, "you should")
    .replace(/\bhe should\b/gi, "you should")
    .replace(/\bshe\b/gi, "you")
    .replace(/\bhe\b/gi, "you")
    // Object "her" (after a verb, before an adverb/preposition/punctuation) → "you".
    .replace(
      /\bher\b(?=\s+(again|back|to|for|from|with|about|and|that|when|so|too|as|in|on|at|first|clearly|harder|easier|better|more|less)\b)/gi,
      "you"
    )
    .replace(/\bher\b(?=\s*[,.;:!?])/gi, "you")
    .replace(/\bher own\b/gi, "your own")
    .replace(/\bhis own\b/gi, "your own")
    .replace(/\bhis\b/gi, "your")
    .replace(/\bhers\b/gi, "yours")
    .replace(/\bher\b/gi, "your")
    .replace(/\bhim\b/gi, "you");

  out = fixAgreement(out);

  // Re-capitalise sentence starts.
  out = out.replace(/(^|[.!?]\s+)([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
  return out.replace(/\s{2,}/g, " ").trim();
}
