import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// GET /api/profile/user?username=xxx
// Fetches a profile by username. Checks `profiles` (Supabase auth users) first,
// then falls back to `users` (Spotify OAuth users).
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  if (!username)
    return NextResponse.json({ error: "missing username" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer service role key (bypasses RLS), fall back to anon key
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[profile/user] missing Supabase env vars");
    return NextResponse.json(
      { error: "server configuration error" },
      { status: 500 }
    );
  }

  const db = createClient(url, key);

  // 1. Check profiles table (Supabase auth users)
  const { data: profile } = await db
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at")
    .eq("username", username)
    .single();

  if (profile) return NextResponse.json(profile);

  // 2. Fall back to users table (Spotify OAuth users)
  const { data: user } = await db
    .from("users")
    .select("spotify_id, username, display_name, image, created_at")
    .eq("username", username)
    .single();

  if (user) {
    return NextResponse.json({
      id: user.spotify_id,
      username: user.username,
      display_name: user.display_name ?? null,
      avatar_url: user.image ?? null,
      bio: null,
      created_at: user.created_at ?? null,
    });
  }

  console.error("[profile/user] not found in profiles or users:", username);
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
