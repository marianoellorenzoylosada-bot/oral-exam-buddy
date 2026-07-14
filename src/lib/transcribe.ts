import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunction, EdgeFunctionError } from "@/lib/edgeClient";

export interface ScribeWord {
  text: string;
  start: number;
  end: number;
  speaker?: string | null;
}

export class TranscriptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly userMessage: string,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

const TRANSCRIPTION_USER_MESSAGES: Record<string, string> = {
  quota_exceeded: "Sin créditos de transcripción en ElevenLabs. Tu grabación quedó guardada — reponé créditos y tocá Reintentar.",
  auth_error: "La clave de ElevenLabs no es válida. Verificá la conexión en configuración.",
  rate_limited: "Demasiadas solicitudes a ElevenLabs. Esperá un momento y reintentá.",
  service_unavailable: "El servicio de transcripción está temporalmente caído. Probá en unos minutos.",
  audio_invalid: "El audio parece vacío o dañado. Volvé a grabar.",
  transcription_error: "No se pudo transcribir el audio. Tu grabación quedó guardada — tocá Reintentar.",
};

export function classifyTranscriptionError(err: any): {
  message: string;
  code: string;
  retryable: boolean;
  userMessage: string;
} {
  if (err instanceof EdgeFunctionError && err.body?.code) {
    const code = err.body.code as string;
    return {
      message: (err.body.error as string) || err.message,
      code,
      retryable: !!err.body.retryable,
      userMessage: TRANSCRIPTION_USER_MESSAGES[code] || (err.body.error as string) || err.message,
    };
  }
  const msg = err?.message || "";
  if (msg.includes("Network error") || msg.includes("Failed to fetch")) {
    return {
      message: msg,
      code: "network_error",
      retryable: true,
      userMessage: "La conexión se cortó durante el análisis. Tu audio está guardado, tocá Reintentar.",
    };
  }
  return {
    message: msg,
    code: "unknown",
    retryable: false,
    userMessage: msg || "No se pudo procesar el examen. Tu grabación quedó guardada — tocá Reintentar.",
  };
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
export async function transcribeBlob(
  blob: Blob,
  onStage?: (stage: string) => void,
): Promise<{ transcript: string; words: ScribeWord[] }> {
  const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
  console.info("[transcribe] uploading", sizeMb, "MB", blob.type);
  onStage?.(`Uploading audio (${sizeMb} MB)…`);

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    throw new Error("Unauthorized — please sign in again.");
  }
  const userId = userData.user.id;
  const ext = (blob.type || "audio/webm").includes("mp4") ? "mp4" : "webm";
  const audioPath = `${userId}/${crypto.randomUUID()}.${ext}`;

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
    onStage?.("Contacting transcription service…");
    let data: { transcript?: string; words?: ScribeWord[] };
    try {
      data = await callEdgeFunction<{ transcript?: string; words?: ScribeWord[] }>(
        "transcribe-audio",
        { body: { audioPath, mimeType: blob.type || "audio/webm" }, timeoutMs: 180_000 },
      );
    } catch (err: any) {
      const msg = err?.message ?? "Transcription failed";
      // Only rewrite true fetch-level network failures; let real HTTP errors
      // (e.g. "transcribe-audio failed (502): ...") pass through verbatim.
      if (/^Network error reaching/.test(msg)) {
        throw new Error(`Network error contacting transcription service (audio ${sizeMb} MB uploaded OK). Check your connection and tap Retry.`);
      }
      throw err;
    }
    return {
      transcript: data?.transcript ?? "",
      words: data?.words ?? [],
    };
  } finally {
    void supabase.storage.from("exam-audio").remove([audioPath]).catch(() => undefined);
  }
}
