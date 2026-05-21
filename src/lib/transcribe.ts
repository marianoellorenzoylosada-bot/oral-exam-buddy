import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction } from "@/lib/edgeClient";

export interface ScribeWord {
  text: string;
  start: number;
  end: number;
  speaker?: string | null;
}

/**
 * Transcribe a recorded audio blob via the `transcribe-audio` edge function
 * (ElevenLabs Scribe batch).
 *
 * Implementation note: previously we base64-encoded the blob and POSTed it as
 * JSON to the edge function. On mobile, multi-MB JSON bodies routinely failed
 * with `TypeError: Failed to fetch` before reaching the server (radio sleep,
 * NAT/TLS resets mid-upload). We now upload the blob directly to the private
 * `exam-audio` Storage bucket (resilient, resumable-friendly), then call the
 * function with just the storage path. The function fetches the object with a
 * service-role client and forwards it to ElevenLabs unchanged.
 */
export async function transcribeBlob(blob: Blob): Promise<{ transcript: string; words: ScribeWord[] }> {
  const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
  console.info("[transcribe] uploading", sizeMb, "MB", blob.type);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    throw new Error("Unauthorized — please sign in again.");
  }
  const userId = userData.user.id;
  const ext = (blob.type || "audio/webm").includes("mp4") ? "mp4" : "webm";
  const audioPath = `${userId}/${crypto.randomUUID()}.${ext}`;

  // Step 1: upload to Storage. Storage handles large bodies far more reliably
  // than a JSON function POST on mobile networks.
  const { error: uploadErr } = await supabase.storage
    .from("exam-audio")
    .upload(audioPath, blob, {
      contentType: blob.type || "audio/webm",
      upsert: false,
    });
  if (uploadErr) {
    throw new Error(`Audio upload failed (${sizeMb} MB): ${uploadErr.message} — check your connection and tap Retry.`);
  }

  try {
    // Step 2: invoke transcribe-audio with the storage path only.
    let data: { transcript?: string; words?: ScribeWord[] };
    try {
      data = await callEdgeFunction<{ transcript?: string; words?: ScribeWord[] }>(
        "transcribe-audio",
        { body: { audioPath, mimeType: blob.type || "audio/webm" }, timeoutMs: 180_000 },
      );
    } catch (err: any) {
      const msg = err?.message ?? "Transcription failed";
      if (msg.startsWith("Network error")) {
        throw new Error(`Network error contacting transcription service (audio ${sizeMb} MB uploaded OK). Check your connection and tap Retry.`);
      }
      throw err;
    }
    return {
      transcript: data?.transcript ?? "",
      words: data?.words ?? [],
    };
  } finally {
    // Best-effort cleanup; purge-expired-audio is the safety net.
    void supabase.storage.from("exam-audio").remove([audioPath]).catch(() => undefined);
  }
}
