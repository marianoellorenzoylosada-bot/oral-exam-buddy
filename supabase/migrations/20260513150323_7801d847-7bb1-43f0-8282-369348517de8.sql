DROP POLICY IF EXISTS "Allow public read storage" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;

CREATE POLICY "Users read own exam audio"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exam-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users upload own exam audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'exam-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

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

CREATE POLICY "Users delete own exam audio"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'exam-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);