import { NextResponse } from "next/server";
import { getAppToken } from "@/lib/spotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Artists, and their catalogue.
 *
 *   ?q=<name>  search for artists
 *   ?id=<id>   one artist plus their tracks
 *
 * Spotify, not Deezer. Deezer's ranking is unusable outside the mainstream —
 * searching "Diyar" puts Diyar Dersim at result 43 of 50 and reports him as
 * having 111 fans, where Spotify knows he has 390,000 monthly listeners.
 *
 * Previews are NOT fetched here. Spotify stopped returning preview_url, so
 * they come from Deezer via /api/preview when a track is actually tapped —
 * which also means this endpoint costs nothing per track.
 */

const MAX_ALBUMS = 20;
const MAX_TRACKS = 100;

type SpotifyImage = { url: string; width: number | null };
type SpotifyArtist = {
  id: string;
  name: string;
  images?: SpotifyImage[];
  followers?: { total: number };
  popularity?: number;
};
type SpotifyTrack = {
  id: string;
  name: string;
  artists?: { name: string }[];
  album?: { images?: SpotifyImage[] };
  duration_ms?: number;
  explicit?: boolean;
  external_urls?: { spotify?: string };
  popularity?: number;
};

/** Largest first, so the biggest image is index 0. */
function bestImage(images?: SpotifyImage[]): string | null {
  if (!images?.length) return null;
  return images[0]?.url ?? null;
}

function formatArtist(a: SpotifyArtist) {
  return {
    id: a.id,
    name: a.name,
    image: bestImage(a.images),
    fans: a.followers?.total ?? 0,
  };
}

function formatTrack(t: SpotifyTrack, fallbackArtist: string) {
  return {
    trackId: t.id,
    name: t.name,
    artist: t.artists?.map((x) => x.name).join(", ") || fallbackArtist,
    albumImage: bestImage(t.album?.images),
    // Deliberately null: resolved from Deezer on tap.
    previewUrl: null as string | null,
    deezerUrl: null as string | null,
    spotifyUrl: t.external_urls?.spotify ?? null,
    durationMs: t.duration_ms ?? 0,
    explicit: t.explicit ?? false,
  };
}

async function spotify(path: string, token: string) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return res.ok ? res.json() : null;
}

/**
 * Deezer, used when Spotify has no credentials configured.
 *
 * Its ranking is poor outside the mainstream — this is the path that put
 * Diyar Dersim at result 43 — but it needs no token and it works.
 */
async function deezerFallback(id: string | null, q: string | undefined) {
  try {
    if (id) {
      const base = `https://api.deezer.com/artist/${encodeURIComponent(id)}`;
      const [aRes, albumsRes] = await Promise.all([
        fetch(base, { cache: "no-store" }),
        fetch(`${base}/albums?limit=${MAX_ALBUMS}`, { cache: "no-store" }),
      ]);
      if (!aRes.ok) {
        return NextResponse.json({ ok: false, error: "artist_not_found" }, { status: 404 });
      }
      const artist = await aRes.json();
      const albums = albumsRes.ok ? ((await albumsRes.json()).data ?? []) : [];

      const tracks = (
        await Promise.all(
          (albums as { id: number }[]).slice(0, MAX_ALBUMS).map(async (al) => {
            try {
              const r = await fetch(`https://api.deezer.com/album/${al.id}/tracks?limit=100`, {
                cache: "no-store",
              });
              return r.ok ? ((await r.json()).data ?? []) : [];
            } catch {
              return [];
            }
          })
        )
      ).flat() as { id: number; title: string; preview?: string; duration?: number; explicit_lyrics?: boolean }[];

      const seen = new Set<string>();
      const ordered = tracks.filter((t) => {
        if (!t.preview) return false;
        const key = t.title.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, MAX_TRACKS);

      return NextResponse.json({
        ok: true,
        artist: {
          id: String(artist.id),
          name: artist.name,
          image: artist.picture_xl ?? artist.picture_big ?? null,
          fans: artist.nb_fan ?? 0,
        },
        tracks: ordered.map((t) => ({
          trackId: String(t.id),
          name: t.title,
          artist: artist.name,
          albumImage: artist.picture_xl ?? null,
          previewUrl: t.preview ?? null,
          deezerUrl: null,
          spotifyUrl: null,
          durationMs: (t.duration ?? 0) * 1000,
          explicit: t.explicit_lyrics ?? false,
        })),
      });
    }

    if (!q || q.length < 2) return NextResponse.json({ ok: true, artists: [] });

    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=50`,
      { cache: "no-store" }
    );
    const list = res.ok ? ((await res.json()).data ?? []) : [];
    return NextResponse.json({
      ok: true,
      artists: (list as { id: number; name: string; picture_xl?: string; nb_fan?: number }[]).map(
        (a) => ({
          id: String(a.id),
          name: a.name,
          image: a.picture_xl ?? null,
          fans: a.nb_fan ?? 0,
        })
      ),
    });
  } catch {
    return NextResponse.json({ ok: true, artists: [], tracks: [] });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const q = searchParams.get("q")?.trim();

  // Spotify ranks these correctly, but its credentials are optional here:
  // they were provisioned for the retired OAuth login and may not be set.
  // Deezer still answers, just less well, and a worse ranking beats a 503.
  const token = await getAppToken();
  if (!token) return deezerFallback(id, q);

  if (id) {
    const artist = (await spotify(`/artists/${encodeURIComponent(id)}`, token)) as SpotifyArtist | null;
    if (!artist) {
      return NextResponse.json({ ok: false, error: "artist_not_found" }, { status: 404 });
    }

    // Top tracks first — Spotify's own popularity ordering — then the rest of
    // the catalogue from their albums, which top-tracks caps at ten.
    const [top, albums] = await Promise.all([
      spotify(`/artists/${encodeURIComponent(id)}/top-tracks?market=from_token`, token),
      spotify(`/artists/${encodeURIComponent(id)}/albums?include_groups=album,single&limit=${MAX_ALBUMS}`, token),
    ]);

    const albumIds = ((albums?.items ?? []) as { id: string }[]).map((a) => a.id).slice(0, MAX_ALBUMS);
    const albumTracks: SpotifyTrack[] = [];

    // Batched twenty at a time, which is Spotify's limit for this endpoint.
    for (let i = 0; i < albumIds.length; i += 20) {
      const batch = await spotify(`/albums?ids=${albumIds.slice(i, i + 20).join(",")}`, token);
      for (const album of (batch?.albums ?? []) as {
        images?: SpotifyImage[];
        tracks?: { items?: SpotifyTrack[] };
      }[]) {
        for (const t of album?.tracks?.items ?? []) {
          albumTracks.push({ ...t, album: { images: album.images } });
        }
      }
    }

    const seen = new Set<string>();
    const ordered: SpotifyTrack[] = [];
    for (const t of [...((top?.tracks ?? []) as SpotifyTrack[]), ...albumTracks]) {
      // One entry per song: the same track appears on a single and again on
      // the album it came from.
      const key = t.name.toLowerCase().replace(/[^a-z0-9]/g, "");
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
  }

  if (!q || q.length < 2) return NextResponse.json({ ok: true, artists: [] });

  const found = await spotify(`/search?type=artist&limit=25&q=${encodeURIComponent(q)}`, token);
  const items = (found?.artists?.items ?? []) as SpotifyArtist[];

  // Spotify's ordering already weights real listening, so it is kept as-is.
  return NextResponse.json({ ok: true, artists: items.map(formatArtist) });
}
