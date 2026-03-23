import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// YouTube Data API v3 — requires YOUTUBE_API_KEY env var
// Free tier: 10,000 units/day. A search costs 100 units → 100 searches/day free
// Results are cached in Supabase youtube_cache so each track is only looked up once

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cacheKey(track: string, artist: string) {
  return `${track.toLowerCase().trim()}_${artist.toLowerCase().trim()}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track") ?? "";
  const artist = searchParams.get("artist") ?? "";

  if (!track || !artist) {
    return NextResponse.json({ ok: false, videoId: null });
  }

  const key = cacheKey(track, artist);

  // 1. Check cache first
  const { data: cached } = await supabase
    .from("youtube_cache")
    .select("video_id")
    .eq("track_key", key)
    .single();

  if (cached) {
    return NextResponse.json({ ok: true, videoId: cached.video_id, cached: true });
  }

  // 2. Cache miss — call YouTube API
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, videoId: null, reason: "no_key" });
  }

  try {
    const query = encodeURIComponent(`${track} ${artist} official music video`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&videoCategoryId=10&maxResults=1&key=${apiKey}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ ok: false, videoId: null });

    const data = await res.json();
    const videoId = data.items?.[0]?.id?.videoId ?? null;

    // 3. Save to cache (even if null, to avoid repeated failed lookups)
    await supabase.from("youtube_cache").insert({ track_key: key, video_id: videoId });

    return NextResponse.json({ ok: true, videoId, cached: false });
  } catch {
    return NextResponse.json({ ok: false, videoId: null });
  }
}
