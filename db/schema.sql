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
  created_at timestamptz not null default now(),
  embedding vector(1536),
  fts tsvector generated always as (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'') || ' ' || coalesce(note,''))
  ) stored
);

alter table public.clips add column if not exists embedding vector(1536);
alter table public.clips add column if not exists fts tsvector generated always as (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'') || ' ' || coalesce(note,''))
) stored;

create index if not exists clips_created_at_idx on public.clips (created_at desc);
create index if not exists clips_tags_idx on public.clips using gin (tags);
create index if not exists clips_embedding_idx on public.clips using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists clips_fts_idx on public.clips using gin (fts);
create unique index if not exists clips_url_key on public.clips (url) where url is not null;
do $$
begin
  alter table public.clips add constraint clips_kind_check check (kind in ('text','file','screenshot','url'));
exception
  when duplicate_object then null;
end $$;

-- Storage bucket for uploaded files
insert into storage.buckets (id, name, public) values ('clips', 'clips', false)
on conflict do nothing;

-- Semantic search helper
create or replace function public.match_clips(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 10
) returns table (
  id text,
  title text,
  url text,
  content text,
  note text,
  tags text[],
  kind text,
  source_app text,
  created_at timestamptz,
  similarity float
) language sql stable as $$
  select
    id, title, url, content, note, tags, kind, source_app, created_at,
    1 - (embedding <=> query_embedding) as similarity
  from public.clips
  where embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Optional: enable RLS and require service role or a specific JWT claim to insert
-- alter table public.clips enable row level security;
-- create policy "service inserts" on public.clips for insert to public using (auth.role() = 'service_role');
