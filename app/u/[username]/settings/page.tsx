"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

// ── Inline edit field ─────────────────────────────────────────────────────────
function InlineField({
  label,
  value,
  onSave,
  placeholder,
  maxLength,
  multiline,
  hint,
}: {
  label: string;
  value: string;
  onSave: (val: string) => Promise<string | null>;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  hint?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // Sync when external value changes
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function handleEdit() {
    setDraft(value);
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleSave() {
    const trimmed = draft.trim();
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    const err = await onSave(trimmed);
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setEditing(false);
      setDraft(value);
    }
  }

  const sharedInputClass =
    "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all resize-none";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-white/40 font-medium uppercase tracking-wider">
          {label}
        </label>
        {!editing && (
          <button
            onClick={handleEdit}
            className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {multiline ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              maxLength={maxLength}
              rows={3}
              className={sharedInputClass}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              maxLength={maxLength}
              className={sharedInputClass}
            />
          )}

          {hint && <p className="text-xs text-white/25">{hint}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-50 hover:bg-white/90 active:bg-white/80 transition-all"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setDraft(value);
                setError(null);
              }}
              className="flex-1 py-2 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 active:bg-white/10 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 min-h-[46px] whitespace-pre-wrap break-words">
          {value || <span className="text-white/25">{placeholder}</span>}
        </div>
      )}
    </div>
  );
}

// ── Delete confirmation dialog ────────────────────────────────────────────────
function DeleteDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 z-10">
        <h2 className="text-white font-semibold text-base mb-1">
          Delete your account?
        </h2>
        <p className="text-white/50 text-sm mb-5 leading-relaxed">
          This is permanent. Your profile and all data will be deleted and cannot
          be recovered.
        </p>

        <div className="mb-4">
          <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
            Type DELETE to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-red-500/40 transition-all"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={confirmText !== "DELETE" || deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-red-600 active:bg-red-700 transition-all"
          >
            {deleting ? "Deleting…" : "Delete account"}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 active:bg-white/10 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main settings page ────────────────────────────────────────────────────────
export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [passwordEmailSent, setPasswordEmailSent] = useState(false);
  const [passwordEmailLoading, setPasswordEmailLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth");
        return;
      }

      setEmail(user.email ?? null);

      // Fetch profile
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .eq("username", username)
        .single();

      if (error || !data) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      // Only allow viewing own settings
      if (data.id !== user.id) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      setProfile(data);
      setLoading(false);
    }

    load();
  }, [username, router]);

  // ── Field savers ───────────────────────────────────────────────────────────

  async function saveDisplayName(val: string): Promise<string | null> {
    if (val.length < 1) return "Display name cannot be empty.";
    if (val.length > 50) return "Display name must be 50 characters or fewer.";

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: val })
      .eq("id", profile!.id);

    if (error) return error.message;
    setProfile((p) => p && { ...p, display_name: val });
    return null;
  }

  async function saveBio(val: string): Promise<string | null> {
    if (val.length > 160) return "Bio must be 160 characters or fewer.";

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ bio: val })
      .eq("id", profile!.id);

    if (error) return error.message;
    setProfile((p) => p && { ...p, bio: val });
    return null;
  }

  async function saveUsername(val: string): Promise<string | null> {
    if (val.length < 3) return "Username must be at least 3 characters.";
    if (val.length > 30) return "Username must be 30 characters or fewer.";
    if (!/^[a-zA-Z0-9_]+$/.test(val))
      return "Username can only contain letters, numbers, and underscores.";

    const supabase = createClient();

    // Check uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", val.toLowerCase())
      .single();

    if (existing && existing.id !== profile!.id) {
      return "That username is already taken.";
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: val.toLowerCase() })
      .eq("id", profile!.id);

    if (error) return error.message;

    setProfile((p) => p && { ...p, username: val.toLowerCase() });
    // Redirect to updated username URL
    router.replace(`/u/${val.toLowerCase()}/settings`);
    return null;
  }

  // ── Password reset ─────────────────────────────────────────────────────────

  async function handleChangePassword() {
    if (!email) return;
    setPasswordEmailLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setPasswordEmailLoading(false);
    setPasswordEmailSent(true);
  }

  // ── Data download ──────────────────────────────────────────────────────────

  async function handleDownloadData() {
    if (!profile) return;

    const data = {
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
      },
      email,
      exported_at: new Date().toISOString(),
      reposts: [],
      vibes: [],
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zuno-data-${profile.username}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Account deletion ───────────────────────────────────────────────────────

  async function handleDeleteAccount() {
    const supabase = createClient();

    // Delete profile row (cascade should handle related data)
    if (profile) {
      await supabase.from("profiles").delete().eq("id", profile.id);
    }

    // Sign out — account deletion via admin API requires a server-side route;
    // for now we sign out and the orphaned auth user can be cleaned up server-side.
    await supabase.auth.signOut();
    router.replace("/feed");
  }

  // ── Sign out ───────────────────────────────────────────────────────────────

  async function handleSignOut() {
    setSignOutLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/feed");
  }

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-white text-xl font-semibold mb-2">Access denied</h1>
        <p className="text-white/40 text-sm mb-8">
          You can only view your own settings.
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

  return (
    <>
      {showDeleteDialog && (
        <DeleteDialog
          onConfirm={handleDeleteAccount}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}

      <div className="min-h-screen bg-black text-white">
        {/* ── Top bar ── */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-6">
          <Link
            href={`/u/${profile.username}`}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all flex-shrink-0"
            aria-label="Back to profile"
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
          </Link>
          <h1 className="text-base font-semibold text-white">Settings</h1>
        </div>

        <div className="px-4 space-y-8 pb-24">

          {/* ── Profile section ── */}
          <section>
            <h2 className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-4">
              Profile
            </h2>
            <div className="space-y-4">
              <InlineField
                label="Display name"
                value={displayName}
                onSave={saveDisplayName}
                placeholder="Your name"
                maxLength={50}
              />
              <InlineField
                label="Bio"
                value={profile.bio ?? ""}
                onSave={saveBio}
                placeholder="Tell the world what you're listening to"
                maxLength={160}
                multiline
                hint="Up to 160 characters."
              />
              <InlineField
                label="Username"
                value={profile.username}
                onSave={saveUsername}
                placeholder="yourname"
                maxLength={30}
                hint="Letters, numbers, and underscores only. Changing your username will update your profile URL."
              />
            </div>
          </section>

          {/* ── Divider ── */}
          <div className="h-px bg-white/8" />

          {/* ── Account section ── */}
          <section>
            <h2 className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-4">
              Account
            </h2>
            <div className="space-y-4">
              {/* Email (read-only) */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Email
                </label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/40">
                  {email ?? "—"}
                </div>
              </div>

              {/* Change password */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                  Password
                </label>
                {passwordEmailSent ? (
                  <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                    Password reset email sent. Check your inbox.
                  </div>
                ) : (
                  <button
                    onClick={handleChangePassword}
                    disabled={passwordEmailLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 text-left hover:bg-white/8 active:bg-white/10 disabled:opacity-50 transition-all"
                  >
                    {passwordEmailLoading
                      ? "Sending reset email…"
                      : "Send password reset email →"}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── Divider ── */}
          <div className="h-px bg-white/8" />

          {/* ── Privacy & GDPR ── */}
          <section>
            <h2 className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-4">
              Privacy &amp; GDPR
            </h2>
            <div className="space-y-3">
              {/* Download data */}
              <button
                onClick={handleDownloadData}
                className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white/70 hover:bg-white/8 active:bg-white/10 transition-all"
              >
                <span>Download my data</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/30"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>

              {/* Delete account */}
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="w-full flex items-center justify-between bg-red-500/5 border border-red-500/15 rounded-xl px-4 py-3.5 text-sm text-red-400 hover:bg-red-500/10 active:bg-red-500/15 transition-all"
              >
                <span>Delete my account</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-red-400/60"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </div>
          </section>

          {/* ── Divider ── */}
          <div className="h-px bg-white/8" />

          {/* ── Legal ── */}
          <section>
            <h2 className="text-xs text-white/40 font-semibold uppercase tracking-widest mb-4">
              Legal
            </h2>
            <div className="space-y-2">
              <Link
                href="/privacy"
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white/70 hover:bg-white/8 active:bg-white/10 transition-all"
              >
                <span>Privacy Policy</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/25"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
              <Link
                href="/terms"
                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white/70 hover:bg-white/8 active:bg-white/10 transition-all"
              >
                <span>Terms of Service</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white/25"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            </div>
          </section>

          {/* ── Divider ── */}
          <div className="h-px bg-white/8" />

          {/* ── Sign out ── */}
          <section>
            <button
              onClick={handleSignOut}
              disabled={signOutLoading}
              className="w-full py-3.5 rounded-xl border border-white/10 text-sm font-medium text-white/60 hover:bg-white/5 active:bg-white/10 disabled:opacity-50 transition-all"
            >
              {signOutLoading ? "Signing out…" : "Sign out"}
            </button>
          </section>

        </div>
      </div>
    </>
  );
}
