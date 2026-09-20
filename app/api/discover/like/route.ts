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

/** Missing table — the migration hasn't been run yet. */
function isMissingTable(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

/**
 * GET /api/discover/like — every track the viewer has liked in Discover.
 *
 * The feed uses this for three things: drawing the heart filled, excluding
 * tracks you already liked, and steering the next batch toward those artists.
 */
export async function GET(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });

  const { data, error } = await adminDb()
    .from("discover_likes")
    .select("track_id, track_name, artist, album_image, preview_url, spotify_url, created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(300);

  // A feed that won't load because likes are unavailable is worse than a feed
  // with empty hearts, so failures here degrade to "nothing liked yet".
  if (error) return NextResponse.json({ ok: true, tracks: [] });

  return NextResponse.json({
    ok: true,
    tracks: (data ?? []).map((r) => ({
      trackId: r.track_id as string,
      name: (r.track_name as string | null) ?? "",
      artist: (r.artist as string | null) ?? "",
      albumImage: r.album_image as string | null,
      previewUrl: r.preview_url as string | null,
      spotifyUrl: r.spotify_url as string | null,
    })),
  });
}

/** POST /api/discover/like — toggles one track, returns the resulting state. */
export async function POST(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const { trackId, name, artist, albumImage, previewUrl, spotifyUrl } = await req.json();
  if (!trackId) return NextResponse.json({ ok: false, error: "missing_track" }, { status: 400 });

  const db = adminDb();
  const { data: existing, error: readError } = await db
    .from("discover_likes")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("track_id", String(trackId))
    .maybeSingle();

  if (readError && isMissingTable(readError.code)) {
    return NextResponse.json({ ok: false, error: "likes_unavailable" }, { status: 503 });
  }

  if (existing) {
    await db.from("discover_likes").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, liked: false });
  }

  const { error: writeError } = await db.from("discover_likes").insert({
    user_id: auth.user.id,
    track_id: String(trackId),
    track_name: name ?? null,
    artist: artist ?? null,
    album_image: albumImage ?? null,
    preview_url: previewUrl ?? null,
    spotify_url: spotifyUrl ?? null,
  });

  if (writeError) return NextResponse.json({ ok: false, error: "not_saved" }, { status: 500 });

  return NextResponse.json({ ok: true, liked: true });
}
