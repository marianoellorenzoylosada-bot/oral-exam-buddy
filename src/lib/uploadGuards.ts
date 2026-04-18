// Client-side guards before sending audio + context to the analyze-exam edge function.
// Prevents long delays followed by opaque 413/timeout errors.

// Lovable AI Gateway accepts inline base64 audio reasonably up to ~25 MB.
// We pad down a bit to leave room for the JSON envelope and reference text.
export const MAX_AUDIO_BYTES = 22 * 1024 * 1024; // 22 MB
export const MAX_AUDIO_DURATION_SECONDS = 45 * 60; // 45 min
export const MAX_CONTEXT_CHARS = 60_000; // booklet + rubric combined

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

export function checkAudioSize(blob: Blob | null | undefined): GuardResult {
  if (!blob) return { ok: false, reason: "No audio recording was captured." };
  if (blob.size > MAX_AUDIO_BYTES) {
    const mb = (blob.size / (1024 * 1024)).toFixed(1);
    const limit = (MAX_AUDIO_BYTES / (1024 * 1024)).toFixed(0);
    return {
      ok: false,
      reason: `Recording is ${mb} MB, which exceeds the ${limit} MB limit. Please split the exam into shorter segments.`,
    };
  }
  return { ok: true };
}

export function checkAudioDuration(seconds: number): GuardResult {
  if (seconds > MAX_AUDIO_DURATION_SECONDS) {
    const mins = Math.round(seconds / 60);
    const limit = MAX_AUDIO_DURATION_SECONDS / 60;
    return {
      ok: false,
      reason: `Recording is ${mins} minutes long; the maximum is ${limit} minutes. Split the exam into shorter sessions.`,
    };
  }
  return { ok: true };
}

export function checkContextSize(bookletText: string, rubricText: string): GuardResult {
  const total = (bookletText?.length ?? 0) + (rubricText?.length ?? 0);
  if (total > MAX_CONTEXT_CHARS) {
    return {
      ok: false,
      reason: `Booklet + rubric text is ${total.toLocaleString()} characters; please trim to under ${MAX_CONTEXT_CHARS.toLocaleString()}.`,
    };
  }
  return { ok: true };
}

export function runAllGuards(opts: {
  audioBlob: Blob | null | undefined;
  durationSeconds: number;
  bookletText: string;
  rubricText: string;
}): GuardResult {
  return (
    checkAudioSize(opts.audioBlob).ok
      ? checkAudioDuration(opts.durationSeconds).ok
        ? checkContextSize(opts.bookletText, opts.rubricText)
        : checkAudioDuration(opts.durationSeconds)
      : checkAudioSize(opts.audioBlob)
  );
}
