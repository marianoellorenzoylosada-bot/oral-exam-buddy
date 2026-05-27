
CREATE TABLE public.cambridge_reference_material (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  level_code TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT cambridge_ref_level_chk CHECK (level_code IN ('A2','B1','B2','C1','C2')),
  CONSTRAINT cambridge_ref_kind_chk CHECK (kind IN ('sample_transcript','examiner_comments','handbook_extract'))
);

CREATE INDEX cambridge_ref_user_level_idx ON public.cambridge_reference_material(user_id, level_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cambridge_reference_material TO authenticated;
GRANT ALL ON public.cambridge_reference_material TO service_role;

ALTER TABLE public.cambridge_reference_material ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reference material"
  ON public.cambridge_reference_material FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own reference material"
  ON public.cambridge_reference_material FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reference material"
  ON public.cambridge_reference_material FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own reference material"
  ON public.cambridge_reference_material FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER cambridge_ref_set_updated_at
  BEFORE UPDATE ON public.cambridge_reference_material
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
