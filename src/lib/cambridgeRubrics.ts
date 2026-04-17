// Official Cambridge Speaking assessment criteria and descriptors.
// Source: Cambridge Assessment English Speaking Examiner Handbooks
// (B2 First descriptors used verbatim; A2/B1/C1/C2 adapted from the
// overall Speaking band descriptors table.)
//
// Five criteria, each scored 0–5 in 0.5 increments. Half-bands are awarded
// when performance shares features of the bands above and below.

export type CambridgeLevel = "A2" | "B1" | "B2" | "C1" | "C2";

export interface CambridgeExamMeta {
  value: CambridgeLevel;
  label: string;        // e.g. "B2 First (FCE)"
  shortName: string;    // e.g. "B2 First"
  cefr: CambridgeLevel; // CEFR code stored in DB
}

export const CAMBRIDGE_EXAMS: CambridgeExamMeta[] = [
  { value: "A2", label: "A2 Key (KET)", shortName: "A2 Key", cefr: "A2" },
  { value: "B1", label: "B1 Preliminary (PET)", shortName: "B1 Preliminary", cefr: "B1" },
  { value: "B2", label: "B2 First (FCE)", shortName: "B2 First", cefr: "B2" },
  { value: "C1", label: "C1 Advanced (CAE)", shortName: "C1 Advanced", cefr: "C1" },
  { value: "C2", label: "C2 Proficiency (CPE)", shortName: "C2 Proficiency", cefr: "C2" },
];

export const CAMBRIDGE_CRITERIA = [
  "Grammar and Vocabulary",
  "Discourse Management",
  "Pronunciation",
  "Interactive Communication",
  "Global Achievement",
] as const;

export type CambridgeCriterion = typeof CAMBRIDGE_CRITERIA[number];

// 0–5 band descriptors per criterion per level.
// Each entry maps a whole band (5, 3, 1) to its descriptor; bands 4 and 2
// represent performance sharing features of the bands above and below.
// Band 0 = performance below band 1.
type BandDescriptors = Record<CambridgeCriterion, { "5": string; "3": string; "1": string }>;

const B2: BandDescriptors = {
  "Grammar and Vocabulary": {
    "5": "Shows a good degree of control of a range of simple and complex grammatical forms. Uses a range of appropriate vocabulary to give and exchange views on familiar and unfamiliar topics.",
    "3": "Shows a good degree of control of simple grammatical forms, and attempts some complex grammatical forms. Uses a range of appropriate vocabulary when talking about familiar topics.",
    "1": "Shows sufficient control of simple grammatical forms. Uses a limited range of appropriate vocabulary to talk about familiar topics.",
  },
  "Discourse Management": {
    "5": "Produces extended stretches of language with very little hesitation. Contributions are relevant, coherent and varied. Uses a wide range of cohesive devices and discourse markers.",
    "3": "Produces extended stretches of language despite some hesitation. Contributions are relevant and there is a clear organisation of ideas. Uses a range of cohesive devices and discourse markers.",
    "1": "Produces responses which are extended beyond short phrases, despite hesitation. Contributions are mostly relevant, but there may be some repetition. Uses basic cohesive devices.",
  },
  "Pronunciation": {
    "5": "Is intelligible. Intonation is appropriate. Sentence and word stress is accurately placed. Individual sounds are articulated clearly.",
    "3": "Is intelligible. Intonation is generally appropriate. Sentence and word stress is generally accurately placed. Individual sounds are generally articulated clearly.",
    "1": "Is mostly intelligible, and has some control of phonological features at both utterance and word levels.",
  },
  "Interactive Communication": {
    "5": "Initiates and responds appropriately, linking contributions to those of other speakers. Maintains and develops the interaction and negotiates towards an outcome.",
    "3": "Initiates and responds appropriately. Maintains and develops the interaction and negotiates towards an outcome with very little support.",
    "1": "Maintains simple exchanges, despite some difficulty. Requires prompting and support.",
  },
  "Global Achievement": {
    "5": "Handles communication on a range of familiar and unfamiliar topics, with very little hesitation. Produces extended discourse that is coherent and easy to follow.",
    "3": "Handles communication on familiar topics, despite some hesitation. Organises extended discourse but occasionally produces utterances that lack coherence.",
    "1": "Handles communication in everyday situations, despite hesitation. Constructs longer utterances but is not able to use complex language except in well-rehearsed utterances.",
  },
};

const A2: BandDescriptors = {
  "Grammar and Vocabulary": {
    "5": "Shows sufficient control of simple grammatical forms. Uses a range of appropriate vocabulary when talking about everyday situations.",
    "3": "Shows sufficient control of simple grammatical forms. Uses appropriate vocabulary to talk about everyday situations.",
    "1": "Shows only limited control of a few grammatical forms. Uses a vocabulary of isolated words and phrases.",
  },
  "Discourse Management": {
    "5": "Produces responses which are extended beyond short phrases, despite hesitation. Contributions are mostly relevant, despite some repetition. Uses basic cohesive devices.",
    "3": "Produces responses which are characterised by short phrases and frequent hesitation. Repeats information or digresses from the topic.",
    "1": "Produces responses which are short. Contributions are sometimes difficult to follow.",
  },
  "Pronunciation": {
    "5": "Is mostly intelligible, and has some control of phonological features at both utterance and word levels.",
    "3": "Is mostly intelligible, despite limited control of phonological features.",
    "1": "Has very limited control of phonological features and is often unintelligible.",
  },
  "Interactive Communication": {
    "5": "Maintains simple exchanges, despite some difficulty. Requires prompting and support.",
    "3": "Maintains simple exchanges. Requires prompting and support.",
    "1": "Has considerable difficulty maintaining simple exchanges. Requires additional prompting and support.",
  },
  "Global Achievement": {
    "5": "Handles communication in everyday situations, despite hesitation. Constructs longer utterances but is not able to use complex language except in well-rehearsed utterances.",
    "3": "Handles short, basic exchanges, despite hesitation. Constructs longer utterances but cannot use complex language except in well-rehearsed utterances.",
    "1": "Conveys basic meaning in very short utterances. Responses are mainly isolated words or short formulaic phrases.",
  },
};

const B1: BandDescriptors = {
  "Grammar and Vocabulary": {
    "5": "Shows a good degree of control of simple grammatical forms, and attempts some complex grammatical forms. Uses a range of appropriate vocabulary when talking about familiar topics.",
    "3": "Shows sufficient control of simple grammatical forms. Uses a range of appropriate vocabulary to talk about familiar topics.",
    "1": "Shows sufficient control of a few simple grammatical forms. Uses a limited range of appropriate vocabulary to talk about familiar topics.",
  },
  "Discourse Management": {
    "5": "Produces extended stretches of language despite some hesitation. Contributions are relevant and there is a clear organisation of ideas. Uses a range of cohesive devices.",
    "3": "Produces responses which are extended beyond short phrases, despite hesitation. Contributions are mostly relevant, despite some repetition. Uses basic cohesive devices.",
    "1": "Produces responses which are characterised by short phrases and frequent hesitation. Repeats information or digresses from the topic.",
  },
  "Pronunciation": {
    "5": "Is intelligible. Intonation is generally appropriate. Sentence and word stress is generally accurately placed. Individual sounds are generally articulated clearly.",
    "3": "Is mostly intelligible, and has some control of phonological features at both utterance and word levels.",
    "1": "Is mostly intelligible, despite limited control of phonological features.",
  },
  "Interactive Communication": {
    "5": "Initiates and responds appropriately. Maintains and develops the interaction and negotiates towards an outcome with very little support.",
    "3": "Maintains simple exchanges, despite some difficulty. Requires prompting and support.",
    "1": "Has considerable difficulty maintaining simple exchanges. Requires additional prompting and support.",
  },
  "Global Achievement": {
    "5": "Handles communication on familiar topics, despite some hesitation. Organises extended discourse but occasionally produces utterances that lack coherence.",
    "3": "Handles communication in everyday situations, despite hesitation. Constructs longer utterances but cannot use complex language except in well-rehearsed utterances.",
    "1": "Handles short, basic exchanges, despite hesitation. Constructs longer utterances but cannot use complex language.",
  },
};

const C1: BandDescriptors = {
  "Grammar and Vocabulary": {
    "5": "Maintains control of a wide range of grammatical forms and uses them with flexibility. Uses a wide range of appropriate vocabulary with flexibility to give and exchange views on familiar and unfamiliar topics.",
    "3": "Shows a good degree of control of a range of simple and complex grammatical forms. Uses a range of appropriate vocabulary to give and exchange views on familiar and unfamiliar topics.",
    "1": "Shows a good degree of control of simple grammatical forms, and attempts some complex grammatical forms. Uses a range of appropriate vocabulary when talking about familiar topics.",
  },
  "Discourse Management": {
    "5": "Produces extended stretches of language with ease and with very little hesitation. Contributions are relevant, coherent, varied and detailed. Makes full and effective use of a wide range of cohesive devices and discourse markers.",
    "3": "Produces extended stretches of language with very little hesitation. Contributions are relevant, coherent and varied. Uses a wide range of cohesive devices and discourse markers.",
    "1": "Produces extended stretches of language despite some hesitation. Contributions are relevant and there is a clear organisation of ideas. Uses a range of cohesive devices.",
  },
  "Pronunciation": {
    "5": "Is intelligible. Intonation is appropriate. Sentence and word stress is accurately placed. Individual sounds are articulated clearly. Is effortless to understand.",
    "3": "Is intelligible. Intonation is appropriate. Sentence and word stress is accurately placed. Individual sounds are articulated clearly.",
    "1": "Is intelligible. Intonation is generally appropriate. Sentence and word stress is generally accurately placed.",
  },
  "Interactive Communication": {
    "5": "Interacts with ease, linking contributions to those of other speakers. Widens the scope of the interaction and develops it fully and effectively towards a negotiated outcome.",
    "3": "Initiates and responds appropriately, linking contributions to those of other speakers. Maintains and develops the interaction and negotiates towards an outcome.",
    "1": "Initiates and responds appropriately. Maintains and develops the interaction and negotiates towards an outcome with very little support.",
  },
  "Global Achievement": {
    "5": "Handles communication on a wide range of familiar and unfamiliar topics, with very little hesitation. Produces extended discourse that is coherent, easy to follow and detailed.",
    "3": "Handles communication on a range of familiar and unfamiliar topics, with very little hesitation. Produces extended discourse that is coherent and easy to follow.",
    "1": "Handles communication on familiar topics, despite some hesitation. Organises extended discourse but occasionally produces utterances that lack coherence.",
  },
};

const C2: BandDescriptors = {
  "Grammar and Vocabulary": {
    "5": "Maintains control of a wide range of grammatical forms with full flexibility and precision. Uses a wide range of appropriate vocabulary, including idiomatic and less common items, with full flexibility and precision on a wide range of familiar and unfamiliar topics.",
    "3": "Maintains control of a wide range of grammatical forms and uses them with flexibility. Uses a wide range of appropriate vocabulary with flexibility to give and exchange views on familiar and unfamiliar topics.",
    "1": "Shows a good degree of control of a range of simple and complex grammatical forms. Uses a range of appropriate vocabulary to give and exchange views on familiar and unfamiliar topics.",
  },
  "Discourse Management": {
    "5": "Produces extended stretches of language with ease and with no hesitation. Contributions are relevant, coherent, fully extended, varied and detailed. Makes full and effective use of a wide range of cohesive devices and discourse markers with full flexibility.",
    "3": "Produces extended stretches of language with ease and with very little hesitation. Contributions are relevant, coherent, varied and detailed. Makes full and effective use of a wide range of cohesive devices and discourse markers.",
    "1": "Produces extended stretches of language with very little hesitation. Contributions are relevant, coherent and varied. Uses a wide range of cohesive devices and discourse markers.",
  },
  "Pronunciation": {
    "5": "Is readily intelligible. Intonation is appropriate and used effectively to convey meaning. Sentence and word stress is accurately placed. Individual sounds are articulated clearly. Is effortless to understand throughout.",
    "3": "Is intelligible. Intonation is appropriate. Sentence and word stress is accurately placed. Individual sounds are articulated clearly. Is effortless to understand.",
    "1": "Is intelligible. Intonation is appropriate. Sentence and word stress is accurately placed. Individual sounds are articulated clearly.",
  },
  "Interactive Communication": {
    "5": "Interacts with ease by skilfully interweaving his/her contributions into the conversation. Widens the scope of the interaction and develops it fully and effectively towards a negotiated outcome.",
    "3": "Interacts with ease, linking contributions to those of other speakers. Widens the scope of the interaction and develops it fully and effectively towards a negotiated outcome.",
    "1": "Initiates and responds appropriately, linking contributions to those of other speakers. Maintains and develops the interaction and negotiates towards an outcome.",
  },
  "Global Achievement": {
    "5": "Handles communication on a wide range of familiar and unfamiliar topics with no hesitation. Produces extended discourse that is coherent, fully extended, easy to follow and detailed.",
    "3": "Handles communication on a wide range of familiar and unfamiliar topics, with very little hesitation. Produces extended discourse that is coherent, easy to follow and detailed.",
    "1": "Handles communication on a range of familiar and unfamiliar topics, with very little hesitation. Produces extended discourse that is coherent and easy to follow.",
  },
};

export const CAMBRIDGE_DESCRIPTORS: Record<CambridgeLevel, BandDescriptors> = {
  A2, B1, B2, C1, C2,
};

/**
 * Build a plain-text rubric block for a given Cambridge level, ready to inject
 * into the AI system prompt.
 */
export function buildRubricPrompt(level: CambridgeLevel): string {
  const exam = CAMBRIDGE_EXAMS.find(e => e.value === level);
  const descriptors = CAMBRIDGE_DESCRIPTORS[level];
  const lines: string[] = [];
  lines.push(`OFFICIAL CAMBRIDGE SPEAKING ASSESSMENT — ${exam?.label ?? level}`);
  lines.push("");
  lines.push("Marking scale: 0–5 per criterion, in 0.5 increments.");
  lines.push("• Whole bands (5, 3, 1) have explicit descriptors below.");
  lines.push("• Bands 4 and 2 are awarded when performance shares features of the bands above and below.");
  lines.push("• Half-bands (e.g. 3.5) are awarded for borderline performance.");
  lines.push("• Band 0 indicates performance below band 1.");
  lines.push("");
  for (const criterion of CAMBRIDGE_CRITERIA) {
    const d = descriptors[criterion];
    lines.push(`### ${criterion}`);
    lines.push(`Band 5: ${d["5"]}`);
    lines.push(`Band 3: ${d["3"]}`);
    lines.push(`Band 1: ${d["1"]}`);
    lines.push("");
  }
  return lines.join("\n");
}
