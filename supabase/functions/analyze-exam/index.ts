import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { level, language, bookletText, rubricText, audioBase64 } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert oral language examination assessor. You evaluate spoken language proficiency based on official CEFR (Common European Framework of Reference) standards.

Your task: Analyze an oral examination recording and produce a structured assessment report.

EXAM CONTEXT:
- CEFR Level: ${level}
- Language being assessed: ${language}
${bookletText ? `\nEXAM BOOKLET CONTENT:\n${bookletText}` : ""}
${rubricText ? `\nCUSTOM RUBRIC:\n${rubricText}` : ""}

If no custom rubric is provided, use the standard CEFR descriptors for the specified level.

ASSESSMENT CRITERIA (score each 0-5):
1. **Range** — Variety of vocabulary, grammar structures, and idiomatic expressions
2. **Accuracy** — Grammatical correctness, pronunciation, and appropriate word choice
3. **Fluency** — Natural flow, pace, hesitation patterns, and self-correction ability
4. **Interaction** — Turn-taking, initiating/responding, negotiating meaning
5. **Coherence** — Logical organization, discourse markers, topic development

RESPOND IN THIS EXACT JSON FORMAT:
{
  "overallBand": "B1",
  "overallScore": 3.2,
  "criteria": [
    { "name": "Range", "score": 3, "maxScore": 5, "feedback": "..." },
    { "name": "Accuracy", "score": 3, "maxScore": 5, "feedback": "..." },
    { "name": "Fluency", "score": 4, "maxScore": 5, "feedback": "..." },
    { "name": "Interaction", "score": 3, "maxScore": 5, "feedback": "..." },
    { "name": "Coherence", "score": 3, "maxScore": 5, "feedback": "..." }
  ],
  "strengths": ["strength 1", "strength 2"],
  "areasForImprovement": ["area 1", "area 2"],
  "transcript": "Approximate transcription of what was said...",
  "examinerNotes": "Brief overall commentary for the teacher..."
}`;

    // Build content array - text + optional audio
    const userContent: any[] = [
      {
        type: "text",
        text: "Please analyze this oral examination recording and provide a detailed CEFR assessment. Return ONLY valid JSON matching the format specified.",
      },
    ];

    if (audioBase64) {
      userContent.push({
        type: "input_audio",
        input_audio: {
          data: audioBase64,
          format: "wav",
        },
      });
    }

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
    const rawContent = aiResult.choices?.[0]?.message?.content ?? "";

    // Extract JSON from the response (strip markdown fences if present)
    let jsonStr = rawContent;
    const fenceMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    let assessment;
    try {
      assessment = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, return the raw text
      assessment = {
        overallBand: level,
        overallScore: 0,
        criteria: [],
        strengths: [],
        areasForImprovement: [],
        transcript: "",
        examinerNotes: rawContent,
      };
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
