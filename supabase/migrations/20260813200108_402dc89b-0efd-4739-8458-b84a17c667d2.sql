UPDATE public.session_attempts
SET status = 'reviewing_speakers', analysis_result = NULL, updated_at = now()
WHERE id = '41ab2161-0cfa-4bdc-bfde-33dc848172dd';