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

type Tab = "reposts" | "vibes";

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("reposts");

  // Follow state — placeholder until follow functionality is built
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Stats — placeholder counts until tables are built
  const [stats] = useState({ posts: 0, followers: 0, following: 0 });

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

      // Fetch profile by username
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, created_at")
        .eq("username", username)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(data);
      setIsOwnProfile(user?.id === data.id);
      setLoading(false);
    }

    load();
  }, [username]);

  async function handleFollow() {
    if (!currentUserId) {
      router.push("/auth");
      return;
    }
    setFollowLoading(true);
    // Placeholder — follow logic to be implemented when follows table is ready
    setIsFollowing((prev) => !prev);
    setFollowLoading(false);
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
          onClick={() => router.back()}
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
          {(["reposts", "vibes"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-all duration-200 ${
                tab === t
                  ? "bg-white text-black shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {t === "reposts" ? "Reposts" : "Vibes"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-4 pb-24">
        {tab === "reposts" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/30"
              >
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
        )}

        {tab === "vibes" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/30"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <p className="text-white/50 text-sm font-medium mb-1">No vibes yet</p>
            <p className="text-white/25 text-xs max-w-xs">
              {isOwnProfile
                ? "Curate your first vibe collection to share your taste."
                : `${displayName} hasn't created any vibe collections yet.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
