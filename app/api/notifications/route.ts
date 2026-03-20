import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — return notifications for the current user
export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("zuno_user_id")?.value;
  if (!userId) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const { data: notifs } = await supabase
    .from("notifications")
    .select("id, type, actor_id, actor_name, actor_image, actor_username, track_name, history_id, comment_text, read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ ok: true, notifications: notifs ?? [] });
}

// POST — mark notifications as read
export async function POST() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("zuno_user_id")?.value;
  if (!userId) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  return NextResponse.json({ ok: true });
}
