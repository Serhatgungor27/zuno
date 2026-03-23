"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type NowPlayingData = {
  playing: boolean;
  isLive?: boolean;
  user: { name: string; image: string | null };
  track?: {
    name: string;
    artists: string;
    image: string | null;
    url: string | null;
  };
};

export default function EmbedWidget() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<NowPlayingData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/spotify/now-playing?userId=${id}`);
        if (!res.ok) return;
        const json = await res.json();
        setData(json);
      } catch { /* silent */ }
      finally { setLoaded(true); }
    };

    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [id]);

  if (!loaded) {
    return (
      <div style={{ background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.3)", animation: "bounce 1s infinite", animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const zunoUrl = `https://zuno.app/u/${id}`;
  const isPlaying = data?.playing && data?.isLive;
  const track = data?.track;
  const user = data?.user;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: transparent; }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes wave {
          0%, 100% { height: 4px; }
          50% { height: 16px; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .widget-link:hover .widget-card { opacity: 0.9; transform: scale(0.99); }
        .widget-card { transition: opacity 0.2s, transform 0.2s; }
      `}</style>

      <a
        href={zunoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="widget-link"
        style={{ display: "block", textDecoration: "none", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        <div
          className="widget-card"
          style={{
            background: isPlaying
              ? "linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(15,15,15,0.98) 100%)"
              : "rgba(20,20,20,0.95)",
            border: isPlaying ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(255,255,255,0.06)",
            borderRadius: "16px",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Background album art blur */}
          {isPlaying && track?.image && (
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: `url(${track.image})`,
              backgroundSize: "cover", backgroundPosition: "center",
              filter: "blur(30px) brightness(0.15)",
              transform: "scale(1.3)",
            }} />
          )}

          {/* Album art / avatar */}
          <div style={{ position: "relative", zIndex: 1, flexShrink: 0 }}>
            {isPlaying && track?.image ? (
              <img
                src={track.image}
                alt={track.name}
                style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", display: "block" }}
              />
            ) : user?.image ? (
              <img
                src={user.image}
                alt={user.name}
                style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", display: "block", opacity: 0.6 }}
              />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
            )}
          </div>

          {/* Text */}
          <div style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0 }}>
            {isPlaying && track ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 16 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} style={{
                        width: 3, height: 4, background: "#1DB954", borderRadius: 2,
                        animation: `wave ${0.8 + i * 0.15}s ease-in-out infinite`,
                        animationDelay: `${i * 0.1}s`,
                      }} />
                    ))}
                  </div>
                  <span style={{ color: "#1DB954", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>NOW PLAYING</span>
                </div>
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                  {track.name}
                </p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                  {track.artists}
                </p>
              </>
            ) : (
              <>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                  {user?.name ?? id}
                </p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>Not playing right now</p>
              </>
            )}
          </div>

          {/* Zuno branding */}
          <div style={{ position: "relative", zIndex: 1, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>ZUNO</span>
            <svg width="12" height="12" fill="none" stroke="rgba(255,255,255,0.2)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </div>
        </div>
      </a>
    </>
  );
}
