CREATE OR REPLACE FUNCTION public.fill_missing_part_feedback(
  _exam_id uuid,
  _part_feedback jsonb,
  _overall_summary text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  IF _part_feedback IS NULL OR jsonb_typeof(_part_feedback) <> 'array' OR jsonb_array_length(_part_feedback) = 0 THEN
    RAISE EXCEPTION 'part_feedback must be a non-empty array';
  END IF;

  UPDATE public.exams
     SET part_feedback = _part_feedback,
         overall_summary = COALESCE(NULLIF(overall_summary, ''), NULLIF(_overall_summary, ''))
   WHERE id = _exam_id
     AND user_id = auth.uid()
     AND (part_feedback IS NULL OR jsonb_array_length(part_feedback) = 0);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.fill_missing_part_feedback(uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fill_missing_part_feedback(uuid, jsonb, text) TO authenticated;