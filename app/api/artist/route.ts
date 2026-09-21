import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Artists, and their catalogue.
 *
 *   ?q=<name>  search for artists
 *   ?id=<id>   one artist plus their top tracks
 */

/**
 * How deep to look, and how many to show.
 *
 * Everything Deezer returns is shown. Twelve was not enough — searching
 * "Diyar" puts Diyar Dersim, the artist actually meant, at position 43 — and
 * no reordering finds him, because neither Deezer's artist ranking nor its
 * track ranking places him anywhere near the top. Truncating just hides him.
 * Typing the full name returns him second, which is the reliable path.
 */
const SEARCH_DEPTH = 50;
const SEARCH_RESULTS = 50;

function normalise(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

/** Albums to pull tracklists from. Each one costs a request. */
const MAX_ALBUMS = 12;
const MAX_TRACKS = 100;

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
      const base = `https://api.deezer.com/artist/${encodeURIComponent(id)}`;
      const [artistRes, topRes, albumsRes] = await Promise.all([
        fetch(base, { cache: "no-store" }),
        fetch(`${base}/top?limit=100`, { cache: "no-store" }),
        fetch(`${base}/albums?limit=${MAX_ALBUMS}`, { cache: "no-store" }),
      ]);

      if (!artistRes.ok) {
        return NextResponse.json({ ok: false, error: "artist_not_found" }, { status: 404 });
      }

      const artist = (await artistRes.json()) as DeezerArtist;
      const top = topRes.ok ? (((await topRes.json()).data ?? []) as DeezerTrack[]) : [];
      const albums = albumsRes.ok
        ? (((await albumsRes.json()).data ?? []) as { id: number }[])
        : [];

      // The catalogue comes from the albums, not from /top.
      //
      // /top is Deezer's most-played list and it is frequently empty — "Diyar
      // Pala" has 16,000 fans and seventeen albums and returns nothing from
      // it — so an artist page built on /top alone is blank for exactly the
      // artists worth looking up. Albums are the reliable source; /top is
      // still used first because it is a genuine popularity ordering.
      const albumTracks = (
        await Promise.all(
          albums.slice(0, MAX_ALBUMS).map(async (a) => {
            try {
              const r = await fetch(`https://api.deezer.com/album/${a.id}/tracks?limit=100`, {
                cache: "no-store",
              });
              return r.ok ? (((await r.json()).data ?? []) as DeezerTrack[]) : [];
            } catch {
              return [];
            }
          })
        )
      ).flat();

      const seen = new Set<string>();
      const ordered: DeezerTrack[] = [];
      for (const t of [...top, ...albumTracks]) {
        if (!t.preview) continue;
        // One entry per song: the same track appears on a single and again on
        // the album it came from.
        const key = t.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!key || seen.has(key)) continue;
        seen.add(key);
        ordered.push(t);
        if (ordered.length >= MAX_TRACKS) break;
      }

      return NextResponse.json({
        ok: true,
        artist: formatArtist(artist),
        tracks: ordered.map((t) => formatTrack(t, artist.name)),
      });
    } catch {
      return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 502 });
    }
  }

  if (!q || q.length < 2) return NextResponse.json({ ok: true, artists: [] });

  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=${SEARCH_DEPTH}`,
      { cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json({ ok: true, artists: [] });

    const list = ((await res.json()).data ?? []) as DeezerArtist[];
    const wanted = normalise(q);

    // Exact name matches first, ordered by fans among themselves; everything
    // else keeps Deezer's own relevance order.
    //
    // Sorting the whole list by fans was wrong. nb_fan counts activity on
    // Deezer alone, which badly misrepresents artists popular elsewhere —
    // Diyar Dersim has 390,000 monthly listeners on Spotify and 111 fans
    // here, so a fan sort buried him beneath an unrelated artist with a
    // similar name. Exact-match tiering still fixes the case it was added
    // for: two artists both called "Tarkan", where the 540,000-fan one is
    // obviously the one meant.
    const exact: DeezerArtist[] = [];
    const rest: DeezerArtist[] = [];
    for (const a of list) {
      (normalise(a.name) === wanted ? exact : rest).push(a);
    }
    exact.sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0));

    return NextResponse.json({
      ok: true,
      artists: [...exact, ...rest].slice(0, SEARCH_RESULTS).map(formatArtist),
    });
  } catch {
    return NextResponse.json({ ok: true, artists: [] });
  }
}
