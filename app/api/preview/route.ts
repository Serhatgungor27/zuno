import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getValidAccessToken } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Simple in-process cache — avoids hammering the upstreams for the same tracks
const cache = new Map<string, { url: string | null; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/preview?trackId=&track=&artist= → { previewUrl }
 *
 * Deezer is tried first because Spotify has stopped returning preview_url for
 * most applications — every track in our own history now comes back null — and
 * Deezer needs no token, so it is both more likely to work and cheaper. Spotify
 * remains the fallback for the cases where it still answers.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const trackId = url.searchParams.get("trackId");
  const track = url.searchParams.get("track");
  const artist = url.searchParams.get("artist");

  if (!trackId && !track) {
    return NextResponse.json({ ok: false, previewUrl: null });
  }

  const key = trackId ?? `${track}|${artist ?? ""}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ok: true, previewUrl: cached.url });
  }

  let previewUrl: string | null = null;

  if (track) previewUrl = await deezerPreview(track, artist);
  if (!previewUrl && trackId) previewUrl = await spotifyPreview(trackId);

  cache.set(key, { url: previewUrl, ts: Date.now() });
  return NextResponse.json({ ok: true, previewUrl });
}

async function deezerPreview(
  track: string,
  artist: string | null
): Promise<string | null> {
  // Field-qualified search, so "California Soul" by Marlena Shaw does not match
  // an unrelated cover that happens to rank higher.
  const query = artist
    ? `track:"${track}" artist:"${artist}"`
    : `track:"${track}"`;

  for (const q of [query, `${track} ${artist ?? ""}`.trim()]) {
    try {
      const res = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5&order=RANKING`,
        { cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const hit = (data?.data ?? []).find(
        (t: { preview?: string }) => typeof t.preview === "string" && t.preview
      );
      if (hit?.preview) return hit.preview as string;
    } catch {
      // Try the looser query, then give up quietly — a missing preview is a
      // non-event for the caller.
    }
  }
  return null;
}

async function spotifyPreview(trackId: string): Promise<string | null> {
  const { data: users } = await supabase
    .from("users")
    .select("spotify_id")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!users?.length) return null;

  const token = await getValidAccessToken(users[0].spotify_id);
  if (!token) return null;

  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const data = await res.json();
  return (data.preview_url as string | null) ?? null;
}
