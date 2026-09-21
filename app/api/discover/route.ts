import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getApiAuth } from "@/lib/apiAuth";
import { artistAffinity, type Row as AffinityRow } from "@/lib/affinity";

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

/** Seeds are the artists we know they like; more means a wider feed. */
const MAX_SEEDS = 4;
/**
 * Share of the feed kept for music outside the listener's established taste.
 * A feed built purely on what someone already likes converges and goes stale,
 * and it can never surface an interest they have not expressed yet.
 */
const EXPLORE_SHARE = 0.15;
/** Neighbouring artists used per request, taken from a much larger pool. */
const MAX_RELATED = 16;
/**
 * Deezer returns up to fifty per artist and we were asking for eight, which
 * capped the whole taste pool at about ninety tracks — small enough that a
 * few pages exhausted it and the same songs kept reappearing.
 */
const TOP_PER_ARTIST = 50;
/** How far the window of neighbouring artists slides with each page. */
const RELATED_STRIDE = 8;

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
 * Deezer answers roughly twenty calls for a single Discover request, and it
 * rate limits — enough parallel requests and every lookup fails at once,
 * which returns an empty feed rather than a degraded one. Who an artist is
 * and who they sound like barely changes, so both are held for the life of
 * the instance; their top tracks are held for half an hour.
 */
const artistIdCache = new Map<string, DeezerArtist | null>();
const relatedCache = new Map<number, DeezerArtist[]>();
const topCache = new Map<number, { at: number; tracks: DeezerTrack[] }>();
const TOP_TTL_MS = 30 * 60 * 1000;

/**
 * Resolve an artist name to a Deezer id, taking the one with the most fans
 * rather than the first hit — plenty of names are shared, and the top search
 * result is not reliably the artist anyone means.
 */
async function deezerArtistId(name: string): Promise<DeezerArtist | null> {
  const key = name.toLowerCase().trim();
  const hit = artistIdCache.get(key);
  if (hit !== undefined) return hit;
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const list: DeezerArtist[] = data.data ?? [];
    const best =
      list.slice().sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0] ?? null;
    artistIdCache.set(key, best);
    return best;
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
  const hit = relatedCache.get(artistId);
  if (hit) return hit;
  try {
    const res = await fetch(
      `https://api.deezer.com/artist/${artistId}/related?limit=20`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list: DeezerArtist[] = data.data ?? [];
    if (list.length) relatedCache.set(artistId, list);
    return list;
  } catch {
    return [];
  }
}

async function artistTopTracks(artistId: number, limit = 8): Promise<DeezerTrack[]> {
  const hit = topCache.get(artistId);
  if (hit && Date.now() - hit.at < TOP_TTL_MS) return hit.tracks;
  try {
    const res = await fetch(
      `https://api.deezer.com/artist/${artistId}/top?limit=${limit}`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const tracks: DeezerTrack[] = data.data ?? [];
    if (tracks.length) topCache.set(artistId, { at: Date.now(), tracks });
    return tracks;
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
  // The raw page number, uncapped. It was clamped to the number of genre
  // groups, so every page past the fifth was identical to the fifth — which
  // is a large part of why scrolling ran out of new music.
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
  const genrePage = page % GENRE_GROUPS.length;
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
    const defaultGroup = GENRE_GROUPS[genrePage];
    genreGroup = [...tasteGenreIds, ...defaultGroup].slice(0, 3);
  } else {
    genreGroup = GENRE_GROUPS[genrePage];
  }

  // The seeds are the artists we know the listener already likes. They are
  // NOT what gets served: searching a seed by name returns that same artist's
  // catalogue, which is how Discover ended up replaying someone's favourites
  // back at them. The seeds are only a starting point in Deezer's
  // related-artist graph.
  // What the listener actually did outranks what the client guessed. The app
  // still sends artists so an unauthenticated or offline request degrades to
  // the old behaviour rather than to nothing.
  let seedPool = clientArtists;
  let blockedFromAffinity: string[] = [];

  const auth = await getApiAuth(req).catch(() => null);
  if (auth) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("favorite_artists")
        .eq("id", auth.user.id)
        .maybeSingle();

      const [interactions, likes, dislikes] = await Promise.all([
        supabase
          .from("discover_interactions")
          .select("artist, action, completion, time_spent_ms, created_at")
          .eq("user_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("discover_likes")
          .select("artist, created_at")
          .eq("user_id", auth.user.id)
          .limit(300),
        supabase
          .from("discover_dislikes")
          .select("artist")
          .eq("user_id", auth.user.id)
          .limit(500),
      ]);

      const affinity = artistAffinity({
        interactions: (interactions.data ?? []) as AffinityRow[],
        likes: (likes.data ?? []) as { artist: string | null; created_at: string }[],
        dislikes: (dislikes.data ?? []) as { artist: string | null }[],
        stated: (profile?.favorite_artists as string[] | null) ?? [],
      });
      if (affinity.artists.length) seedPool = affinity.artists;
      blockedFromAffinity = affinity.blocked;
    } catch {
      // Scoring is an improvement, not a dependency — fall back to the client.
    }
  }

  for (const name of blockedFromAffinity) excludedArtists.add(normaliseArtist(name));

  const seeds = seedPool.slice(0, MAX_SEEDS);
  let relatedTracks: DeezerTrack[] = [];
  const seedNames = new Set(seeds.map(normaliseArtist));

  if (seeds.length > 0) {
    const resolved = (await Promise.all(seeds.map(deezerArtistId))).filter(
      (a): a is DeezerArtist => !!a
    );

    const neighboursPerSeed = await Promise.all(
      resolved.map((a) => relatedArtists(a.id))
    );

    // Take one neighbour from each seed in turn.
    //
    // This used to flatten every seed's neighbours into one list and take the
    // first twelve, which meant the first seed filled every slot and the rest
    // were silently discarded — three favourite Turkish artists could produce
    // a feed with no Turkish music in it, purely because of ordering. Going
    // round-robin guarantees each seed is represented.
    const picked: DeezerArtist[] = [];
    const takenIds = new Set<number>(resolved.map((a) => a.id));
    const deepest = Math.max(0, ...neighboursPerSeed.map((n) => n.length));

    for (let depth = 0; depth < deepest; depth++) {
      for (const neighbours of neighboursPerSeed) {
        const artist = neighbours[depth];
        if (!artist) continue;
        const key = normaliseArtist(artist.name);
        if (takenIds.has(artist.id) || seedNames.has(key) || excludedArtists.has(key)) {
          continue;
        }
        takenIds.add(artist.id);
        picked.push(artist);
      }
    }

    // Every eligible neighbour is collected — four seeds give up to eighty —
    // and each page takes a different window of them. Previously the first
    // sixteen were used on every page, so no amount of scrolling reached a
    // new artist.
    const start = picked.length ? (page * RELATED_STRIDE) % picked.length : 0;
    const window = [...picked.slice(start), ...picked.slice(0, start)].slice(
      0,
      MAX_RELATED
    );

    relatedTracks = (
      await Promise.all(window.map((a) => artistTopTracks(a.id, TOP_PER_ARTIST)))
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
    searchQueries = [SEARCH_QUERIES[genrePage % SEARCH_QUERIES.length]];
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

  // Weighted hard towards taste, with a stated slice held back for things
  // outside it. An earlier 70/30 split left a Turkish-rap feed carrying
  // Taylor Swift, which is not what someone means by "music like this" — but
  // zero exploration is worse, because the feed can then only ever return
  // what it already knows.
  const TARGET = 60;
  const tasteShare =
    fromTaste.length > 0 ? Math.round(TARGET * (1 - EXPLORE_SHARE)) : 0;
  const all = shuffle([
    ...fromTaste.slice(0, tasteShare),
    ...fromCharts.slice(0, TARGET - Math.min(tasteShare, fromTaste.length)),
  ]);

  return NextResponse.json({ ok: true, tracks: all.slice(0, TARGET).map(formatTrack), page });
}
