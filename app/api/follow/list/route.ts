import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sanitizeFilterValue } from "@/lib/pgrest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/follow/list?userId=<username|spotify_id>&type=followers|following
 *
 * The counts already existed but nothing could list the people behind them,
 * so Following/Followers were dead numbers in the app.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const type = url.searchParams.get("type") === "following" ? "following" : "followers";

  if (!userId) {
    return NextResponse.json({ ok: false, error: "missing_user_id" }, { status: 400 });
  }

  // The slug may be a username or a spotify_id, as everywhere else.
  const safe = sanitizeFilterValue(userId);
  const { data: target } = await supabase
    .from("users")
    .select("spotify_id")
    .or(`spotify_id.eq.${safe},username.eq.${safe}`)
    .single();

  if (!target) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

  const targetId = target.spotify_id as string;

  const { data: rows } = await supabase
    .from("follows")
    .select(type === "followers" ? "follower_id" : "following_id")
    .eq(type === "followers" ? "following_id" : "follower_id", targetId)
    .limit(200);

  const ids = (rows ?? []).map((r) =>
    type === "followers"
      ? (r as { follower_id: string }).follower_id
      : (r as { following_id: string }).following_id
  );

  if (ids.length === 0) return NextResponse.json({ ok: true, users: [] });

  // Ghost-mode users still count, but are not listed — the same bargain the
  // feed makes.
  const { data: users } = await supabase
    .from("users")
    .select("spotify_id, username, display_name, image")
    .in("spotify_id", ids)
    .eq("ghost_mode", false);

  return NextResponse.json({
    ok: true,
    users: (users ?? []).map((u) => ({
      id: (u.username as string | null) ?? (u.spotify_id as string),
      spotifyId: u.spotify_id as string,
      name: (u.display_name as string | null) ?? "Unknown",
      username: u.username as string | null,
      image: u.image as string | null,
    })),
  });
}
