
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS words_json jsonb,
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS phase_marks jsonb;

CREATE INDEX IF NOT EXISTS idx_exams_audio_expires_at
  ON public.exams (audio_expires_at)
  WHERE audio_path IS NOT NULL;
