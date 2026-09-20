-- Favourite artists are stored as free text, so "Drake" has to be re-searched
-- to draw a picture — and the search can return a different Drake than the one
-- the user picked. This records the Deezer artist id they actually chose,
-- keyed by the exact name in favorite_artists, so the two stay in step.
--
-- Additive: favorite_artists keeps its meaning and the web app is untouched.
alter table public.profiles
  add column if not exists favorite_artist_ids jsonb not null default '{}'::jsonb;
