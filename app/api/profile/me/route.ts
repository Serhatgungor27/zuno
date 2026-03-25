import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

// GET /api/profile/me
// Returns current user's profile, auto-creating username if missing.
// Runs server-side so Supabase session cookie is included → RLS works.
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Fetch existing profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, display_name")
    .eq("id", user.id)
    .single();

  if (profile?.username) {
    return NextResponse.json({
      ok: true,
      username: profile.username,
      avatar_url: profile.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    });
  }

  // No username yet — generate one from email prefix
  const raw = (user.email ?? "").split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 16);
  const username = raw || user.id.slice(0, 8);

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      username,
      display_name: user.user_metadata?.full_name ?? profile?.display_name ?? username,
      avatar_url: user.user_metadata?.avatar_url ?? profile?.avatar_url ?? null,
    },
    { onConflict: "id" }
  );

  return NextResponse.json({
    ok: true,
    username,
    avatar_url: user.user_metadata?.avatar_url ?? null,
  });
}
