import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — return current ghost mode status
export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("zuno_user_id")?.value;
  if (!userId) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const { data } = await supabase
    .from("users")
    .select("ghost_mode")
    .eq("spotify_id", userId)
    .single();

  return NextResponse.json({ ok: true, ghostMode: data?.ghost_mode ?? false });
}

// POST — toggle ghost mode
export async function POST() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("zuno_user_id")?.value;
  if (!userId) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const { data: current } = await supabase
    .from("users")
    .select("ghost_mode")
    .eq("spotify_id", userId)
    .single();

  const newValue = !(current?.ghost_mode ?? false);

  await supabase
    .from("users")
    .update({ ghost_mode: newValue, updated_at: new Date().toISOString() })
    .eq("spotify_id", userId);

  return NextResponse.json({ ok: true, ghostMode: newValue });
}
