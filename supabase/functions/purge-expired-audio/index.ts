import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("PURGE_CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const { data: rows, error } = await admin
      .from("exams")
      .select("id, audio_path")
      .not("audio_path", "is", null)
      .lt("audio_expires_at", new Date().toISOString())
      .limit(500);
    if (error) throw error;

    let deleted = 0;
    for (const r of rows ?? []) {
      if (!r.audio_path) continue;
      const { error: rmErr } = await admin.storage.from("exam-audio").remove([r.audio_path]);
      if (rmErr) {
        console.warn("storage remove failed", r.id, rmErr.message);
        continue;
      }
      const { error: upErr } = await admin
        .from("exams")
        .update({ audio_path: null, audio_expires_at: null, words_json: null })
        .eq("id", r.id);
      if (upErr) console.warn("row update failed", r.id, upErr.message);
      else deleted++;
    }

    return new Response(JSON.stringify({ deleted, scanned: rows?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("purge-expired-audio error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
