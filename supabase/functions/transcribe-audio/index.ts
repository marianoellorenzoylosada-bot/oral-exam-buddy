import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type TranscriptionErrorCode =
  | "quota_exceeded"
  | "rate_limited"
  | "auth_error"
  | "service_unavailable"
  | "audio_invalid"
  | "transcription_error";

interface TranscriptionErrorResponse {
  error: string;
  code: TranscriptionErrorCode;
  retryable: boolean;
}

function classifyTranscriptionError(
  status: number,
  bodyText: string,
): TranscriptionErrorResponse {
  const lower = bodyText.toLowerCase();
  if (
    status === 402 || status === 403 ||
    lower.includes("quota_exceeded") || lower.includes("quota exceeded") ||
    lower.includes("billing") || lower.includes("credit")
  ) {
    return {
      error: "ElevenLabs usage quota exceeded. Please upgrade your plan or wait for the next billing cycle.",
      code: "quota_exceeded",
      retryable: false,
    };
  }
  if (
    status === 401 ||
    lower.includes("unauthorized") || lower.includes("invalid api key") ||
    lower.includes("auth_error") || lower.includes("authentication")
  ) {
    return {
      error: "ElevenLabs API key is invalid or missing. Check the connection settings.",
      code: "auth_error",
      retryable: false,
    };
  }
  if (status === 429 || lower.includes("rate_limited") || lower.includes("rate limit")) {
    return {
      error: "Too many requests to ElevenLabs. Please wait a moment and retry.",
      code: "rate_limited",
      retryable: true,
    };
  }
  if (
    (status === 400 || status === 422) &&
    (lower.includes("no speech") || lower.includes("no audio") ||
      lower.includes("invalid audio") || lower.includes("audio_invalid") ||
      lower.includes("input_error") || lower.includes("insufficient_audio"))
  ) {
    return {
      error: "The audio file appears to be empty or invalid. Please record again.",
      code: "audio_invalid",
      retryable: false,
    };
  }
  if (
    status >= 500 ||
    lower.includes("service_unavailable") || lower.includes("transcriber_error") ||
    lower.includes("temporary") || lower.includes("server error") ||
    lower.includes("gateway")
  ) {
    return {
      error: "ElevenLabs transcription service is temporarily unavailable. Please retry in a few moments.",
      code: "service_unavailable",
      retryable: true,
    };
  }
  return {
    error: `Transcription failed (${status}): ${bodyText}`,
    code: "transcription_error",
    retryable: status >= 500 || status === 429,
  };
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireUser(req: Request): Promise<{ userId: string } | Response> {
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

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured");

    const body = await req.json();
    const { audioPath, audioBase64, mimeType } = body ?? {};

    let blob: Blob;

    if (audioPath && typeof audioPath === "string") {
      // Enforce ownership: path must live under the caller's user-id folder.
      if (!audioPath.startsWith(`${userId}/`) || audioPath.includes("..")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Preferred path: client uploaded to Storage, we fetch with service role.
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data, error } = await admin.storage.from("exam-audio").download(audioPath);
      if (error || !data) {
        return new Response(JSON.stringify({ error: `Could not read uploaded audio: ${error?.message ?? "not found"}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      blob = new Blob([await data.arrayBuffer()], { type: mimeType || data.type || "audio/webm" });
    } else if (audioBase64 && typeof audioBase64 === "string") {
      // Back-compat: legacy base64 JSON path.
      const MAX = 30 * 1024 * 1024;
      if (audioBase64.length > MAX) {
        return new Response(JSON.stringify({
          error: `Audio too large (${(audioBase64.length / (1024 * 1024)).toFixed(1)} MB encoded). Please record shorter exams.`,
        }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const bytes = base64ToBytes(audioBase64);
      blob = new Blob([bytes], { type: mimeType || "audio/webm" });
    } else {
      return new Response(JSON.stringify({ error: "audioPath or audioBase64 is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      const classified = classifyTranscriptionError(resp.status, err);
      return new Response(JSON.stringify(classified), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const result = await resp.json();
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
