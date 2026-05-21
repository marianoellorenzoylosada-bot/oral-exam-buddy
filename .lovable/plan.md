
## Diagnosis

### Verified facts (just tested via curl + logs)

- `OPTIONS` preflight on `analyze-exam` → **200** with correct CORS headers. Preflight is **not** the problem.
- `POST` without `Authorization` → **401** `UNAUTHORIZED_NO_AUTH_HEADER` from the **gateway** (before the function runs).
- `POST` with only `apikey` (anon) and no Bearer → **401** same code. The gateway requires a Bearer JWT now that `verify_jwt = true`.
- User session is valid (refresh token call at 20:19:10 returned a fresh access_token; subsequent REST calls to `/exams` and `/user_roles` succeed with that JWT).
- No `/functions/v1/...` request appears in the captured network log — meaning the failing call most likely never produced a server-side response the client could surface, OR it happened outside the capture window.
- `transcribe-audio` recent logs only show `shutdown` events — no invocation records since the new pilot started, suggesting the request is failing client-side before reaching the function, OR the function cold-started and the client gave up first.

### Which function is failing

`useBatchQueue.analyzeOne` calls them in this order:

1. `transcribeBlob()` → `supabase.functions.invoke("transcribe-audio", { body: { audioBase64, mimeType } })`
2. `supabase.functions.invoke("analyze-exam", …)`

Step 1 sends a large base64 audio payload (a 5-minute webm ≈ 5–15 MB raw → ~7–20 MB base64 → ~7–20 MB JSON body). `analyze-exam` is only reached if step 1 succeeds. The user's "Failed to send a request to the edge function" is the supabase-js `FunctionsFetchError`, which is thrown when **`fetch` itself rejects** — not on HTTP 4xx/5xx (those become `FunctionsHttpError` with a readable body).

The most likely culprits, in order:

1. **`transcribe-audio` is the failing function** (step 1 of the chain).
2. The error is a `fetch` failure, most plausibly:
   - **Race between `supabase.functions.invoke` and session state.** `invoke()` reads the session synchronously at call time; if a token refresh is in flight or the SDK hasn't attached the user JWT for that call, the gateway rejects with 401. The current generic catch (`if (error) throw error`) presents this as "Failed to send a request to the edge function" instead of the real `Unauthorized`.
   - **Large JSON body** (5–20 MB) occasionally trips `fetch` on flaky mobile networks, surfacing as a `TypeError: Failed to fetch` — again funneled into the same generic message.
3. Single-pair Live exam (`NewExam` + `MicCheck` → `elevenlabs-scribe-token`) uses the **same `invoke()` pattern** but with a **tiny body** (no audio payload, just a token request), so it usually succeeds — which matches the user's report that recording works and only the Batch analyze step fails.

### Why the previous security change made it visible

Before `verify_jwt = true`, the gateway forwarded unauthenticated POSTs to the function, and the in-code `requireUser()` returned a structured JSON 401. supabase-js would expose that as `FunctionsHttpError` with a readable `Unauthorized` message. **Now** the gateway rejects with a plain HTTP 401 (no JSON body via `invoke` normalization in some SDK versions), and the SDK is more likely to surface a generic fetch failure for edge cases. The auth gate itself is correct; we just lost the visible error message.

## Root cause

A combination of:

- **Generic error swallowing** in client code (`if (error) throw error` with no body inspection) hides the real gateway/function response.
- **`supabase.functions.invoke` is fragile for large bodies and during token refresh** — it doesn't expose the underlying status/body when fetch fails, and it doesn't let us force-refresh the session before the call.

## Smallest safe fix (no scoring/report/PDF changes)

### 1. Replace `invoke()` with a thin `callEdgeFunction()` helper used by Batch Session paths

New file `src/lib/edgeClient.ts`:

- Calls `supabase.auth.getSession()` (and `refreshSession()` if `expires_at` is within 60 s) so the Bearer JWT is always fresh.
- Uses `fetch()` directly against `${VITE_SUPABASE_URL}/functions/v1/<name>` with `Authorization: Bearer <token>` and `apikey: <anon>`.
- On non-2xx, reads the response body (JSON or text) and throws an `Error` with the real message + status code.
- On network failure, throws `Error("Network error reaching <name>: <reason>")`.

### 2. Use the helper in the two Batch Session call sites only

- `src/lib/transcribe.ts` → `transcribeBlob()`
- `src/hooks/useBatchQueue.ts` → `analyze-exam` invocation

Leave `NewExam`, `MicCheck`, `ReportDetail`, and `LiveTranscript` on `supabase.functions.invoke` for now (they work and are out of scope for this fix).

### 3. Surface the real error in the Batch list

`useBatchQueue.analyzeOne`'s catch already writes `err.message` into `item.error`. With the helper above, that field will now contain things like `"transcribe-audio failed (413): Audio too large (24.1 MB encoded). Please record shorter exams."` or `"Unauthorized — please sign in again."` instead of "Failed to send a request to the edge function".

### What we will NOT change

- No edge function code changes.
- No `supabase/config.toml` changes — `verify_jwt = true` stays for the three paid functions; `purge-expired-audio` stays `false`.
- No scoring, feedback, reports, PDF, speaker mapping, or billing code.
- No auth flow changes; anonymous callers continue to get 401 at the gateway.

## Test plan

1. **Smoke (still blocked anonymously):** `curl -X POST .../functions/v1/transcribe-audio` → expect 401.
2. **Live exam still works:** open `/new-exam`, run MicCheck, record a short exam, finish → confirm transcript + analysis appear (proves `elevenlabs-scribe-token`, `transcribe-audio`, `analyze-exam` still callable for authed users).
3. **Batch Session, 1 pair:**
   1. Sign in, open `/batch-session`, fill level/language/booklet/rubric.
   2. Record one ~60 s pair with 2 candidates, stop.
   3. Tap **Analyze**. Expect: status moves `queued` → `analyzing` → `done` with a populated report.
4. **Failure surfacing:**
   1. In DevTools, temporarily block `*/functions/v1/transcribe-audio` (Network → Block request URL).
   2. Tap Analyze. Expect item status `failed` with a specific message like `"Network error reaching transcribe-audio: …"` — **not** the generic "Failed to send a request to the edge function".
   3. Unblock, tap Retry → success.
5. **Expired-session path:** open DevTools console, run `await supabase.auth.signOut()`, then tap Retry → expect `failed` with `"Unauthorized — please sign in again."`.
6. **Edge function logs:** after step 3, `transcribe-audio` and `analyze-exam` logs should show one successful invocation each, with no 401s.

## Technical notes

- The helper uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from env (already present, no new secrets).
- Body remains JSON-stringified `{ audioBase64, mimeType }` for `transcribe-audio` — same wire format the function already accepts.
- 120 s timeout for `analyze-exam` is preserved via `AbortController` so the existing watchdog behavior is unchanged.
- `getSession()` followed by a conditional `refreshSession()` adds ≤ 1 round-trip only when the token is near expiry; otherwise zero overhead.
