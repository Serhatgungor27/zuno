import { ImageResponse } from "next/og";
import { resolveUser } from "@/lib/resolveUser";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return new Response("Missing userId", { status: 400 });
  }

  const user = await resolveUser(userId);

  let trackName = "Not playing";
  let artistName = "";
  let albumImage = "";

  // Use cached DB data — fast, no Spotify API call needed
  if (user) {
    const { data: live } = await supabase
      .from("users")
      .select("now_playing_track, now_playing_artist, now_playing_image, is_playing, ghost_mode")
      .eq("spotify_id", user.spotify_id)
      .single();

    if (live?.is_playing && !live?.ghost_mode) {
      trackName = (live.now_playing_track as string) || "Not playing";
      artistName = (live.now_playing_artist as string) || "";
      albumImage = (live.now_playing_image as string) || "";
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          fontFamily: "sans-serif",
          overflow: "hidden",
          backgroundColor: "#000",
        }}
      >
        {/* Album art background */}
        {albumImage && (
          <img
            src={albumImage}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(40px) brightness(0.4)",
              transform: "scale(1.1)",
            }}
          />
        )}

        {/* Dark overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding: "60px",
            gap: "20px",
          }}
        >
          {/* Profile photo */}
          {user?.image && (
            <img
              src={user.image}
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.3)",
                objectFit: "cover",
              }}
            />
          )}

          {/* Album art thumbnail */}
          {albumImage && (
            <img
              src={albumImage}
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "12px",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              }}
            />
          )}

          {/* Listening label */}
          <div style={{ display: "flex", color: "rgba(255,255,255,0.7)", fontSize: "20px" }}>
            {user?.display_name ?? "Someone"} is listening to
          </div>

          {/* Track name */}
          <div
            style={{
              color: "white",
              fontSize: "48px",
              fontWeight: "bold",
              textAlign: "center",
              maxWidth: "900px",
              lineHeight: 1.2,
            }}
          >
            {trackName}
          </div>

          {/* Artist */}
          {artistName && (
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "26px" }}>
              {artistName}
            </div>
          )}

          {/* Zuno branding */}
          <div
            style={{
              position: "absolute",
              bottom: "36px",
              right: "48px",
              display: "flex",
              color: "rgba(255,255,255,0.4)",
              fontSize: "18px",
              letterSpacing: "2px",
            }}
          >
            ZUNO
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
