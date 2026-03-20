import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getValidAccessToken } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple in-process cache — avoids hammering Spotify API for the same tracks
const cache = new Map<string, { url: string | null; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(req: Request) {
  const url = new URL(req.url);
  const trackId = url.searchParams.get("trackId");
  if (!trackId) return NextResponse.json({ ok: false, previewUrl: null });

  // Cache hit
  const cached = cache.get(trackId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ok: true, previewUrl: cached.url });
  }

  // Use any active user's token to call Spotify API
  const { data: users } = await supabase
    .from("users")
    .select("spotify_id")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!users?.length) return NextResponse.json({ ok: false, previewUrl: null });

  const token = await getValidAccessToken(users[0].spotify_id);
  if (!token) return NextResponse.json({ ok: false, previewUrl: null });

  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[preview] Spotify API error ${res.status}: ${errText}`);
    return NextResponse.json({ ok: false, previewUrl: null });
  }

  const data = await res.json();
  const previewUrl: string | null = data.preview_url ?? null;

  cache.set(trackId, { url: previewUrl, ts: Date.now() });

  return NextResponse.json({ ok: true, previewUrl });
}
