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

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-12 pb-2">
        <button
          onClick={() => router.push("/feed")}
          className="w-9 h-9 flex items-center justify-center"
          aria-label="Go back"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {isOwnProfile ? (
          <Link
            href={`/u/${profile.username}/settings`}
            className="w-9 h-9 flex items-center justify-center"
            aria-label="Settings"
          >
            <svg
              width="22"
              height="22"
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
        ) : (
          <div className="w-9 h-9" />
        )}
      </div>

      {/* ── Avatar + identity ── */}
      <div className="flex flex-col items-center px-6 pt-4 pb-5">
        {/* Avatar */}
        <div className="mb-3">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-[88px] h-[88px] rounded-full object-cover"
            />
          ) : (
            <div className="w-[88px] h-[88px] rounded-full bg-white flex items-center justify-center text-3xl font-bold text-black">
              {avatarLetter}
            </div>
          )}
        </div>

        {/* Display name */}
        <h1 className="text-xl font-bold text-white mb-0.5">{displayName}</h1>
        {/* @username */}
        <p className="text-sm text-white/40 mb-4">@{profile.username}</p>

        {/* Stats row */}
        <div className="flex items-center gap-0 mb-5 w-full max-w-xs justify-center">
          {/* Following */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-lg font-bold text-white leading-tight">{stats.following}</span>
            <span className="text-xs text-white/50 mt-0.5">Following</span>
          </div>
          {/* Divider */}
          <div className="w-px h-8 bg-white/10" />
          {/* Followers */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-lg font-bold text-white leading-tight">{stats.followers}</span>
            <span className="text-xs text-white/50 mt-0.5">Followers</span>
          </div>
          {/* Divider */}
          <div className="w-px h-8 bg-white/10" />
          {/* Vibes */}
          <div className="flex-1 flex flex-col items-center">
            <span className="text-lg font-bold text-white leading-tight">{stats.posts}</span>
            <span className="text-xs text-white/50 mt-0.5">Vibes</span>
          </div>
        </div>

        {/* Action button */}
        {isOwnProfile ? (
          <Link
            href={`/u/${profile.username}/settings`}
            className="px-10 py-2 rounded-md border border-white/20 text-sm font-semibold text-white hover:bg-white/5 active:bg-white/10 transition-all"
          >
            Edit Profile
          </Link>
        ) : (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className={`px-10 py-2 rounded-md text-sm font-semibold transition-all disabled:opacity-50 ${
              isFollowing
                ? "border border-white/20 text-white bg-transparent hover:bg-white/5"
                : "bg-white text-black hover:bg-white/90 active:bg-white/80"
            }`}
          >
            {followLoading ? "…" : isFollowing ? "Following" : "Follow"}
          </button>
        )}

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-white/70 text-center max-w-xs leading-relaxed mt-4">
            {profile.bio}
          </p>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-white/10">
        {/* Vibes tab */}
        <button
          onClick={() => setTab("vibes")}
          className={`flex-1 flex flex-col items-center py-3 gap-1 relative transition-colors ${
            tab === "vibes" ? "text-white" : "text-white/40"
          }`}
        >
          {/* Grid icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="text-[10px] font-medium">Vibes</span>
          {tab === "vibes" && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
          )}
        </button>

        {/* Reposts tab */}
        <button
          onClick={() => setTab("reposts")}
          className={`flex-1 flex flex-col items-center py-3 gap-1 relative transition-colors ${
            tab === "reposts" ? "text-white" : "text-white/40"
          }`}
        >
          {/* Repost icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <span className="text-[10px] font-medium">Reposts</span>
          {tab === "reposts" && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
          )}
        </button>

        {/* Taste tab */}
        <button
          onClick={() => setTab("taste")}
          className={`flex-1 flex flex-col items-center py-3 gap-1 relative transition-colors ${
            tab === "taste" ? "text-white" : "text-white/40"
          }`}
        >
          {/* Heart icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill={tab === "taste" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span className="text-[10px] font-medium">Taste</span>
          {tab === "taste" && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
          )}
        </button>
      </div>

      {/* ── Tab content ── */}

      {/* ── Vibes tab ── */}
      {tab === "vibes" && (
        vibesLoading ? (
          <div className="grid grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-white/5 animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        ) : vibeItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
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
          <div className="grid grid-cols-3">
            {vibeItems.map((item) => (
              <a
                key={item.id}
                href={item.track_url ?? `https://open.spotify.com/search/${encodeURIComponent(item.track_name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square overflow-hidden block"
              >
                {item.album_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.album_image}
                    alt={item.track_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                )}
                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {/* Track name overlay */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="white" className="flex-shrink-0 opacity-70">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" fill="white" />
                    <circle cx="18" cy="16" r="3" fill="white" />
                  </svg>
                  <span className="text-[10px] text-white truncate leading-tight opacity-90">
                    {item.track_name}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )
      )}

      {/* ── Reposts tab ── */}
      {tab === "reposts" && (
        repostsLoading ? (
          <div className="grid grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-white/5 animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        ) : reposts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
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
          <div className="grid grid-cols-3">
            {reposts.map((item) => (
              <a
                key={item.id}
                href={item.track_url ?? `https://open.spotify.com/search/${encodeURIComponent(item.track_name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-square overflow-hidden block"
              >
                {item.album_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.album_image}
                    alt={item.track_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/20">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <polyline points="7 23 3 19 7 15" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                  </div>
                )}
                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {/* Track name overlay */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="white" className="flex-shrink-0 opacity-70">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" fill="white" />
                    <circle cx="18" cy="16" r="3" fill="white" />
                  </svg>
                  <span className="text-[10px] text-white truncate leading-tight opacity-90">
                    {item.track_name}
                  </span>
                </div>
              </a>
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
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            {isOwnProfile ? (
              <Link
                href={`/u/${profile.username}/settings`}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                Set your taste in Settings →
              </Link>
            ) : (
              <p className="text-white/40 text-sm">No taste set yet</p>
            )}
          </div>
        ) : (
          <div className="px-4 py-6 space-y-7 pb-24">
            {taste.favorite_artists.length > 0 && (
              <div>
                <p className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-3">
                  Artists
                </p>
                <div className="flex flex-wrap gap-2">
                  {taste.favorite_artists.map((artist) => (
                    <span
                      key={artist}
                      className="px-3.5 py-1.5 rounded-full text-sm border border-white/20 text-white/80"
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
                  Music
                </p>
                <div className="flex flex-wrap gap-2">
                  {taste.music_genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-3.5 py-1.5 rounded-full text-sm border border-white/20 text-white/80"
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
                  Podcasts
                </p>
                <div className="flex flex-wrap gap-2">
                  {taste.podcast_genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-3.5 py-1.5 rounded-full text-sm border border-white/20 text-white/80"
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
                className="block text-center text-sm text-white/30 hover:text-white/60 transition-colors"
              >
                Edit in Settings →
              </Link>
            )}
          </div>
        )
      )}

    </div>
  );
}
