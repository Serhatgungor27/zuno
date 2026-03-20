import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("zuno_user_id")?.value ?? null;
}

// GET /api/follow?userId=X — follow status + counts for a profile
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false, error: "missing_user_id" }, { status: 400 });

  const currentUserId = await getCurrentUserId();

  // Resolve spotify_id from username or spotify_id
  const { data: target } = await supabase
    .from("users")
    .select("spotify_id")
    .or(`spotify_id.eq.${userId},username.eq.${userId}`)
    .single();

  if (!target) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

  const targetId = target.spotify_id;

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", targetId),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", targetId),
  ]);

  let isFollowing = false;
  if (currentUserId && currentUserId !== targetId) {
    const { data } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", currentUserId)
      .eq("following_id", targetId)
      .single();
    isFollowing = !!data;
  }

  return NextResponse.json({
    ok: true,
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
    isFollowing,
    isSelf: currentUserId === targetId,
  });
}

// POST /api/follow — toggle follow { userId }
export async function POST(req: Request) {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const body = await req.json();
  const targetUserId = body.userId as string;
  if (!targetUserId) return NextResponse.json({ ok: false, error: "missing_user_id" }, { status: 400 });

  // Resolve to spotify_id
  const { data: target } = await supabase
    .from("users")
    .select("spotify_id")
    .or(`spotify_id.eq.${targetUserId},username.eq.${targetUserId}`)
    .single();

  if (!target) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

  const targetId = target.spotify_id;
  if (targetId === currentUserId) return NextResponse.json({ ok: false, error: "cannot_follow_self" }, { status: 400 });

  // Check if already following
  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", currentUserId)
    .eq("following_id", targetId)
    .single();

  if (existing) {
    // Unfollow
    await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", targetId);
    return NextResponse.json({ ok: true, action: "unfollowed" });
  } else {
    // Follow
    await supabase.from("follows").insert({ follower_id: currentUserId, following_id: targetId });

    // Create a notification for the person being followed
    const { data: actor } = await supabase
      .from("users")
      .select("display_name, image, username")
      .eq("spotify_id", currentUserId)
      .single();

    if (actor) {
      await supabase.from("notifications").insert({
        user_id: targetId,
        type: "follow",
        actor_id: currentUserId,
        actor_name: actor.display_name,
        actor_image: actor.image,
        actor_username: actor.username,
        read: false,
      }).select().single(); // fire-and-forget, ignore errors
    }

    return NextResponse.json({ ok: true, action: "followed" });
  }
}
