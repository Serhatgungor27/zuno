import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const historyId = url.searchParams.get("historyId");
  if (!historyId) return NextResponse.json({ ok: false });

  const cookieStore = await cookies();
  const userId = cookieStore.get("zuno_user_id")?.value ?? null;

  const { data: comments, count } = await supabase
    .from("vibe_comments")
    .select("id, user_id, user_name, user_image, user_username, text, created_at", { count: "exact" })
    .eq("history_id", historyId)
    .order("created_at", { ascending: true })
    .limit(100);

  const rows = comments ?? [];

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, comments: [], count: 0 });
  }

  const commentIds = rows.map((c) => c.id as string);

  // Fetch like counts + current user's likes in parallel
  const [{ data: likesData }, { data: userLikesData }] = await Promise.all([
    supabase.from("vibe_comment_likes").select("comment_id").in("comment_id", commentIds),
    userId
      ? supabase.from("vibe_comment_likes").select("comment_id").in("comment_id", commentIds).eq("user_id", userId)
      : Promise.resolve({ data: [] }),
  ]);

  const likeCounts: Record<string, number> = {};
  for (const l of likesData ?? []) {
    const id = l.comment_id as string;
    likeCounts[id] = (likeCounts[id] ?? 0) + 1;
  }
  const userLiked = new Set((userLikesData ?? []).map((l) => l.comment_id as string));

  const enriched = rows.map((c) => ({
    ...c,
    like_count: likeCounts[c.id as string] ?? 0,
    user_liked: userLiked.has(c.id as string),
  }));

  return NextResponse.json({ ok: true, comments: enriched, count: count ?? 0 });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("zuno_user_id")?.value;
  if (!userId) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const { historyId, text } = await req.json();
  if (!historyId || !text?.trim()) return NextResponse.json({ ok: false });

  const { data: user } = await supabase
    .from("users").select("display_name, image, username").eq("spotify_id", userId).single();

  const trimmedText = text.trim().slice(0, 200);

  const { data: comment, error: insertError } = await supabase.from("vibe_comments").insert({
    history_id: historyId,
    user_id: userId,
    user_name: user?.display_name ?? null,
    user_image: user?.image ?? null,
    user_username: user?.username ?? null,
    text: trimmedText,
  }).select("id, user_id, user_name, user_image, user_username, text, created_at").single();

  if (insertError || !comment) {
    console.error("[vibe/comments] insert error:", insertError);
    return NextResponse.json({ ok: false, error: insertError?.message ?? "insert_failed" });
  }

  // Notify owner — fire-and-forget, never blocks the response
  void (async () => {
    try {
      const { data: histRow } = await supabase
        .from("listening_history")
        .select("user_spotify_id, track_name")
        .eq("id", historyId)
        .maybeSingle();

      if (histRow && histRow.user_spotify_id !== userId) {
        await supabase.from("notifications").insert({
          user_id: histRow.user_spotify_id,
          type: "vibe_comment",
          actor_id: userId,
          actor_name: user?.display_name ?? null,
          actor_image: user?.image ?? null,
          actor_username: user?.username ?? null,
          track_name: histRow.track_name,
          history_id: historyId,
          comment_text: trimmedText.slice(0, 80),
          read: false,
        });
      }
    } catch (e) {
      console.error("[vibe/comments] notification error:", e);
    }
  })();

  return NextResponse.json({ ok: true, comment });
}
