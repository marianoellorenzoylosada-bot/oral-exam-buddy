ALTER TABLE public.exams
  ADD CONSTRAINT exams_audio_path_owner_prefix
  CHECK (
    audio_path IS NULL
    OR (user_id IS NOT NULL AND audio_path LIKE user_id::text || '/%' AND audio_path NOT LIKE '%..%')
  ) NOT VALID;