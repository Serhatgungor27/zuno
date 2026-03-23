import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=missing_code", req.url));
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL("/?error=missing_env", req.url));
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("Token exchange failed:", text);
    return NextResponse.redirect(new URL("/?error=token_exchange", req.url));
  }

  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token as string;
  const refreshToken = tokenJson.refresh_token as string | undefined;
  const expiresIn = tokenJson.expires_in as number;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Fetch Spotify user profile
  const profileRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(new URL("/?error=profile_fetch", req.url));
  }

  const profile = await profileRes.json();
  const spotifyId = profile.id as string;
  const displayName = (profile.display_name as string) ?? null;
  const image = profile.images?.[0]?.url ?? null;

  // Upsert user into Supabase
  const { error } = await supabase.from("users").upsert(
    {
      spotify_id: spotifyId,
      display_name: displayName,
      image,
      access_token: accessToken,
      refresh_token: refreshToken ?? null,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "spotify_id" }
  );

  if (error) {
    console.error("DB upsert error:", error);
    return NextResponse.redirect(new URL("/?error=db_error", req.url));
  }

  // Fetch the user's username (if they already have one)
  const { data: existingUser } = await supabase
    .from("users")
    .select("username")
    .eq("spotify_id", spotifyId)
    .single();

  const slug = existingUser?.username ?? spotifyId;

  // Set a readable identity cookie (not httpOnly) so the frontend knows who is logged in
  const res = NextResponse.redirect(new URL(`/u/${slug}`, req.url));
  res.cookies.set("zuno_user_id", spotifyId, {
    httpOnly: false,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
