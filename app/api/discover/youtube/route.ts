import { NextResponse } from "next/server";

export const runtime = "nodejs";

// YouTube Data API v3 — requires YOUTUBE_API_KEY env var
// Free tier: 10,000 units/day. A search costs 100 units → 100 searches/day free
// Set YOUTUBE_API_KEY in Vercel env vars to enable video backgrounds

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track") ?? "";
  const artist = searchParams.get("artist") ?? "";

  if (!track || !artist) {
    return NextResponse.json({ ok: false, videoId: null });
  }

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

    return NextResponse.json({ ok: true, videoId });
  } catch {
    return NextResponse.json({ ok: false, videoId: null });
  }
}
