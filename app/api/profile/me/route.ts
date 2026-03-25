import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// GET /api/profile/me
// Returns current user's profile, auto-creating username if missing.
// Uses service role key for DB writes to bypass RLS.
export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Use admin client for DB writes so RLS never blocks profile creation
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = serviceKey
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
    : supabase;

  // Fetch existing profile
  const { data: profile, error: selectError } = await db
    .from("profiles")
    .select("username, avatar_url, display_name")
    .eq("id", user.id)
    .single();

  console.log("[profile/me] user.id:", user.id, "serviceKey:", !!process.env.SUPABASE_SERVICE_ROLE_KEY, "selectError:", selectError?.code, selectError?.message, "profile:", profile?.username ?? null);

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

  const { error } = await db.from("profiles").upsert(
    {
      id: user.id,
      username,
      display_name: user.user_metadata?.full_name ?? profile?.display_name ?? username,
      avatar_url: user.user_metadata?.avatar_url ?? profile?.avatar_url ?? null,
    },
    { onConflict: "id" }
  );

  if (error) console.error("[profile/me] upsert failed:", error.code, error.message);

  return NextResponse.json({
    ok: true,
    username,
    avatar_url: user.user_metadata?.avatar_url ?? null,
  });
}
