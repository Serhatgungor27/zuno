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

  const [{ count }, likedRes] = await Promise.all([
    supabase
      .from("vibe_likes")
      .select("*", { count: "exact", head: true })
      .eq("history_id", historyId),
    userId
      ? supabase.from("vibe_likes").select("id").eq("history_id", historyId).eq("user_id", userId).single()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({ ok: true, count: count ?? 0, liked: !!likedRes.data });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("zuno_user_id")?.value;
  if (!userId) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const { historyId } = await req.json();
  if (!historyId) return NextResponse.json({ ok: false });

  const { data: existing } = await supabase
    .from("vibe_likes").select("id").eq("history_id", historyId).eq("user_id", userId).single();

  if (existing) {
    await supabase.from("vibe_likes").delete().eq("history_id", historyId).eq("user_id", userId);
  } else {
    await supabase.from("vibe_likes").insert({ history_id: historyId, user_id: userId });

    // Notify owner — fire-and-forget, never blocks the response
    void (async () => {
      try {
        const { data: histRow } = await supabase
          .from("listening_history")
          .select("user_spotify_id, track_name")
          .eq("id", historyId)
          .maybeSingle();

        if (histRow && histRow.user_spotify_id !== userId) {
          const { data: actor } = await supabase
            .from("users")
            .select("display_name, image, username")
            .eq("spotify_id", userId)
            .maybeSingle();

          if (actor) {
            await supabase.from("notifications").insert({
              user_id: histRow.user_spotify_id,
              type: "vibe_like",
              actor_id: userId,
              actor_name: actor.display_name,
              actor_image: actor.image,
              actor_username: actor.username,
              track_name: histRow.track_name,
              history_id: historyId,
              read: false,
            });
          }
        }
      } catch (e) {
        console.error("[vibe/like] notification error:", e);
      }
    })();
  }

  const { count } = await supabase
    .from("vibe_likes").select("*", { count: "exact", head: true }).eq("history_id", historyId);

  return NextResponse.json({ ok: true, liked: !existing, count: count ?? 0 });
}
