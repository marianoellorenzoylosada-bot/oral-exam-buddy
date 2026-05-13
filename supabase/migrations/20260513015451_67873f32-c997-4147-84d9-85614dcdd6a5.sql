ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS previous_analyses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS regrade_count int NOT NULL DEFAULT 0;