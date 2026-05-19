## Goal

Close the two critical findings without breaking the app:
1. Require an authenticated Supabase user JWT on every edge function that spends money (Lovable AI, ElevenLabs).
2. Make `purge-expired-audio` non-callable by anonymous or normal users; keep it usable by an internal scheduler.

## Function-by-function audit

| Function | Paid? | Privileged? | Today | Risk |
|---|---|---|---|---|
| `analyze-exam` | Yes (Lovable AI Gateway, `LOVABLE_API_KEY`) | No | `verify_jwt = false` in `supabase/config.toml`, no in-code check | Anyone can drain AI credits |
| `transcribe-audio` | Yes (ElevenLabs STT) | No | Default (no JWT verify), no in-code check | Anyone can drain ElevenLabs credits |
| `elevenlabs-scribe-token` | Yes (mints realtime Scribe token) | No | Default, no in-code check | Anyone can mint live transcription tokens |
| `purge-expired-audio` | No | Yes (service-role; deletes storage + nulls DB rows) | Default, no auth, no shared secret | Anyone can trigger admin maintenance |

Client invocation today (`src/lib/transcribe.ts`, `useBatchQueue`, `NewExam`, `MicCheck`, etc.) uses `supabase.functions.invoke(...)`, which automatically attaches the logged-in user's JWT as the `Authorization: Bearer` header. So once we enforce auth in the functions, legitimate authenticated callers continue to work with **no client changes**.

## Smallest safe fix

### A. Paid functions — require authenticated user (in-code check)

For `analyze-exam`, `transcribe-audio`, `elevenlabs-scribe-token`, add at the very top of `serve()` (after the OPTIONS handler):

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const authHeader = req.headers.get("Authorization") ?? "";
if (!authHeader.startsWith("Bearer ")) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: authHeader } } },
);
const { data, error: authErr } = await supabase.auth.getClaims(
  authHeader.replace("Bearer ", "")
);
if (authErr || !data?.claims?.sub) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

Keep `verify_jwt = false` in `supabase/config.toml` (per project convention with the signing-keys system) and validate in code. No changes to scoring, transcripts, audio storage, or calibration.

### B. `purge-expired-audio` — restrict to internal scheduler

Add a shared-secret header check at the top of the handler:

```ts
const provided = req.headers.get("x-cron-secret");
const expected = Deno.env.get("PURGE_CRON_SECRET");
if (!expected || provided !== expected) {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

- Add `PURGE_CRON_SECRET` via the secrets tool (request from user).
- If a `pg_cron` job exists for this function, update it to send `x-cron-secret`. If no schedule exists yet, leave scheduling out of scope (function simply becomes unreachable from the public internet, which is the goal).
- Service-role key remains server-only.

## Files to change

- `supabase/functions/analyze-exam/index.ts` — add auth gate
- `supabase/functions/transcribe-audio/index.ts` — add auth gate
- `supabase/functions/elevenlabs-scribe-token/index.ts` — add auth gate
- `supabase/functions/purge-expired-audio/index.ts` — add cron-secret gate
- Add secret: `PURGE_CRON_SECRET`

No `config.toml` change. No client code change. No DB/RLS/storage change.

## Test plan

After deploy:

1. **Anonymous blocked on paid functions** — `curl -X POST https://<project>.functions.supabase.co/transcribe-audio -d '{}'` → 401. Same for `analyze-exam`, `elevenlabs-scribe-token`.
2. **Authenticated user still works** — Log in to preview, record a Batch Session exam, run Analyze → succeeds end-to-end (transcribe + analyze). Mic check (`elevenlabs-scribe-token`) still issues a token.
3. **Purge blocked publicly** — `curl https://<project>.functions.supabase.co/purge-expired-audio` → 403. Same when logged in as a normal user via `supabase.functions.invoke` (no secret header).
4. **Purge works with secret** — `curl -H "x-cron-secret: $PURGE_CRON_SECRET" ...` → 200 with `{deleted, scanned}`. Confirms scheduler path remains functional.

## Risks / notes

- `supabase.functions.invoke()` already attaches the user JWT for logged-in sessions, so no client edits are required. Any code path that calls these functions while the user is *not* logged in would now fail — none exist today (all callers sit behind `useAuth`).
- `getClaims()` is the supported in-code validator under the signing-keys system already used elsewhere in the project.
- The cron-secret approach for purge avoids exposing the service role key and works with any scheduler (pg_cron, external).
