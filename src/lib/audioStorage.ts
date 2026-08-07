import { supabase } from "@/integrations/supabase/client";

export async function getSignedAudioUrl(path: string, expiresInSeconds = 600) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("exam-audio")
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("[getSignedAudioUrl]", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
