import { NextResponse } from "next/server";
import { getApiAuth } from "@/lib/apiAuth";
import { createClient as createAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminDb() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET /api/repost?username=X — get reposts for a user.
// With no username, returns the caller's own, which is what a feed needs to
// draw the repost button in the right state.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const username = url.searchParams.get("username");

  const db = adminDb();

  let userId: string | null = null;
  if (username) {
    const { data: profile } = await db.from("profiles").select("id").eq("username", username).single();
    if (!profile) return NextResponse.json({ ok: true, reposts: [] });
    userId = profile.id as string;
  } else {
    const auth = await getApiAuth(req);
    if (!auth) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
    userId = auth.user.id;
  }

  const { data: reposts } = await db
    .from("reposts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ ok: true, reposts: reposts ?? [] });
}

// POST /api/repost — add or remove repost { historyId, trackName, artist, albumImage, trackUrl }
export async function POST(req: Request) {
  // Accepts either the session cookie (web) or a bearer token (iOS app).
  const auth = await getApiAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
  const { user } = auth;

  const { historyId, trackName, artist, albumImage, trackUrl } = await req.json();
  if (!historyId) return NextResponse.json({ ok: false }, { status: 400 });

  const db = adminDb();

  // Check if already reposted
  const { data: existing } = await db
    .from("reposts")
    .select("id")
    .eq("user_id", user.id)
    .eq("history_id", historyId)
    .single();

  if (existing) {
    await db.from("reposts").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, action: "removed" });
  } else {
    await db.from("reposts").insert({
      user_id: user.id,
      history_id: historyId,
      track_name: trackName,
      artist,
      album_image: albumImage,
      track_url: trackUrl,
    });
    return NextResponse.json({ ok: true, action: "reposted" });
  }
}
