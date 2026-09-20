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

// GET /api/taste — get current user's taste profile
export async function GET(req: Request) {
  // Accepts either the session cookie (web) or a bearer token (iOS app).
  const auth = await getApiAuth(req);
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });
  const { user } = auth;

  const db = adminDb();
  const { data } = await db
    .from("profiles")
    // Select the whole row rather than naming columns: favorite_artist_ids is
    // new, and naming a column the migration hasn't added yet fails the query
    // outright and would return an empty taste profile.
    .select("*")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    ok: true,
    favorite_artists: data?.favorite_artists ?? [],
    // name -> Deezer artist id, for the artists picked from the search list.
    favorite_artist_ids: data?.favorite_artist_ids ?? {},
    music_genres: data?.music_genres ?? [],
    podcast_genres: data?.podcast_genres ?? [],
  });
}

// POST /api/taste — save taste profile
export async function POST(req: Request) {
  const auth = await getApiAuth(req);
  if (!auth) return NextResponse.json({ ok: false }, { status: 401 });
  const { user } = auth;

  const { favorite_artists, favorite_artist_ids, music_genres, podcast_genres } =
    await req.json();

  const db = adminDb();
  const base = {
    favorite_artists: favorite_artists ?? [],
    music_genres: music_genres ?? [],
    podcast_genres: podcast_genres ?? [],
  };

  // The web settings page doesn't know about ids and omits the field; treat
  // that as "leave them alone" rather than clearing what the app recorded.
  const payload =
    favorite_artist_ids === undefined
      ? base
      : { ...base, favorite_artist_ids };

  const { error } = await db.from("profiles").update(payload).eq("id", user.id);

  // 42703/PGRST204 mean the migration in supabase/migrations hasn't been run
  // yet. Saving taste matters more than keeping the ids, so drop them rather
  // than failing the request.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    await db.from("profiles").update(base).eq("id", user.id);
  }

  return NextResponse.json({ ok: true });
}
