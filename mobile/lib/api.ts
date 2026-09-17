import Constants from "expo-constants";

import { supabase } from "./supabase";

// EXPO_PUBLIC_API_BASE_URL points the app at a local `next dev` server so backend
// changes can be tested from the phone before they are deployed. Unset in normal use.
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  "https://botan-now-playing.vercel.app";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Calls a Next.js API route on the deployed backend.
 *
 * The Supabase access token is sent as a bearer header. Heads-up: as of this
 * scaffold the backend reads identity from cookies only — `app/lib/supabase/
 * server.ts` builds its client from `cookies()`, and the other 13 routes use
 * the signed Spotify cookie in `lib/authCookie.ts`. Authenticated calls will
 * 401 until a bearer path is added server-side. Public reads work today.
 */
export async function api<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ApiError(
      response.status,
      path,
      body.slice(0, 200) || response.statusText
    );
  }

  return response.json() as Promise<T>;
}

export { apiBaseUrl };
