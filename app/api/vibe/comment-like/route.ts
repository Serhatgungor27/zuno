import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("zuno_user_id")?.value;
  if (!userId) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const { commentId } = await req.json();
  if (!commentId) return NextResponse.json({ ok: false });

  const { data: existing } = await supabase
    .from("vibe_comment_likes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("vibe_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId);
  } else {
    await supabase.from("vibe_comment_likes").insert({ comment_id: commentId, user_id: userId });
  }

  const { count } = await supabase
    .from("vibe_comment_likes")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", commentId);

  return NextResponse.json({ ok: true, liked: !existing, count: count ?? 0 });
}
