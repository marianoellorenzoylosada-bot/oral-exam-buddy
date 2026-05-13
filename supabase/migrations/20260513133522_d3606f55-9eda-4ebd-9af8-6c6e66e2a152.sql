CREATE TABLE public.calibration_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL,
  level text NOT NULL,
  task_type text NOT NULL DEFAULT '',
  transcript text NOT NULL,
  original_gold jsonb NOT NULL DEFAULT '[]'::jsonb,
  senior_corrections jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_differences jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale_differences jsonb NOT NULL DEFAULT '[]'::jsonb,
  senior_notes text NOT NULL DEFAULT '',
  examiner_id uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calibration_examples_level ON public.calibration_examples(level);
CREATE INDEX idx_calibration_examples_task_type ON public.calibration_examples(task_type);
CREATE INDEX idx_calibration_examples_case_id ON public.calibration_examples(case_id);

ALTER TABLE public.calibration_examples ENABLE ROW LEVEL SECURITY;

-- Any authenticated user (educators, admins) can read approved calibration examples
-- so they can be retrieved as contextual guidance for AI feedback later.
CREATE POLICY "Authenticated users can read calibration examples"
  ON public.calibration_examples FOR SELECT
  TO authenticated
  USING (true);

-- Only admins (Senior Examiners) can insert/update/delete approved calibration examples.
CREATE POLICY "Admins can insert calibration examples"
  ON public.calibration_examples FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND examiner_id = auth.uid());

CREATE POLICY "Admins can update calibration examples"
  ON public.calibration_examples FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete calibration examples"
  ON public.calibration_examples FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));