import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveViewerId } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeezerChartTrack = {
  id: number;
  title: string;
  link?: string;
  preview?: string;
  position?: number;
  artist?: { name?: string };
  album?: { cover_xl?: string; cover_big?: string };
};

type AppleChartRow = {
  id: string;
  name: string;
  artistName?: string;
  artworkUrl100?: string;
  url?: string;
};

const CHART_TTL = 10 * 60 * 1000;
const chartCache = new Map<string, { at: number; payload: { tracks: unknown[]; title?: string } }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "global";

  // Vibe — recent plays from listening_history (last 48h, non-ghost users)
  if (type === "vibe") {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: history } = await supabase
      .from("listening_history")
      .select("id, track_id, track_name, artist, album_image, track_url, played_at, user_spotify_id, repeat_count")
      .gte("played_at", since)
      .order("played_at", { ascending: false })
      .limit(60);

    if (!history || history.length === 0) return NextResponse.json({ ok: true, items: [] });

    const userIds = [...new Set(history.map((h) => h.user_spotify_id as string))];
    const { data: users } = await supabase
      .from("users")
      .select("spotify_id, display_name, image, username, ghost_mode")
      .in("spotify_id", userIds)
      .eq("ghost_mode", false);

    const userMap = new Map((users ?? []).map((u) => [u.spotify_id, u]));

    const seen = new Set<string>();
    const items = history
      .filter((h) => userMap.has(h.user_spotify_id as string))
      .filter((h) => {
        // Deduplicate old rows: keep only the first (most recent) occurrence
        // of each (user, track) pair — handles legacy duplicate inserts
        const key = `${h.user_spotify_id}:${h.track_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((h) => {
        const u = userMap.get(h.user_spotify_id as string)!;
        return {
          vibeId: h.id as string,
          id: (u.username as string | null) ?? (u.spotify_id as string),
          spotifyId: u.spotify_id as string,
          userName: (u.display_name as string | null) ?? "Unknown",
          userImage: u.image as string | null,
          trackId: h.track_id as string,
          track: h.track_name as string,
          artist: h.artist as string,
          albumImage: h.album_image as string | null,
          trackUrl: h.track_url as string | null,
          playedAt: h.played_at as string,
          repeatCount: (h.repeat_count as number) ?? 1,
        };
      });

    return NextResponse.json({ ok: true, items });
  }

  // Following feed — vibes and reposts from the people you follow, merged and
  // ordered by when they happened. Reposts live on profiles.id while follows
  // key on spotify_id, so this leans on users.auth_user_id to bridge them.
  if (type === "following_feed") {
    const viewerId = await resolveViewerId(req);
    if (!viewerId) return NextResponse.json({ ok: true, items: [] });

    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewerId);

    const followedIds = (followRows ?? []).map((f) => f.following_id as string);
    if (followedIds.length === 0) return NextResponse.json({ ok: true, items: [] });

    const { data: followedUsers } = await supabase
      .from("users")
      .select("spotify_id, display_name, image, username, auth_user_id, ghost_mode")
      .in("spotify_id", followedIds)
      .eq("ghost_mode", false);

    const bySpotifyId = new Map(
      (followedUsers ?? []).map((u) => [u.spotify_id as string, u])
    );
    const byAuthId = new Map(
      (followedUsers ?? [])
        .filter((u) => u.auth_user_id)
        .map((u) => [u.auth_user_id as string, u])
    );

    const visibleIds = [...bySpotifyId.keys()];
    if (visibleIds.length === 0) return NextResponse.json({ ok: true, items: [] });

    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: plays }, { data: reposts }] = await Promise.all([
      supabase
        .from("listening_history")
        .select("id, track_id, track_name, artist, album_image, track_url, played_at, user_spotify_id")
        .in("user_spotify_id", visibleIds)
        .gte("played_at", since)
        .order("played_at", { ascending: false })
        .limit(60),
      byAuthId.size > 0
        ? supabase
            .from("reposts")
            .select("id, user_id, history_id, track_name, artist, album_image, track_url, created_at")
            .in("user_id", [...byAuthId.keys()])
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(40)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

    type Item = {
      id: string;
      kind: "vibe" | "repost";
      trackId: string | null;
      track: string;
      artist: string;
      albumImage: string | null;
      trackUrl: string | null;
      at: string;
      userName: string;
      userImage: string | null;
      userHandle: string;
    };

    const items: Item[] = [];

    for (const p of plays ?? []) {
      const u = bySpotifyId.get(p.user_spotify_id as string);
      if (!u) continue;
      items.push({
        id: `vibe:${p.id}`,
        kind: "vibe",
        trackId: p.track_id as string,
        track: p.track_name as string,
        artist: p.artist as string,
        albumImage: p.album_image as string | null,
        trackUrl: p.track_url as string | null,
        at: p.played_at as string,
        userName: (u.display_name as string | null) ?? "Unknown",
        userImage: u.image as string | null,
        userHandle: (u.username as string | null) ?? (u.spotify_id as string),
      });
    }

    for (const r of reposts ?? []) {
      const u = byAuthId.get(r.user_id as string);
      if (!u) continue;
      items.push({
        id: `repost:${r.id}`,
        kind: "repost",
        trackId: (r.history_id as string) ?? null,
        track: r.track_name as string,
        artist: r.artist as string,
        albumImage: r.album_image as string | null,
        trackUrl: r.track_url as string | null,
        at: r.created_at as string,
        userName: (u.display_name as string | null) ?? "Unknown",
        userImage: u.image as string | null,
        userHandle: (u.username as string | null) ?? (u.spotify_id as string),
      });
    }

    // One row per person per track — someone replaying a song all evening
    // should not fill the feed.
    const seen = new Set<string>();
    const merged = items
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .filter((i) => {
        const key = `${i.userHandle}:${i.track}:${i.artist}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 60);

    return NextResponse.json({ ok: true, items: merged });
  }

  // Charts — songs or podcasts, worldwide or per country.
  //
  // "Global" songs come from Deezer, whose rows carry preview URLs so they
  // play without the /api/preview lookup. Every country chart comes from
  // Apple's marketing RSS, which has no previews — those fall back to the
  // lookup like any other list. Apple has no worldwide storefront, so global
  // podcasts are not a thing; the app only offers countries there.
  if (type === "trending_global") {
    const kind = url.searchParams.get("kind") === "podcasts" ? "podcasts" : "songs";
    const country = (url.searchParams.get("country") ?? "global").toLowerCase();
    const cacheKey = `${kind}:${country}`;

    const cached = chartCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CHART_TTL) {
      return NextResponse.json({ ok: true, ...cached.payload });
    }

    try {
      let payload: { tracks: unknown[]; title?: string };

      if (kind === "songs" && country === "global") {
        const res = await fetch("https://api.deezer.com/chart/0/tracks?limit=50", {
          cache: "no-store",
        });
        if (!res.ok) return NextResponse.json({ ok: true, tracks: [] });
        const data = await res.json();
        payload = {
          title: "Global",
          tracks: (data?.data ?? []).map(
            (t: DeezerChartTrack, i: number) => ({
              position: t.position ?? i + 1,
              trackId: String(t.id),
              name: t.title,
              artist: t.artist?.name ?? "",
              albumImage: t.album?.cover_xl ?? t.album?.cover_big ?? null,
              previewUrl: t.preview ?? null,
              // Where this row came from: Deezer here, Apple below. It is NOT
              // a Spotify link, and naming it deezerUrl led the app to open
              // Apple Music from a button labelled Spotify.
              sourceUrl: t.link ?? null,
              kind: "song",
            })
          ),
        };
      } else {
        const path =
          kind === "podcasts"
            ? `${country}/podcasts/top/50/podcasts.json`
            : `${country}/music/most-played/50/songs.json`;
        const res = await fetch(`https://rss.marketingtools.apple.com/api/v2/${path}`, {
          cache: "no-store",
        });
        if (!res.ok) return NextResponse.json({ ok: true, tracks: [] });
        const data = await res.json();
        payload = {
          title: data?.feed?.title ?? "",
          tracks: (data?.feed?.results ?? []).map(
            (r: AppleChartRow, i: number) => ({
              position: i + 1,
              trackId: String(r.id),
              name: r.name,
              artist: r.artistName ?? "",
              // The RSS only gives 100px art; the CDN resizes by path.
              albumImage: r.artworkUrl100
                ? r.artworkUrl100.replace("100x100bb", "600x600bb")
                : null,
              previewUrl: null,
              sourceUrl: r.url ?? null,
              kind: kind === "podcasts" ? "podcast" : "song",
            })
          ),
        };
      }

      chartCache.set(cacheKey, { at: Date.now(), payload });
      return NextResponse.json({ ok: true, ...payload });
    } catch {
      return NextResponse.json({ ok: true, tracks: [] });
    }
  }

  // Trending songs — most played in last 24 hours
  if (type === "trending") {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: history } = await supabase
      .from("listening_history")
      .select("track_id, track_name, artist, album_image, track_url")
      .gte("played_at", since);

    if (!history || history.length === 0) return NextResponse.json({ ok: true, tracks: [] });

    // Count plays per track
    const counts: Record<string, { track_id: string; track_name: string; artist: string; album_image: string | null; track_url: string | null; count: number }> = {};
    for (const h of history) {
      if (!counts[h.track_id]) {
        counts[h.track_id] = { track_id: h.track_id, track_name: h.track_name, artist: h.artist, album_image: h.album_image, track_url: h.track_url, count: 0 };
      }
      counts[h.track_id].count++;
    }

    const trending = Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({ ok: true, tracks: trending });
  } // "global" | "following"

  // Freshness window: users updated within last 2 minutes
  const freshSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  if (type === "following") {
    const currentUserId = await resolveViewerId(req);
    if (!currentUserId) {
      return NextResponse.json({ ok: true, users: [] });
    }

    const { data: followData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId);

    const ids = (followData ?? []).map((f) => f.following_id);
    if (ids.length === 0) return NextResponse.json({ ok: true, users: [] });

    const { data: users } = await supabase
      .from("users")
      .select("spotify_id, display_name, image, username, now_playing_track, now_playing_artist, now_playing_image, now_playing_track_id, now_playing_url, now_playing_updated_at, is_playing")
      .eq("is_playing", true)
      .eq("ghost_mode", false)
      .gte("now_playing_updated_at", freshSince)
      .in("spotify_id", ids)
      .order("now_playing_updated_at", { ascending: false });

    return NextResponse.json({ ok: true, users: formatUsers(users ?? []) });
  }

  // Global feed — exclude ghost mode users
  const { data: users } = await supabase
    .from("users")
    .select("spotify_id, display_name, image, username, now_playing_track, now_playing_artist, now_playing_image, now_playing_track_id, now_playing_url, now_playing_updated_at, is_playing")
    .eq("is_playing", true)
    .eq("ghost_mode", false)
    .gte("now_playing_updated_at", freshSince)
    .order("now_playing_updated_at", { ascending: false });

  return NextResponse.json({ ok: true, users: formatUsers(users ?? []) });
}

function formatUsers(users: Record<string, unknown>[]) {
  return users.map((u) => ({
    id: (u.username as string | null) ?? (u.spotify_id as string),
    spotifyId: u.spotify_id as string,
    name: (u.display_name as string | null) ?? "Unknown",
    image: u.image as string | null,
    track: u.now_playing_track as string | null,
    artist: u.now_playing_artist as string | null,
    albumImage: u.now_playing_image as string | null,
    trackId: u.now_playing_track_id as string | null,
    trackUrl: u.now_playing_url as string | null,
    updatedAt: u.now_playing_updated_at as string | null,
  }));
}
