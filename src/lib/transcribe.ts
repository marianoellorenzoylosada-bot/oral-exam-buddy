/**
 * Convert a Blob to base64. Streams in chunks to avoid argument-length limits.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

import { callEdgeFunction } from "@/lib/edgeClient";

export interface ScribeWord {
  text: string;
  start: number;
  end: number;
  speaker?: string | null;
}

/**
 * Transcribe a recorded audio blob via the `transcribe-audio` edge function
 * (ElevenLabs Scribe batch). Returns the full transcript and the word
 * timeline for clickable quote playback.
 */
export async function transcribeBlob(blob: Blob): Promise<{ transcript: string; words: ScribeWord[] }> {
  const audioBase64 = await blobToBase64(blob);
  const data = await callEdgeFunction<{ transcript?: string; words?: ScribeWord[] }>(
    "transcribe-audio",
    { body: { audioBase64, mimeType: blob.type || "audio/webm" } },
  );
  return {
    transcript: data?.transcript ?? "",
    words: data?.words ?? [],
  };
}
