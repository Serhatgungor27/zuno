-- Apple's Search API is unauthenticated but rate limited (roughly 20 calls a
-- minute per IP), and a Discover session asks about dozens of tracks. Cache
-- every lookup, INCLUDING the misses: most underground tracks have no music
-- video, and without caching those we'd re-ask Apple about them forever.
create table if not exists public.music_video_cache (
  track_key   text primary key,
  -- Null means "looked up, genuinely no video" — not "not looked up yet".
  video_url   text,
  artwork_url text,
  created_at  timestamptz not null default now()
);

alter table public.music_video_cache enable row level security;

-- The API reaches this table through the service role, which bypasses RLS but
-- still needs table privileges. New tables in this project do NOT inherit them
-- — without this the routes fail with "permission denied for table", which the
-- service role's RLS bypass makes easy to misread as a policy problem.
grant all privileges on public.music_video_cache to service_role;
