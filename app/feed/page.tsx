"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

import type { SpotifyIFrameAPI, SpotifyEmbedController } from "@/lib/spotify-iframe";

type LiveUser = {
  id: string;
  spotifyId: string;
  name: string;
  image: string | null;
  track: string | null;
  artist: string | null;
  albumImage: string | null;
  trackId: string | null;
  trackUrl: string | null;
  updatedAt: string | null;
};

type VibeItem = {
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

type TrendingTrack = {
  track_id: string;
  track_name: string;
  artist: string;
  album_image: string | null;
  track_url: string | null;
  count: number;
};

type Tab = "global" | "following" | "vibe" | "trending" | "discover";

type DiscoverTrack = {
  trackId: string;
  name: string;
  artist: string;
  album: string;
  albumImage: string | null;
  previewUrl: string | null;
  spotifyUrl: string;
  deezerUrl: string;
  durationMs: number;
  rank: number;
  explicit: boolean;
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 30) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Full-screen live card
function LiveCard({ user }: { user: LiveUser }) {
  return (
    <Link
      href={`/u/${user.id}`}
      className="relative w-full flex-shrink-0 overflow-hidden block"
      style={{ height: "calc(100svh - 112px)" }}
    >
      {user.albumImage ? (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${user.albumImage})` }} />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
      )}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />

      <div className="absolute inset-0 flex flex-col justify-between p-6">
        {/* Top */}
        <div className="flex items-center gap-3">
          {user.image && <img src={user.image} alt="" className="w-10 h-10 rounded-full border-2 border-white/30 object-cover" />}
          <div>
            <p className="text-white font-semibold text-sm">{user.name}</p>
            {user.updatedAt && <p className="text-white/40 text-xs">{timeAgo(user.updatedAt)}</p>}
          </div>
          <span className="ml-auto flex items-center gap-1 bg-red-600 text-white text-[10px] px-2.5 py-1 rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />LIVE
          </span>
        </div>

        {/* Bottom */}
        <div>
          <p className="text-white text-3xl font-bold leading-tight mb-1">{user.track}</p>
          <p className="text-white/60 text-base mb-5">{user.artist}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/15" />
            <p className="text-white/30 text-xs tracking-widest uppercase">Tap to listen</p>
            <div className="flex-1 h-px bg-white/15" />
          </div>
        </div>
      </div>
    </Link>
  );
}

type Comment = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_image: string | null;
  user_username: string | null;
  text: string;
  created_at: string;
  like_count: number;
  user_liked: boolean;
};

// ── Share sheet ──────────────────────────────────────────────────────────────
function ShareSheet({ item, onClose }: { item: VibeItem; onClose: () => void }) {
  const profileUrl = `https://zuno.app/u/${item.id}`;
  const text = `"${item.track}" by ${item.artist} — heard on Zuno`;
  const encoded = encodeURIComponent(`${text}\n${profileUrl}`);
  const encodedUrl = encodeURIComponent(profileUrl);
  const encodedText = encodeURIComponent(text);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(profileUrl); } catch { /* ignore */ }
    onClose();
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: item.track, text, url: profileUrl }); } catch { /* ignore */ }
      onClose();
    }
  };

  const SHARE_OPTIONS = [
    { label: "WhatsApp",  emoji: "💬", href: `https://wa.me/?text=${encoded}`, color: "#25D366" },
    { label: "Telegram",  emoji: "✈️", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, color: "#2AABEE" },
    { label: "Twitter",   emoji: "🐦", href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, color: "#1DA1F2" },
    { label: "SMS",       emoji: "💬", href: `sms:?body=${encoded}`, color: "#5AC857" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end"
      onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full bg-zinc-900 border-t border-white/10 rounded-t-3xl p-6 pb-10"
        onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

        {/* Track info */}
        <div className="flex items-center gap-3 mb-6">
          {item.albumImage && <img src={item.albumImage} alt="" className="w-12 h-12 rounded-xl object-cover" />}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{item.track}</p>
            <p className="text-white/50 text-xs truncate">{item.artist}</p>
          </div>
        </div>

        {/* Share grid */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {SHARE_OPTIONS.map((opt) => (
            <a key={opt.label} href={opt.href} target="_blank" rel="noopener noreferrer"
              onClick={onClose}
              className="flex flex-col items-center gap-2 bg-white/5 hover:bg-white/10 rounded-2xl p-3 transition-colors">
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-white/50 text-[11px] text-center">{opt.label}</span>
            </a>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button onClick={nativeShare}
              className="flex items-center justify-center gap-2 bg-white/8 hover:bg-white/15 rounded-2xl p-3 text-white/70 text-sm transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              More
            </button>
          )}
          <button onClick={copyLink}
            className="flex items-center justify-center gap-2 bg-white text-black rounded-2xl p-3 text-sm font-semibold hover:bg-white/90 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy link
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Comment row ──────────────────────────────────────────────────────────────
function CommentRow({ comment: c, isLoggedIn, onLikeToggle, onProfileNavigate }: {
  comment: Comment;
  isLoggedIn: boolean;
  onLikeToggle: (liked: boolean, count: number) => void;
  onProfileNavigate: () => void;
}) {
  const [liked, setLiked] = useState(c.user_liked);
  const [count, setCount] = useState(c.like_count);
  const profileHref = `/u/${c.user_username ?? c.user_id ?? ""}`;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) { window.location.href = "/api/auth/login"; return; }
    const next = !liked;
    const nextCount = count + (next ? 1 : -1);
    setLiked(next);
    setCount(nextCount);
    onLikeToggle(next, nextCount);
    fetch("/api/vibe/comment-like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: c.id }),
    }).catch(() => {});
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onProfileNavigate();
  };

  return (
    <div className="flex items-start gap-3">
      {/* Avatar → profile */}
      <Link href={profileHref} onClick={handleProfileClick} className="shrink-0 mt-0.5">
        {c.user_image ? (
          <img src={c.user_image} alt="" className="w-8 h-8 rounded-full object-cover border border-white/10" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/10" />
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          {/* Name → profile */}
          <Link href={profileHref} onClick={handleProfileClick}
            className="text-white/70 text-xs font-semibold hover:text-white transition-colors">
            {c.user_name ?? "Someone"}
          </Link>
          <span className="text-white/25 text-[10px]">{timeAgo(c.created_at)}</span>
        </div>
        <p className="text-white/90 text-sm mt-0.5 leading-relaxed">{c.text}</p>
      </div>

      {/* Like button — always visible */}
      <button onClick={handleLike} className="flex flex-col items-center gap-0.5 shrink-0 pt-1">
        <svg className={`w-4 h-4 transition-colors ${liked ? "text-red-400 fill-red-400" : "text-white/20 fill-none"}`}
          stroke={liked ? "none" : "currentColor"} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        {count > 0 && <span className="text-[10px] font-semibold text-white/30">{count}</span>}
      </button>
    </div>
  );
}

// Module-level cache so comments survive sheet close/reopen and back-navigation
const commentCache = new Map<string, Comment[]>();

// ── Comments sheet ───────────────────────────────────────────────────────────
function CommentsSheet({ vibeId, onClose, isLoggedIn }: { vibeId: string; onClose: (newCount: number) => void; isLoggedIn: boolean }) {
  const [comments, setComments] = useState<Comment[]>(commentCache.get(vibeId) ?? []);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch fresh data (cached data already shown immediately via useState initialiser)
    fetch(`/api/vibe/comments?historyId=${vibeId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const fresh = d.comments ?? [];
          setComments(fresh);
          commentCache.set(vibeId, fresh);
        } else console.error("[CommentsSheet] GET error:", d);
      })
      .catch((e) => console.error("[CommentsSheet] fetch error:", e));
    setTimeout(() => inputRef.current?.focus(), 400);
  }, [vibeId]);

  const scrollToBottom = () => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  };

  const submit = async () => {
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/vibe/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historyId: vibeId, text: input.trim() }),
      });
      const d = await res.json();
      if (d.ok && d.comment) {
        setComments((prev) => {
          const updated = [...prev, { ...d.comment, like_count: 0, user_liked: false } as Comment];
          commentCache.set(vibeId, updated);
          return updated;
        });
        setInput("");
        setTimeout(scrollToBottom, 50);
      } else {
        setSubmitError(d.error ?? "Failed to post. Try again.");
      }
    } catch {
      setSubmitError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end"
      onClick={(e) => { e.stopPropagation(); onClose(comments.length); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full bg-zinc-900 border-t border-white/10 rounded-t-3xl flex flex-col"
        style={{ maxHeight: "75vh" }}
        onClick={(e) => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
          <p className="text-white font-bold text-base">{comments.length} {comments.length === 1 ? "comment" : "comments"}</p>
          <button onClick={() => onClose(comments.length)} className="text-white/40 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comments list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-5 pb-2 flex flex-col gap-4">
          {comments.length === 0 && (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-white/40 text-sm">No comments yet — be the first</p>
            </div>
          )}
          {comments.map((c) => (
            <CommentRow key={c.id} comment={c} isLoggedIn={isLoggedIn}
              onLikeToggle={(liked, count) => {
                setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, user_liked: liked, like_count: count } : x));
              }}
              onProfileNavigate={() => {
                sessionStorage.setItem("zuno_restore_comments", vibeId);
              }}
            />
          ))}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-white/8 px-4 py-3 pb-safe">
          {submitError && (
            <p className="text-red-400 text-xs mb-2 px-1">{submitError}</p>
          )}
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 200))}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Add a comment…"
                className="flex-1 bg-white/8 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
              />
              <button
                onClick={submit}
                disabled={!input.trim() || submitting}
                className="bg-white text-black text-sm font-bold px-4 py-2.5 rounded-full disabled:opacity-30 transition-opacity"
              >
                {submitting ? "…" : "Post"}
              </button>
            </div>
          ) : (
            <a href="/api/auth/login"
              className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-400 text-black font-semibold py-3 rounded-full transition-colors text-sm">
              Connect Spotify to comment
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Vibe Card ────────────────────────────────────────────────────────────────
function VibeCard({ item, onActivate, isPlaying, onTogglePlay, isLoggedIn, restoreComments, myId }: {
  item: VibeItem;
  onActivate: (trackId: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  isLoggedIn: boolean;
  restoreComments: boolean;
  myId: string | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [showTapIcon, setShowTapIcon] = useState<"play" | "pause" | null>(null);
  const [likes, setLikes] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const isSelf = myId === item.id;
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;
  const tapIconTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore comment sheet when this prop flips to true (triggered by FeedPage on back-nav)
  useEffect(() => {
    if (restoreComments) setShowComments(true);
  }, [restoreComments]);

  // Fetch like/comment counts + follow status once per card
  useEffect(() => {
    if (!item.vibeId) return;
    fetch(`/api/vibe/like?historyId=${item.vibeId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) { setLikes(d.count); setUserLiked(d.liked); } })
      .catch(() => {});
    fetch(`/api/vibe/comments?historyId=${item.vibeId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setCommentCount(d.count); })
      .catch(() => {});
    if (isLoggedIn && !isSelf) {
      fetch(`/api/follow?userId=${item.id}`)
        .then((r) => r.json())
        .then((d) => { if (d.ok) setIsFollowing(d.isFollowing); })
        .catch(() => {});
    }
  }, [item.vibeId, item.id, isLoggedIn, isSelf]);


  // IntersectionObserver
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.intersectionRatio >= 0.75;
        setIsActive(visible);
        if (visible) onActivateRef.current(item.trackId);
      },
      { threshold: [0, 0.75] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [item.trackId]);

  const handleTap = () => {
    onTogglePlay();
    const icon = isPlaying ? "pause" : "play";
    setShowTapIcon(icon);
    if (tapIconTimer.current) clearTimeout(tapIconTimer.current);
    tapIconTimer.current = setTimeout(() => setShowTapIcon(null), 800);
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) { window.location.href = "/api/auth/login"; return; }
    if (followLoading) return;
    setFollowLoading(true);
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: item.id }),
      });
    } catch { setIsFollowing(!next); }
    finally { setFollowLoading(false); }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn) {
      setShowLoginPrompt(true);
      setTimeout(() => setShowLoginPrompt(false), 3000);
      return;
    }
    const newLiked = !userLiked;
    setUserLiked(newLiked);
    setLikes((n) => n + (newLiked ? 1 : -1));
    fetch("/api/vibe/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ historyId: item.vibeId }),
    }).catch(() => {});
  };

  return (
    <>
      <div
        ref={cardRef}
        className="relative w-full flex-shrink-0 overflow-hidden"
        style={{ height: "calc(100svh - 112px)" }}
      >
        {/* Background */}
        {item.albumImage ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${item.albumImage})` }} />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
        )}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/40" />

        {/* Tap-to-play/pause zone — whole card except sidebar */}
        <div
          className="absolute inset-0 z-10"
          style={{ right: 72 }} // leave space for right sidebar
          onClick={handleTap}
        />

        {/* Tap icon flash */}
        {showTapIcon && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
            style={{ right: 72 }}>
            <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center animate-fade-out">
              {showTapIcon === "pause" ? (
                <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-9 h-9 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Content layer */}
        <div className="absolute inset-0 z-10 flex flex-col justify-between p-5 pointer-events-none">
          {/* Top — user info */}
          <Link href={`/u/${item.id}`} className="flex items-center gap-3 pointer-events-auto self-start">
            {item.userImage && <img src={item.userImage} alt="" className="w-10 h-10 rounded-full border-2 border-white/30 object-cover" />}
            <div>
              <p className="text-white font-semibold text-sm">{item.userName}</p>
              <p className="text-white/40 text-xs">{timeAgo(item.playedAt)}</p>
            </div>
          </Link>

          {/* Bottom — track info */}
          <div className="pr-16">
            <p className="text-white text-3xl font-bold leading-tight mb-1 drop-shadow-lg">{item.track}</p>
            <p className="text-white/60 text-base mb-2">{item.artist}</p>
            {item.repeatCount > 1 && (
              <p className="text-white/40 text-xs mb-3">
                repeated {item.repeatCount} times
              </p>
            )}

            {/* Playback indicator */}
            {isActive && isPlaying ? (
              <div className="flex items-center gap-2.5">
                <div className="flex items-end gap-[3px]" style={{ height: 18 }}>
                  {[5, 9, 6, 12, 8, 14, 10, 7, 5].map((h, i) => (
                    <div key={i} style={{
                      width: 3, height: h,
                      background: "rgba(255,255,255,0.85)",
                      borderRadius: 2,
                      animation: `vibeWave ${0.7 + (i % 3) * 0.2}s ease-in-out infinite`,
                      animationDelay: `${i * 0.08}s`,
                      transformOrigin: "bottom",
                    }} />
                  ))}
                </div>
                <span className="text-white/50 text-xs tracking-wide">playing</span>
              </div>
            ) : (
              <div style={{ height: 18 }} />
            )}
          </div>
        </div>

        {/* Login prompt toast */}
        {showLoginPrompt && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/80 backdrop-blur-md border border-white/15 rounded-full px-4 py-2.5 shadow-xl">
            <span className="text-white/80 text-sm whitespace-nowrap">Connect Spotify to like</span>
            <a
              href="/api/auth/login"
              onClick={(e) => e.stopPropagation()}
              className="bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-3 py-1 rounded-full transition-colors whitespace-nowrap"
            >
              Connect
            </a>
          </div>
        )}

        {/* Right sidebar — TikTok-style action buttons */}
        <div className="absolute right-3 bottom-8 z-20 flex flex-col items-center gap-5">
          {/* Like */}
          <button onClick={handleLike} className="flex flex-col items-center gap-1">
            <div className={`w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center transition-transform active:scale-125 ${userLiked ? "border-red-500/50" : ""}`}>
              <svg className={`w-5 h-5 transition-colors ${userLiked ? "text-red-400 fill-red-400" : "text-white fill-none"}`}
                stroke={userLiked ? "none" : "currentColor"} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <span className="text-white/70 text-[11px] font-semibold">{likes > 0 ? likes : ""}</span>
          </button>

          {/* Comments */}
          <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-white/70 text-[11px] font-semibold">{commentCount > 0 ? commentCount : ""}</span>
          </button>

          {/* Share */}
          <button onClick={(e) => { e.stopPropagation(); setShowShare(true); }}
            className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
          </button>

          {/* Follow */}
          {!isSelf && (
            <button onClick={handleFollow}
              className="flex flex-col items-center gap-1">
              <div className={`w-11 h-11 rounded-full backdrop-blur-sm border flex items-center justify-center transition-colors ${
                isFollowing
                  ? "bg-white/20 border-white/30"
                  : "bg-black/30 border-white/10"
              }`}>
                {isFollowing ? (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </div>
              <span className="text-white/50 text-[11px] font-semibold">
                {isFollowing ? "Following" : "Follow"}
              </span>
            </button>
          )}

          {/* Open in Spotify */}
          <a href={item.trackUrl ?? `https://open.spotify.com/search/${encodeURIComponent(item.track)}`}
            target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </div>
          </a>
        </div>
      </div>

      {/* Sheets — rendered outside overflow:hidden via fixed positioning */}
      {showShare && <ShareSheet item={item} onClose={() => setShowShare(false)} />}
      {showComments && (
        <CommentsSheet
          vibeId={item.vibeId}
          onClose={(newCount) => { setShowComments(false); setCommentCount(newCount); }}
          isLoggedIn={isLoggedIn}
        />
      )}
    </>
  );
}

function TrendingRow({ track, rank }: { track: TrendingTrack; rank: number }) {
  return (
    <a
      href={track.track_url ?? `https://open.spotify.com/search/${encodeURIComponent(track.track_name)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors group"
    >
      <span className="text-white/20 text-sm font-bold w-5 text-center shrink-0">{rank}</span>
      {track.album_image ? (
        <img src={track.album_image} alt={track.track_name} className="w-11 h-11 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-lg bg-white/10 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">{track.track_name}</p>
        <p className="text-white/40 text-xs truncate">{track.artist}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-white/60 text-xs font-semibold">{track.count}</p>
        <p className="text-white/20 text-[10px]">{track.count === 1 ? "play" : "plays"}</p>
      </div>
    </a>
  );
}

// ── Discover Card ─────────────────────────────────────────────────────────────
function DiscoverCard({ track, sessionId, audioUnlocked, onUnlock }: { track: DiscoverTrack; sessionId: string; audioUnlocked: boolean; onUnlock: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enterTimeRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const logInteraction = (action: string, timeSpentMs = 0) => {
    fetch("/api/discover/interact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, trackId: track.trackId, artist: track.artist, action, timeSpentMs }),
    }).catch(() => {});
  };

  // Intersection observer — auto-play preview + lazy-load YouTube video
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.intersectionRatio >= 0.75;
        setIsActive(visible);
        if (visible) {
          enterTimeRef.current = Date.now();
          logInteraction("view");
          // Auto-play preview muted (browsers allow muted autoplay)
          if (track.previewUrl && audioRef.current) {
            audioRef.current.muted = !audioUnlocked;
            setIsMuted(!audioUnlocked);
            audioRef.current.play()
              .then(() => setIsPlaying(true))
              .catch(() => setIsPlaying(false));
          }
          // Lazy-load YouTube video only when this card is active
          if (!videoId) {
            fetch(`/api/discover/youtube?track=${encodeURIComponent(track.name)}&artist=${encodeURIComponent(track.artist)}`)
              .then(r => r.json())
              .then(d => { if (d.videoId) { setVideoId(d.videoId); setShowVideo(true); } })
              .catch(() => {});
          } else {
            setShowVideo(true);
          }
        } else {
          if (enterTimeRef.current) {
            logInteraction("view_end", Date.now() - enterTimeRef.current);
            enterTimeRef.current = null;
          }
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
          setShowVideo(false);
        }
      },
      { threshold: [0, 0.75] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.trackId, videoId]);

  // Unmute when audio gets unlocked globally
  useEffect(() => {
    if (audioUnlocked && audioRef.current) {
      audioRef.current.muted = false;
      setIsMuted(false);
    }
  }, [audioUnlocked]);

  // Init audio when track mounts (muted by default for autoplay policy)
  useEffect(() => {
    if (!track.previewUrl) return;
    const audio = new Audio(track.previewUrl);
    audio.muted = true; // start muted — unmuted on first user tap
    audio.addEventListener("timeupdate", () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    });
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setProgress(0);
    });
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.trackId]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !liked;
    setLiked(next);
    logInteraction(next ? "like" : "unlike");
  };

  const handleOpenSpotify = (e: React.MouseEvent) => {
    e.stopPropagation();
    logInteraction("open_spotify");
    window.open(track.spotifyUrl, "_blank");
  };

  return (
    <div
      ref={cardRef}
      className="relative flex-shrink-0 overflow-hidden bg-black"
      style={{ height: "calc(100svh - 112px)", width: "100%" }}
    >
      {/* YouTube video background — muted, loops, shows when active + videoId available */}
      {videoId && showVideo && (
        <iframe
          key={videoId}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-125"
          style={{ border: "none", filter: "brightness(0.4)" }}
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&modestbranding=1`}
          allow="autoplay"
        />
      )}

      {/* Blurred album art background (fallback when no video) */}
      {track.albumImage && (!videoId || !showVideo) && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center scale-110"
            style={{ backgroundImage: `url(${track.albumImage})`, filter: "blur(40px) brightness(0.35)" }}
          />
          <div className="absolute inset-0 bg-black/20" />
        </>
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 z-10" />

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 z-20">
        {/* Album art — shown always, smaller when video plays */}
        {track.albumImage && (
          <div
            className={`rounded-2xl shadow-2xl overflow-hidden mb-6 cursor-pointer transition-all duration-500 ${videoId && showVideo ? "w-32 h-32 opacity-80" : "w-56 h-56"}`}
            onClick={togglePlay}
          >
            <img src={track.albumImage} alt={track.name} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Track info */}
        <p className="text-white font-bold text-xl text-center mb-1 drop-shadow-lg line-clamp-2">{track.name}</p>
        <p className="text-white/70 text-sm text-center mb-1">{track.artist}</p>
        <p className="text-white/30 text-xs text-center mb-5">{track.album}</p>

        {/* Preview progress bar */}
        {track.previewUrl && (
          <div className="w-48 h-0.5 bg-white/20 rounded-full mb-5 overflow-hidden cursor-pointer" onClick={togglePlay}>
            <div
              className="h-full bg-white/60 rounded-full transition-all duration-300"
              style={{ width: isPlaying ? `${progress}%` : "0%" }}
            />
          </div>
        )}

        {/* Open in Spotify CTA */}
        <button
          onClick={handleOpenSpotify}
          className="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] active:scale-95 text-black font-bold px-6 py-2.5 rounded-full transition-all text-sm shadow-lg"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Open in Spotify
        </button>

        {/* Play/mute controls */}
        {track.previewUrl && (
          <div className="mt-3 flex items-center gap-3">
            {isPlaying && isMuted ? (
              <button
                onClick={() => {
                  onUnlock();
                  if (audioRef.current) { audioRef.current.muted = false; setIsMuted(false); }
                }}
                className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full hover:bg-white/20 transition-all active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                Tap to unmute
              </button>
            ) : (
              <button onClick={togglePlay} className="text-white/30 text-xs flex items-center gap-1.5 hover:text-white/60 transition-colors">
                {isPlaying ? (
                  <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Playing preview</>
                ) : (
                  <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Tap to preview</>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right sidebar */}
      <div className="absolute right-3 bottom-8 z-30 flex flex-col items-center gap-5">
        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <div className={`w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm border flex items-center justify-center transition-transform active:scale-125 ${liked ? "border-red-500/60" : "border-white/10"}`}>
            <svg className={`w-5 h-5 transition-colors ${liked ? "text-red-400 fill-red-400" : "text-white fill-none"}`}
              stroke={liked ? "none" : "currentColor"} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        </button>

        {/* Share */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            logInteraction("share");
            navigator.share?.({ title: track.name, text: `${track.name} — ${track.artist}`, url: track.spotifyUrl })
              .catch(() => navigator.clipboard?.writeText(track.spotifyUrl));
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </div>
        </button>
      </div>

      {/* Discover label */}
      <div className="absolute top-4 left-4 z-30">
        <span className="text-white/30 text-xs font-semibold tracking-widest uppercase">Discover</span>
      </div>

      {/* Explicit badge */}
      {track.explicit && (
        <div className="absolute top-4 right-4 z-30">
          <span className="text-white/30 text-[10px] font-bold border border-white/20 px-1.5 py-0.5 rounded">E</span>
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  const [tab, setTab] = useState<Tab>("discover");
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
  const [vibeItems, setVibeItems] = useState<VibeItem[]>([]);
  const [trending, setTrending] = useState<TrendingTrack[]>([]);
  const [discoverTracks, setDiscoverTracks] = useState<DiscoverTrack[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverLoadingMore, setDiscoverLoadingMore] = useState(false);
  const [discoverPage, setDiscoverPage] = useState(1);
  const discoverSentinelRef = useRef<HTMLDivElement>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioUnlockedRef = useRef(false);
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    const key = "zuno_session_id";
    let id = localStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
    return id;
  });
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [myImage, setMyImage] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [restoreVibeId, setRestoreVibeId] = useState<string | null>(null);

  const vibeScrollRef = useRef<HTMLDivElement>(null);

  // Single Spotify Iframe API controller for Vibe tab — reused across all cards.
  // loadUri() swaps the track (stopping the previous one), then play() starts it.
  const vibeApiRef = useRef<SpotifyIFrameAPI | null>(null);
  const vibeControllerRef = useRef<SpotifyEmbedController | null>(null);
  const vibeContainerRef = useRef<HTMLDivElement>(null);
  const pendingVibeTrackRef = useRef<string | null>(null);

  const [vibeIsPlaying, setVibeIsPlaying] = useState(false);

  const initVibeController = useCallback((api: SpotifyIFrameAPI, trackId: string) => {
    const container = vibeContainerRef.current;
    if (!container) return;
    if (vibeControllerRef.current) {
      try { vibeControllerRef.current.destroy(); } catch { /* ignore */ }
      vibeControllerRef.current = null;
    }
    setVibeIsPlaying(false);
    container.innerHTML = "";
    const target = document.createElement("div");
    container.appendChild(target);
    api.createController(
      target,
      { uri: `spotify:track:${trackId}` },
      (controller) => {
        vibeControllerRef.current = controller;
        controller.addListener("playback_update", (e) => {
          const state = (e as { data: { isPaused: boolean } }).data;
          setVibeIsPlaying(!state.isPaused);
        });
        setTimeout(() => { try { controller.play(); } catch { /* ignore */ } }, 300);
      }
    );
  }, []);

  // Load the Spotify Iframe API script when the vibe tab is opened
  useEffect(() => {
    if (tab !== "vibe") {
      // Pause when leaving vibe tab
      try { vibeControllerRef.current?.pause(); } catch { /* ignore */ }
      return;
    }
    window.onSpotifyIframeApiReady = (api) => {
      vibeApiRef.current = api;
      window._SpotifyIFrameAPI = api;
      if (pendingVibeTrackRef.current) {
        initVibeController(api, pendingVibeTrackRef.current);
        pendingVibeTrackRef.current = null;
      }
    };
    if (!document.getElementById("spotify-iframe-api")) {
      const script = document.createElement("script");
      script.id = "spotify-iframe-api";
      script.src = "https://open.spotify.com/embed-podcast/iframe-api/v1";
      document.body.appendChild(script);
    } else if (window._SpotifyIFrameAPI) {
      vibeApiRef.current = window._SpotifyIFrameAPI;
    }
  }, [tab, initVibeController]);

  // Called by whichever VibeCard snapped into view
  const playVibePreview = useCallback((trackId: string) => {
    const api = vibeApiRef.current;
    const controller = vibeControllerRef.current;

    if (controller) {
      setVibeIsPlaying(false);
      try {
        controller.loadUri(`spotify:track:${trackId}`);
        setTimeout(() => { try { controller.play(); } catch { /* ignore */ } }, 300);
      } catch { /* ignore */ }
    } else if (api) {
      initVibeController(api, trackId);
    } else {
      pendingVibeTrackRef.current = trackId;
    }
  }, [initVibeController]);

  const toggleVibePlayback = useCallback(() => {
    const controller = vibeControllerRef.current;
    if (!controller) return;
    try {
      if (vibeIsPlaying) { controller.pause(); setVibeIsPlaying(false); }
      else { controller.play(); setVibeIsPlaying(true); }
    } catch { /* ignore */ }
  }, [vibeIsPlaying]);

  useEffect(() => {
    fetch("/api/user").then((r) => r.json()).then((d) => {
      if (d.ok) {
        setIsLoggedIn(true);
        setMyId(d.user.username ?? d.user.spotifyId);
        setMyImage(d.user.image ?? null);
        // Fetch unread notification count
        fetch("/api/notifications").then((r) => r.json()).then((nd) => {
          if (nd.ok) {
            setUnreadCount((nd.notifications ?? []).filter((n: { read: boolean }) => !n.read).length);
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Restore comment sheet after back-navigation (pageshow fires even from bfcache)
  useEffect(() => {
    const check = () => {
      const vibeId = sessionStorage.getItem("zuno_restore_comments");
      if (!vibeId) return;
      sessionStorage.removeItem("zuno_restore_comments");
      setTab("vibe");
      setRestoreVibeId(vibeId);
    };
    check(); // on mount (normal navigation)
    window.addEventListener("pageshow", check); // on bfcache restore
    return () => window.removeEventListener("pageshow", check);
  }, []);

  // When vibeItems load with a pending restoreVibeId: scroll to the right card
  // then clear restoreVibeId (so VibeCard opens the sheet then stops watching).
  useEffect(() => {
    if (!restoreVibeId || vibeItems.length === 0 || tab !== "vibe") return;
    const idx = vibeItems.findIndex((item) => item.vibeId === restoreVibeId);
    if (idx < 0) { setRestoreVibeId(null); return; }

    // rAF ensures the snap container is painted and has a real clientHeight
    const frame = requestAnimationFrame(() => {
      const container = vibeScrollRef.current;
      if (container) {
        container.scrollTop = idx * container.clientHeight;
      }
      // Give VibeCard's useEffect one more frame to open the sheet, then clear
      requestAnimationFrame(() => setRestoreVibeId(null));
    });
    return () => cancelAnimationFrame(frame);
  }, [restoreVibeId, vibeItems, tab]);

  const fetchFeed = useCallback(async () => {
    try {
      if (tab === "discover") {
        // Discover tab has its own loader — skip
        setLoading(false);
        return;
      }
      if (tab === "trending") {
        const res = await fetch("/api/feed?type=trending");
        const data = await res.json();
        if (data.ok) setTrending(data.tracks ?? []);
      } else if (tab === "vibe") {
        const res = await fetch("/api/feed?type=vibe");
        const data = await res.json();
        if (data.ok) setVibeItems(data.items ?? []);
      } else {
        const res = await fetch(`/api/feed?type=${tab}`);
        const data = await res.json();
        if (data.ok) setLiveUsers(data.users ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    fetchFeed();
  }, [fetchFeed]);

  // Load discover tracks when tab is opened
  useEffect(() => {
    if (tab !== "discover") return;
    if (discoverTracks.length > 0) return; // already loaded
    setDiscoverLoading(true);
    fetch(`/api/discover?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setDiscoverTracks(d.tracks ?? []); })
      .catch(() => {})
      .finally(() => setDiscoverLoading(false));
  }, [tab, sessionId, discoverTracks.length]);

  // Load more discover tracks when sentinel enters view — increments page for fresh genres
  const loadMoreDiscover = useCallback(() => {
    if (discoverLoadingMore) return;
    setDiscoverLoadingMore(true);
    const nextPage = discoverPage;
    fetch(`/api/discover?sessionId=${sessionId}&page=${nextPage}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.tracks?.length) {
          setDiscoverTracks((prev) => {
            const existingIds = new Set(prev.map((t) => t.trackId));
            const fresh = (d.tracks as DiscoverTrack[]).filter((t) => !existingIds.has(t.trackId));
            return [...prev, ...fresh];
          });
          setDiscoverPage((p) => p + 1);
        }
      })
      .catch(() => {})
      .finally(() => setDiscoverLoadingMore(false));
  }, [sessionId, discoverLoadingMore, discoverPage]);

  // Sentinel observer — triggers when user is 3 cards from the end
  useEffect(() => {
    const el = discoverSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreDiscover(); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMoreDiscover, discoverTracks.length]);

  // Auto-refresh live tabs every 10s
  useEffect(() => {
    if (tab === "trending" || tab === "vibe" || tab === "discover") return;
    const interval = setInterval(fetchFeed, 10_000);
    return () => clearInterval(interval);
  }, [fetchFeed, tab]);

  const isScrollFeed = tab === "global" || tab === "following" || tab === "vibe";
  const scrollData = tab === "vibe" ? vibeItems : liveUsers;
  const isEmpty = isScrollFeed ? scrollData.length === 0 : (tab === "trending" ? trending.length === 0 : false);

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hidden Spotify Iframe API container for Vibe tab */}
      <div ref={vibeContainerRef} aria-hidden="true"
        style={{ position: "fixed", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none", zIndex: -1 }} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">zuno</h1>
        <div className="flex items-center gap-3">
          {/* Search */}
          <Link href="/search" className="text-white/30 hover:text-white/60 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>

          {isLoggedIn && myId ? (
            <>
              {/* Notifications bell */}
              <Link href="/notifications" className="relative text-white/30 hover:text-white/60 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-white text-black text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/settings" className="text-white/30 hover:text-white/60 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
              {myImage && (
                <Link href={`/u/${myId}`}>
                  <img src={myImage} alt="You" className="w-8 h-8 rounded-full border-2 border-white/20 object-cover hover:border-white/60 transition-colors" />
                </Link>
              )}
            </>
          ) : (
            <a href="/api/auth/login" className="bg-green-500 hover:bg-green-400 text-black text-sm font-semibold px-4 py-1.5 rounded-full transition-colors">
              Connect Spotify
            </a>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none border-b border-white/5">
        {(["discover", "global", "vibe", "following", "trending"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
              tab === t ? "bg-white text-black" : "bg-white/8 text-white/50 hover:bg-white/15 hover:text-white"
            }`}
          >
            {t === "discover" ? "✦ Discover" : t === "global" ? "🔴 Live" : t === "vibe" ? "✨ Vibe" : t === "following" ? "Following" : "🔥 Trending"}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "discover" ? (
        discoverLoading ? (
          <div className="flex items-center justify-center" style={{ height: "calc(100svh - 112px)" }}>
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        ) : discoverTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-6" style={{ height: "calc(100svh - 112px)" }}>
            <div className="text-5xl mb-4">✦</div>
            <p className="text-white/60 text-lg font-semibold mb-1">Nothing to discover yet</p>
            <p className="text-white/30 text-sm">Check back soon</p>
          </div>
        ) : (
          <div className="relative flex flex-col overflow-y-auto snap-y snap-mandatory" style={{ height: "calc(100svh - 112px)" }}>
            {/* Floating unmute pill — shown until user taps it */}
            {!audioUnlocked && (
              <button
                className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/70 backdrop-blur-sm border border-white/20 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg"
                onClick={() => { setAudioUnlocked(true); audioUnlockedRef.current = true; }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                Tap to play with sound
              </button>
            )}
            {discoverTracks.map((track, i) => (
              <div key={`${track.trackId}-${i}`} className="snap-start snap-always flex-shrink-0">
                <DiscoverCard
                  track={track}
                  sessionId={sessionId}
                  audioUnlocked={audioUnlocked}
                  onUnlock={() => { setAudioUnlocked(true); audioUnlockedRef.current = true; }}
                />
              </div>
            ))}
            {/* Sentinel — placed 3 cards from end by being after the list */}
            <div ref={discoverSentinelRef} className="snap-start snap-always flex-shrink-0 flex items-center justify-center" style={{ height: "calc(100svh - 112px)", width: "100%" }}>
              {discoverLoadingMore ? (
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              ) : (
                <p className="text-white/20 text-sm">Loading more...</p>
              )}
            </div>
          </div>
        )
      ) : loading ? (
        <div className="flex items-center justify-center" style={{ height: "calc(100svh - 112px)" }}>
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      ) : isEmpty ? (
        <EmptyState tab={tab} isLoggedIn={isLoggedIn} />
      ) : tab === "trending" ? (
        <div className="px-4 pt-4 pb-12">
          <div className="max-w-lg mx-auto">
            <p className="text-white/20 text-xs px-4 mb-2">Most played on Zuno in the last 24h</p>
            {trending.map((t, i) => <TrendingRow key={t.track_id} track={t} rank={i + 1} />)}
          </div>
        </div>
      ) : tab === "vibe" ? (
        <div ref={vibeScrollRef} className="flex flex-col overflow-y-auto snap-y snap-mandatory" style={{ height: "calc(100svh - 112px)" }}>
          {vibeItems.map((item, i) => (
            <div key={`${item.vibeId || item.id}-${i}`} className="snap-start snap-always flex-shrink-0">
              <VibeCard
                item={item}
                onActivate={playVibePreview}
                isPlaying={vibeIsPlaying}
                onTogglePlay={toggleVibePlayback}
                isLoggedIn={isLoggedIn}
                restoreComments={item.vibeId === restoreVibeId}
                myId={myId}
              />
            </div>
          ))}
          <style>{`
            @keyframes vibeWave {
              0%, 100% { transform: scaleY(0.3); opacity: 0.45; }
              50%       { transform: scaleY(1);   opacity: 1;    }
            }
          `}</style>
        </div>
      ) : (
        <div className="flex flex-col overflow-y-auto snap-y snap-mandatory" style={{ height: "calc(100svh - 112px)" }}>
          {liveUsers.map((u) => (
            <div key={u.spotifyId} className="snap-start snap-always flex-shrink-0">
              <LiveCard user={u} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState({ tab, isLoggedIn }: { tab: Tab; isLoggedIn: boolean }) {
  const [suggested, setSuggested] = useState<{ id: string; name: string; image: string | null; username: string | null }[]>([]);

  useEffect(() => {
    if (tab === "following") {
      fetch("/api/search?q=a") // broad search for real users
        .then((r) => r.json())
        .then((d) => { if (d.ok) setSuggested((d.users ?? []).slice(0, 6)); })
        .catch(() => {});
    }
  }, [tab]);

  return (
    <div className="flex flex-col items-center justify-center text-center px-6" style={{ height: "calc(100svh - 112px)" }}>
      <div className="text-5xl mb-4">{tab === "vibe" ? "✨" : tab === "following" ? "👥" : tab === "trending" ? "🔥" : "🎵"}</div>
      {tab === "global" && <>
        <p className="text-white/60 text-lg font-semibold mb-1">No one&apos;s live right now</p>
        <p className="text-white/30 text-sm mb-6">Be the first to share your vibe</p>
        {!isLoggedIn && <a href="/api/auth/login" className="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-2.5 rounded-full transition-colors">Connect Spotify</a>}
      </>}
      {tab === "vibe" && <>
        <p className="text-white/60 text-lg font-semibold mb-1">Nothing yet</p>
        <p className="text-white/30 text-sm">Recent plays will show up here</p>
      </>}
      {tab === "following" && (
        <>
          <p className="text-white/60 text-lg font-semibold mb-1">No one you follow is live</p>
          <p className="text-white/30 text-sm mb-6">
            {isLoggedIn ? "Find people to follow" : "Connect Spotify to follow people"}
          </p>
          {!isLoggedIn && (
            <a href="/api/auth/login" className="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-2.5 rounded-full mb-6 transition-colors">
              Connect Spotify
            </a>
          )}
          {suggested.length > 0 && (
            <div className="w-full max-w-sm">
              <p className="text-white/20 text-xs uppercase tracking-widest mb-3">People on Zuno</p>
              <div className="flex flex-col gap-1">
                {suggested.map((u) => (
                  <Link key={u.id} href={`/u/${u.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left">
                    {u.image ? (
                      <img src={u.image} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm font-medium truncate">{u.name}</p>
                      {u.username && <p className="text-white/30 text-xs">@{u.username}</p>}
                    </div>
                    <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
              <Link href="/search" className="mt-4 block text-center text-white/30 hover:text-white/60 text-sm transition-colors">
                Search for more →
              </Link>
            </div>
          )}
        </>
      )}
      {tab === "trending" && <>
        <p className="text-white/60 text-lg font-semibold mb-1">Not enough data yet</p>
        <p className="text-white/30 text-sm">Trending tracks appear once people start listening</p>
      </>}
    </div>
  );
}
