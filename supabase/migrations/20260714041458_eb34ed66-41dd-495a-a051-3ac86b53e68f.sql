ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS part_feedback jsonb,
  ADD COLUMN IF NOT EXISTS overall_summary text;