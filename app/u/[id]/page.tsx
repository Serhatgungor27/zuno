"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { SpotifyIFrameAPI, SpotifyEmbedController } from "@/lib/spotify-iframe";

type Track = {
  name: string;
  artists: string;
  album: string;
  image: string | null;
  url: string | null;
  previewUrl: string | null;
  trackId: string | null;
};

type User = {
  name: string;
  image: string | null;
  bio?: string | null;
  profileLink?: string | null;
  listenerCount?: number;
  lastActive?: string | null;
};

type PlaybackState = { isPaused: boolean; position: number; duration: number };

function formatTime(ms: number) {
  if (!ms || isNaN(ms)) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${(totalSec % 60).toString().padStart(2, "0")}`;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [track, setTrack] = useState<Track | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isOnRepeat, setIsOnRepeat] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>({ isPaused: true, position: 0, duration: 0 });

  const embedContainerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const apiRef = useRef<SpotifyIFrameAPI | null>(null);
  const trackIdRef = useRef<string | null>(null);

  // Username claim
  const [showUsernameBanner, setShowUsernameBanner] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Ghost mode
  const [ghostMode, setGhostMode] = useState(false);
  const [ghostLoading, setGhostLoading] = useState(false);

  // Profile link
  const [profileLink, setProfileLink] = useState<string | null>(null);

  // Stats (owner only)
  const [stats, setStats] = useState<{
    weeklyTracks: number;
    profileViews: number | null;
    topTracks: { track_id: string; track_name: string; artist: string; album_image: string | null; count: number }[];
    topArtist: { artist: string; album_image: string | null; count: number } | null;
  } | null>(null);

  // Co-listeners
  const [listeners, setListeners] = useState<{ id: string; name: string; image: string | null }[]>([]);

  // Listening history
  const [history, setHistory] = useState<{
    track_id: string;
    track_name: string;
    artist: string;
    album_image: string | null;
    track_url: string | null;
    played_at: string;
    repeat_count?: number;
  }[]>([]);

  // Follow state
  const [followState, setFollowState] = useState<{
    isFollowing: boolean;
    followerCount: number;
    followingCount: number;
    isSelf: boolean;
    isLoggedIn: boolean;
    loaded: boolean;
  }>({ isFollowing: false, followerCount: 0, followingCount: 0, isSelf: false, isLoggedIn: false, loaded: false });
  const [followLoading, setFollowLoading] = useState(false);

  // Load Spotify IFrame API — visitors only (avoids creating a Connect device for the owner)
  useEffect(() => {
    if (!followState.loaded || followState.isSelf) return;

    const init = (IFrameAPI: SpotifyIFrameAPI) => {
      apiRef.current = IFrameAPI;
      window._SpotifyIFrameAPI = IFrameAPI;
      if (trackIdRef.current) initController(IFrameAPI, trackIdRef.current);
    };

    window.onSpotifyIframeApiReady = init;
    if (!document.getElementById("spotify-iframe-api")) {
      const script = document.createElement("script");
      script.id = "spotify-iframe-api";
      script.src = "https://open.spotify.com/embed-podcast/iframe-api/v1";
      document.body.appendChild(script);
    } else if (window._SpotifyIFrameAPI && trackIdRef.current) {
      init(window._SpotifyIFrameAPI);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followState.loaded, followState.isSelf]);

  const initController = (api: SpotifyIFrameAPI, trackId: string) => {
    if (!embedContainerRef.current) return;
    embedContainerRef.current.innerHTML = "";
    const target = document.createElement("div");
    embedContainerRef.current.appendChild(target);
    controllerRef.current = null;
    setPlayback({ isPaused: true, position: 0, duration: 0 });

    api.createController(target, { uri: `spotify:track:${trackId}` }, (controller) => {
      controllerRef.current = controller;
      controller.addListener("playback_update", (e) => setPlayback(e.data));
    });
  };

  // Re-init when track changes
  useEffect(() => {
    if (followState.isSelf || !track?.trackId || track.trackId === trackIdRef.current) return;
    trackIdRef.current = track.trackId;
    controllerRef.current = null;
    setPlayback({ isPaused: true, position: 0, duration: 0 });
    if (apiRef.current) initController(apiRef.current, track.trackId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.trackId, followState.isSelf]);

  // Fetch follow state + detect own page
  const fetchFollowState = useCallback(async () => {
    const [userRes, followRes] = await Promise.all([
      fetch("/api/user").then((r) => r.json()).catch(() => ({ ok: false })),
      fetch(`/api/follow?userId=${id}`).then((r) => r.json()).catch(() => null),
    ]);

    const isLoggedIn = !!userRes?.ok;
    if (isLoggedIn) {
      const me = userRes.user;
      const isMe = me.spotify_id === id || me.username === id;
      if (isMe && !me.username) setShowUsernameBanner(true);
    }

    if (followRes?.ok) {
      setFollowState({
        isFollowing: followRes.isFollowing,
        followerCount: followRes.followerCount,
        followingCount: followRes.followingCount,
        isSelf: followRes.isSelf,
        isLoggedIn,
        loaded: true,
      });
    }
  }, [id]);

  useEffect(() => {
    fetchFollowState();
  }, [fetchFollowState]);

  // Fetch ghost mode status (owner only)
  useEffect(() => {
    fetch("/api/privacy")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setGhostMode(d.ghostMode); })
      .catch(() => {});
  }, []);

  // Fetch listening history + stats + profile link
  useEffect(() => {
    fetch(`/api/history?userId=${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setHistory(d.tracks ?? []); })
      .catch(() => {});

    fetch(`/api/stats?userId=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStats({ weeklyTracks: d.weeklyTracks, profileViews: d.profileViews, topTracks: d.topTracks ?? [], topArtist: d.topArtist ?? null });
      })
      .catch(() => {});

    // Owner: fetch profile link from settings (in case they haven't had a now-playing poll yet)
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => { if (d.ok && d.user.profile_link) setProfileLink(d.user.profile_link); })
      .catch(() => {});

    // Count this as a profile view (non-owners only — API handles the check)
    fetch(`/api/view?userId=${id}`, { method: "POST" }).catch(() => {});
  }, [id]);

  const handleToggleGhost = async () => {
    setGhostLoading(true);
    try {
      const res = await fetch("/api/privacy", { method: "POST" });
      const data = await res.json();
      if (data.ok) setGhostMode(data.ghostMode);
    } finally {
      setGhostLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!followState.isLoggedIn) { window.location.href = "/api/auth/login"; return; }
    setFollowLoading(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json();
      if (data.ok) {
        setFollowState((prev) => ({
          ...prev,
          isFollowing: data.action === "followed",
          followerCount: prev.followerCount + (data.action === "followed" ? 1 : -1),
        }));
      }
    } finally {
      setFollowLoading(false);
    }
  };

  // Poll now-playing every 5s
  useEffect(() => {
    const fetchNowPlaying = async () => {
      try {
        const res = await fetch(`/api/spotify/now-playing?userId=${id}`);
        if (res.status === 404) { setNotFound(true); return; }
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (data.user.profileLink) setProfileLink(data.user.profileLink);
        }
        if (data.playing) {
          setTrack(data.track);
          setIsLive(Boolean(data.isLive));
          setIsOnRepeat(Boolean(data.isOnRepeat));
          // Fetch co-listeners for this track
          if (data.track?.trackId) {
            fetch(`/api/listeners?trackId=${data.track.trackId}&exclude=${encodeURIComponent(id)}`)
              .then((r) => r.json())
              .then((ld) => { if (ld.ok) setListeners(ld.users ?? []); })
              .catch(() => {});
          }
        } else {
          setTrack(null);
          setIsLive(false);
          setIsOnRepeat(false);
          setListeners([]);
        }
        setLoaded(true);
      } catch (err) {
        console.error(err);
        setLoaded(true);
      }
    };
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePlayPause = () => {
    if (!controllerRef.current) return;
    if (playback.isPaused) controllerRef.current.play();
    else controllerRef.current.pause();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ms = parseFloat(e.target.value);
    controllerRef.current?.seek(ms / 1000);
    setPlayback((p) => ({ ...p, position: ms }));
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt("Copy your Zuno link:", url);
    }
  };

  const handleSetUsername = async () => {
    if (!usernameInput.trim()) return;
    setUsernameLoading(true);
    setUsernameError("");
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowUsernameBanner(false);
        router.replace(`/u/${data.username}`);
      } else {
        setUsernameError(data.message ?? "Something went wrong");
      }
    } catch {
      setUsernameError("Network error, try again");
    } finally {
      setUsernameLoading(false);
    }
  };

  const progress = playback.duration > 0 ? (playback.position / playback.duration) * 100 : 0;

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-white/60">User not found.</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start md:justify-center text-white overflow-x-hidden overflow-y-auto">

      {/* Album art background */}
      {track?.image && (
        <div
          key={track.image}
          className="absolute inset-0 bg-cover bg-center animate-zoom"
          style={{ backgroundImage: `url(${track.image})` }}
        />
      )}
      {!track?.image && <div className="absolute inset-0 bg-black" />}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

      {/* Top nav */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-4 bg-black/30 backdrop-blur-md border-b border-white/5">
        {/* Back to feed */}
        <Link href="/feed" className="flex items-center gap-1 text-white/40 hover:text-white transition-colors text-sm w-16">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Feed
        </Link>

        {/* Logo — always centered */}
        <span className="absolute left-1/2 -translate-x-1/2 text-white/50 text-sm font-bold tracking-widest">zuno</span>

        {/* Right side — ghost + settings for owner */}
        {followState.isSelf ? (
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleToggleGhost}
              disabled={ghostLoading}
              className={`relative group transition-all duration-200 ${ghostMode ? "opacity-100 animate-pulse" : "opacity-30 hover:opacity-70"}`}
            >
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 10V7.5a4 4 0 018 0V10" />
                <rect x="3" y="10" width="18" height="2.5" rx="1.25" fill="currentColor" stroke="none" />
                <circle cx="9" cy="16" r="2.25" />
                <circle cx="15" cy="16" r="2.25" />
                <line x1="11.25" y1="16" x2="12.75" y2="16" />
              </svg>
              {/* Tooltip */}
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {ghostMode ? "Ghost Mode ON" : "Ghost Mode"}
              </span>
            </button>
            <Link href="/settings" className="text-white/40 hover:text-white/80 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Username claim banner */}
      {showUsernameBanner && (
        <div className="fixed top-14 left-0 right-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-6 py-4">
          <div className="max-w-xl mx-auto">
            <p className="text-sm text-white/70 mb-2">
              🎉 Claim your username for a clean shareable link like{" "}
              <span className="text-white font-mono">zuno.app/u/yourname</span>
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-mono">@</span>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                    setUsernameError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSetUsername()}
                  placeholder="yourname"
                  maxLength={20}
                  className="w-full bg-white/10 border border-white/20 rounded-full pl-7 pr-4 py-2 text-sm font-mono text-white placeholder-white/30 focus:outline-none focus:border-white/40"
                />
              </div>
              <button
                onClick={handleSetUsername}
                disabled={usernameLoading || !usernameInput.trim()}
                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 transition px-5 py-2 rounded-full text-sm font-semibold"
              >
                {usernameLoading ? "..." : "Claim"}
              </button>
              <button onClick={() => setShowUsernameBanner(false)} className="text-white/30 hover:text-white/60 px-2 text-sm transition">
                Later
              </button>
            </div>
            {usernameError && <p className="text-red-400 text-xs mt-1 pl-2">{usernameError}</p>}
          </div>
        </div>
      )}

      {/* Hidden Spotify iframe — audio engine, visitors only */}
      <div ref={embedContainerRef} aria-hidden="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }} />

      {/* Main content */}
      <div className="relative z-10 text-center px-5 max-w-xl w-full pt-24 pb-12">
        {user && track ? (
          <>
            {/* Profile photo */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <img
                  src={user.image ?? ""}
                  alt="Profile"
                  className="w-24 h-24 rounded-full border-4 border-white/20 object-cover shadow-2xl"
                />
                {isLive && (
                  <div className="absolute -top-2 -right-2">
                    <div className="relative inline-flex items-center gap-2 bg-red-600 text-white text-[10px] px-3 py-1 rounded-full font-bold shadow-lg">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-white/80 opacity-70 animate-ping" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                      </span>
                      <span className="leading-none tracking-wide">LIVE</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Follower counts + follow button */}
            {followState.loaded && (
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-center">
                  <p className="text-white font-bold text-sm">{followState.followerCount}</p>
                  <p className="text-white/40 text-xs">followers</p>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div className="text-center">
                  <p className="text-white font-bold text-sm">{followState.followingCount}</p>
                  <p className="text-white/40 text-xs">following</p>
                </div>
                {!followState.isSelf && (
                  <>
                    <div className="w-px h-6 bg-white/20" />
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 disabled:opacity-50 ${
                        followState.isFollowing
                          ? "bg-white/15 border border-white/30 text-white hover:bg-red-500/30 hover:border-red-400/50 hover:text-red-300"
                          : "bg-white text-black hover:bg-white/90"
                      }`}
                    >
                      {followLoading ? "…" : followState.isFollowing ? "Following" : "Follow"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Bio */}
            {user.bio && (
              <p className="text-white/50 text-sm mb-3 max-w-xs mx-auto leading-relaxed">{user.bio}</p>
            )}

            {/* Last active — only shown when not live and user opted in */}
            {!isLive && user.lastActive && (
              <p className="text-white/30 text-xs mb-3">
                Last played {timeAgo(user.lastActive)}
              </p>
            )}

            {/* Profile link */}
            {profileLink && (
              <a
                href={profileLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-xs mb-4 border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-full transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {profileLink.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
              </a>
            )}

            {/* Co-listeners — avatar stack */}
            {listeners.length > 0 && (
              <div className="flex flex-col items-center gap-2 mb-4">
                <div className="flex items-center">
                  {listeners.slice(0, 5).map((l, i) => (
                    <Link key={l.id} href={`/u/${l.id}`} className="relative hover:z-10 transition-transform hover:scale-110" style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 5 - i }}>
                      {l.image ? (
                        <img src={l.image} alt={l.name} className="w-8 h-8 rounded-full border-2 border-black object-cover" title={l.name} />
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-black bg-white/20 flex items-center justify-center">
                          <span className="text-xs">👤</span>
                        </div>
                      )}
                    </Link>
                  ))}
                  {(user.listenerCount ?? 0) > 5 && (
                    <div className="w-8 h-8 rounded-full border-2 border-black bg-white/10 flex items-center justify-center text-white/50 text-[10px] font-bold" style={{ marginLeft: -10, zIndex: 0 }}>
                      +{(user.listenerCount ?? 0) - 5}
                    </div>
                  )}
                </div>
                <p className="text-white/40 text-xs">
                  🎧 {user.listenerCount} {user.listenerCount === 1 ? "person" : "people"} listening right now
                </p>
              </div>
            )}
            {(user.listenerCount ?? 0) > 0 && listeners.length === 0 && (
              <p className="text-white/40 text-xs mb-4">
                🎧 {user.listenerCount} {user.listenerCount === 1 ? "other person" : "others"} listening to this right now
              </p>
            )}

            <p className="text-sm text-white/80 mb-2 tracking-wide">
              <span className="font-semibold tracking-wider">{user.name}</span>{" "}
              is listening to
            </p>

            <h1 className="text-4xl md:text-5xl font-bold mb-2 leading-tight drop-shadow-lg">
              {track.name}
            </h1>
            <p className="text-lg text-white/75 mb-3">{track.artists}</p>
            {isOnRepeat && (
              <p className="text-white/50 text-xs mb-6">
                Currently on repeat
              </p>
            )}
            {!isOnRepeat && <div className="mb-6" />}

            {/* Wave visualizer */}
            {isLive && (
              <div className="flex justify-center items-end gap-[3px] mb-6 h-10">
                {[6, 10, 14, 10, 8, 12, 16, 12, 10, 8, 14, 10, 6].map((baseH, i) => (
                  <span
                    key={i}
                    className="w-[3px] bg-white/90 rounded-full"
                    style={{
                      animation: `wave ${0.9 + (i % 4) * 0.2}s ease-in-out infinite`,
                      animationDelay: `${i * 0.1}s`,
                      height: `${baseH}px`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Spotify embed player — visitors only, always visible */}
            {track.trackId && !followState.isSelf && (
              <div className="mb-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-4 shadow-2xl">
                <div className="flex items-center gap-4">
                  {track.image && (
                    <img src={track.image} alt={track.album} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-lg" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate leading-tight">{track.name}</p>
                    <p className="text-white/50 text-xs truncate mb-3">{track.artists}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-[10px] tabular-nums w-7 text-right flex-shrink-0">{formatTime(playback.position)}</span>
                      <div className="relative flex-1 h-1 group">
                        <div className="absolute inset-0 rounded-full bg-white/20" />
                        <div className="absolute inset-y-0 left-0 rounded-full bg-white transition-all duration-300" style={{ width: `${progress}%` }} />
                        <input
                          type="range" min={0} max={playback.duration || 100} step={0.5} value={playback.position}
                          onChange={handleSeek}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                        />
                      </div>
                      <span className="text-white/40 text-[10px] tabular-nums w-7 flex-shrink-0">{formatTime(playback.duration)}</span>
                    </div>
                  </div>
                  <button
                    onClick={handlePlayPause}
                    className="flex-shrink-0 w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
                  >
                    {playback.isPaused ? (
                      <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Ghost mode banner — only owner sees this */}
            {followState.isSelf && ghostMode && (
              <Link href="/settings" className="mb-5 flex items-center justify-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-xs text-white/50 backdrop-blur-sm hover:bg-white/15 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 10V7.5a4 4 0 018 0V10" />
                  <rect x="3" y="10" width="18" height="2.5" rx="1.25" fill="currentColor" stroke="none" />
                  <circle cx="9" cy="16" r="2.25" />
                  <circle cx="15" cy="16" r="2.25" />
                  <line x1="11.25" y1="16" x2="12.75" y2="16" />
                </svg>
                <span>Ghost Mode is on — tap to change</span>
              </Link>
            )}

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={track.url ?? "#"}
                target="_blank"
                className="inline-block bg-green-500 hover:bg-green-600 transition-all duration-300 px-8 py-3 rounded-full font-semibold shadow-xl hover:scale-105 active:scale-95"
              >
                Open in Spotify
              </a>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/20 transition-all duration-300 px-8 py-3 rounded-full font-semibold hover:scale-105 active:scale-95"
              >
                {copied ? (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied!</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>Share</>
                )}
              </button>
            </div>
          </>
        ) : user ? (
          <div className="flex flex-col items-center">
            {/* Profile photo */}
            <div className="flex justify-center mb-5">
              <img src={user.image ?? ""} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white/20 object-cover shadow-2xl" />
            </div>

            {/* Follow counts */}
            {followState.loaded && (
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-center">
                  <p className="text-white font-bold text-sm">{followState.followerCount}</p>
                  <p className="text-white/40 text-xs">followers</p>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div className="text-center">
                  <p className="text-white font-bold text-sm">{followState.followingCount}</p>
                  <p className="text-white/40 text-xs">following</p>
                </div>
                {!followState.isSelf && (
                  <>
                    <div className="w-px h-6 bg-white/20" />
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 disabled:opacity-50 ${
                        followState.isFollowing
                          ? "bg-white/15 border border-white/30 text-white hover:bg-red-500/30 hover:border-red-400/50 hover:text-red-300"
                          : "bg-white text-black hover:bg-white/90"
                      }`}
                    >
                      {followLoading ? "…" : followState.isFollowing ? "Following" : "Follow"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Bio */}
            {user.bio && (
              <p className="text-white/50 text-sm mb-3 max-w-xs mx-auto leading-relaxed">{user.bio}</p>
            )}

            {/* Profile link */}
            {profileLink && (
              <a href={profileLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-xs mb-4 border border-white/20 hover:border-white/40 px-3 py-1.5 rounded-full transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {profileLink.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
              </a>
            )}

            {/* Last active — shown when user opted in */}
            {user.lastActive && (
              <p className="text-white/30 text-xs mb-3">
                Last played {timeAgo(user.lastActive)}
              </p>
            )}

            <p className="text-white/40 text-sm mb-5">
              <span className="font-semibold text-white/60">{user.name}</span> is not playing anything right now
            </p>

            <button onClick={handleShare} className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-300 px-6 py-2.5 rounded-full text-sm font-semibold hover:scale-105 active:scale-95">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              Share
            </button>
          </div>
        ) : (
          <p className="text-white/40 animate-pulse">Loading…</p>
        )}

        {/* Top song + favourite artist — visible to all */}
        {stats && (stats.topTracks.length > 0 || stats.topArtist) && (
          <div className="mt-8 w-full max-w-xl">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3 px-1 text-left">This week</p>
            <div className="grid grid-cols-2 gap-3">
              {stats.topTracks[0] && (
                <a
                  href={stats.topTracks[0].track_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-4 flex flex-col gap-2 transition-colors text-left"
                >
                  <p className="text-white/30 text-[10px] uppercase tracking-widest">Top song</p>
                  {stats.topTracks[0].album_image && (
                    <img src={stats.topTracks[0].album_image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  )}
                  <div>
                    <p className="text-white/90 text-sm font-medium leading-tight truncate">{stats.topTracks[0].track_name}</p>
                    <p className="text-white/40 text-xs truncate mt-0.5">{stats.topTracks[0].artist}</p>
                  </div>
                </a>
              )}
              {stats.topArtist && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2 text-left">
                  <p className="text-white/30 text-[10px] uppercase tracking-widest">Fav artist</p>
                  {stats.topArtist.album_image && (
                    <img src={stats.topArtist.album_image} alt="" className="w-10 h-10 rounded-full object-cover" />
                  )}
                  <p className="text-white/90 text-sm font-medium leading-tight truncate">{stats.topArtist.artist}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats — owner only */}
        {followState.isSelf && stats && (stats.weeklyTracks > 0 || stats.profileViews !== null) && (
          <div className="mt-8 w-full max-w-xl">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3 px-1 text-left">Your stats this week</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{stats.weeklyTracks}</p>
                <p className="text-white/40 text-xs mt-1">tracks played</p>
              </div>
              {stats.profileViews !== null && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{stats.profileViews}</p>
                  <p className="text-white/40 text-xs mt-1">profile views</p>
                </div>
              )}
            </div>
            {stats.topTracks.length > 0 && (
              <div className="mt-3">
                <p className="text-white/30 text-xs uppercase tracking-widest mb-2 px-1 text-left">Top tracks</p>
                {stats.topTracks.map((t, i) => (
                  <div key={t.track_id} className="flex items-center gap-3 px-2 py-2">
                    <span className="text-white/20 text-xs w-4 text-right shrink-0">{i + 1}</span>
                    {t.album_image && <img src={t.album_image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-white/70 text-xs font-medium truncate">{t.track_name}</p>
                      <p className="text-white/30 text-xs truncate">{t.artist}</p>
                    </div>
                    <span className="text-white/30 text-xs shrink-0">{t.count}×</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Listening history */}
        {history.length > 0 && (
          <div className="mt-10 w-full max-w-xl text-left">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3 px-1">Recently played</p>
            <div className="flex flex-col gap-1">
              {history.map((t, i) => (
                <a
                  key={`${t.track_id}-${i}`}
                  href={t.track_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors group"
                >
                  {t.album_image ? (
                    <img src={t.album_image} alt={t.track_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-medium truncate group-hover:text-white transition-colors">{t.track_name}</p>
                    <p className="text-white/40 text-xs truncate">{t.artist}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-white/20 text-[10px]">{timeAgo(t.played_at)}</p>
                    {(t.repeat_count ?? 1) > 1 && (
                      <p className="text-white/30 text-[10px]">
                        ×{t.repeat_count}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes wave {
          0%   { height: 4px;  opacity: 0.5; }
          50%  { height: 32px; opacity: 1;   }
          100% { height: 4px;  opacity: 0.5; }
        }
        @keyframes zoom {
          0%   { transform: scale(1.0); }
          100% { transform: scale(1.12); }
        }
        .animate-zoom { animation: zoom 20s ease-in-out infinite alternate; }
      `}</style>
    </main>
  );
}
