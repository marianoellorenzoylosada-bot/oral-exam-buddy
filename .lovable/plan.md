# Fix: private exam material readable by other users

## The problem

The `describe-material` backend function takes a storage path from the request and reads it with admin privileges, without checking the file belongs to the user asking. Any signed-in examiner who knows or guesses another examiner's file path could get the AI to read and describe their private exam pictures or scripts.

The sibling audio function already guards against this; this one was missed.

## The fix

Add the same ownership check to `supabase/functions/describe-material/index.ts`, right after the user is authenticated and before any storage access:

- Reject the request with 403 if `storagePath` does not start with `${userId}/`.
- Reject paths containing `..` (path traversal).

This mirrors the existing check in `supabase/functions/transcribe-audio/index.ts`, so behaviour stays consistent.

## Impact on normal use

None. The app always uploads session material under `${user.id}/sessions/${session_id}/…`, so every legitimate request already satisfies the check.

## After the fix

- Mark the security finding as fixed.
- Update the security memory noting that both `describe-material` and `transcribe-audio` enforce user-prefix ownership on storage paths, and that `exam-context` / `exam-audio` are private per-examiner buckets.
