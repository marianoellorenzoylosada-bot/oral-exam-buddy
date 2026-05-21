## Diagnosis

**Symptom:** Mobile shows `Network error reaching transcribe-audio: Failed to fetch`. The error is thrown from `edgeClient.ts` inside the `catch` around `fetch()`, before any HTTP status. The function logs are empty for that request → the request never reached the edge function.

**Root cause classification:** payload size + mobile network instability (not CORS, not auth, not URL).

- `transcribe.ts` base64-encodes the WebM blob and sends it inside a JSON body to `transcribe-audio`.
- A typical 8–10 min Opus/WebM recording from `MediaRecorder` is roughly 4–8 MB binary → **5.5–11 MB base64 JSON**.
- The previous `supabase.functions.invoke()` used the same payload shape, but the SDK transport had implicit retries/keep-alive behaviour. The new explicit `fetch()` in `edgeClient.ts` is a single shot — on mobile (cellular, radio sleep, NAT timeouts, TLS resets while the body is still uploading) a multi-MB JSON POST routinely fails with `TypeError: Failed to fetch` before any server response.
- CORS is fine (the same headers and origin were working from desktop). The URL is correct (built from `VITE_SUPABASE_URL`). Auth is fine (JWT is fresh; we'd see a 401, not a network failure).
- Desktop succeeds for the same item because wired/WiFi connections tolerate the large body upload.

**Side issue:** even when the upload succeeds, the edge function decodes base64 → bytes → `Blob` → re-uploads as multipart to ElevenLabs. That doubles peak memory and adds latency. Going through Storage avoids both.

## Smallest safe fix

Upload the audio blob to the existing **private `exam-audio` Storage bucket** from the client, then call `transcribe-audio` with `{ audioPath }` instead of `{ audioBase64 }`. The edge function downloads the object with the service-role key and forwards it to ElevenLabs exactly as today.

Why this is the smallest fix:
- Storage uploads use a dedicated, resumable-friendly endpoint that handles large bodies far more reliably on mobile than a JSON POST to a function.
- No change to scoring, feedback, reports/PDFs, speaker mapping, calibration, billing.
- No change to `analyze-exam`, `purge-expired-audio`, or `elevenlabs-scribe-token`.
- Keeps `verify_jwt = true` on `transcribe-audio`; RLS on the bucket already restricts user access; the function uses service-role only to read the just-uploaded object.

### Changes

1. **`src/lib/transcribe.ts`** — replace `transcribeBlob`:
   - Compute encoded size, log it (`console.info("[transcribe] uploading", sizeMb, "MB")`).
   - Generate a path `${userId}/${crypto.randomUUID()}.webm`.
   - `supabase.storage.from("exam-audio").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false })`. On failure, surface a clear message (`Audio upload failed: <msg> — check your connection and retry.`).
   - `callEdgeFunction("transcribe-audio", { body: { audioPath: path, mimeType: blob.type }, timeoutMs: 180_000 })`.
   - In a `finally`, best-effort delete the object: `supabase.storage.from("exam-audio").remove([path])` (ignore errors; `purge-expired-audio` is the safety net).

2. **`supabase/functions/transcribe-audio/index.ts`** — accept either shape, prefer `audioPath`:
   - If `audioPath` present: create a service-role client, `storage.from("exam-audio").download(audioPath)` → get a `Blob`, forward to ElevenLabs unchanged.
   - If only `audioBase64` present: keep the existing branch (back-compat for any in-flight queued items).
   - Keep CORS, `verify_jwt`, `requireUser`, all headers, response shape, and the ElevenLabs call **unchanged**.

3. **Storage RLS** — `exam-audio` already exists as private. Confirm there are policies allowing an authenticated user to `INSERT` and `DELETE` objects under their own `userId/*` prefix. If missing, add minimal policies (no other table or policy touched):
   - `INSERT` where `bucket_id = 'exam-audio' AND auth.uid()::text = (storage.foldername(name))[1]`
   - `DELETE` same predicate
   - `SELECT` same predicate (so the user can verify their upload; the function reads with service role and doesn't need this)
   No change to the existing `purge-expired-audio` policy/job.

4. **Better client error message** — in `transcribe.ts`, wrap the existing fetch path so if `callEdgeFunction` throws `Network error …`, the surfaced message includes the encoded size and a hint: `"Network error uploading audio (X.X MB). Check your mobile connection and tap Retry."`. Pure cosmetic; no behaviour change.

### Explicitly NOT changed

- No edits to `analyze-exam`, `elevenlabs-scribe-token`, `purge-expired-audio`, `supabase/config.toml`, scoring (`speakingScore`, `cambridgeRubrics`), feedback (`partFeedback`), report PDFs (`generateReportPdf`, `generateStudentPdf`, `generateProgressPdf`), speaker mapping (`applySpeakerMap`, `SpeakerMappingPanel`), calibration, or billing.

## Storage / cost impact

- **Storage:** transient. Files are deleted client-side immediately after transcription returns, and `purge-expired-audio` already cleans orphans. Worst case during a 200-pair pilot day: ~200 × ~6 MB ≈ 1.2 GB peak that lives for seconds to minutes. Well under the Lovable Cloud free tier.
- **Bandwidth:** unchanged in total (audio still has to leave the device), but split into one Storage PUT + one tiny JSON function call instead of one huge JSON POST. Net mobile reliability is much higher.
- **Function cost:** lower — request body shrinks from MBs to ~200 bytes; CPU spent on `atob`/`Uint8Array` decode is gone.
- **Latency:** comparable on desktop, **better on mobile** (no giant JSON parse before the function can start).

## Mobile test procedure (8–10 minute recording)

1. On a mobile device over cellular (not WiFi), open Batch Session → record one pair for 8–10 minutes → Stop → Save to queue.
2. Confirm the item shows status `recorded` and an encoded-size hint is logged in the console (e.g. `[transcribe] uploading 6.4 MB`).
3. Tap **Analyze**.
   - Expected: status becomes `analyzing`, the Storage PUT completes (visible in Network as a `PUT …/storage/v1/object/exam-audio/…`), then a `POST …/functions/v1/transcribe-audio` returns 200 within ~30–90 s, then `analyze-exam` runs, item ends as `done` with a transcript.
4. Lock the screen for 10 s during the upload, unlock — the in-flight PUT should still complete (Storage tolerates this far better than the old JSON POST).
5. Toggle airplane mode briefly to force a failure — error should now read `Audio upload failed: … — check your connection and retry.` and **Retry** must succeed without re-recording.
6. Repeat on desktop — should remain green end-to-end.
7. Confirm in Storage that the uploaded object is gone within ~1 minute of `done` (client cleanup) or by the next purge run.

After approval I'll implement steps 1–4 above and rerun the security scan.