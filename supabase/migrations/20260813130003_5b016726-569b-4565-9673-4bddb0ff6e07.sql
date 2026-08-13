create policy "Users can manage their own shared-reports files"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'shared-reports' and split_part(name, '/', 1) = auth.uid()::text)
  with check (bucket_id = 'shared-reports' and split_part(name, '/', 1) = auth.uid()::text);