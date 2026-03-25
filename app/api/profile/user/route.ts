import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// GET /api/profile/user?username=xxx
// Fetches a profile by username using admin/anon key (bypasses browser RLS).
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

  const { data, error } = await db
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, created_at")
    .eq("username", username)
    .single();

  if (error || !data) {
    console.error("[profile/user] lookup failed:", error?.message, "username:", username);
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
