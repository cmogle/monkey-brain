# Claude Code Review — monkey-brain Phase 1

Reviewed: 2026-03-08
Reviewer context: I maintain the openclaw context engine (`~/openclaw/openclaw-context-engine/`) which uses the same Supabase instance (CAMEO org, project `fazdbecnxwgkvbxwlrfn`). The openclaw agent ("Monkey") needs to be able to search and retrieve clips from this second brain.

---

## What's solid

- Clean minimal intake service, good Fastify structure
- Thorough README with iOS Shortcut recipes
- Tailnet-only design is the right call
- Same Supabase instance as the context engine — no cross-project wiring needed

---

## Critical: Add embeddings so the openclaw agent can search clips

The context engine searches via pgvector cosine similarity (`text-embedding-3-small`, 1536 dimensions). The `clips` table has no embedding column and no vector search function. They're in the same database but completely disconnected.

### Required changes

1. **Add embedding column to `clips`:**
   ```sql
   alter table public.clips add column embedding vector(1536);
   create index clips_embedding_idx on public.clips using ivfflat (embedding vector_cosine_ops) with (lists = 100);
   ```

2. **Embed on ingest.** After inserting the clip row, call OpenAI `text-embedding-3-small` on the clip content (concatenate title + content + note + url for richer vectors) and update the row with the embedding. Add `OPENAI_API_KEY` to the env config.

3. **Add a semantic search RPC** (same pattern as existing `match_context_chunks`):
   ```sql
   create or replace function match_clips(
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
   ```

4. **Add a full-text search index** on content for keyword lookups:
   ```sql
   alter table public.clips add column fts tsvector
     generated always as (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(content,'') || ' ' || coalesce(note,''))) stored;
   create index clips_fts_idx on public.clips using gin (fts);
   ```

---

## Integration path (for Claude Code / openclaw side)

Once the above is in place, I'll wire the openclaw context engine to query `match_clips()` and inject relevant clips into the agent's context as a `<clipped-knowledge>` section. No action needed from Codex on that side.

**Interim shortcut (optional):** If you want Monkey to see clips before the full integration, insert a summary of each new clip into the existing `shared_knowledge` table with `source_agent_id: 'monkey-brain'` and `category: 'clip'`. The context engine already searches that table.

---

## Smaller recommendations

- **Deduplication:** Consider a unique constraint or upsert on `url` (where not null) to prevent the same link being clipped twice.
- **`kind` values:** Document or constrain the expected values (`text`, `file`, `screenshot`, `url`, etc.) — an enum or check constraint prevents client typos.
- **Full-text search:** Even before embeddings, a tsvector index on content would let you do keyword lookups.
- **RLS:** Currently commented out. Worth enabling before Phase 2 / any multi-user scenario.
- **Binding `0.0.0.0`:** Fine on tailnet, but note this differs from the openclaw gateway which is loopback-only. If the Mac mini ever joins a non-tailscale network, the service would be exposed.

---

## Division of labour

- **Codex owns:** monkey-brain repo — schema, intake server, embeddings pipeline, search RPCs
- **Claude Code owns:** openclaw context engine integration — wiring `match_clips()` into the agent's `assemble()` step

Awaiting Codex's handover doc for Phase 2 details before starting the integration work.
