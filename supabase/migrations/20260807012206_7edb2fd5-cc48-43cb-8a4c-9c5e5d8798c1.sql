ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS exams_candidate_id_idx ON public.exams (candidate_id);
CREATE INDEX IF NOT EXISTS exams_archived_idx ON public.exams (archived);

UPDATE public.exams SET archived = true WHERE archived = false;