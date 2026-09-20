-- Liking a track in Discover only ever wrote to the browser's localStorage, so
-- the likes died with the device and the iOS app had nowhere to put them at all
-- (SecureStore caps at 2048 bytes; AsyncStorage would mean a native rebuild).
--
-- Likes are worth keeping: they drive what Discover shows you next and which
-- tracks it stops repeating, so losing them degrades the feed itself.
create table if not exists public.discover_likes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- A Deezer track id, the same string Discover serves and /api/repost stores.
  track_id    text not null,
  track_name  text,
  artist      text,
  album_image text,
  preview_url text,
  spotify_url text,
  created_at  timestamptz not null default now(),
  unique (user_id, track_id)
);

create index if not exists discover_likes_user_created_idx
  on public.discover_likes (user_id, created_at desc);

-- Reached only through the service role in the API routes, so no policies are
-- needed — but leaving RLS off would expose the table to the anon key.
alter table public.discover_likes enable row level security;

-- The API reaches this table through the service role, which bypasses RLS but
-- still needs table privileges. New tables in this project do NOT inherit them
-- — without this the routes fail with "permission denied for table", which the
-- service role's RLS bypass makes easy to misread as a policy problem.
grant all privileges on public.discover_likes to service_role;
