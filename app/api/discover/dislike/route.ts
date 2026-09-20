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

/** GET /api/discover/dislike — everything the viewer has turned down. */
export async function GET(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });

  const { data, error } = await adminDb()
    .from("discover_dislikes")
    .select("track_id, artist")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  // A feed that won't load because dislikes are unavailable is worse than one
  // that forgets them.
  if (error) return NextResponse.json({ ok: true, trackIds: [], artists: [] });

  const rows = data ?? [];
  return NextResponse.json({
    ok: true,
    trackIds: rows.map((r) => r.track_id as string),
    artists: [
      ...new Set(rows.map((r) => r.artist as string | null).filter(Boolean)),
    ],
  });
}

/** POST /api/discover/dislike — record one. Not a toggle: undo is a re-like. */
export async function POST(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const { trackId, name, artist } = await req.json();
  if (!trackId) return NextResponse.json({ ok: false, error: "missing_track" }, { status: 400 });

  const db = adminDb();

  const { error } = await db.from("discover_dislikes").upsert(
    {
      user_id: auth.user.id,
      track_id: String(trackId),
      track_name: name ?? null,
      artist: artist ?? null,
    },
    { onConflict: "user_id,track_id" }
  );

  if (error) {
    console.error("[discover/dislike] write:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Turning something down and having it stay liked is contradictory.
  await db
    .from("discover_likes")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("track_id", String(trackId));

  return NextResponse.json({ ok: true });
}
