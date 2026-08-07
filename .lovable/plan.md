# Fix: audio purge job deletes files without checking ownership

## The problem

The scheduled cleanup job (`purge-expired-audio`) takes the stored audio file path from each expired exam record and deletes that file with admin privileges, without checking the path belongs to the exam's own owner.

Every legitimate upload is stored under a folder named after the examiner's own id, but nothing in the database forces that. An examiner could save their own exam row with a file path pointing at someone else's recording and an already-past expiry date; the next cleanup run would then permanently delete that other person's audio. They still could never read or list it — only cause its deletion.

## The fix

Two layers, both small:

1. **In the cleanup job** — before deleting a file, confirm the path starts with that row's own owner id (and contains no `..`). Rows that fail are skipped and logged, not deleted. This mirrors the ownership checks already used by the audio-transcription and material-description functions.

2. **In the database** — add a rule on the exams table so an audio path can only ever be saved if it begins with the row's own owner id. This closes the hole at the source, so no future code path can reintroduce it.

## Impact on normal use

None. The app already uploads to `${user id}/…`, so all real records satisfy both checks. Old rows that somehow have a mismatched path simply stop being auto-purged and get logged instead of silently deleting a stranger's file.

## Technical notes

- `supabase/functions/purge-expired-audio/index.ts`: include `user_id` in the `exams` select, and guard the `storage.remove` call with `r.audio_path.startsWith(`${r.user_id}/`) && !r.audio_path.includes("..")`.
- Migration: a `CHECK`-style trigger (or `CHECK` constraint) on `public.exams` enforcing `audio_path IS NULL OR audio_path LIKE user_id::text || '/%'`. Existing non-conforming rows will be left alone by using a `NOT VALID` constraint so the migration cannot fail on legacy data.
- Afterwards: mark the finding `purge_path_trust` as fixed and refresh the security memory to record that all three audio/material functions enforce the user-prefix rule and that the DB now constrains `audio_path`.
