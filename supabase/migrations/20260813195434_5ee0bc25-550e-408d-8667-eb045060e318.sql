UPDATE public.session_attempts
SET status = 'reviewing_speakers', analysis_result = NULL, updated_at = now()
WHERE id = '41ab2161-0cfa-4bdc-bfde-33dc848172dd';

UPDATE public.exams
SET archived = true
WHERE id IN (
  '37e5b860-60be-4310-9fb4-0dab91193434',
  '9d590429-4133-4f6a-b155-aa439fa07ed0',
  '7f36c7ed-4d61-401f-966f-67b94237ce4b'
);