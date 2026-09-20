import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type DeezerTrack = {
  id: number;
  title: string;
  artist: { name: string };
  album: { title: string; cover_xl: string };
  preview: string;
  link: string;
  duration: number;
  rank: number;
  explicit_lyrics: boolean;
};

function formatTrack(t: DeezerTrack) {
  return {
    trackId: String(t.id),
    name: t.title,
    artist: t.artist.name,
    album: t.album.title,
    albumImage: t.album.cover_xl ?? null,
    previewUrl: t.preview ?? null,
    deezerUrl: t.link,
    spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(`${t.title} ${t.artist.name}`)}`,
    durationMs: t.duration * 1000,
    rank: t.rank ?? 0,
    explicit: t.explicit_lyrics ?? false,
  };
}

const GENRE_MAP: Record<string, number> = {
  "Pop": 132, "Hip-Hop": 116, "Rock": 152, "Electronic": 106,
  "R&B": 165, "Jazz": 129, "Metal": 464, "Classical": 98,
  "Indie": 85, "Soul": 67, "Reggae": 144, "Country": 84,
  "Dance": 113, "K-Pop": 309, "Latin": 197, "Afrobeats": 386,
};

// Genre groups — each page uses a different group so infinite scroll gets fresh tracks
const GENRE_GROUPS = [
  [0, 132, 116],   // page 0: Global, Pop, Rap
  [152, 113, 165], // page 1: Rock, Dance, R&B
  [106, 129, 144], // page 2: Electro, Latin, Jazz
  [164, 132, 116], // page 3: Reggae, Pop, Rap (different combos)
  [0, 165, 106],   // page 4: Global, R&B, Electro
];

// Fallback search queries per page for variety
const SEARCH_QUERIES = [
  "top hits 2025",
  "new music 2025",
  "viral songs 2025",
  "trending music",
  "best songs right now",
];

async function getDeezerChartTracks(genreId: number, limit = 50): Promise<DeezerTrack[]> {
  try {
    const res = await fetch(
      `https://api.deezer.com/chart/${genreId}/tracks?limit=${limit}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

type DeezerArtist = { id: number; name: string; nb_fan?: number };

/**
 * Resolve an artist name to a Deezer id, taking the one with the most fans
 * rather than the first hit — plenty of names are shared, and the top search
 * result is not reliably the artist anyone means.
 */
async function deezerArtistId(name: string): Promise<DeezerArtist | null> {
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const list: DeezerArtist[] = data.data ?? [];
    return (
      list.slice().sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0] ?? null
    );
  } catch {
    return null;
  }
}

/**
 * The artists Deezer considers similar. This is what turns a taste profile
 * into discovery: searching a favourite artist by name only ever returns that
 * same artist, which is the opposite of what Discover is for. Relatedness is
 * behavioural, so it also keeps to a scene and a language without us having to
 * model either.
 */
async function relatedArtists(artistId: number): Promise<DeezerArtist[]> {
  try {
    const res = await fetch(
      `https://api.deezer.com/artist/${artistId}/related?limit=12`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

async function artistTopTracks(artistId: number, limit = 8): Promise<DeezerTrack[]> {
  try {
    const res = await fetch(
      `https://api.deezer.com/artist/${artistId}/top?limit=${limit}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

function normaliseArtist(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

async function searchDeezer(query: string, limit = 50): Promise<DeezerTrack[]> {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}&order=RANKING`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId") ?? "";
  const page = Math.min(parseInt(searchParams.get("page") ?? "0", 10), GENRE_GROUPS.length - 1);
  const excludeIdsParam = searchParams.get("excludeIds") ?? "";
  const artistsParam = searchParams.get("artists") ?? "";
  const genresParam = searchParams.get("genres") ?? "";
  const excludeArtistsParam = searchParams.get("excludeArtists") ?? "";

  // Artists the listener has turned down. Rejecting a song is nearly always a
  // statement about the artist, so the whole artist is held out.
  const excludedArtists = new Set(
    excludeArtistsParam
      .split(",")
      .map((a) => normaliseArtist(a))
      .filter(Boolean)
  );

  // Parse excluded track IDs (already-liked tracks — never show again)
  const excludeIds = new Set(excludeIdsParam ? excludeIdsParam.split(",").filter(Boolean) : []);

  // Parse liked artists from client (top 3)
  const clientArtists = artistsParam ? artistsParam.split(",").filter(Boolean).slice(0, 3) : [];

  // Parse taste genres from client — use up to 3 to replace/augment genre group
  const tasteGenreNames = genresParam ? genresParam.split(",").filter(Boolean) : [];
  const tasteGenreIds = tasteGenreNames
    .map((g) => GENRE_MAP[g])
    .filter((id): id is number => id !== undefined);

  // Build genre group: prefer taste genres if provided, fall back to default rotation
  let genreGroup: number[];
  if (tasteGenreIds.length >= 3) {
    // Shuffle taste genres and pick 3 for this page
    const shuffled = [...tasteGenreIds].sort(() => Math.random() - 0.5);
    genreGroup = shuffled.slice(0, 3);
  } else if (tasteGenreIds.length > 0) {
    // Mix taste genres with default group
    const defaultGroup = GENRE_GROUPS[page];
    genreGroup = [...tasteGenreIds, ...defaultGroup].slice(0, 3);
  } else {
    genreGroup = GENRE_GROUPS[page];
  }

  // The seeds are the artists we know the listener already likes. They are
  // NOT what gets served: searching a seed by name returns that same artist's
  // catalogue, which is how Discover ended up replaying someone's favourites
  // back at them. The seeds are only a starting point in Deezer's
  // related-artist graph.
  const seeds = clientArtists.slice(0, 2);
  let relatedTracks: DeezerTrack[] = [];
  const seedNames = new Set(seeds.map(normaliseArtist));

  if (seeds.length > 0) {
    const resolved = (await Promise.all(seeds.map(deezerArtistId))).filter(
      (a): a is DeezerArtist => !!a
    );

    const neighbours = (
      await Promise.all(resolved.map((a) => relatedArtists(a.id)))
    ).flat();

    // One entry per artist, minus the seeds themselves and anything turned
    // down. Ten is as many as Deezer will answer for comfortably in one go.
    const picked: DeezerArtist[] = [];
    const takenIds = new Set<number>(resolved.map((a) => a.id));
    for (const artist of neighbours) {
      const key = normaliseArtist(artist.name);
      if (takenIds.has(artist.id) || seedNames.has(key) || excludedArtists.has(key)) continue;
      takenIds.add(artist.id);
      picked.push(artist);
      if (picked.length >= 10) break;
    }

    relatedTracks = (
      await Promise.all(picked.map((a) => artistTopTracks(a.id, 8)))
    ).flat();
  }

  let searchQueries: string[] = [];

  if (seeds.length === 0 && sessionId) {
    try {
      const { data: interactions } = await supabase
        .from("discover_interactions")
        .select("artist, action")
        .eq("session_id", sessionId)
        .in("action", ["like", "open_spotify"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (interactions && interactions.length > 0) {
        // Get unique artists from recent likes
        const artists = [...new Set(
          interactions.map(i => (i.artist as string)?.split(",")[0]?.trim()).filter(Boolean)
        )].slice(0, 3);
        searchQueries = artists;
      }
    } catch { /* silent */ }
  }

  // Only fall back to generic queries when there is nothing personal to go on;
  // with seeds, the related-artist tracks are the personalised half.
  if (searchQueries.length === 0 && relatedTracks.length === 0) {
    searchQueries = [SEARCH_QUERIES[page % SEARCH_QUERIES.length]];
  }

  // Fetch all 3 genre charts + personalized searches in parallel
  const searchFetches = searchQueries.map(q => searchDeezer(q, 30));
  const [tracks0, tracks1, tracks2, ...searchResults] = await Promise.all([
    getDeezerChartTracks(genreGroup[0], 50),
    getDeezerChartTracks(genreGroup[1], 50),
    getDeezerChartTracks(genreGroup[2], 50),
    ...searchFetches,
  ]);

  // Flatten search results
  const searchTracks = searchResults.flat();

  const usable = (t: DeezerTrack) =>
    t.preview &&
    t.album?.cover_xl &&
    !excludeIds.has(String(t.id)) &&
    !excludedArtists.has(normaliseArtist(t.artist?.name ?? "")) &&
    // The seeds' own catalogue is exactly what the listener already knows.
    !seedNames.has(normaliseArtist(t.artist?.name ?? ""));

  const dedupe = (source: DeezerTrack[], seen: Set<number>) => {
    const out: DeezerTrack[] = [];
    for (const t of source) {
      if (seen.has(t.id) || !usable(t)) continue;
      seen.add(t.id);
      out.push(t);
    }
    return out;
  };

  const shuffle = (list: DeezerTrack[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  const seen = new Set<number>();
  const fromTaste = shuffle(dedupe(relatedTracks, seen));
  const fromCharts = shuffle(
    dedupe([...tracks0, ...tracks1, ...tracks2, ...searchTracks], seen)
  );

  // Weighted towards what the listener's taste points at, with charts mixed in
  // so the feed can still surprise. With no taste on file the charts are all
  // there is, and slice() just takes everything.
  const TARGET = 60;
  const tasteShare = fromTaste.length > 0 ? Math.round(TARGET * 0.7) : 0;
  const all = shuffle([
    ...fromTaste.slice(0, tasteShare),
    ...fromCharts.slice(0, TARGET - Math.min(tasteShare, fromTaste.length)),
  ]);

  return NextResponse.json({ ok: true, tracks: all.slice(0, TARGET).map(formatTrack), page });
}
