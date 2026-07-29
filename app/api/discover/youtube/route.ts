import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// YouTube Data API v3 — 10,000 units/day free, 100 units per search
// Results cached in Supabase youtube_cache so each track is only ever looked up once

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cacheKey(track: string, artist: string) {
  return `${track.toLowerCase().trim()}_${artist.toLowerCase().trim()}`;
}

type Snippet = { title?: string; channelTitle?: string; description?: string };

// When a song has no real music video, YouTube auto-generates an "Art Track": the album
// cover as a still image with the audio over it, uploaded to an "<Artist> - Topic" channel.
// Using one as the card background gives a frozen JPEG, and the "Full video" button then
// promises a video that doesn't exist — so we treat these as having no video at all.
function isArtTrack(snippet: Snippet | undefined) {
  const channel = snippet?.channelTitle ?? "";
  const description = snippet?.description ?? "";
  return /\s*-\s*Topic$/i.test(channel) || description.startsWith("Provided to YouTube by");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track") ?? "";
  const artist = searchParams.get("artist") ?? "";

  if (!track || !artist) {
    return NextResponse.json({ ok: false, videoId: null });
  }

  const key = cacheKey(track, artist);

  // 1. Check Supabase cache first — no API cost
  const { data: cached } = await supabase
    .from("youtube_cache")
    .select("video_id")
    .eq("track_key", key)
    .single();

  // A cached row with a null video_id means "already looked up, no real video" — still a hit,
  // so we don't burn another 100-unit search on it.
  if (cached) {
    return NextResponse.json({ ok: true, videoId: cached.video_id ?? null });
  }

  // 2. Cache miss — call YouTube API
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, videoId: null });
  }

  try {
    // maxResults doesn't affect quota (a search is 100 units either way), so cast a wide net
    // — with Art Tracks filtered out we need spare candidates to fall back on.
    const query = encodeURIComponent(`${track} ${artist} official music video`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&videoCategoryId=10&maxResults=10&key=${apiKey}`;

    const res = await fetch(url, { cache: "no-store" });

    // Quota exceeded or other error — fail gracefully, don't cache
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("[youtube] API error", res.status, JSON.stringify(errBody));
      return NextResponse.json({ ok: false, videoId: null });
    }

    const data = await res.json();
    const items: { id?: { videoId?: string }; snippet?: Snippet }[] = data.items ?? [];

    // Keep YouTube's relevance order, just skip past the Art Tracks. No real video in the
    // top 10 means the song almost certainly doesn't have one.
    const match = items.find((it) => it.id?.videoId && !isArtTrack(it.snippet));
    const videoId = match?.id?.videoId ?? null;

    // Cache the null too — "this song has no video" is a real answer worth remembering, and
    // re-searching it on every view would burn 100 units a time. (Quota/network failures
    // return earlier, so they still get retried.)
    const { error: cacheErr } = await supabase
      .from("youtube_cache")
      .upsert({ track_key: key, video_id: videoId }, { onConflict: "track_key" });
    if (cacheErr) console.error("[youtube] cache insert failed:", cacheErr.code, cacheErr.message);

    return NextResponse.json({ ok: true, videoId });
  } catch {
    return NextResponse.json({ ok: false, videoId: null });
  }
}
