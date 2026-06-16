-- 1. Cambridge Core Library: allow admin-managed global rows (user_id IS NULL)
ALTER TABLE public.cambridge_reference_material
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.cambridge_reference_material
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Replace RLS policies
DROP POLICY IF EXISTS "Users view own reference material" ON public.cambridge_reference_material;
DROP POLICY IF EXISTS "Users insert own reference material" ON public.cambridge_reference_material;
DROP POLICY IF EXISTS "Users update own reference material" ON public.cambridge_reference_material;
DROP POLICY IF EXISTS "Users delete own reference material" ON public.cambridge_reference_material;

-- SELECT: owners see their legacy private rows; admins see everything (including Core). Educators do NOT see Core rows.
CREATE POLICY "Owners view private refs"
  ON public.cambridge_reference_material
  FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Admins view all refs"
  ON public.cambridge_reference_material
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- INSERT: admins can insert Core rows (user_id NULL); legacy owner inserts disallowed (educators no longer create refs)
CREATE POLICY "Admins insert core refs"
  ON public.cambridge_reference_material
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND user_id IS NULL
  );

-- UPDATE: admins update Core rows; owners may still update their legacy rows
CREATE POLICY "Admins update core refs"
  ON public.cambridge_reference_material
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND user_id IS NULL)
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND user_id IS NULL);

CREATE POLICY "Owners update private refs"
  ON public.cambridge_reference_material
  FOR UPDATE TO authenticated
  USING (user_id IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);

-- DELETE: admins delete Core; owners delete legacy private
CREATE POLICY "Admins delete core refs"
  ON public.cambridge_reference_material
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND user_id IS NULL);

CREATE POLICY "Owners delete private refs"
  ON public.cambridge_reference_material
  FOR DELETE TO authenticated
  USING (user_id IS NOT NULL AND auth.uid() = user_id);

-- 2. Exam-specific context column on exams (additive, default empty array)
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS exam_context jsonb NOT NULL DEFAULT '[]'::jsonb;