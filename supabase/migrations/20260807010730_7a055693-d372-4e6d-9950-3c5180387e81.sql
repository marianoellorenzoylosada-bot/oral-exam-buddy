ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision_reason text NULL;

DROP POLICY IF EXISTS "Users can update own exams" ON public.exams;

CREATE POLICY "Users can update own exams" ON public.exams
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND confirmed_at IS NULL)
  WITH CHECK (auth.uid() = user_id AND confirmed_at IS NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;