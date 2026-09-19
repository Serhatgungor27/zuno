/** Mirrors the item shape returned by GET /api/feed?type=vibe. */
export type VibeItem = {
  vibeId: string;
  id: string;
  spotifyId: string;
  userName: string;
  userImage: string | null;
  trackId: string;
  track: string;
  artist: string;
  albumImage: string | null;
  trackUrl: string | null;
  playedAt: string;
  repeatCount: number;
};

export type FeedResponse = { ok: boolean; items: VibeItem[] };

/** Mirrors GET /api/discover. */
export type DiscoverTrack = {
  trackId: string;
  name: string;
  artist: string;
  album: string | null;
  albumImage: string | null;
  previewUrl: string | null;
  deezerUrl: string | null;
  spotifyUrl: string | null;
  durationMs: number | null;
  rank: number | null;
  explicit: boolean;
};

export type DiscoverResponse = { ok: boolean; tracks: DiscoverTrack[]; page?: number };

/** Mirrors GET /api/search. */
export type SearchUser = {
  id: string;
  spotifyId: string;
  name: string;
  username: string | null;
  image: string | null;
  isLive: boolean;
  nowPlaying: { track?: string; artist?: string } | null;
};

export type SearchResponse = { ok: boolean; users: SearchUser[] };
