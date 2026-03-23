"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const FEATURE_CARDS = [
  {
    emoji: "🔴",
    title: "Live feed",
    desc: "See exactly what everyone is playing right now, in real time.",
  },
  {
    emoji: "🎧",
    title: "Listen along",
    desc: "Tap anyone's card and hear their song instantly — no Spotify Premium needed.",
  },
  {
    emoji: "👻",
    title: "Ghost mode",
    desc: "Listen privately whenever you want. You control what others see.",
  },
  {
    emoji: "✨",
    title: "Vibe history",
    desc: "Scroll through what people have been listening to. Find your next obsession.",
  },
];

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) router.replace("/feed");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center min-h-screen px-6 overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1.5s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/2 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-2xl w-full">
          <p className="text-white/40 text-sm font-mono tracking-[0.3em] uppercase mb-6">Now playing — everywhere</p>
          <h1 className="text-7xl md:text-8xl font-bold tracking-tighter mb-6 leading-none">zuno</h1>
          <p className="text-white/55 text-xl md:text-2xl mb-4 leading-relaxed max-w-lg mx-auto">
            See what your friends are listening to,{" "}
            <span className="text-white font-semibold">live</span>.
          </p>
          <p className="text-white/30 text-base mb-12 max-w-md mx-auto">
            Share your music taste in real time. Follow people whose vibe you love. Discover tracks you&apos;d never find alone.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <a
              href="/api/auth/login"
              className="bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-4 rounded-full text-base shadow-2xl shadow-green-500/20 hover:scale-105 active:scale-95 transition-all duration-200 w-full sm:w-auto"
            >
              Connect with Spotify
            </a>
            <Link
              href="/feed"
              className="bg-white/8 hover:bg-white/15 border border-white/10 text-white font-semibold px-8 py-4 rounded-full text-base transition-all duration-200 w-full sm:w-auto"
            >
              Browse the feed →
            </Link>
          </div>

          <p className="text-white/20 text-xs">Free. No credit card. Just Spotify.</p>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/20">
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-2xl mx-auto">
        <p className="text-white/20 text-xs uppercase tracking-widest text-center mb-12">What you get</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURE_CARDS.map((f) => (
            <div key={f.title} className="bg-white/4 border border-white/8 rounded-2xl p-6 hover:bg-white/6 transition-colors">
              <p className="text-3xl mb-3">{f.emoji}</p>
              <p className="text-white font-semibold mb-1">{f.title}</p>
              <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* IG Bio CTA */}
      <section className="px-6 py-20 max-w-lg mx-auto text-center">
        <div className="bg-gradient-to-br from-white/6 to-white/2 border border-white/10 rounded-3xl p-8">
          <p className="text-3xl mb-4">📲</p>
          <h2 className="text-2xl font-bold mb-3">Put it in your IG bio</h2>
          <p className="text-white/45 text-sm leading-relaxed mb-6">
            Your Zuno link is your music identity. Drop{" "}
            <span className="text-white font-mono text-xs bg-white/10 px-2 py-1 rounded-md">zuno.app/u/yourname</span>{" "}
            in your Instagram bio and let people see exactly what you&apos;re listening to when they visit.
          </p>
          <a
            href="/api/auth/login"
            className="inline-block bg-white text-black font-bold px-8 py-3.5 rounded-full hover:bg-white/90 active:scale-95 transition-all duration-200"
          >
            Get your link
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center">
        <p className="text-white/60 font-bold text-lg tracking-tight mb-1">zuno</p>
        <p className="text-white/20 text-xs">See what the world is listening to, live.</p>
      </footer>
    </main>
  );
}
