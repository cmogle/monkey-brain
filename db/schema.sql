-- Clips table
create table if not exists public.clips (
  id text primary key,
  title text,
  url text,
  content text,
  note text,
  tags text[],
  source_app text,
  device text,
  kind text not null default 'text',
  file_path text,
  file_meta jsonb,
  client_ip text,
  created_at timestamptz not null default now()
);

create index if not exists clips_created_at_idx on public.clips (created_at desc);
create index if not exists clips_tags_idx on public.clips using gin (tags);

-- Storage bucket for uploaded files
insert into storage.buckets (id, name, public) values ('clips', 'clips', false)
on conflict do nothing;

-- Optional: enable RLS and require service role or a specific JWT claim to insert
-- alter table public.clips enable row level security;
-- create policy "service inserts" on public.clips for insert to public using (auth.role() = 'service_role');
