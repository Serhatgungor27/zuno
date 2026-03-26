import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
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
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const db = adminDb();
  const { data } = await db
    .from("profiles")
    .select("favorite_artists, music_genres, podcast_genres")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    ok: true,
    favorite_artists: data?.favorite_artists ?? [],
    music_genres: data?.music_genres ?? [],
    podcast_genres: data?.podcast_genres ?? [],
  });
}

// POST /api/taste — save taste profile
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { favorite_artists, music_genres, podcast_genres } = await req.json();

  const db = adminDb();
  await db.from("profiles").update({
    favorite_artists: favorite_artists ?? [],
    music_genres: music_genres ?? [],
    podcast_genres: podcast_genres ?? [],
  }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
