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

/** A row in the follower/following list — no presence, unlike search. */
export type FollowUser = {
  id: string;
  spotifyId: string;
  name: string;
  username: string | null;
  image: string | null;
};

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

/** GET /api/history?userId= — no longer surfaced; Spotify polling ended. */
export type HistoryTrack = {
  /** The listening_history row — what likes and comments key on. */
  id: string;
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

/** GET /api/vibe/comments?historyId= */
export type VibeComment = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_image: string | null;
  user_username: string | null;
  text: string;
  created_at: string;
  like_count: number;
  user_liked: boolean;
};

/** GET /api/taste */
export type Taste = {
  ok: boolean;
  favorite_artists: string[];
  /**
   * Artist name -> Deezer artist id, for the ones picked from the search list.
   * Names alone are ambiguous — two artists can share one — so this is what
   * makes the picture match the artist you actually chose.
   */
  favorite_artist_ids: Record<string, number>;
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

/** GET /api/notifications */
export type ZunoNotification = {
  id: string;
  type: "follow" | "vibe_like" | "vibe_comment" | string;
  actor_id: string | null;
  actor_name: string | null;
  actor_image: string | null;
  actor_username: string | null;
  track_name: string | null;
  history_id: string | null;
  comment_text: string | null;
  read: boolean | null;
  created_at: string;
};

/** GET /api/feed?type=trending */
export type TrendingTrack = {
  track_id: string;
  track_name: string;
  artist: string;
  album_image: string | null;
  track_url: string | null;
  count: number;
};

/** GET /api/feed?type=following_feed */
export type FollowingItem = {
  id: string;
  kind: "like" | "repost";
  trackId: string | null;
  track: string;
  artist: string;
  albumImage: string | null;
  trackUrl: string | null;
  at: string;
  userName: string;
  userImage: string | null;
  userHandle: string;
};

/** GET /api/feed?type=trending_global */
export type GlobalTrack = {
  position: number;
  trackId: string;
  name: string;
  artist: string;
  albumImage: string | null;
  previewUrl: string | null;
  deezerUrl: string | null;
};

/** Rows from GET /api/feed?type=trending_global */
export type ChartRow = {
  position: number;
  trackId: string;
  name: string;
  artist: string;
  albumImage: string | null;
  previewUrl: string | null;
  /**
   * Where the row came from — Deezer for the global chart, Apple Music for a
   * country chart. Deliberately not called a Spotify url: it isn't one, and
   * treating it as one is what made the Spotify button open Apple Music.
   */
  sourceUrl: string | null;
  /** Which service sourceUrl points at, so the app never has to guess. */
  source: "apple" | "deezer";
  kind: "song" | "podcast";
};

/** Storefronts offered in the Trending filter. Global is songs-only. */
export const CHART_COUNTRIES: { code: string; label: string }[] = [
  { code: "global", label: "Global" },
  { code: "se", label: "Sweden" },
  { code: "us", label: "United States" },
  { code: "gb", label: "United Kingdom" },
  { code: "de", label: "Germany" },
  { code: "tr", label: "Türkiye" },
  { code: "fr", label: "France" },
  { code: "nl", label: "Netherlands" },
  { code: "es", label: "Spain" },
  { code: "it", label: "Italy" },
  { code: "no", label: "Norway" },
  { code: "dk", label: "Denmark" },
];
