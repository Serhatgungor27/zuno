import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/listeners?trackId=X — who else is playing this track right now
export async function GET(req: Request) {
  const url = new URL(req.url);
  const trackId = url.searchParams.get("trackId");
  const excludeId = url.searchParams.get("exclude"); // current profile owner

  if (!trackId) return NextResponse.json({ ok: true, users: [] });

  const freshSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  let query = supabase
    .from("users")
    .select("spotify_id, display_name, username, image")
    .eq("now_playing_track_id", trackId)
    .eq("is_playing", true)
    .eq("ghost_mode", false)
    .gte("now_playing_updated_at", freshSince)
    .limit(8);

  if (excludeId) {
    query = query.neq("spotify_id", excludeId);
  }

  const { data: users } = await query;

  return NextResponse.json({
    ok: true,
    users: (users ?? []).map((u) => ({
      id: (u.username as string | null) ?? (u.spotify_id as string),
      name: (u.display_name as string | null) ?? "Someone",
      image: u.image as string | null,
    })),
  });
}
