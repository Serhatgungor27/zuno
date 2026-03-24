"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";

type Tab = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sign-in state
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign-up state
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpUsername, setSignUpUsername] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirm, setSignUpConfirm] = useState("");

  // Check if already logged in
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/feed");
      }
    });
  }, [router]);

  // Clear error/success on tab switch
  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
    setSuccess(null);
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail,
      password: signInPassword,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/feed");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (signUpPassword !== signUpConfirm) {
      setError("Passwords do not match.");
      return;
    }

    if (signUpPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (signUpUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(signUpUsername)) {
      setError("Username can only contain letters, numbers, and underscores.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: signUpEmail,
      password: signUpPassword,
      options: {
        data: {
          username: signUpUsername,
        },
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess("Check your email to confirm your account, then sign in.");
    setTab("signin");
    setSignInEmail(signUpEmail);
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/supabase/callback?next=/feed`,
      },
    });

    if (error) {
      setGoogleLoading(false);
      setError(error.message);
    }
    // On success, browser is redirected — no need to setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-12">
      {/* Logo / wordmark */}
      <div className="mb-8 text-center">
        <span className="text-2xl font-bold tracking-tight text-white">zuno</span>
        <p className="mt-1 text-sm text-white/40">see what the world is listening to</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        {/* Tab toggle */}
        <div className="flex bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
          <button
            onClick={() => switchTab("signin")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              tab === "signin"
                ? "bg-white text-black shadow-sm"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => switchTab("signup")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              tab === "signup"
                ? "bg-white text-black shadow-sm"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Error / success banners */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            {success}
          </div>
        )}

        {/* Sign In Form */}
        {tab === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/8 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-semibold py-3 rounded-xl text-sm mt-2 disabled:opacity-50 hover:bg-white/90 active:bg-white/80 transition-all"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {/* Sign Up Form */}
        {tab === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-3">
            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={signUpUsername}
                onChange={(e) => setSignUpUsername(e.target.value.toLowerCase())}
                placeholder="yourname"
                maxLength={30}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                placeholder="min. 8 characters"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5 font-medium uppercase tracking-wider">
                Confirm password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={signUpConfirm}
                onChange={(e) => setSignUpConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-semibold py-3 rounded-xl text-sm mt-2 disabled:opacity-50 hover:bg-white/90 active:bg-white/80 transition-all"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-medium py-3 rounded-xl text-sm border border-white/10 hover:bg-white/90 active:bg-white/80 disabled:opacity-50 transition-all"
        >
          {/* Google SVG logo */}
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" fillRule="evenodd">
              <path
                d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </g>
          </svg>
          {googleLoading ? "Redirecting…" : "Continue with Google"}
        </button>

        <p className="mt-6 text-center text-xs text-white/25 leading-relaxed">
          By continuing, you agree to our{" "}
          <span className="underline underline-offset-2 cursor-pointer hover:text-white/40 transition-colors">
            Terms
          </span>{" "}
          and{" "}
          <span className="underline underline-offset-2 cursor-pointer hover:text-white/40 transition-colors">
            Privacy Policy
          </span>
          .
        </p>
      </div>
    </div>
  );
}
