import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");

    const { audioBase64, mimeType } = await req.json();
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return new Response(JSON.stringify({ error: "audioBase64 is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAX = 30 * 1024 * 1024;
    if (audioBase64.length > MAX) {
      return new Response(JSON.stringify({
        error: `Audio too large (${(audioBase64.length / (1024 * 1024)).toFixed(1)} MB encoded). Please record shorter exams.`,
      }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const bytes = base64ToBytes(audioBase64);
    const blob = new Blob([bytes], { type: mimeType || "audio/webm" });

    const form = new FormData();
    form.append("file", blob, "exam.webm");
    form.append("model_id", "scribe_v2");
    form.append("tag_audio_events", "true");
    form.append("diarize", "true");
    form.append("language_code", "eng");

    const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("ElevenLabs Scribe error:", resp.status, err);
      return new Response(JSON.stringify({ error: `Transcription failed: ${resp.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resp.json();
    // Normalize: extract transcript, word timeline, speaker labels
    const transcript: string = result.text ?? "";
    const words = Array.isArray(result.words) ? result.words.map((w: any) => ({
      text: w.text ?? w.word ?? "",
      start: typeof w.start === "number" ? w.start : 0,
      end: typeof w.end === "number" ? w.end : 0,
      speaker: w.speaker_id ?? w.speaker ?? null,
    })) : [];

    return new Response(JSON.stringify({ transcript, words }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-audio error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
