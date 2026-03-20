"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SearchUser = {
  id: string;
  spotifyId: string;
  name: string;
  username: string | null;
  image: string | null;
  isLive: boolean;
  nowPlaying: { track: string | null; artist: string | null } | null;
};

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.ok) setResults(data.users ?? []);
      setSearched(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-white/40 hover:text-white transition-colors shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Search input */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search people…"
            className="w-full bg-white/8 border border-white/10 rounded-full pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); setSearched(false); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Results */}
      <div className="max-w-lg mx-auto px-4 py-4">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-white/50">No one found for &ldquo;{query}&rdquo;</p>
            <p className="text-white/25 text-sm mt-1">Try a different name or username</p>
          </div>
        )}

        {!loading && !searched && !query && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-white/50 text-sm">Search by name or username</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="flex flex-col gap-1">
            {results.map((user) => (
              <Link
                key={user.spotifyId}
                href={`/u/${user.id}`}
                className="flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 transition-colors group"
              >
                <div className="relative shrink-0">
                  {user.image ? (
                    <img src={user.image} alt={user.name} className="w-12 h-12 rounded-full object-cover border-2 border-white/10 group-hover:border-white/25 transition-colors" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-white/10 flex items-center justify-center">
                      <span className="text-white/40 text-lg">👤</span>
                    </div>
                  )}
                  {user.isLive && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-black" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm truncate">{user.name}</p>
                    {user.isLive && (
                      <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">LIVE</span>
                    )}
                  </div>
                  {user.username && (
                    <p className="text-white/40 text-xs">@{user.username}</p>
                  )}
                  {user.nowPlaying?.track && (
                    <p className="text-white/30 text-xs truncate mt-0.5">
                      🎵 {user.nowPlaying.track}
                      {user.nowPlaying.artist ? ` · ${user.nowPlaying.artist}` : ""}
                    </p>
                  )}
                </div>

                <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
