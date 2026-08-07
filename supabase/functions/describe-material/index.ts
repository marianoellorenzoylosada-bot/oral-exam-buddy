import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireUser(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: data.user.id };
}

function buildPrompt(kind: string): string {
  if (kind === "part2_pictures") {
    return `You are helping a Cambridge English oral examiner prepare a mock exam. Describe the set of pictures shown in this image for a Part 2 (Long Turn) task. Explain what each picture shows and how the pictures are related or what the candidate should compare. Keep it concise but complete, in English, so the AI rater can later evaluate whether the candidate talked about the right content.`;
  }
  if (kind === "part3_diagram") {
    return `You are helping a Cambridge English oral examiner prepare a mock exam. Describe the diagram or visual in this image for a Part 3 (Collaborative Task). Explain the central topic and the options or points shown, so the AI rater can later evaluate whether the candidates discussed the task appropriately. Keep it concise, in English.`;
  }
  if (kind === "examiner_script") {
    return `Transcribe and clean up the examiner script in this image. Return only the text the examiner should read aloud during the mock exam, in English. Remove handwriting marks, headers, or unrelated text. Keep it concise but complete.`;
  }
  return `Describe what this image contains in English, clearly and concisely.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const userCheck = await requireUser(req);
  if (userCheck instanceof Response) return userCheck;

  let body: { storagePath?: string; kind?: string; base64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.kind || !(body.storagePath || body.base64)) {
    return new Response(
      JSON.stringify({ error: "Missing kind and storagePath or base64 image" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let imageUrl: string;
  let mimeType = body.mimeType || "image/jpeg";

  if (body.storagePath) {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await admin.storage
      .from("exam-context")
      .createSignedUrl(body.storagePath, 60);
    if (error || !data?.signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to access image in storage" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    imageUrl = data.signedUrl;
  } else if (body.base64) {
    imageUrl = `data:${mimeType};base64,${body.base64}`;
  } else {
    return new Response(JSON.stringify({ error: "No image provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing AI gateway configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt(body.kind!) },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "AI gateway request failed", status: response.status, details: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await response.json();
    const description = result?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ description: description.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
