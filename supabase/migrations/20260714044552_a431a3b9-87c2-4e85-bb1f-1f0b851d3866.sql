
DROP POLICY IF EXISTS "Admins can insert calibration examples" ON public.calibration_examples;
DROP POLICY IF EXISTS "Admins can update calibration examples" ON public.calibration_examples;
DROP POLICY IF EXISTS "Admins can delete calibration examples" ON public.calibration_examples;

CREATE POLICY "Seniors and admins can insert calibration examples"
  ON public.calibration_examples FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'senior'::public.app_role))
    AND examiner_id = auth.uid()
  );

CREATE POLICY "Seniors and admins can update calibration examples"
  ON public.calibration_examples FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'senior'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'senior'::public.app_role)
  );

CREATE POLICY "Seniors and admins can delete calibration examples"
  ON public.calibration_examples FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'senior'::public.app_role)
  );
