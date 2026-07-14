import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type TokenErrorCode =
  | "quota_exceeded"
  | "rate_limited"
  | "auth_error"
  | "service_unavailable"
  | "token_error";

interface TokenErrorResponse {
  error: string;
  code: TokenErrorCode;
  retryable: boolean;
}

function classifyTokenError(status: number, bodyText: string): TokenErrorResponse {
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
    status >= 500 ||
    lower.includes("service_unavailable") || lower.includes("temporary") ||
    lower.includes("server error") || lower.includes("gateway")
  ) {
    return {
      error: "ElevenLabs token service is temporarily unavailable. Please retry in a few moments.",
      code: "service_unavailable",
      retryable: true,
    };
  }
  return {
    error: `Failed to get scribe token (${status}): ${bodyText}`,
    code: "token_error",
    retryable: status >= 500 || status === 429,
  };
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireUser(req: Request): Promise<Response | null> {
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
  const { data, error } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !data?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const unauth = await requireUser(req);
  if (unauth) return unauth;

  try {

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const response = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs token error:", response.status, errText);
      throw new Error(`Failed to get scribe token: ${response.status}`);
    }

    const { token } = await response.json();

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("elevenlabs-scribe-token error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
