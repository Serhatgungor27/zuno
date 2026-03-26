"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type LikedTrack = {
  trackId: string;
  name: string;
  artist: string;
  album: string;
  albumImage: string | null;
  previewUrl: string | null;
  spotifyUrl: string;
  deezerUrl: string;
};

export default function LikedPage() {
  const router = useRouter();
  const [tracks, setTracks] = useState<LikedTrack[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("zuno_liked_tracks") ?? "[]");
      setTracks(stored);
    } catch {}
  }, []);

  const togglePlay = (track: LikedTrack) => {
    if (!track.previewUrl) return;

    if (playing === track.trackId) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(track.previewUrl);
    audio.volume = 1;
    audio.play().catch(() => {});
    audio.onended = () => setPlaying(null);
    audioRef.current = audio;
    setPlaying(track.trackId);
  };

  const unlike = (trackId: string) => {
    const next = tracks.filter(t => t.trackId !== trackId);
    setTracks(next);
    try {
      localStorage.setItem("zuno_liked_tracks", JSON.stringify(next));
      // Also update the ID set
      const ids: string[] = JSON.parse(localStorage.getItem("zuno_liked_discover") ?? "[]");
      localStorage.setItem("zuno_liked_discover", JSON.stringify(ids.filter(id => id !== trackId)));
    } catch {}
    // Stop audio if this track was playing
    if (playing === trackId) {
      audioRef.current?.pause();
      setPlaying(null);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push("/feed")} className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-base font-bold">Liked Songs</h1>
          <p className="text-xs text-white/40">{tracks.length} {tracks.length === 1 ? "song" : "songs"}</p>
        </div>
      </header>

      <div className="pt-16 pb-8">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 mt-32 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-10 h-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm">No liked songs yet.<br />Heart songs in Discover to save them here.</p>
            <button onClick={() => router.push("/feed")} className="mt-2 px-5 py-2 rounded-full bg-white text-black text-sm font-semibold">
              Go to Discover
            </button>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-white/5">
            {tracks.map((track) => (
              <div key={track.trackId} className="flex items-center gap-3 px-4 py-3">
                {/* Album art + play button */}
                <button
                  onClick={() => togglePlay(track)}
                  className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/5"
                >
                  {track.albumImage && (
                    <img src={track.albumImage} alt={track.album} className="w-full h-full object-cover" />
                  )}
                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${playing === track.trackId ? "opacity-100 bg-black/50" : "opacity-0 hover:opacity-100 bg-black/40"}`}>
                    {playing === track.trackId ? (
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </div>
                </button>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{track.name}</p>
                  <p className="text-xs text-white/50 truncate">{track.artist}</p>
                  <p className="text-xs text-white/30 truncate">{track.album}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={track.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-[#1DB954]/20 flex items-center justify-center"
                    onClick={e => e.stopPropagation()}
                  >
                    <svg className="w-4 h-4 text-[#1DB954]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </a>
                  {/* Unlike button */}
                  <button
                    onClick={() => unlike(track.trackId)}
                    className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 text-red-400 fill-red-400" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
