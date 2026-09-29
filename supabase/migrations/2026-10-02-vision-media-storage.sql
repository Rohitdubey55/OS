-- Vision photos, videos and voice recordings sync across devices through a
-- private Supabase Storage bucket. Each user can only see and change files in
-- their own folder (<user id>/...). Safe to run more than once.

insert into storage.buckets (id, name, public, file_size_limit)
values ('vision-media', 'vision-media', false, 52428800)   -- 50 MB per file
on conflict (id) do nothing;

drop policy if exists "vision-media read own"   on storage.objects;
drop policy if exists "vision-media insert own" on storage.objects;
drop policy if exists "vision-media update own" on storage.objects;
drop policy if exists "vision-media delete own" on storage.objects;

create policy "vision-media read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'vision-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vision-media insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vision-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vision-media update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'vision-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "vision-media delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vision-media' and (storage.foldername(name))[1] = auth.uid()::text);
