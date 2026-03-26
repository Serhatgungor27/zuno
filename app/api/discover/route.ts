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

  // Parse excluded track IDs (already-liked tracks — never show again)
  const excludeIds = new Set(excludeIdsParam ? excludeIdsParam.split(",").filter(Boolean) : []);

  // Parse liked artists from client (top 3)
  const clientArtists = artistsParam ? artistsParam.split(",").filter(Boolean).slice(0, 3) : [];

  const genreGroup = GENRE_GROUPS[page];

  // Build personalized search queries:
  // 1. Use liked artists from client if available
  // 2. Fall back to session interactions from DB
  // 3. Fall back to default queries
  let searchQueries: string[] = [];

  if (clientArtists.length > 0) {
    // Use up to 3 liked artists as search queries for personalization
    searchQueries = clientArtists;
  } else if (sessionId) {
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

  // Fill remaining search slots with default queries
  const defaultQuery = SEARCH_QUERIES[page % SEARCH_QUERIES.length];
  if (searchQueries.length === 0) {
    searchQueries = [defaultQuery];
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

  // Merge + deduplicate + filter tracks with no preview or cover + exclude liked tracks
  const seen = new Set<number>();
  const all: DeezerTrack[] = [];
  for (const t of [...tracks0, ...tracks1, ...tracks2, ...searchTracks]) {
    if (!seen.has(t.id) && t.preview && t.album?.cover_xl && !excludeIds.has(String(t.id))) {
      seen.add(t.id);
      all.push(t);
    }
  }

  // Shuffle for freshness
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  return NextResponse.json({ ok: true, tracks: all.slice(0, 60).map(formatTrack), page });
}
