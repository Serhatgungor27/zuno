import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

/**
 * Resolves the current user's spotify_id from cookies.
 * Checks zuno_user_id first (new), then falls back to
 * looking up the access token from spotify_access_token (legacy).
 */
async function getSpotifyIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();

  // New cookie (set after latest deploy)
  const zunoId = cookieStore.get("zuno_user_id")?.value;
  if (zunoId) return zunoId;

  // Legacy fallback: look up the user by their stored access token
  const rawToken = cookieStore.get("spotify_access_token")?.value;
  if (!rawToken) return null;

  const accessToken = decodeURIComponent(rawToken);

  const { data: user } = await supabase
    .from("users")
    .select("spotify_id")
    .eq("access_token", accessToken)
    .single();

  return user?.spotify_id ?? null;
}

// GET /api/user — returns current logged-in user info
export async function GET() {
  const spotifyId = await getSpotifyIdFromCookies();

  if (!spotifyId) {
    return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("spotify_id, display_name, image, username")
    .eq("spotify_id", spotifyId)
    .single();

  if (!user) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user });
}

// POST /api/user — set custom username
export async function POST(req: Request) {
  const spotifyId = await getSpotifyIdFromCookies();

  if (!spotifyId) {
    return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
  }

  const body = await req.json();
  const username = (body.username as string)?.trim().toLowerCase();

  if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { ok: false, error: "invalid_username", message: "3–20 chars, letters/numbers/underscores only" },
      { status: 400 }
    );
  }

  // Check availability
  const { data: existing } = await supabase
    .from("users")
    .select("spotify_id")
    .eq("username", username)
    .single();

  if (existing && existing.spotify_id !== spotifyId) {
    return NextResponse.json({ ok: false, error: "taken", message: "Username already taken" }, { status: 409 });
  }

  const { error } = await supabase
    .from("users")
    .update({ username, updated_at: new Date().toISOString() })
    .eq("spotify_id", spotifyId);

  if (error) {
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, username });
}
