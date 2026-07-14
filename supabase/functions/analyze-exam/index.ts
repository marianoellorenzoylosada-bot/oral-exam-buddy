import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireUser(req: Request): Promise<Response | { userId: string }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const jwt = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: data.user.id };
}


async function fetchLibraryBlock(userId: string, level: string): Promise<string> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // Core (admin-curated, user_id IS NULL) + legacy private rows owned by the caller.
    const { data, error } = await admin
      .from("cambridge_reference_material")
      .select("kind, title, content, user_id")
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .eq("level_code", level)
      .order("user_id", { ascending: true, nullsFirst: true }) // Core (NULL) first
      .order("created_at", { ascending: true });
    if (error || !data || data.length === 0) return "";
    const KIND_LABEL: Record<string, string> = {
      sample_transcript: "SAMPLE TRANSCRIPT",
      examiner_comments: "OFFICIAL EXAMINER COMMENTS",
      handbook_extract: "OFFICIAL HANDBOOK EXTRACT",
    };
    const MAX = 18_000;
    let used = 0;
    const coreSections: string[] = [];
    const legacySections: string[] = [];
    for (const row of data) {
      const label = KIND_LABEL[row.kind] ?? row.kind.toUpperCase();
      const piece = `\n--- ${label} — ${row.title} ---\n${row.content}`;
      if (used + piece.length > MAX) break;
      used += piece.length;
      if (row.user_id === null) coreSections.push(piece);
      else legacySections.push(piece);
    }
    const blocks: string[] = [];
    if (coreSections.length > 0) {
      blocks.push(`\nCAMBRIDGE CORE LIBRARY (authoritative reference curated by the administrator — use to guide interpretation of the candidate's performance, NOT as evidence of what was said):${coreSections.join("")}`);
    }
    if (legacySections.length > 0) {
      blocks.push(`\nADDITIONAL REFERENCE (legacy private uploads — supplementary):${legacySections.join("")}`);
    }
    return blocks.join("\n");
  } catch {
    return "";
  }
}

function buildExamContextBlock(examContext: unknown): string {
  if (!Array.isArray(examContext) || examContext.length === 0) return "";
  const KIND_LABEL: Record<string, string> = {
    examiner_script: "EXAMINER SCRIPT",
    candidate_prompt: "CANDIDATE PROMPT",
    long_turn: "PART 2 — LONG TURN MATERIAL",
    collaborative_task: "PART 3 — COLLABORATIVE TASK MATERIAL",
    visual_task: "VISUAL TASK DESCRIPTION",
    instructions: "EXAM INSTRUCTIONS",
    notes: "MOCK-SPECIFIC NOTES",
  };
  const MAX = 8_000;
  let used = 0;
  const out: string[] = [];
  for (const entry of examContext as Array<{ kind?: string; title?: string; text?: string }>) {
    if (!entry || typeof entry.text !== "string" || entry.text.trim() === "") continue;
    const label = KIND_LABEL[entry.kind ?? ""] ?? (entry.kind ?? "CONTEXT").toUpperCase();
    const title = entry.title ? ` — ${entry.title}` : "";
    const piece = `\n--- ${label}${title} ---\n${entry.text.trim()}`;
    if (used + piece.length > MAX) break;
    out.push(piece);
    used += piece.length;
  }
  if (out.length === 0) return "";
  return `\nEXAM-SPECIFIC CONTEXT FOR THIS MOCK (materials the examiner provided for this exact session — use to interpret what the candidate is responding to, but do NOT score the materials themselves):${out.join("")}`;
}




// ─── Cambridge official Speaking descriptors (0–5 scale, 0.5 increments) ───
// Mirrors src/lib/cambridgeRubrics.ts. Kept inline because edge functions
// cannot import from the src/ folder.
type CambridgeLevel = "A2" | "B1" | "B2" | "C1" | "C2";
const CAMBRIDGE_CRITERIA = [
  "Grammar and Vocabulary",
  "Discourse Management",
  "Pronunciation",
  "Interactive Communication",
  "Global Achievement",
] as const;

const CAMBRIDGE_DESCRIPTORS: Record<CambridgeLevel, Record<string, { "5": string; "3": string; "1": string }>> = {
  A2: {
    "Grammar and Vocabulary": { "5": "Shows sufficient control of simple grammatical forms. Uses a range of appropriate vocabulary when talking about everyday situations.", "3": "Shows sufficient control of simple grammatical forms. Uses appropriate vocabulary to talk about everyday situations.", "1": "Shows only limited control of a few grammatical forms. Uses a vocabulary of isolated words and phrases." },
    "Discourse Management": { "5": "Produces responses extended beyond short phrases, despite hesitation. Contributions are mostly relevant. Uses basic cohesive devices.", "3": "Produces short phrases with frequent hesitation. Repeats information or digresses.", "1": "Produces very short responses. Sometimes difficult to follow." },
    "Pronunciation": { "5": "Mostly intelligible with some control of phonological features.", "3": "Mostly intelligible despite limited control of phonological features.", "1": "Very limited phonological control; often unintelligible." },
    "Interactive Communication": { "5": "Maintains simple exchanges despite some difficulty. Requires prompting and support.", "3": "Maintains simple exchanges. Requires prompting and support.", "1": "Considerable difficulty maintaining simple exchanges." },
    "Global Achievement": { "5": "Handles communication in everyday situations. Constructs longer utterances but cannot use complex language except in well-rehearsed utterances.", "3": "Handles short, basic exchanges despite hesitation.", "1": "Conveys basic meaning in very short utterances; mainly isolated words or formulaic phrases." },
  },
  B1: {
    "Grammar and Vocabulary": { "5": "Good control of simple grammatical forms; attempts some complex forms. Range of appropriate vocabulary on familiar topics.", "3": "Sufficient control of simple grammatical forms. Range of appropriate vocabulary on familiar topics.", "1": "Sufficient control of a few simple grammatical forms. Limited range of vocabulary on familiar topics." },
    "Discourse Management": { "5": "Extended stretches of language despite some hesitation. Clear organisation of ideas. Range of cohesive devices.", "3": "Responses extended beyond short phrases despite hesitation. Mostly relevant. Basic cohesive devices.", "1": "Short phrases with frequent hesitation. Repeats or digresses." },
    "Pronunciation": { "5": "Intelligible. Intonation generally appropriate. Stress generally accurate.", "3": "Mostly intelligible with some control of phonological features.", "1": "Mostly intelligible despite limited control of phonological features." },
    "Interactive Communication": { "5": "Initiates and responds appropriately. Maintains and develops the interaction with very little support.", "3": "Maintains simple exchanges despite some difficulty. Requires prompting.", "1": "Considerable difficulty maintaining simple exchanges." },
    "Global Achievement": { "5": "Handles communication on familiar topics despite some hesitation. Organises extended discourse, occasional incoherence.", "3": "Handles communication in everyday situations despite hesitation.", "1": "Handles short, basic exchanges despite hesitation." },
  },
  B2: {
    "Grammar and Vocabulary": { "5": "Good control of a range of simple and complex grammatical forms. Range of appropriate vocabulary to give and exchange views on familiar and unfamiliar topics.", "3": "Good control of simple grammatical forms; attempts some complex forms. Range of appropriate vocabulary on familiar topics.", "1": "Sufficient control of simple grammatical forms. Limited range of vocabulary on familiar topics." },
    "Discourse Management": { "5": "Extended stretches of language with very little hesitation. Relevant, coherent, varied. Wide range of cohesive devices and discourse markers.", "3": "Extended stretches despite some hesitation. Relevant with clear organisation. Range of cohesive devices.", "1": "Responses extended beyond short phrases despite hesitation. Mostly relevant; basic cohesive devices." },
    "Pronunciation": { "5": "Intelligible. Intonation appropriate. Sentence/word stress accurately placed. Sounds clearly articulated.", "3": "Intelligible. Intonation generally appropriate. Stress generally accurate. Sounds generally clear.", "1": "Mostly intelligible with some control of phonological features." },
    "Interactive Communication": { "5": "Initiates and responds appropriately, linking contributions. Maintains and develops the interaction and negotiates towards an outcome.", "3": "Initiates and responds appropriately. Maintains and develops the interaction with very little support.", "1": "Maintains simple exchanges despite some difficulty. Requires prompting." },
    "Global Achievement": { "5": "Handles communication on a range of familiar and unfamiliar topics with very little hesitation. Coherent, easy-to-follow extended discourse.", "3": "Handles communication on familiar topics despite hesitation. Organises extended discourse with occasional incoherence.", "1": "Handles communication in everyday situations despite hesitation." },
  },
  C1: {
    "Grammar and Vocabulary": { "5": "Maintains control of a wide range of grammatical forms with flexibility. Wide range of vocabulary used flexibly on familiar and unfamiliar topics.", "3": "Good control of a range of simple and complex grammatical forms. Range of appropriate vocabulary on familiar and unfamiliar topics.", "1": "Good control of simple grammatical forms; attempts some complex forms." },
    "Discourse Management": { "5": "Extended language with ease and very little hesitation. Relevant, coherent, varied, detailed. Full effective use of a wide range of cohesive devices.", "3": "Extended stretches with very little hesitation. Relevant, coherent and varied. Wide range of cohesive devices.", "1": "Extended stretches despite some hesitation. Relevant with clear organisation." },
    "Pronunciation": { "5": "Intelligible. Intonation appropriate. Stress accurate. Sounds clearly articulated. Effortless to understand.", "3": "Intelligible. Intonation appropriate. Stress accurate. Sounds clearly articulated.", "1": "Intelligible. Intonation generally appropriate. Stress generally accurate." },
    "Interactive Communication": { "5": "Interacts with ease, linking contributions. Widens scope of interaction; develops it fully and effectively towards a negotiated outcome.", "3": "Initiates and responds appropriately, linking contributions. Maintains, develops, negotiates towards an outcome.", "1": "Initiates and responds appropriately. Maintains and develops the interaction with very little support." },
    "Global Achievement": { "5": "Handles communication on a wide range of familiar and unfamiliar topics with very little hesitation. Coherent, easy-to-follow, detailed extended discourse.", "3": "Handles communication on a range of familiar and unfamiliar topics with very little hesitation.", "1": "Handles communication on familiar topics despite some hesitation." },
  },
  C2: {
    "Grammar and Vocabulary": { "5": "Maintains control of a wide range of grammatical forms with full flexibility and precision. Wide range of vocabulary, including idiomatic and less common items, used flexibly and precisely.", "3": "Maintains control of a wide range of grammatical forms used flexibly. Wide range of vocabulary used flexibly on familiar and unfamiliar topics.", "1": "Good control of a range of simple and complex grammatical forms." },
    "Discourse Management": { "5": "Extended language with ease and no hesitation. Relevant, coherent, fully extended, varied, detailed. Full flexible use of a wide range of cohesive devices.", "3": "Extended language with ease and very little hesitation. Relevant, coherent, varied, detailed.", "1": "Extended stretches with very little hesitation. Relevant, coherent and varied." },
    "Pronunciation": { "5": "Readily intelligible. Intonation effective for meaning. Stress accurate. Sounds clearly articulated. Effortless throughout.", "3": "Intelligible. Intonation appropriate. Stress accurate. Sounds clearly articulated. Effortless to understand.", "1": "Intelligible. Intonation appropriate. Stress accurate. Sounds clearly articulated." },
    "Interactive Communication": { "5": "Interacts with ease by skilfully interweaving contributions. Widens scope; develops fully and effectively towards a negotiated outcome.", "3": "Interacts with ease, linking contributions. Widens scope; develops fully and effectively towards a negotiated outcome.", "1": "Initiates and responds appropriately, linking contributions." },
    "Global Achievement": { "5": "Handles communication on a wide range of familiar and unfamiliar topics with no hesitation. Coherent, fully extended, easy-to-follow, detailed.", "3": "Handles communication on a wide range of familiar and unfamiliar topics with very little hesitation. Coherent, easy to follow, detailed.", "1": "Handles communication on a range of familiar and unfamiliar topics with very little hesitation." },
  },
};

function buildRubricBlock(level: string): string {
  const lvl = (level as CambridgeLevel);
  const descriptors = CAMBRIDGE_DESCRIPTORS[lvl];
  if (!descriptors) {
    return `OFFICIAL CAMBRIDGE SPEAKING ASSESSMENT — Level ${level}\nUse standard CEFR descriptors. Score each criterion 0–5 in 0.5 increments.`;
  }
  const lines: string[] = [];
  lines.push(`OFFICIAL CAMBRIDGE SPEAKING ASSESSMENT — Level ${level}`);
  lines.push("Marking scale: 0–5 per criterion, in 0.5 increments.");
  lines.push("• Whole bands (5, 3, 1) have explicit descriptors below.");
  lines.push("• Bands 4 and 2 are awarded when performance shares features of the bands above and below.");
  lines.push("• Half-bands (e.g. 3.5) are awarded for borderline performance.");
  lines.push("• Band 0 indicates performance below band 1.");
  for (const c of CAMBRIDGE_CRITERIA) {
    const d = descriptors[c];
    lines.push(`\n### ${c}\nBand 5: ${d["5"]}\nBand 3: ${d["3"]}\nBand 1: ${d["1"]}`);
  }
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    const { level, language, candidateNames, bookletText, rubricText, transcript, examinerTags, examContext } = await req.json();


    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Hard guard: a transcript is required. Without it we cannot ground the
    // assessment and the model would hallucinate. Refuse politely.
    const transcriptText: string = typeof transcript === "string" ? transcript.trim() : "";
    const wordCount = transcriptText ? transcriptText.split(/\s+/).length : 0;
    if (wordCount < 30) {
      return new Response(
        JSON.stringify({
          error: `Not enough speech to assess (${wordCount} words transcribed). Please record a longer sample with the candidates speaking clearly.`,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const MAX_CONTEXT_CHARS = 60_000;
    const contextLen = (bookletText?.length ?? 0) + (rubricText?.length ?? 0);
    if (contextLen > MAX_CONTEXT_CHARS) {
      return new Response(
        JSON.stringify({
          error: `Reference text (booklet + rubric) is ${contextLen} characters; please trim to under ${MAX_CONTEXT_CHARS}.`,
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const names = candidateNames || ["Candidate A", "Candidate B"];
    const candidateList = names.map((n: string, i: number) => `Candidate ${String.fromCharCode(65 + i)} (${n || "unnamed"})`).join(", ");
    const rubricBlock = buildRubricBlock(level);
    const libraryBlock = await fetchLibraryBlock(userId, level);
    const examContextBlock = buildExamContextBlock(examContext);


    // Per-level Speaking parts (mirrors src/lib/examPhases.ts).
    const PARTS_BY_LEVEL: Record<string, string[]> = {
      A2: ["Part 1 — Interview", "Part 2 — Collaborative"],
      B1: ["Part 1 — Interview", "Part 2 — Long turn", "Part 3 — Collaborative", "Part 4 — Discussion"],
      B2: ["Part 1 — Interview", "Part 2 — Long turn", "Part 3 — Collaborative", "Part 4 — Discussion"],
      C1: ["Part 1 — Interview", "Part 2 — Long turn", "Part 3 — Collaborative", "Part 4 — Discussion"],
      C2: ["Part 1 — Interview", "Part 2 — Long turn", "Part 3 — Collaborative", "Part 4 — Discussion"],
    };
    const partsList = PARTS_BY_LEVEL[level] ?? PARTS_BY_LEVEL.B2;
    const partsBlock = partsList.map((p) => `  - ${p}`).join("\n");
    const partFeedbackExample = partsList
      .map((p) => `        { "part": "${p.split(" — ")[0]}", "title": "${p.split(" — ")[1] ?? ""}", "commentary": "...", "observations": ["..."], "criteriaTouched": ["Discourse Management"], "improvement": "..." }`)
      .join(",\n");

    // Format examiner-supplied quick tags as time-stamped evidence the model
    // should weigh alongside the transcript.
    const tagBlock = (() => {
      if (!Array.isArray(examinerTags) || examinerTags.length === 0) return "";
      const fmt = (s: number) => {
        const m = Math.floor(s / 60).toString().padStart(2, "0");
        const sec = Math.floor(s % 60).toString().padStart(2, "0");
        return `${m}:${sec}`;
      };
      const lines = examinerTags
        .filter((t: any) => t && typeof t.label === "string")
        .map((t: any) => `- [${fmt(Number(t.atSec) || 0)}] Candidate ${t.candidate ?? "?"}: ${t.label}`);
      if (lines.length === 0) return "";
      return `\nEXAMINER OBSERVATIONS DURING THE EXAM (timestamped notes from the live examiner — treat as additional evidence, NOT as a substitute for the transcript):\n${lines.join("\n")}`;
    })();

    const systemPrompt = `You are an official Cambridge Assessment English Speaking examiner. You evaluate oral performance using the official Cambridge Speaking assessment scales.

Your task: Analyze an oral examination recording with MULTIPLE candidates and produce a structured assessment report for EACH candidate individually, using the Cambridge 0–5 scale (0.5 increments).

EXAM CONTEXT:
- Cambridge Level: ${level}
- Language being assessed: ${language}
- Speakers: Examiner (teacher), ${candidateList}

══════════════════════════════════════════════════════════════
LAYER 1 — AUTHORITATIVE REFERENCE (guides how to interpret evidence; never replaces it)
══════════════════════════════════════════════════════════════
${rubricBlock}
${libraryBlock}
${examContextBlock}
${bookletText ? `\nADDITIONAL REFERENCE — EXAM BOOKLET / SAMPLE PAPER:\n${bookletText}` : ""}
${rubricText ? `\nADDITIONAL REFERENCE — UPLOADED HANDBOOK / RUBRIC:\n${rubricText}` : ""}
${tagBlock}

══════════════════════════════════════════════════════════════
LAYER 2 — CANDIDATE EVIDENCE (the PRIMARY source of every score)
══════════════════════════════════════════════════════════════
EXAM TRANSCRIPT (verbatim, with speaker labels — this is the ONLY source of evidence about what the candidate actually produced):
"""
${transcriptText}
"""

PRIORITY RULES (read carefully):
- The candidate's actual performance in the transcript above is the PRIMARY source of evidence. Score and comment strictly on what the candidate said.
- The Authoritative Reference Layer (Core Library, Exam Context, descriptors) tells you HOW to interpret that evidence — it does NOT substitute for it.
- If the Core Library or Exam Context conflicts with the rubric descriptors above, the Cambridge Core Library takes precedence. If it conflicts with what the candidate actually said, the transcript wins for evidence.
- Do not invent content not present in the transcript.
- In the Cambridge reference materials, text enclosed in double quotes "…" (sometimes followed by a timestamp like (2.39 Part 2)) is a VERBATIM QUOTE FROM THE CANDIDATE IN THE SAMPLE VIDEO — not examiner commentary. Treat those quotes as exemplars of the assigned band level, never as evidence about the current candidate.
- Timestamps such as (9.40 Part 3) refer to the Cambridge sample video and have NO relation to the audio of the candidate being assessed now.

IMPORTANT:
- In "strengths" and "areasForImprovement", quote the candidate VERBATIM using straight double quotes (e.g. "I have went to the park yesterday"). Each item must contain at least one verbatim quote followed by a brief comment.
- Identify each speaker. The Examiner is the teacher; assess only the candidates.
- Score each candidate INDEPENDENTLY on the 5 Cambridge criteria below.
- Use the 0–5 scale in 0.5 increments. Half-bands are valid (e.g. 2.5, 3.5, 4.5).

- Do NOT estimate the overall band or overall score yourself. Return only the five criterion scores and feedback. The application computes the weighted result deterministically. The "overallScore" and "overallBand" fields in the schema below are placeholders kept for backwards compatibility; you may set them to the simple mean and best-guess CEFR letter, but the client will overwrite them.
- Feedback for each criterion should reference the Cambridge descriptors above.

THE 5 CAMBRIDGE CRITERIA (must appear in this exact order, with these exact names):
1. Grammar and Vocabulary
2. Discourse Management
3. Pronunciation
4. Interactive Communication
5. Global Achievement

For each criterion, also include a "confidence" field (0–100) indicating how confident you are in the score.
Guidelines for confidence:
- 90–100: Very clear evidence in the audio; score is unambiguous.
- 70–89: Good evidence but some ambiguity (e.g. short speaking time, background noise).
- 50–69: Limited evidence; score is an estimate.
- Below 50: Very little evidence; the examiner should review carefully.

PART-BY-PART EXAMINER FEEDBACK:
For each candidate, also produce a "partFeedback" array covering the speaking parts for this level:
${partsBlock}
For every part:
- Write 2–4 sentences of professional examiner-style commentary, descriptor-informed but natural.
- Ground every observation in the transcript; reference observable performance.
- Mention the criteria most clearly evidenced by that part in "criteriaTouched".
- If useful, add ONE short actionable "improvement" point. Avoid generic praise and unsupported claims.
- Do NOT invent per-part scores — these are commentary only; the global criterion scores are unchanged.
Also produce a short "overallSummary" (3–5 sentences) synthesising the candidate's performance across the whole exam.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "candidates": [
    {
      "candidateName": "${names[0] || "Candidate A"}",
      "overallBand": "B2",
      "overallScore": 3.5,
      "criteria": [
        { "name": "Grammar and Vocabulary", "score": 3.5, "maxScore": 5, "confidence": 85, "feedback": "..." },
        { "name": "Discourse Management", "score": 3, "maxScore": 5, "confidence": 78, "feedback": "..." },
        { "name": "Pronunciation", "score": 4, "maxScore": 5, "confidence": 90, "feedback": "..." },
        { "name": "Interactive Communication", "score": 3.5, "maxScore": 5, "confidence": 72, "feedback": "..." },
        { "name": "Global Achievement", "score": 3.5, "maxScore": 5, "confidence": 80, "feedback": "..." }
      ],
      "strengths": ["strength 1", "strength 2"],
      "areasForImprovement": ["area 1", "area 2"],
      "partFeedback": [
${partFeedbackExample}
      ],
      "overallSummary": "..."
    }
  ],
  "transcript": "Full transcription with speaker labels (Examiner:, Candidate A:, Candidate B:, etc.)...",
  "examinerNotes": "Brief overall commentary for the teacher about the session..."
}

Include one entry in the "candidates" array for EACH candidate (${names.length} total). Return ONLY valid JSON.`;

    const userContent = "Please analyze the oral examination transcript provided in the system prompt and produce a detailed Cambridge assessment for each candidate. Quote candidates verbatim in strengths and areas for improvement. Return ONLY valid JSON matching the format specified.";

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "AI analysis failed. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const rawContent: string = aiResult.choices?.[0]?.message?.content ?? "";

    // Robust JSON extraction:
    //  1. Prefer fenced ```json blocks.
    //  2. Otherwise, take the substring from the first '{' to the last '}'.
    //  3. Fall back to the raw content.
    function extractJson(raw: string): string {
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fence) return fence[1].trim();
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first >= 0 && last > first) return raw.slice(first, last + 1);
      return raw;
    }

    let assessment: any;
    let parseFailed = false;
    try {
      assessment = JSON.parse(extractJson(rawContent));
    } catch (err) {
      console.error("analyze-exam: JSON parse failed", err);
      parseFailed = true;
      assessment = {
        candidates: names.map((n: string) => ({
          candidateName: n,
          overallBand: level,
          overallScore: 0,
          criteria: [],
          strengths: [],
          areasForImprovement: [],
        })),
        transcript: "",
        // Do NOT leak raw model output into examinerNotes — it confuses examiners.
        examinerNotes: "",
      };
    }

    // Normalize: if old single-candidate format, wrap it
    if (!assessment.candidates && assessment.overallBand) {
      assessment = {
        candidates: [{
          candidateName: names[0] || "Candidate A",
          overallBand: assessment.overallBand,
          overallScore: assessment.overallScore,
          criteria: assessment.criteria,
          strengths: assessment.strengths,
          areasForImprovement: assessment.areasForImprovement,
          partFeedback: assessment.partFeedback,
          overallSummary: assessment.overallSummary,
        }],
        transcript: assessment.transcript,
        examinerNotes: assessment.examinerNotes,
      };
    }

    // Defensive normalization so the UI never crashes on missing fields,
    // and so "no evidence" placeholder part entries are dropped before render.
    const NO_EVIDENCE = /no evidence|not covered|n\/?a\b|insufficient/i;
    if (Array.isArray(assessment.candidates)) {
      assessment.candidates = assessment.candidates.map((c: any) => {
        const cand = c && typeof c === "object" ? c : {};
        cand.criteria = Array.isArray(cand.criteria) ? cand.criteria : [];
        cand.strengths = Array.isArray(cand.strengths) ? cand.strengths : [];
        cand.areasForImprovement = Array.isArray(cand.areasForImprovement) ? cand.areasForImprovement : [];

        // Pronunciation safety net: automatic pronunciation analysis is unreliable.
        // Guarantee the criterion exists, with a sensible default and a teacher-review flag
        // whenever the AI was missing, vague, or low-confidence. The teacher can edit freely;
        // this never blocks report validation.
        const PRON = "Pronunciation";
        const pronIdx = cand.criteria.findIndex((cr: any) => cr?.name === PRON);
        const needsReview = (cr: any) =>
          !cr ||
          typeof cr.score !== "number" ||
          typeof cr.confidence === "number" && cr.confidence < 60 ||
          typeof cr.feedback !== "string" ||
          cr.feedback.trim().length < 12;
        if (pronIdx === -1) {
          cand.criteria.push({
            name: PRON, score: 3, maxScore: 5, confidence: 0, feedback: "",
            needsTeacherReview: true,
          });
        } else if (needsReview(cand.criteria[pronIdx])) {
          const existing = cand.criteria[pronIdx] || {};
          cand.criteria[pronIdx] = {
            ...existing,
            name: PRON,
            maxScore: typeof existing.maxScore === "number" ? existing.maxScore : 5,
            score: typeof existing.score === "number" ? existing.score : 3,
            feedback: typeof existing.feedback === "string" ? existing.feedback : "",
            confidence: typeof existing.confidence === "number" ? existing.confidence : 0,
            needsTeacherReview: true,
          };
        }

        if (Array.isArray(cand.partFeedback)) {
          cand.partFeedback = cand.partFeedback.filter((p: any) => {
            if (!p || typeof p !== "object") return false;
            const commentary = typeof p.commentary === "string" ? p.commentary.trim() : "";
            if (!commentary) return false;
            if (NO_EVIDENCE.test(commentary)) return false;
            return true;
          });
        } else {
          cand.partFeedback = [];
        }
        if (typeof cand.overallSummary !== "string") cand.overallSummary = "";
        return cand;
      });
    }
    if (parseFailed) {
      assessment.examinerNotes = "AI analysis could not be parsed. Please re-run analysis.";
    }

    return new Response(JSON.stringify(assessment), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-exam error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
