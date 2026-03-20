import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { resolveUser } from "@/lib/resolveUser";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/view?userId=X — increment profile view count (non-owners only)
export async function POST(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false }, { status: 400 });

  const user = await resolveUser(userId);
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });

  // Don't count the owner's own views
  const cookieStore = await cookies();
  const viewerId = cookieStore.get("zuno_user_id")?.value;
  if (viewerId === user.spotify_id) return NextResponse.json({ ok: true, counted: false });

  await supabase.rpc("increment_profile_views", { user_id: user.spotify_id });

  return NextResponse.json({ ok: true, counted: true });
}
