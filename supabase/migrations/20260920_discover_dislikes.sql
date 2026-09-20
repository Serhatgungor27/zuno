-- "Not for me" on a Discover card. Saying no has to outlive the session or
-- the feed keeps offering the same artist back, which reads as the button
-- doing nothing.
create table if not exists public.discover_dislikes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  track_id   text not null,
  track_name text,
  -- The artist matters more than the track: rejecting one song is usually a
  -- statement about the artist and the kind of music, not that one recording.
  artist     text,
  created_at timestamptz not null default now(),
  unique (user_id, track_id)
);

create index if not exists discover_dislikes_user_idx
  on public.discover_dislikes (user_id, created_at desc);

alter table public.discover_dislikes enable row level security;

-- Creating a table here grants the service role nothing, and the API reaches
-- this only through the service role.
grant all privileges on public.discover_dislikes to service_role;
