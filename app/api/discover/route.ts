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
    // Spotify search deep link — opens Spotify directly to the track
    spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(`${t.title} ${t.artist.name}`)}`,
    durationMs: t.duration * 1000,
    rank: t.rank ?? 0,
    explicit: t.explicit_lyrics ?? false,
  };
}

// Deezer genre IDs for variety
const GENRE_IDS = [
  0,    // All / Global charts
  132,  // Pop
  116,  // Rap / Hip-Hop
  152,  // Rock
  113,  // Dance
  165,  // R&B
  106,  // Electro
  129,  // Latin
  144,  // Jazz
  164,  // Reggae
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

  // Pick 2 random genres for charts + global chart + 1 search
  const shuffledGenres = [...GENRE_IDS].sort(() => Math.random() - 0.5);
  const genre1 = shuffledGenres[0];
  const genre2 = shuffledGenres[1];

  // Build personalised search query if we have session interactions
  let searchQuery = "top hits 2024 2025";
  if (sessionId) {
    try {
      const { data: interactions } = await supabase
        .from("discover_interactions")
        .select("artist, action")
        .eq("session_id", sessionId)
        .in("action", ["like", "open_spotify"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (interactions && interactions.length > 0) {
        const artist = (interactions[0].artist as string)?.split(",")[0]?.trim();
        if (artist) searchQuery = artist;
      }
    } catch { /* silent */ }
  }

  // Fetch in parallel — global charts, 2 genre charts, 1 personalised search
  const [global, genreTracks1, genreTracks2, searchTracks] = await Promise.all([
    getDeezerChartTracks(0, 50),
    getDeezerChartTracks(genre1, 50),
    getDeezerChartTracks(genre2, 50),
    searchDeezer(searchQuery, 30),
  ]);

  // Merge + deduplicate + filter tracks with no preview or cover
  const seen = new Set<number>();
  const all: DeezerTrack[] = [];
  for (const t of [...global, ...genreTracks1, ...genreTracks2, ...searchTracks]) {
    if (!seen.has(t.id) && t.preview && t.album?.cover_xl) {
      seen.add(t.id);
      all.push(t);
    }
  }

  // Sort by rank (higher = more popular), then shuffle top half for freshness
  all.sort((a, b) => b.rank - a.rank);
  const top = all.slice(0, 60);
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }

  return NextResponse.json({ ok: true, tracks: top.map(formatTrack) });
}
