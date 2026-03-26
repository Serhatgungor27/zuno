"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

type Tab = "vibes" | "reposts" | "taste";

type HistoryItem = {
  id: string;
  track_name: string;
  artist: string;
  album_image: string | null;
  track_url: string | null;
  played_at: string;
  like_count?: number;
};

type RepostItem = {
  id: string;
  track_name: string;
  artist: string;
  album_image: string | null;
  track_url: string | null;
  created_at: string;
};

type TasteData = {
  favorite_artists: string[];
  music_genres: string[];
  podcast_genres: string[];
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 30) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("vibes");

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Real stats
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });

  // Tab content
  const [vibeItems, setVibeItems] = useState<HistoryItem[]>([]);
  const [vibesLoading, setVibesLoading] = useState(false);
  const [reposts, setReposts] = useState<RepostItem[]>([]);
  const [repostsLoading, setRepostsLoading] = useState(false);
  const [taste, setTaste] = useState<TasteData | null>(null);
  const [tasteLoading, setTasteLoading] = useState(false);

  // Vibe like state
  const [vibeLikes, setVibeLikes] = useState<Record<string, { count: number; liked: boolean }>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Get current user (may be null if not logged in)
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setCurrentUserId(user.id);
      }

      // 1. Try profiles table directly (Supabase auth users — public RLS policy)
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, created_at")
        .eq("username", username)
        .single();

      if (profileRow) {
        setProfile(profileRow);
        setIsOwnProfile(user?.id === profileRow.id);

        // Fetch real follow counts
        const [{ count: followers }, { count: following }] = await Promise.all([
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileRow.id),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileRow.id),
        ]);

        // Fetch post count from listening_history
        const { count: posts } = await supabase
          .from("listening_history")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profileRow.id);

        setStats({
          posts: posts ?? 0,
          followers: followers ?? 0,
          following: following ?? 0,
        });

        // Fetch follow status for current user
        if (user && user.id !== profileRow.id) {
          const { data: followRow } = await supabase
            .from("follows")
            .select("id")
            .eq("follower_id", user.id)
            .eq("following_id", profileRow.id)
            .single();
          setIsFollowing(!!followRow);
        }

        setLoading(false);
        return;
      }

      // 2. Fall back to API for Spotify OAuth users (users table)
      const res = await fetch(`/api/profile/user?username=${encodeURIComponent(username)}`);
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await res.json();

      setProfile(data);
      setIsOwnProfile(user?.id === data.id);
      setLoading(false);
    }

    load();
  }, [username]);

  // Load vibes tab content
  useEffect(() => {
    if (tab !== "vibes" || !profile) return;
    if (vibeItems.length > 0) return;
    setVibesLoading(true);
    fetch(`/api/history?userId=${profile.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok || Array.isArray(d.items)) {
          setVibeItems(d.items ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setVibesLoading(false));
  }, [tab, profile, vibeItems.length]);

  // Load reposts tab content
  useEffect(() => {
    if (tab !== "reposts" || !profile) return;
    if (reposts.length > 0) return;
    setRepostsLoading(true);
    fetch(`/api/repost?username=${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setReposts(d.reposts ?? []);
      })
      .catch(() => {})
      .finally(() => setRepostsLoading(false));
  }, [tab, profile, username, reposts.length]);

  // Load taste tab content
  useEffect(() => {
    if (tab !== "taste" || !profile) return;
    if (taste) return;
    setTasteLoading(true);
    // For own profile, use authenticated /api/taste; for others, try public profile endpoint
    const endpoint = isOwnProfile
      ? "/api/taste"
      : `/api/profile/user?username=${encodeURIComponent(username)}`;
    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => {
        if (isOwnProfile && d.ok) {
          setTaste({
            favorite_artists: d.favorite_artists ?? [],
            music_genres: d.music_genres ?? [],
            podcast_genres: d.podcast_genres ?? [],
          });
        } else if (!isOwnProfile && d) {
          setTaste({
            favorite_artists: d.favorite_artists ?? [],
            music_genres: d.music_genres ?? [],
            podcast_genres: d.podcast_genres ?? [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setTasteLoading(false));
  }, [tab, profile, taste, isOwnProfile, username]);

  async function handleFollow() {
    if (!currentUserId) {
      router.push("/auth");
      return;
    }
    setFollowLoading(true);
    const next = !isFollowing;
    setIsFollowing(next);
    setStats((s) => ({ ...s, followers: s.followers + (next ? 1 : -1) }));
    try {
      await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile!.id }),
      });
    } catch {
      setIsFollowing(!next);
      setStats((s) => ({ ...s, followers: s.followers + (next ? -1 : 1) }));
    }
    setFollowLoading(false);
  }

  async function handleVibeLike(e: React.MouseEvent, historyId: string) {
    e.stopPropagation();
    const current = vibeLikes[historyId] ?? { count: 0, liked: false };
    const newLiked = !current.liked;
    setVibeLikes((prev) => ({
      ...prev,
      [historyId]: { count: current.count + (newLiked ? 1 : -1), liked: newLiked },
    }));
    fetch("/api/vibe/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ historyId }),
    }).catch(() => {});
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  // ── 404 state ─────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl mb-4">¯\_(ツ)_/¯</p>
        <h1 className="text-white text-xl font-semibold mb-2">
          This profile doesn&apos;t exist
        </h1>
        <p className="text-white/40 text-sm mb-8">
          @{username} hasn&apos;t joined zuno yet.
        </p>
        <Link
          href="/feed"
          className="text-sm text-white/60 underline underline-offset-4 hover:text-white transition-colors"
        >
          Back to feed
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.display_name ?? profile.username;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  // ── Profile page ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <button
          onClick={() => router.push("/feed")}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all"
          aria-label="Go back"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {isOwnProfile && (
          <Link
            href={`/u/${profile.username}/settings`}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all"
            aria-label="Settings"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        )}

        {/* Spacer when not own profile so back button stays left-aligned */}
        {!isOwnProfile && <div className="w-9 h-9" />}
      </div>

      {/* ── Avatar + identity ── */}
      <div className="flex flex-col items-center px-6 pb-6">
        {/* Avatar */}
        <div className="relative mb-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover border-2 border-white/10"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/10 flex items-center justify-center text-3xl font-bold text-white/70">
              {avatarLetter}
            </div>
          )}
        </div>

        {/* Name + username */}
        <h1 className="text-xl font-bold text-white mb-1">{displayName}</h1>
        <p className="text-sm text-white/40 mb-3">@{profile.username}</p>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-white/70 text-center max-w-xs leading-relaxed mb-4">
            {profile.bio}
          </p>
        )}

        {/* Follow / Edit profile button */}
        {isOwnProfile ? (
          <Link
            href={`/u/${profile.username}/settings`}
            className="px-6 py-2 rounded-full border border-white/20 text-sm font-medium text-white/80 hover:bg-white/5 active:bg-white/10 transition-all"
          >
            Edit profile
          </Link>
        ) : (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-50 ${
              isFollowing
                ? "border border-white/20 text-white/80 hover:bg-white/5 active:bg-white/10"
                : "bg-white text-black hover:bg-white/90 active:bg-white/80"
            }`}
          >
            {followLoading ? "…" : isFollowing ? "Following" : "Follow"}
          </button>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="flex border-t border-b border-white/8 divide-x divide-white/8 mb-6">
        {[
          { label: "Posts", value: stats.posts },
          { label: "Followers", value: stats.followers },
          { label: "Following", value: stats.following },
        ].map(({ label, value }) => (
          <div key={label} className="flex-1 py-4 flex flex-col items-center gap-0.5">
            <span className="text-lg font-bold text-white">{value}</span>
            <span className="text-xs text-white/40">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Tab switcher ── */}
      <div className="px-4 mb-6">
        <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
          {(["vibes", "reposts", "taste"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-all duration-200 ${
                tab === t
                  ? "bg-white text-black shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {t === "vibes" ? "Vibes" : t === "reposts" ? "Reposts" : "Taste"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-4 pb-24">

        {/* ── Vibes tab ── */}
        {tab === "vibes" && (
          vibesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : vibeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <p className="text-white/50 text-sm font-medium mb-1">No vibes yet</p>
              <p className="text-white/25 text-xs max-w-xs">
                {isOwnProfile
                  ? "Your listening history will appear here."
                  : `${displayName} hasn't listened to anything yet.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {vibeItems.map((item) => {
                const likeState = vibeLikes[item.id] ?? { count: item.like_count ?? 0, liked: false };
                return (
                  <div key={item.id} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl p-3">
                    {item.album_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.album_image} alt={item.track_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{item.track_name}</p>
                      <p className="text-white/40 text-xs truncate">{item.artist}</p>
                      <p className="text-white/20 text-[10px] mt-0.5">{timeAgo(item.played_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {currentUserId && (
                        <button
                          onClick={(e) => handleVibeLike(e, item.id)}
                          className="flex flex-col items-center gap-0.5"
                        >
                          <svg
                            className={`w-4 h-4 transition-colors ${likeState.liked ? "text-red-400 fill-red-400" : "text-white/30 fill-none"}`}
                            stroke={likeState.liked ? "none" : "currentColor"}
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                          {likeState.count > 0 && (
                            <span className="text-[10px] text-white/30 font-semibold">{likeState.count}</span>
                          )}
                        </button>
                      )}
                      <a
                        href={item.track_url ?? `https://open.spotify.com/search/${encodeURIComponent(item.track_name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-white/20 hover:text-white/50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Reposts tab ── */}
        {tab === "reposts" && (
          repostsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : reposts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </div>
              <p className="text-white/50 text-sm font-medium mb-1">No reposts yet</p>
              <p className="text-white/25 text-xs max-w-xs">
                Songs {isOwnProfile ? "you repost" : `${displayName} reposts`} will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reposts.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl p-3">
                  {/* Repost indicator */}
                  <div className="flex-shrink-0 w-4 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  {item.album_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.album_image} alt={item.track_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{item.track_name}</p>
                    <p className="text-white/40 text-xs truncate">{item.artist}</p>
                    <p className="text-white/20 text-[10px] mt-0.5">{timeAgo(item.created_at)}</p>
                  </div>
                  <a
                    href={item.track_url ?? `https://open.spotify.com/search/${encodeURIComponent(item.track_name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Taste tab ── */}
        {tab === "taste" && (
          tasteLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : !taste || (taste.favorite_artists.length === 0 && taste.music_genres.length === 0 && taste.podcast_genres.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </div>
              <p className="text-white/50 text-sm font-medium mb-1">No taste profile yet</p>
              <p className="text-white/25 text-xs max-w-xs mb-4">
                {isOwnProfile
                  ? "Add your favourite artists and genres in settings."
                  : `${displayName} hasn't set up their taste profile yet.`}
              </p>
              {isOwnProfile && (
                <Link
                  href={`/u/${profile.username}/settings`}
                  className="text-sm text-white/50 underline underline-offset-4 hover:text-white transition-colors"
                >
                  Go to Settings
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {taste.favorite_artists.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-3">
                    Favourite Artists
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {taste.favorite_artists.map((artist) => (
                      <span
                        key={artist}
                        className="px-3.5 py-1.5 rounded-full text-sm bg-white/10 border border-white/15 text-white/80"
                      >
                        {artist}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {taste.music_genres.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-3">
                    Music Genres
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {taste.music_genres.map((genre) => (
                      <span
                        key={genre}
                        className="px-3.5 py-1.5 rounded-full text-sm bg-white text-black font-medium"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {taste.podcast_genres.length > 0 && (
                <div>
                  <p className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-3">
                    Podcast Genres
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {taste.podcast_genres.map((genre) => (
                      <span
                        key={genre}
                        className="px-3.5 py-1.5 rounded-full text-sm bg-white/10 border border-white/15 text-white/80"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {isOwnProfile && (
                <Link
                  href={`/u/${profile.username}/settings`}
                  className="block text-center text-sm text-white/30 underline underline-offset-4 hover:text-white/60 transition-colors"
                >
                  Edit in Settings
                </Link>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
