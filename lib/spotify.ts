import { supabase } from "./supabase";

/**
 * Returns a valid access token for the given Spotify user ID.
 * Automatically refreshes the token if it's expired or about to expire.
 */
export async function getValidAccessToken(
  spotifyId: string
): Promise<string | null> {
  const { data: user, error } = await supabase
    .from("users")
    .select("access_token, refresh_token, token_expires_at")
    .eq("spotify_id", spotifyId)
    .single();

  if (error || !user) return null;

  const expiresAt = new Date(user.token_expires_at).getTime();
  const now = Date.now();

  // Still valid with a 60s buffer
  if (expiresAt - now > 60 * 1000) {
    return user.access_token;
  }

  // Expired — try to refresh
  if (!user.refresh_token) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: user.refresh_token,
    }),
  });

  if (!res.ok) return null;

  const tokens = await res.json();
  const newAccessToken = tokens.access_token as string;
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase
    .from("users")
    .update({
      access_token: newAccessToken,
      token_expires_at: newExpiresAt,
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("spotify_id", spotifyId);

  return newAccessToken;
}

/**
 * An app-level token, for the things that are about the catalogue rather than
 * about a person: search, artists, albums.
 *
 * Spotify's search ranks on real listening — it knows Diyar Dersim has
 * 390,000 monthly listeners, where Deezer records 111 fans and buries him at
 * result 43. Previews still come from Deezer, because Spotify stopped
 * returning preview_url.
 */
let appToken: { value: string; expiresAt: number } | null = null;

export async function getAppToken(): Promise<string | null> {
  if (appToken && appToken.expiresAt - Date.now() > 60_000) return appToken.value;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = await res.json();
    appToken = {
      value: json.access_token as string,
      expiresAt: Date.now() + (json.expires_in as number) * 1000,
    };
    return appToken.value;
  } catch {
    return null;
  }
}
