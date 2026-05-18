-- Comments table
create table if not exists comments (
  id text primary key,
  entity_type text not null check (entity_type in ('folder', 'item')),
  entity_id text not null,
  text text not null default '',
  attachments jsonb not null default '[]',
  author_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists comments_entity_idx on comments(entity_type, entity_id);

-- Storage bucket for screenshots/attachments
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Storage policy: allow authenticated users to upload
create policy "auth upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments');

create policy "auth update" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments');

create policy "public read" on storage.objects
  for select to public
  using (bucket_id = 'attachments');

create policy "auth delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments');

-- RLS for comments: authenticated users only
alter table comments enable row level security;

create policy "auth all" on comments
  for all to authenticated
  using (true)
  with check (true);

-- Re-lock main tables to authenticated only
alter table folders enable row level security;
alter table items enable row level security;
alter table releases enable row level security;

create policy "auth all" on folders for all to authenticated using (true) with check (true);
create policy "auth all" on items for all to authenticated using (true) with check (true);
create policy "auth all" on releases for all to authenticated using (true) with check (true);
