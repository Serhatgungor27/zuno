import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI!;

  const scope = "user-read-currently-playing user-read-recently-played user-read-playback-state";

  const authUrl = new URL("https://accounts.spotify.com/authorize");

  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("redirect_uri", redirectUri);

  return NextResponse.redirect(authUrl.toString());
}