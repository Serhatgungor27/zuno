
/**
 * Turns what someone actually did in Discover into a ranked picture of their
 * taste.
 *
 * The feed used to seed from hearts alone, and hearts are rare — most people
 * swipe for ten minutes without tapping anything. Meanwhile every swipe says
 * something: a track left playing to the end is interest, one skipped in two
 * seconds is a rejection. Reading those is the difference between a feed that
 * learns and one that waits to be told.
 */

export type Row = {
  artist: string | null;
  action: string;
  completion: number | null;
  time_spent_ms: number | null;
  created_at: string;
};

/**
 * What each signal is worth. Deliberate acts score highest, but they are also
 * the rarest — the view rules below are what carry a typical session.
 */
const WEIGHTS: Record<string, number> = {
  repost: 4,
  like: 3,
  share: 3,
  open_spotify: 2,
  open_apple: 2,
  open_youtube: 2,
  unlike: -2,
  dislike: -8,
};

/** A track that played this far through was not being endured. */
const FINISHED = 0.75;
/** Below this, and gone within a few seconds, reads as a rejection. */
const SKIMMED = 0.15;
const SKIP_MS = 4000;

/**
 * Interest decays. Half of a signal's weight is gone after two weeks, so the
 * feed follows what someone is into now rather than what they liked once.
 */
const HALF_LIFE_DAYS = 14;

function decay(createdAt: string, now: number): number {
  const ageDays = (now - new Date(createdAt).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < 0) return 1;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

function scoreRow(row: Row): number {
  const explicit = WEIGHTS[row.action];
  if (explicit !== undefined) return explicit;

  // Everything else is a view. Completion is the honest measure: time alone
  // rewards long previews over short ones.
  if (row.action !== "view" && row.action !== "view_end") return 0;

  const completion = row.completion ?? 0;
  const ms = row.time_spent_ms ?? 0;

  if (completion >= FINISHED) return 2;
  if (completion >= 0.4) return 0.75;
  if (completion <= SKIMMED && ms > 0 && ms < SKIP_MS) return -1.5;
  return 0;
}

export type Affinity = {
  /** Artists worth seeding from, strongest first. */
  artists: string[];
  /** Artists to keep out of the feed entirely. */
  blocked: string[];
};

/**
 * @param stated Artists named in the profile. An explicit choice outranks any
 *   single swipe, so it is seeded with real weight — but it still competes,
 *   rather than owning the feed forever.
 */
export type AffinityInput = {
  /** Rows from discover_interactions, newest first. */
  interactions: Row[];
  /** Rows from discover_likes. */
  likes: { artist: string | null; created_at: string }[];
  /** Rows from discover_dislikes. */
  dislikes: { artist: string | null }[];
  /**
   * Artists named in the profile. An explicit choice outranks any single
   * swipe, so it is seeded with real weight — but it still competes, rather
   * than owning the feed forever.
   */
  stated: string[];
  /** Injected so the decay is testable. */
  now?: number;
};

/**
 * Pure on purpose: the caller fetches, this ranks. Keeps the scoring easy to
 * reason about and to check against real rows without a database.
 */
export function artistAffinity({
  interactions,
  likes,
  dislikes,
  stated,
  now = Date.now(),
}: AffinityInput): Affinity {
  const scores = new Map<string, number>();
  const bump = (artist: string | null | undefined, by: number) => {
    const name = (artist ?? "").trim();
    if (!name) return;
    scores.set(name, (scores.get(name) ?? 0) + by);
  };

  stated.forEach((name, i) => bump(name, 6 - Math.min(i, 3)));

  for (const row of interactions) {
    const value = scoreRow(row);
    if (value !== 0) bump(row.artist, value * decay(row.created_at, now));
  }

  // A like that predates the interaction log still counts.
  for (const row of likes) bump(row.artist, 3 * decay(row.created_at, now));

  const blocked = [
    ...new Set(dislikes.map((r) => (r.artist ?? "").trim()).filter(Boolean)),
  ];
  const blockedKeys = new Set(blocked.map((a) => a.toLowerCase()));

  const artists = [...scores.entries()]
    .filter(([name, value]) => value > 0 && !blockedKeys.has(name.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return { artists, blocked };
}
