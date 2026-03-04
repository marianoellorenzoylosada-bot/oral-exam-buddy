
-- Allow public delete on exams
CREATE POLICY "Allow public delete" ON public.exams FOR DELETE USING (true);

-- Allow public update on exams
CREATE POLICY "Allow public update" ON public.exams FOR UPDATE USING (true) WITH CHECK (true);

-- Create storage bucket for exam audio
INSERT INTO storage.buckets (id, name, public) VALUES ('exam-audio', 'exam-audio', false);

-- RLS for exam-audio bucket: allow anyone to insert
CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'exam-audio');
-- Allow public read
CREATE POLICY "Allow public read storage" ON storage.objects FOR SELECT USING (bucket_id = 'exam-audio');
