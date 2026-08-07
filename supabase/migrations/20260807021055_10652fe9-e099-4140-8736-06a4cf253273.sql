CREATE TYPE public.transcription_mode AS ENUM ('live', 'manual');

CREATE TABLE public.speaking_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  level_code TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  transcription_mode public.transcription_mode NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaking_sessions TO authenticated;
GRANT ALL ON public.speaking_sessions TO service_role;

ALTER TABLE public.speaking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own speaking sessions"
  ON public.speaking_sessions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.session_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.speaking_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('part2_pictures','part3_diagram','examiner_script','notes')),
  image_path TEXT NOT NULL DEFAULT '',
  ai_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_materials TO authenticated;
GRANT ALL ON public.session_materials TO service_role;

ALTER TABLE public.session_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own session materials"
  ON public.session_materials
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.session_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.speaking_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_path TEXT NOT NULL DEFAULT '',
  transcript TEXT NOT NULL DEFAULT '',
  speaker_map JSONB,
  candidate_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidate_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'recorded',
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  live_transcript TEXT NOT NULL DEFAULT '',
  live_words JSONB,
  transcription_mode public.transcription_mode NOT NULL DEFAULT 'manual'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_attempts TO authenticated;
GRANT ALL ON public.session_attempts TO service_role;

ALTER TABLE public.session_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own session attempts"
  ON public.session_attempts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.speaking_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES public.session_attempts(id) ON DELETE SET NULL;

CREATE TRIGGER update_speaking_sessions_updated_at
  BEFORE UPDATE ON public.speaking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_session_materials_updated_at
  BEFORE UPDATE ON public.session_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_session_attempts_updated_at
  BEFORE UPDATE ON public.session_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
