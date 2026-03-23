import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/spotify";
import { resolveUser } from "@/lib/resolveUser";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ ok: false, error: "missing_user_id" }, { status: 400 });
  }

  const user = await resolveUser(userId);
  if (!user) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

  // Fetch extra fields: ghost_mode, bio, profile_link, last cached track id
  const { data: userData } = await supabase
    .from("users")
    .select("ghost_mode, now_playing_track_id, bio, profile_link, show_last_active, now_playing_updated_at, updated_at")
    .eq("spotify_id", user.spotify_id)
    .single();

  const ghostMode = userData?.ghost_mode ?? false;
  const showLastActive = userData?.show_last_active ?? false;
  // Fallback to updated_at if now_playing_updated_at hasn't been set yet
  const lastActive = (userData?.now_playing_updated_at as string | null) ?? (userData?.updated_at as string | null) ?? null;

  // Check if the viewer is the owner
  const cookieStore = await cookies();
  const viewerId = cookieStore.get("zuno_user_id")?.value ?? null;
  const isOwner = viewerId === user.spotify_id;

  const profileLink = (userData?.profile_link as string | null) || null;
  const lastActivePayload = showLastActive ? lastActive : null;

  // If ghost mode is on and viewer is NOT the owner, return not playing
  if (ghostMode && !isOwner) {
    return NextResponse.json({
      ok: true,
      playing: false,
      isLive: false,
      ghostMode: true,
      user: { name: user.display_name, image: user.image, bio: userData?.bio ?? null, profileLink, lastActive: lastActivePayload },
    });
  }

  const accessToken = await getValidAccessToken(user.spotify_id);
  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  const spotifyRes = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (spotifyRes.status === 204) {
    await supabase
      .from("users")
      .update({ is_playing: false, updated_at: new Date().toISOString() })
      .eq("spotify_id", user.spotify_id);

    return NextResponse.json({
      ok: true,
      playing: false,
      isLive: false,
      ghostMode,
      user: { name: user.display_name, image: user.image, bio: userData?.bio ?? null, profileLink, lastActive: lastActivePayload },
    });
  }

  if (!spotifyRes.ok) {
    const text = await spotifyRes.text();
    return NextResponse.json({ ok: false, error: "spotify_error", details: text }, { status: 400 });
  }

  const data = await spotifyRes.json();
  const item = data?.item;

  if (!item) {
    await supabase
      .from("users")
      .update({ is_playing: false, updated_at: new Date().toISOString() })
      .eq("spotify_id", user.spotify_id);

    return NextResponse.json({
      ok: true,
      playing: false,
      isLive: false,
      ghostMode,
      user: { name: user.display_name, image: user.image, bio: userData?.bio ?? null, profileLink, lastActive: lastActivePayload },
    });
  }

  const artists = (item.artists || []).map((a: { name: string }) => a.name).join(", ");
  const image = item.album?.images?.[0]?.url ?? null;
  const isLive = data?.is_playing ?? false;
  const trackId = item.id ?? null;

  // Get repeat state via player endpoint (requires user-read-playback-state scope)
  // Fails silently for users who haven't re-authenticated with the new scope yet
  let isOnRepeat = false;
  try {
    const playerRes = await fetch("https://api.spotify.com/v1/me/player", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (playerRes.ok) {
      const playerData = await playerRes.json();
      isOnRepeat = (playerData?.repeat_state as string | undefined) === "track";
    }
  } catch {
    // scope not granted yet — skip
  }

  // Count others listening to the same track right now
  const { count: listenerCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("now_playing_track_id", trackId)
    .eq("is_playing", true)
    .eq("ghost_mode", false)
    .gte("now_playing_updated_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .neq("spotify_id", user.spotify_id);

  // Record history — only if ghost mode is off.
  // Strategy: 10-min throttle prevents spam. Within a 4-hour session window,
  // UPDATE the existing row (incrementing repeat_count) instead of inserting a new one.
  // This prevents the same song flooding the feed when listened on repeat.
  if (trackId && !ghostMode) {
    const since10m = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const since4h  = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    // Throttle: skip if already recorded within the last 10 min
    const { data: veryRecent } = await supabase
      .from("listening_history")
      .select("id")
      .eq("user_spotify_id", user.spotify_id)
      .eq("track_id", trackId)
      .gte("played_at", since10m)
      .limit(1)
      .maybeSingle();

    if (!veryRecent) {
      // Check if same track exists in the current session (last 4 hours)
      const { data: sessionEntry } = await supabase
        .from("listening_history")
        .select("id, repeat_count")
        .eq("user_spotify_id", user.spotify_id)
        .eq("track_id", trackId)
        .gte("played_at", since4h)
        .order("played_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionEntry) {
        // Same session — bump repeat count and refresh played_at so it stays top of feed
        await supabase
          .from("listening_history")
          .update({
            repeat_count: ((sessionEntry.repeat_count as number) ?? 1) + 1,
            played_at: new Date().toISOString(),
          })
          .eq("id", sessionEntry.id);
      } else {
        // New session — insert fresh entry
        await supabase.from("listening_history").insert({
          user_spotify_id: user.spotify_id,
          track_id: trackId,
          track_name: item.name,
          artist: artists,
          album_image: image,
          track_url: item.external_urls?.spotify ?? null,
          repeat_count: 1,
        });
      }
    }
  }

  // Update cache (only if not in ghost mode — don't expose to feed)
  await supabase
    .from("users")
    .update({
      is_playing: ghostMode ? false : isLive, // hide from feed if ghost mode
      now_playing_track: item.name,
      now_playing_artist: artists,
      now_playing_image: image,
      now_playing_track_id: trackId,
      now_playing_url: item.external_urls?.spotify ?? null,
      now_playing_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("spotify_id", user.spotify_id);

  return NextResponse.json({
    ok: true,
    playing: true,
    isLive,
    isOnRepeat,
    ghostMode,
    user: { name: user.display_name, image: user.image, bio: userData?.bio ?? null, profileLink, listenerCount: listenerCount ?? 0, lastActive: lastActivePayload },
    track: {
      name: item.name,
      artists,
      album: item.album?.name ?? "",
      image,
      url: item.external_urls?.spotify ?? null,
      previewUrl: item.preview_url ?? null,
      trackId,
    },
  });
}
