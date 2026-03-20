import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("zuno_user_id")?.value;
  if (!userId) return null;
  const { data } = await supabase
    .from("users")
    .select("spotify_id, display_name, username, image, bio, ghost_mode, profile_link, show_last_active, show_top_stats")
    .eq("spotify_id", userId)
    .single();
  return data ?? null;
}

// GET — return current settings
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
  return NextResponse.json({ ok: true, user });
}

// POST — update bio or username
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, string> = { updated_at: new Date().toISOString() };

  // Profile link update
  if ("profile_link" in body) {
    const link = (body.profile_link as string ?? "").trim().slice(0, 200);
    updates.profile_link = link || "";
  }

  // Bio update
  if ("bio" in body) {
    const bio = (body.bio as string ?? "").trim().slice(0, 160);
    updates.bio = bio;
  }

  // Username update
  if ("username" in body) {
    const username = (body.username as string ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!username) return NextResponse.json({ ok: false, message: "Invalid username" }, { status: 400 });
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json({ ok: false, message: "Username must be 3–20 characters" }, { status: 400 });
    }
    if (username === user.username) {
      return NextResponse.json({ ok: false, message: "That's already your username" }, { status: 400 });
    }
    // Check uniqueness
    const { data: existing } = await supabase
      .from("users").select("spotify_id").eq("username", username).single();
    if (existing) return NextResponse.json({ ok: false, message: "Username already taken" }, { status: 400 });
    updates.username = username;
  }

  // show_last_active toggle
  if ("show_last_active" in body) {
    (updates as Record<string, unknown>).show_last_active = !!body.show_last_active;
  }

  // show_top_stats toggle
  if ("show_top_stats" in body) {
    (updates as Record<string, unknown>).show_top_stats = !!body.show_top_stats;
  }

  await supabase.from("users").update(updates).eq("spotify_id", user.spotify_id);
  return NextResponse.json({ ok: true, updates });
}

// DELETE — delete account permanently
export async function DELETE() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("zuno_user_id")?.value;
  if (!userId) return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });

  // Delete listening history
  await supabase.from("listening_history").delete().eq("user_spotify_id", userId);
  // Delete follows
  await supabase.from("follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
  // Delete user
  await supabase.from("users").delete().eq("spotify_id", userId);

  // Clear cookie
  const response = NextResponse.json({ ok: true });
  response.cookies.set("zuno_user_id", "", { maxAge: 0, path: "/" });
  return response;
}
