import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Artists, and their catalogue.
 *
 *   ?q=<name>  search for artists
 *   ?id=<id>   one artist plus their top tracks
 */

type DeezerArtist = {
  id: number;
  name: string;
  picture_xl?: string;
  picture_big?: string;
  nb_fan?: number;
};

type DeezerTrack = {
  id: number;
  title: string;
  artist?: { name: string };
  album?: { title: string; cover_xl?: string; cover_big?: string };
  preview?: string;
  link?: string;
  duration?: number;
  explicit_lyrics?: boolean;
};

function formatArtist(a: DeezerArtist) {
  return {
    id: String(a.id),
    name: a.name,
    image: a.picture_xl ?? a.picture_big ?? null,
    fans: a.nb_fan ?? 0,
  };
}

function formatTrack(t: DeezerTrack, fallbackArtist: string) {
  return {
    trackId: String(t.id),
    name: t.title,
    artist: t.artist?.name ?? fallbackArtist,
    albumImage: t.album?.cover_xl ?? t.album?.cover_big ?? null,
    previewUrl: t.preview ?? null,
    deezerUrl: t.link ?? null,
    spotifyUrl: null as string | null,
    durationMs: (t.duration ?? 0) * 1000,
    explicit: t.explicit_lyrics ?? false,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const q = searchParams.get("q")?.trim();

  if (id) {
    try {
      const [artistRes, topRes] = await Promise.all([
        fetch(`https://api.deezer.com/artist/${encodeURIComponent(id)}`, { cache: "no-store" }),
        fetch(`https://api.deezer.com/artist/${encodeURIComponent(id)}/top?limit=100`, { cache: "no-store" }),
      ]);

      if (!artistRes.ok) {
        return NextResponse.json({ ok: false, error: "artist_not_found" }, { status: 404 });
      }

      const artist = (await artistRes.json()) as DeezerArtist;
      const top = topRes.ok ? ((await topRes.json()).data as DeezerTrack[]) : [];

      return NextResponse.json({
        ok: true,
        artist: formatArtist(artist),
        // Deezer returns whatever it has, often fewer than 100. Only tracks
        // with a preview are useful here — the point is to hear them.
        tracks: top.filter((t) => t.preview).map((t) => formatTrack(t, artist.name)),
      });
    } catch {
      return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 502 });
    }
  }

  if (!q || q.length < 2) return NextResponse.json({ ok: true, artists: [] });

  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=12`,
      { cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ ok: true, artists: [] });

    const list = ((await res.json()).data ?? []) as DeezerArtist[];

    // By fan count, not by Deezer's order. Searching "Tarkan" returns a
    // 43-fan namesake ahead of the 540,000-fan one, and nobody means the
    // former.
    return NextResponse.json({
      ok: true,
      artists: list
        .slice()
        .sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))
        .map(formatArtist),
    });
  } catch {
    return NextResponse.json({ ok: true, artists: [] });
  }
}
