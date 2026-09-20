-- Discover only ever learned from an explicit heart, which almost nobody
-- taps. The strong signal in a swipe feed is how long a card held you and
-- whether the track played out — that is what makes TikTok's feed feel like
-- it knows you, and every swipe produces one whether or not you touch
-- anything.
--
-- Interactions were anonymous per session, so nothing survived a relaunch.
alter table public.discover_interactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Fraction of the preview that actually played, 0-1. Distinguishes a track
-- left running from one skipped in half a second, which time alone does not
-- when previews differ in length.
alter table public.discover_interactions
  add column if not exists completion real;

create index if not exists discover_interactions_user_created_idx
  on public.discover_interactions (user_id, created_at desc);

-- Reached only through the service role.
grant all privileges on public.discover_interactions to service_role;
