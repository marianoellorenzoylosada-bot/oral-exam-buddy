ALTER TABLE public.session_attempts
  ADD COLUMN IF NOT EXISTS split_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS speaker_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS split_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS speaker_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;