## Fix: Lock down `exam-audio` storage bucket

### Problem
The `exam-audio` bucket has two policies on `storage.objects` granted to the `public` role:
- `Allow public read storage` — anyone (signed in or not) can read any audio file
- `Allow public upload` — anyone can upload arbitrary files into the bucket

Audio files are stored under the path convention `<user_id>/<exam_id>...` (used by `NewExam.tsx` and signed-URL generation in `ReportDetail.tsx`), so we can enforce ownership via the first path segment.

### Migration
Drop both public policies and replace them with four authenticated, owner-scoped policies on `storage.objects` for `bucket_id = 'exam-audio'`:

```sql
DROP POLICY "Allow public read storage" ON storage.objects;
DROP POLICY "Allow public upload" ON storage.objects;

-- SELECT: only the owner (path starts with their uid)
CREATE POLICY "Users read own exam audio"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exam-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- INSERT: only into own folder
CREATE POLICY "Users upload own exam audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exam-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE: only own files
CREATE POLICY "Users update own exam audio"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'exam-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'exam-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: only own files (used by purge-expired-audio via service role, which bypasses RLS)
CREATE POLICY "Users delete own exam audio"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'exam-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

The bucket itself is already `public = false`; access continues to be served via signed URLs (`createSignedUrl`) generated server-/client-side for the owner. The `purge-expired-audio` edge function uses the service role key, which bypasses RLS, so cleanup keeps working.

### No app code changes
Upload paths already start with `auth.uid()`, so existing flows (NewExam upload, ReportDetail signed URL playback, purge function) continue to work unchanged.

### Post-fix summary
- **Read:** only the authenticated owner (uid matches first folder segment); admin/service-role tasks still work via service key.
- **Upload:** only authenticated users, and only into their own `<uid>/...` folder.
- **Modify/Delete:** only the authenticated owner; service role for automated purge.
- **Public/anonymous:** no access of any kind.
