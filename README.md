# monkey-brain

Tailnet-only clipping intake for your second brain. Accepts Share-sheet posts from iOS/iPadOS/macOS, drops them into Supabase, and stores files in a private bucket. Designed to run on the Mac mini (Tailscale node) and stay reachable from all your devices without iCloud.

## What this targets
- Fast capture from any Apple device via the native Share menu.
- Works offline on device; posts once network returns.
- Text, URLs, and optional files (screenshots, PDFs); client-side OCR encouraged.
- Private by default: tailnet HTTP + API key; no public exposure unless you choose Tailscale Funnel.
- Semantic search ready: embeddings stored in Supabase (OpenAI `text-embedding-3-small`) with `match_clips()` RPC for pgvector search.
- Ready for Phase 2 (summaries, purpose validation, Notion export) but keeps Phase 1 minimal.

## Components
- Fastify server (`src/server.js`): POST `/clip` to insert into Supabase `public.clips` and upload optional files to `storage` bucket `clips`.
- Supabase: table + bucket defined in `db/schema.sql`.
- iOS/iPadOS/macOS Shortcuts: Share-sheet workflow that sends payload + `X-Clip-Key` header to the tailnet address of the Mac mini.

## Prerequisites
- Node 20+ on the Mac mini.
- Tailscale running on all devices; know the tailnet IP/hostname of the Mac mini.
- Supabase project with service role key (already in CMO org); ability to run SQL in the dashboard.

## Setup
1. Apply schema in Supabase. Open the SQL editor, paste `db/schema.sql`, run it to create `public.clips`, indexes, and the private `clips` bucket.
2. Configure env. Copy `.env.example` to `.env`; set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, a strong `CLIP_API_KEY`, and `OPENAI_API_KEY`; optionally change `PORT` and `SUPABASE_BUCKET`.
3. Install deps. `cd /Users/monkeyclaw/monkey-brain` then `npm install`.
4. Run the service. `npm run dev` for pretty logs or `npm start` for production; listens on `0.0.0.0:${PORT}`.

## Endpoint
- `POST /clip`
- Headers: `X-Clip-Key: <your secret>`; `Content-Type: application/json` or `multipart/form-data`.
- JSON body fields: `content`, `title`, `url`, `note`, `tags` (comma-separated or array), `source_app`, `device`, `kind`.
- Multipart fields: same as above plus one file part. Server stores file to Supabase Storage bucket `clips` at path `<id>/<filename>`.
- Response: `{ id, stored: true, has_file, bucket, created_at }`.
- Health: `GET /health` returns `{ ok: true }`.
- Semantic search: use `select * from match_clips(<embedding>, match_threshold, match_count);` after generating a query embedding with `text-embedding-3-small`.

## Suggested iOS Shortcut (Share Sheet: Text/Links)
- Action 1: Get Details of Shortcut Input → choose URL and Text.
- Action 2: If URL is empty, set `url` variable to blank; else use the URL.
- Action 3: Ask for optional note (Quick Prompt) if you want annotations.
- Action 4: Dictionary with keys `url`, `content` (Shortcut Input as text), `title` (Get Name from URL if available), `note`, `source_app` (App Name), `device` (Device Name), `tags` (comma list).
- Action 5: Get Contents of URL — URL `http://<mac-mini-tailnet-host>:8787/clip`, Method POST, Body JSON (the Dictionary), Headers `X-Clip-Key: <your secret>`.
- Action 6: Show Result (optional toast).

## Suggested iOS Shortcut (Share Sheet: Screenshot with OCR)
- Action 1: Receive Images from Share Sheet.
- Action 2: Recognize Text from Image (on-device OCR).
- Action 3: Dictionary with `content` = recognized text, `note` = “OCR from screenshot”, `source_app` = App Name, `device` = Device Name, `kind` = `file`, `tags` = `screenshot,ocr`.
- Action 4: Get Contents of URL — URL `http://<mac-mini-tailnet-host>:8787/clip`, Method POST, Body Form (dictionary fields plus File = original image), Headers `X-Clip-Key: <your secret>`.
- Action 5: Notify success/failure.

## Tailscale notes
- Keep Tailscale app running on iOS/iPadOS; add a pre-step “Open App: Tailscale” in the Shortcut if connections fail when idle.
- Prefer tailnet-only HTTP. Use Tailscale Funnel only if you need public ingress; keep `X-Clip-Key` mandatory either way.

## Notion and Phase 2 (optional hooks)
- The `clips` table keeps `url`, `content`, `note`, `tags`, and `file_path`, so a later job can upsert into your Notion CMS database and add summaries.
- Recommendation for Phase 2: a nightly job on the Mac mini that reads `clips` → summarizes with OpenAI → writes purpose + highlights into Notion and Obsidian.

## Troubleshooting
- 401 Unauthorized: header `X-Clip-Key` missing or mismatched.
- 500 storage upload failed: ensure the `clips` bucket exists and `SUPABASE_SERVICE_ROLE_KEY` is set.
- Shortcut hangs: ensure the Mac mini is reachable via tailnet; ping it using the Tailscale IP/hostname.

## Repo hygiene
- `.env` is ignored; keep secrets out of git.
- `npm run dev` shows pretty logs; `npm start` is quiet.
