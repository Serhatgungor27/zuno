import { Metadata } from "next";
import { resolveUser } from "@/lib/resolveUser";
import { supabase } from "@/lib/supabase";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  // Resolve by username OR spotify_id
  const user = await resolveUser(id);
  if (!user) {
    return { title: "User not found · zuno" };
  }

  const name = user.display_name ?? "Someone";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://zuno.app";

  // Grab current now-playing from DB (fast — no Spotify API call)
  const { data: live } = await supabase
    .from("users")
    .select("now_playing_track, now_playing_artist, is_playing, ghost_mode")
    .eq("spotify_id", user.spotify_id)
    .single();

  const isLive = live?.is_playing && !live?.ghost_mode;
  const trackName = live?.now_playing_track as string | null;
  const artistName = live?.now_playing_artist as string | null;

  const title = isLive && trackName
    ? `${name} is listening to ${trackName} · zuno`
    : `${name} · zuno`;

  const description = isLive && trackName
    ? `${name} is playing "${trackName}"${artistName ? ` by ${artistName}` : ""} right now. Tap to listen along.`
    : `See what ${name} is listening to on zuno.`;

  const ogImageUrl = `${baseUrl}/api/og?userId=${user.spotify_id}`;
  const pageUrl = `${baseUrl}/u/${user.username ?? user.spotify_id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "zuno",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${name}'s now playing` }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
