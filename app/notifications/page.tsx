"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  type: "follow" | "vibe_like" | "vibe_comment";
  actor_id: string;
  actor_name: string | null;
  actor_image: string | null;
  actor_username: string | null;
  track_name: string | null;
  history_id: string | null;
  comment_text: string | null;
  read: boolean;
  created_at: string;
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) { router.replace("/"); return; }
        setNotifs(d.notifications ?? []);
        // Mark all as read
        fetch("/api/notifications", { method: "POST" }).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white/40 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-bold">Notifications</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {!loading && notifs.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔔</p>
            <p className="text-white/50">No notifications yet</p>
            <p className="text-white/25 text-sm mt-1">Likes, comments, and follows will show up here</p>
          </div>
        )}

        {!loading && notifs.length > 0 && (
          <div className="flex flex-col gap-1">
            {notifs.map((n) => {
              const profileId = n.actor_username ?? n.actor_id;
              const icon = n.type === "follow" ? "👤" : n.type === "vibe_like" ? "❤️" : "💬";
              const action =
                n.type === "follow" ? "started following you" :
                n.type === "vibe_like" ? `liked your vibe${n.track_name ? ` · ${n.track_name}` : ""}` :
                `commented on your vibe${n.track_name ? ` · ${n.track_name}` : ""}`;

              return (
                <Link
                  key={n.id}
                  href={`/u/${profileId}`}
                  className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors group ${
                    n.read ? "hover:bg-white/5" : "bg-white/5 hover:bg-white/8"
                  }`}
                >
                  <div className="relative shrink-0">
                    {n.actor_image ? (
                      <img src={n.actor_image} alt={n.actor_name ?? ""} className="w-11 h-11 rounded-full object-cover border-2 border-white/10" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-white/10 border-2 border-white/10 flex items-center justify-center">
                        <span className="text-white/40">👤</span>
                      </div>
                    )}
                    {/* Type icon badge */}
                    <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-[10px] leading-none">
                      {icon}
                    </span>
                    {!n.read && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-black" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-snug">
                      <span className="font-semibold">{n.actor_name ?? "Someone"}</span>
                      {" "}<span className="text-white/60">{action}</span>
                    </p>
                    {n.type === "vibe_comment" && n.comment_text && (
                      <p className="text-white/40 text-xs mt-0.5 truncate">"{n.comment_text}"</p>
                    )}
                    {n.actor_username && (
                      <p className="text-white/25 text-xs">@{n.actor_username}</p>
                    )}
                  </div>

                  <span className="text-white/25 text-[11px] shrink-0">{timeAgo(n.created_at)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
