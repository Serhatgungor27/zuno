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

/** GET /api/user — the Spotify-side account (keyed on spotify_id). */
export type ZunoUser = {
  spotify_id: string;
  display_name: string | null;
  image: string | null;
  username: string | null;
};

/** GET /api/follow?userId= */
export type FollowStats = {
  ok: boolean;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isSelf: boolean;
};

/** GET /api/history?userId= — the "Vibes" grid. */
export type HistoryTrack = {
  track_id: string;
  track_name: string;
  artist: string;
  album_image: string | null;
  track_url: string | null;
  played_at: string;
  repeat_count: number | null;
};

/** GET /api/repost?username= */
export type Repost = {
  id: string;
  history_id: string;
  track_name: string;
  artist: string;
  album_image: string | null;
  track_url: string | null;
  created_at: string;
};

/** GET /api/taste */
export type Taste = {
  ok: boolean;
  favorite_artists: string[];
  music_genres: string[];
  podcast_genres: string[];
};

/** GET /api/settings */
export type SettingsUser = {
  spotify_id: string;
  display_name: string | null;
  username: string | null;
  image: string | null;
  bio: string | null;
  ghost_mode: boolean | null;
  profile_link: string | null;
  show_last_active: boolean | null;
  show_top_stats: boolean | null;
};

export const MUSIC_GENRES = [
  "Hip-Hop", "R&B", "Pop", "Rock", "Electronic", "Jazz", "Classical",
  "Afrobeats", "Latin", "Metal", "Indie", "Soul", "Reggae", "Country",
  "Dance", "K-Pop",
] as const;

export const PODCAST_GENRES = [
  "True Crime", "Comedy", "Tech", "Business", "Health", "Sports", "News",
  "Science", "History", "Culture", "Politics", "Education", "Self-Help",
  "Finance", "Entertainment",
] as const;

/** GET /api/profile/user?username= */
export type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string | null;
};
