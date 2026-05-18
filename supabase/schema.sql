-- QA Atlas schema

create table if not exists folders (
  id text primary key,
  name text not null,
  parent_id text references folders(id) on delete cascade,
  tags jsonb not null default '[]',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id text primary key,
  title text not null,
  folder_id text not null references folders(id) on delete cascade,
  description text not null default '',
  tags jsonb not null default '[]',
  priority text not null default 'medium',
  status text not null default 'To Do',
  tickets jsonb not null default '[]',
  bugs jsonb not null default '[]',
  is_stable boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists releases (
  id text primary key,
  name text not null,
  date text not null,
  affected_folder_ids jsonb not null default '[]',
  affected_item_ids jsonb not null default '[]',
  tags jsonb not null default '[]',
  created_at timestamptz not null default now()
);
