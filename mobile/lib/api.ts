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
 * Calls a Next.js API route on the backend.
 *
 * The Supabase access token goes out as a bearer header; server-side
 * `lib/apiAuth.ts` accepts it on the routes that authenticate through Supabase
 * (profile/me, taste, repost). The other 13 routes key on `users.spotify_id`,
 * which a Supabase login cannot produce — see backlog item B.
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
    throw new ApiError(response.status, path, await failureMessage(response));
  }

  // A 200 that isn't JSON means something served a page where an API should be
  // — a proxy, a login redirect, a misrouted path. Say that, rather than
  // letting response.json() throw an unreadable parse error.
  if (!isJson(response)) {
    throw new ApiError(
      response.status,
      path,
      `expected JSON, got ${response.headers.get("content-type") ?? "no content-type"}`
    );
  }

  return response.json() as Promise<T>;
}

function isJson(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").includes("json");
}

/**
 * One readable line for a failed request. Server error pages are HTML, and
 * pasting markup into the UI tells the reader nothing, so only a genuine JSON
 * error payload contributes detail; anything else falls back to the status.
 */
async function failureMessage(response: Response): Promise<string> {
  const status = response.statusText
    ? `HTTP ${response.status} ${response.statusText}`
    : `HTTP ${response.status}`;

  if (!isJson(response)) return status;

  const body = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(body) as { error?: unknown; message?: unknown };
    const detail = parsed.error ?? parsed.message;
    if (typeof detail === "string" && detail.length > 0) {
      return `${status} — ${detail}`;
    }
  } catch {
    // Not parseable after all; the status alone is more use than raw bytes.
  }
  return status;
}

export { apiBaseUrl };
