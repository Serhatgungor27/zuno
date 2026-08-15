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
