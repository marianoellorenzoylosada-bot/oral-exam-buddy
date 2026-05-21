## Root cause (confirmed from logs)

Every recent `transcribe-audio` invocation crashes at line 27 with:

```
TypeError: supabase.auth.getClaims is not a function
    at requireUser (transcribe-audio/index.ts:27:47)
```

The Supabase JS client (`@supabase/supabase-js@2.45.0`) does **not** expose `supabase.auth.getClaims()`. The auth gate throws an uncaught `TypeError` before any response headers are flushed, so the Edge Runtime tears down the connection. On the client this surfaces as `fetch` rejecting with `TypeError: Failed to fetch`, which `transcribe.ts` then rewrites to **"Network error contacting transcription service (audio X MB uploaded OK)"** — a misleading message, because the upload genuinely did succeed and the function genuinely was reached; it just exploded before replying.

This is why:
- Storage upload works (different code path).
- ElevenLabs is never called (we never get past line 27).
- Duration / quota / timeout are red herrings — the function dies in <50 ms.
- It started after the security/auth refactor that introduced `getClaims`.

## Smallest safe fix

Replace the broken claims call in `supabase/functions/transcribe-audio/index.ts` with the supported `auth.getUser(jwt)` API, which validates the JWT against Supabase Auth and returns the user. Same security guarantee, real function on the installed SDK version.

```ts
// before
const { data, error } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
if (error || !data?.claims?.sub) { return 401 }

// after
const jwt = authHeader.replace("Bearer ", "");
const { data, error } = await supabase.auth.getUser(jwt);
if (error || !data?.user?.id) { return 401 }
```

Nothing else in the function needs to change. CORS, Storage download path, ElevenLabs call, response shape, `verify_jwt`, and RLS are untouched.

### Secondary polish (optional, same edit pass)

To stop hiding real backend errors behind "Network error…" in the future, tighten `src/lib/transcribe.ts` so that only true `TypeError: Failed to fetch` (network) is reported as a connection issue; HTTP errors from the function should pass through with their real message (which `edgeClient.ts` already produces, e.g. `transcribe-audio failed (502): Transcription failed: 429`). Today the catch-all rewrites *any* "Network error…" prefix, which is what masked this bug.

## Answers to the diagnostic questions

1. **Did POST reach the function?** Yes — logs show `booted` + immediate `TypeError` per invocation.
2. **Where does it fail?** Auth gate, before Storage download / FormData / ElevenLabs.
3. **Client timeout too short?** No — 180 s is fine; failure is <1 s.
4. **Edge Function timeout?** Not the cause now; for true 14–15 min audio the ElevenLabs call typically returns in 30–90 s, well within the 150 s wall clock. We can revisit only if real timeouts appear after the fix.
5. **ElevenLabs quota?** Not reached — function dies before calling them.
6. **Free-plan credits?** N/A right now; user confirms credits remain.
7. **Storage-first slower?** No — adds one signed download inside the function (~1–3 s for 12 MB), negligible vs. ElevenLabs latency.
8. **Errors swallowed?** Yes, partially — the `Network error` rewrite in `transcribe.ts` hides real HTTP errors. Will tighten so HTTP 4xx/5xx pass through verbatim.
9. **Stage UI?** Will add 3 stage labels to the Batch item status while analyzing: `Uploading audio…` → `Contacting transcription service…` → `Transcribing… (this can take 1–2 min for 15 min audio)` → `Scoring…`. Implemented via a small `onStage` callback wired from `useBatchQueue.analyzeOne` into a new `stageLabel` field on `BatchItem`.

## Files to change

1. `supabase/functions/transcribe-audio/index.ts` — swap `getClaims` → `getUser`. (~4 lines)
2. `src/lib/transcribe.ts` — narrow the "Network error" rewrite to only `TypeError: Failed to fetch`; let HTTP errors through with their real text. Accept optional `onStage` callback.
3. `src/hooks/useBatchQueue.ts` — add `stageLabel?: string` to `BatchItem`; pass `onStage` into `transcribeBlob`; clear on done/failed.
4. `src/pages/BatchSession.tsx` (display only) — render `item.stageLabel` under "Analyzing…".

No changes to: `analyze-exam`, `elevenlabs-scribe-token`, `purge-expired-audio`, `config.toml`, scoring, feedback, reports/PDFs, speaker mapping, calibration, billing, auth setup, RLS, or storage policies.

## Test plan (14–15 min FCE recording)

1. **Smoke test — short clip first (30 s)** on desktop:
   - Record 30 s in Batch Session → Analyze.
   - Expect: stage label cycles Uploading → Contacting → Transcribing → Scoring → `done`.
   - Verify `transcribe-audio` logs show `booted`, no `TypeError`, ElevenLabs `200`, and a response body returned.

2. **Mobile happy path — full FCE length (14–15 min)** on cellular:
   - Record 14–15 min → tap Analyze.
   - Watch the Batch item label progress through all four stages.
   - Expected timing: upload 20–60 s on cellular, ElevenLabs transcription 45–90 s, scoring 15–40 s.
   - Verify Storage object appears then is deleted within ~1 min of completion.
   - Verify final report renders with transcript + scores.

3. **Negative path — force ElevenLabs error** (temporarily revoke `ELEVENLABS_API_KEY` in a side test, or wait for a 429):
   - Expect UI shows `transcribe-audio failed (502): Transcription failed: 401` (or 429), **not** the misleading "Network error" string.
   - Tap Retry → succeeds once the underlying cause is resolved.

4. **Regression** — analyze a previously-completed Batch item to confirm no scoring/report/PDF drift.

5. **Security scan** — re-run after deploy; should remain clean (only the pre-existing low-severity Postgres linter warnings).
