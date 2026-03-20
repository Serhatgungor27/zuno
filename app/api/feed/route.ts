import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const cookieStore = await cookies();
    const currentUserId = cookieStore.get("zuno_user_id")?.value;
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
