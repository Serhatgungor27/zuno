import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveUser } from "@/lib/resolveUser";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false }, { status: 400 });

  const user = await resolveUser(userId);
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });

  // Only the owner sees full stats
  const cookieStore = await cookies();
  const viewerId = cookieStore.get("zuno_user_id")?.value;
  const isOwner = viewerId === user.spotify_id;

  // Check show_top_stats preference
  const { data: userPrefs } = await supabase
    .from("users")
    .select("show_top_stats")
    .eq("spotify_id", user.spotify_id)
    .single();
  const showTopStats = userPrefs?.show_top_stats ?? true;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Total tracks this week
  const { count: weeklyCount } = await supabase
    .from("listening_history")
    .select("*", { count: "exact", head: true })
    .eq("user_spotify_id", user.spotify_id)
    .gte("played_at", weekAgo);

  // Top tracks this week
  const { data: history } = await supabase
    .from("listening_history")
    .select("track_id, track_name, artist, album_image, track_url")
    .eq("user_spotify_id", user.spotify_id)
    .gte("played_at", weekAgo);

  const counts: Record<string, { track_id: string; track_name: string; artist: string; album_image: string | null; track_url: string | null; count: number }> = {};
  const artistCounts: Record<string, { artist: string; album_image: string | null; count: number }> = {};
  for (const h of history ?? []) {
    if (!counts[h.track_id]) {
      counts[h.track_id] = { track_id: h.track_id, track_name: h.track_name, artist: h.artist, album_image: h.album_image, track_url: h.track_url, count: 0 };
    }
    counts[h.track_id].count++;

    // Use primary artist only (first before comma)
    const primaryArtist = (h.artist as string).split(",")[0].trim();
    if (!artistCounts[primaryArtist]) {
      artistCounts[primaryArtist] = { artist: primaryArtist, album_image: h.album_image, count: 0 };
    }
    artistCounts[primaryArtist].count++;
  }
  const topTracks = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  const topArtist = Object.values(artistCounts).sort((a, b) => b.count - a.count)[0] ?? null;

  // Profile views (owner only)
  let profileViews = null;
  if (isOwner) {
    const { data: userData } = await supabase
      .from("users")
      .select("profile_views")
      .eq("spotify_id", user.spotify_id)
      .single();
    profileViews = userData?.profile_views ?? 0;
  }

  // Hide top song / fav artist from visitors if user opted out
  const visibleTopTracks = isOwner || showTopStats ? topTracks : [];
  const visibleTopArtist = isOwner || showTopStats ? topArtist : null;

  return NextResponse.json({
    ok: true,
    isOwner,
    weeklyTracks: weeklyCount ?? 0,
    topTracks: visibleTopTracks,
    topArtist: visibleTopArtist,
    profileViews,
  });
}
