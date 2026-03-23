"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function EmbedSection({ user }: { user: UserSettings }) {
  const slug = user.username ?? user.spotify_id;
  const embedUrl = `https://zuno.app/embed/${slug}`;
  const iframeCode = `<iframe src="${embedUrl}" width="320" height="76" frameborder="0" scrolling="no" style="border:none;border-radius:16px;overflow:hidden;"></iframe>`;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt("Copy your embed code:", iframeCode);
    }
  }, [iframeCode]);

  return (
    <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-1">Embed Widget</h2>
      <p className="text-white/30 text-xs mb-4">Drop this on your website, Linktree, or any page to show what you&apos;re playing live.</p>

      {/* Preview */}
      <div className="bg-zinc-900 rounded-xl p-3 mb-3 border border-white/5">
        <iframe
          src={`http://localhost:3000/embed/${slug}`}
          width="100%"
          height="76"
          frameBorder="0"
          scrolling="no"
          className="rounded-xl block"
        />
      </div>

      {/* Code box */}
      <div className="relative">
        <pre className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-white/40 font-mono overflow-x-auto scrollbar-none whitespace-pre-wrap break-all leading-relaxed">
          {iframeCode}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold px-3 py-1 rounded-lg transition-colors"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </section>
  );
}

type UserSettings = {
  spotify_id: string;
  display_name: string;
  username: string | null;
  image: string | null;
  bio: string | null;
  ghost_mode: boolean;
  profile_link: string | null;
  show_last_active: boolean;
  show_top_stats: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile link
  const [profileLink, setProfileLink] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkMsg, setLinkMsg] = useState("");

  // Bio
  const [bio, setBio] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioMsg, setBioMsg] = useState("");

  // Username
  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState("");

  // Ghost mode
  const [ghostMode, setGhostMode] = useState(false);
  const [ghostSaving, setGhostSaving] = useState(false);

  // Last active
  const [showLastActive, setShowLastActive] = useState(false);
  const [lastActiveSaving, setLastActiveSaving] = useState(false);

  // Top stats
  const [showTopStats, setShowTopStats] = useState(true);
  const [topStatsSaving, setTopStatsSaving] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { router.replace("/"); return; }
        setUser(d.user);
        setBio(d.user.bio ?? "");
        setProfileLink(d.user.profile_link ?? "");
        setUsername(d.user.username ?? "");
        setGhostMode(d.user.ghost_mode ?? false);
        setShowLastActive(d.user.show_last_active ?? false);
        setShowTopStats(d.user.show_top_stats ?? true);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const saveLink = async () => {
    setLinkSaving(true);
    setLinkMsg("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_link: profileLink }),
    });
    const d = await res.json();
    setLinkMsg(d.ok ? "Saved ✓" : (d.message ?? "Error"));
    setLinkSaving(false);
    setTimeout(() => setLinkMsg(""), 2500);
  };

  const saveBio = async () => {
    setBioSaving(true);
    setBioMsg("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio }),
    });
    const d = await res.json();
    setBioMsg(d.ok ? "Saved ✓" : (d.message ?? "Error"));
    setBioSaving(false);
    setTimeout(() => setBioMsg(""), 2500);
  };

  const saveUsername = async () => {
    setUsernameSaving(true);
    setUsernameMsg("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const d = await res.json();
    if (d.ok) {
      setUsernameMsg("Saved ✓");
      setUser((u) => u ? { ...u, username } : u);
    } else {
      setUsernameMsg(d.message ?? "Error");
    }
    setUsernameSaving(false);
    setTimeout(() => setUsernameMsg(""), 2500);
  };

  const toggleGhost = async () => {
    setGhostSaving(true);
    const res = await fetch("/api/privacy", { method: "POST" });
    const d = await res.json();
    if (d.ok) setGhostMode(d.ghostMode);
    setGhostSaving(false);
  };

  const toggleLastActive = async () => {
    const next = !showLastActive;
    setShowLastActive(next);
    setLastActiveSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_last_active: next }),
    }).catch(() => setShowLastActive(!next));
    setLastActiveSaving(false);
  };

  const toggleTopStats = async () => {
    const next = !showTopStats;
    setShowTopStats(next);
    setTopStatsSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_top_stats: next }),
    }).catch(() => setShowTopStats(!next));
    setTopStatsSaving(false);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    await fetch("/api/settings", { method: "DELETE" });
    router.replace("/");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/30 animate-pulse">Loading…</p>
      </main>
    );
  }

  if (!user) return null;

  const profileUrl = `/u/${user.username ?? user.spotify_id}`;

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-5 py-4 flex items-center gap-4">
        <Link href={profileUrl} className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <h1 className="text-lg font-bold">Settings</h1>
      </header>

      <div className="max-w-lg mx-auto px-5 py-8 flex flex-col gap-6">

        {/* Profile preview */}
        <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-4 border border-white/10">
          {user.image && (
            <img src={user.image} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white/20" />
          )}
          <div>
            <p className="font-semibold">{user.display_name}</p>
            <p className="text-white/40 text-sm">@{user.username ?? user.spotify_id}</p>
          </div>
          <Link href={profileUrl} className="ml-auto text-xs text-white/40 hover:text-white transition-colors">
            View profile →
          </Link>
        </div>

        {/* Bio */}
        <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Bio</h2>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 160))}
            placeholder="Trap music all day 🎧"
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-white/20 text-xs">{bio.length}/160</span>
            <div className="flex items-center gap-3">
              {bioMsg && <span className={`text-xs ${bioMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{bioMsg}</span>}
              <button
                onClick={saveBio}
                disabled={bioSaving}
                className="bg-white text-black text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-white/90 transition disabled:opacity-50"
              >
                {bioSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </section>

        {/* Profile Link */}
        <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Link</h2>
          <div className="flex gap-2">
            <input
              type="url"
              value={profileLink}
              onChange={(e) => { setProfileLink(e.target.value); setLinkMsg(""); }}
              placeholder="https://instagram.com/yourname"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
            />
            <button
              onClick={saveLink}
              disabled={linkSaving}
              className="bg-white text-black text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/90 transition disabled:opacity-30"
            >
              {linkSaving ? "…" : "Save"}
            </button>
          </div>
          {linkMsg && <p className={`text-xs mt-2 ${linkMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{linkMsg}</p>}
          <p className="text-white/20 text-xs mt-2">Shows as a button on your profile — Instagram, YouTube, website, anything</p>
        </section>

        {/* Username */}
        <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Username</h2>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                  setUsernameMsg("");
                }}
                maxLength={20}
                placeholder="yourname"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-7 pr-4 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-white/30"
              />
            </div>
            <button
              onClick={saveUsername}
              disabled={usernameSaving || !username || username === user.username}
              className="bg-white text-black text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-white/90 transition disabled:opacity-30"
            >
              {usernameSaving ? "…" : "Save"}
            </button>
          </div>
          {usernameMsg && (
            <p className={`text-xs mt-2 ${usernameMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>
              {usernameMsg}
            </p>
          )}
          <p className="text-white/20 text-xs mt-2">Your profile: zuno.app/u/{username || "yourname"}</p>
        </section>

        {/* Privacy */}
        <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Privacy</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">👻 Ghost Mode</p>
              <p className="text-white/40 text-xs mt-0.5">Hide from the feed and appear offline to everyone</p>
            </div>
            <button
              onClick={toggleGhost}
              disabled={ghostSaving}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${ghostMode ? "bg-white" : "bg-white/20"}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${ghostMode ? "left-7 bg-black" : "left-1 bg-white"}`} />
            </button>
          </div>

          <div className="border-t border-white/8 mt-4 pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">🕐 Show last active</p>
              <p className="text-white/40 text-xs mt-0.5">Let others see when you were last seen on Zuno</p>
            </div>
            <button
              onClick={toggleLastActive}
              disabled={lastActiveSaving}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${showLastActive ? "bg-white" : "bg-white/20"}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${showLastActive ? "left-7 bg-black" : "left-1 bg-white"}`} />
            </button>
          </div>

          <div className="border-t border-white/8 mt-4 pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">📊 Show top song & artist</p>
              <p className="text-white/40 text-xs mt-0.5">Display your top played song and favourite artist on your profile</p>
            </div>
            <button
              onClick={toggleTopStats}
              disabled={topStatsSaving}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${showTopStats ? "bg-white" : "bg-white/20"}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${showTopStats ? "left-7 bg-black" : "left-1 bg-white"}`} />
            </button>
          </div>
        </section>

        {/* Account */}
        <section className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Account</h2>
          <a
            href="/api/auth/login"
            className="flex items-center justify-between py-3 border-b border-white/5 hover:text-white/60 transition-colors text-sm text-white/80"
          >
            <span>Reconnect Spotify</span>
            <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
          <Link
            href={profileUrl}
            className="flex items-center justify-between py-3 border-b border-white/5 hover:text-white/60 transition-colors text-sm text-white/80"
          >
            <span>View my profile</span>
            <svg className="w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </section>

        {/* Embed widget */}
        <EmbedSection user={user} />

        {/* Danger zone */}
        <section className="bg-red-950/20 rounded-2xl p-5 border border-red-500/20">
          <h2 className="text-sm font-semibold text-red-400/60 uppercase tracking-widest mb-4">Danger Zone</h2>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="text-red-400 text-sm hover:text-red-300 transition-colors"
            >
              Delete my account
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-red-300">This will permanently delete your account, history, and all data. This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={deleteAccount}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-500 text-white text-sm font-semibold px-5 py-2 rounded-full transition disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete everything"}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="text-white/40 hover:text-white text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
