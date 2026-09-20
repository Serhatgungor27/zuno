-- Supabase's Security Advisor flagged these four as "RLS Disabled in Public",
-- and the exposure is real: probing production with the anon key — which is
-- public, it ships inside the web bundle and the iOS app — returned rows from
-- every one of them.
--
-- Writes were already revoked from anon/authenticated/public in an earlier
-- pass, so this is a read exposure. The difference it makes is bulk: the UI
-- shows you one vibe's comments, while a direct query returns every comment
-- and every like in the database at once.
--
-- Safe to turn on with no policies at all: all four are reached only through
-- the service role in API routes, which bypasses RLS. Verified before writing
-- this — no browser code and no iOS code queries them directly, and there are
-- no realtime subscriptions on them.
alter table public.vibe_likes         enable row level security;
alter table public.vibe_comments      enable row level security;
alter table public.vibe_comment_likes enable row level security;
alter table public.youtube_cache      enable row level security;
