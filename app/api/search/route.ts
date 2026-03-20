import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json({ ok: true, users: [] });
  }

  // Search by username or display_name (case-insensitive prefix match)
  const { data: users } = await supabase
    .from("users")
    .select("spotify_id, display_name, username, image, is_playing, ghost_mode, now_playing_track, now_playing_artist")
    .or(`username.ilike.${q}%,display_name.ilike.${q}%`)
    .eq("ghost_mode", false)
    .order("username", { ascending: true })
    .limit(20);

  const formatted = (users ?? []).map((u) => ({
    id: (u.username as string | null) ?? (u.spotify_id as string),
    spotifyId: u.spotify_id as string,
    name: (u.display_name as string | null) ?? "Unknown",
    username: u.username as string | null,
    image: u.image as string | null,
    isLive: (u.is_playing as boolean) && !(u.ghost_mode as boolean),
    nowPlaying: u.is_playing && !u.ghost_mode
      ? { track: u.now_playing_track as string | null, artist: u.now_playing_artist as string | null }
      : null,
  }));

  return NextResponse.json({ ok: true, users: formatted });
}
