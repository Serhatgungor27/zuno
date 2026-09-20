import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Apple's Search API returns real music videos with a ~30s preview as a plain
// .m4v file. Unlike a YouTube embed, a plain video file carries no
// embedded-player contract, so it can sit behind the card's own UI.
//
// Results are cached in music_video_cache so each track is only looked up once.

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cacheKey(track: string, artist: string) {
  return `${track.toLowerCase().trim()}_${artist.toLowerCase().trim()}`;
}

type AppleVideo = {
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
};

/**
 * Artist names have to match, or "God's Plan" comes back as a cover by Spirit
 * Fingers — the same trap the favourite-artist lookup fell into. Strip the
 * things that differ harmlessly between catalogues and compare what's left.
 */
function normalise(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(feat|ft|featuring|with)\b.*$/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function looseMatch(wanted: string, found: string) {
  const a = normalise(wanted);
  const b = normalise(found);
  if (!a || !b) return false;
  // One containing the other covers "Drake" vs "Drake & Future" on the artist,
  // and "Espresso" vs "Espresso (Official Video)" on the title.
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Both the artist AND the title have to match. Artist alone is not enough:
 * Apple happily answers "Not Like Us by Kendrick Lamar" with the video for
 * "luther", and a music video of the wrong song playing under the right audio
 * is worse than no video at all.
 */
function isSameSong(
  wantedTrack: string,
  wantedArtist: string,
  found: AppleVideo
) {
  return (
    looseMatch(wantedArtist, found.artistName ?? "") &&
    looseMatch(wantedTrack, found.trackName ?? "")
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track")?.trim();
  const artist = searchParams.get("artist")?.trim();

  if (!track || !artist) {
    return NextResponse.json({ ok: false, error: "missing_track" }, { status: 400 });
  }

  const key = cacheKey(track, artist);

  const { data: cached, error: readError } = await supabase
    .from("music_video_cache")
    .select("video_url, artwork_url")
    .eq("track_key", key)
    .maybeSingle();

  if (readError) console.error("[discover/video] cache read:", readError);

  if (cached) {
    return NextResponse.json({
      ok: true,
      videoUrl: cached.video_url as string | null,
      artworkUrl: cached.artwork_url as string | null,
      cached: true,
    });
  }

  let videoUrl: string | null = null;
  let artworkUrl: string | null = null;

  try {
    const term = encodeURIComponent(`${track} ${artist}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=musicVideo&limit=5`,
      { headers: { "User-Agent": "zuno/1.0" } }
    );
    if (res.ok) {
      const data = (await res.json()) as { results?: AppleVideo[] };
      const hit = (data.results ?? []).find(
        (r) => r.previewUrl && isSameSong(track, artist, r)
      );
      if (hit) {
        videoUrl = hit.previewUrl ?? null;
        artworkUrl = hit.artworkUrl100?.replace("100x100", "600x600") ?? null;
      }
    }
  } catch {
    // Apple being unreachable is not a reason to fail the card — but don't
    // cache it either, or a blip would be remembered as "no video".
    return NextResponse.json({ ok: true, videoUrl: null, artworkUrl: null });
  }

  // Cache the miss as well as the hit. A cache that silently fails to write
  // looks identical to one that works, so say so rather than swallowing it.
  const { error: writeError } = await supabase
    .from("music_video_cache")
    .upsert({ track_key: key, video_url: videoUrl, artwork_url: artworkUrl });

  if (writeError) console.error("[discover/video] cache write:", writeError);

  return NextResponse.json({
    ok: true,
    videoUrl,
    artworkUrl,
    ...(writeError ? { cacheError: writeError.message } : {}),
  });
}
