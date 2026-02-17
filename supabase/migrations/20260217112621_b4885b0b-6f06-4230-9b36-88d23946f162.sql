
-- Create exams table for storing signed reports
CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  level_code TEXT NOT NULL,
  language TEXT NOT NULL,
  institution TEXT DEFAULT '',
  "group" TEXT DEFAULT '',
  candidates INTEGER DEFAULT 1,
  overall_band TEXT NOT NULL,
  overall_score NUMERIC(3,1) NOT NULL,
  criteria JSONB NOT NULL DEFAULT '[]',
  strengths JSONB NOT NULL DEFAULT '[]',
  areas_for_improvement JSONB NOT NULL DEFAULT '[]',
  transcript TEXT DEFAULT '',
  examiner_notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- Since there's no auth system yet, allow all operations for the anon role
-- This will be tightened when auth is added
CREATE POLICY "Allow public read" ON public.exams FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.exams FOR INSERT WITH CHECK (true);
