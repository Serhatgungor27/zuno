import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveUser } from "@/lib/resolveUser";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false, error: "missing_user_id" }, { status: 400 });

  const user = await resolveUser(userId);
  if (!user) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

  // Check ghost mode — only the owner can see their own history while in ghost mode
  const { data: userData } = await supabase
    .from("users")
    .select("ghost_mode")
    .eq("spotify_id", user.spotify_id)
    .single();

  if (userData?.ghost_mode) {
    const cookieStore = await cookies();
    const viewerId = cookieStore.get("zuno_user_id")?.value;
    if (viewerId !== user.spotify_id) {
      return NextResponse.json({ ok: true, tracks: [] });
    }
  }

  const { data: tracks } = await supabase
    .from("listening_history")
    .select("track_id, track_name, artist, album_image, track_url, played_at, repeat_count")
    .eq("user_spotify_id", user.spotify_id)
    .order("played_at", { ascending: false })
    .limit(15);

  return NextResponse.json({ ok: true, tracks: tracks ?? [] });
}
