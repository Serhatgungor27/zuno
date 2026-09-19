import { cookies } from "next/headers";

import { bearerToken, getApiAuth } from "./apiAuth";
import { AUTH_COOKIE_NAME, verifyUserId } from "./authCookie";
import { supabase } from "./supabase";

// zuno has two identity systems that share no column: the web app is keyed on
// `users.spotify_id` (which is also the payload of the signed identity cookie),
// while the iOS app authenticates with Supabase and only ever knows an auth
// UUID. `users.auth_user_id` links them, and this module is the one place that
// translates, so the routes downstream keep working in spotify_id exactly as
// they always have.

/**
 * The spotify_id of whoever is making this request, or null.
 *
 * Order matters. A bearer token is checked first and, if present, is decisive:
 * a request that presents one and fails must not quietly fall through to a
 * cookie and authenticate as somebody else. The signed Spotify cookie is then
 * preferred over a Supabase session, so a browser holding both resolves to the
 * same person the web app already thinks is signed in.
 */
export async function resolveViewerId(req?: Request): Promise<string | null> {
  if (req && bearerToken(req)) {
    const auth = await getApiAuth(req);
    return auth ? spotifyIdForAuthUser(auth.user.id) : null;
  }

  const store = await cookies();
  const fromSignedCookie = verifyUserId(store.get(AUTH_COOKIE_NAME)?.value);
  if (fromSignedCookie) return fromSignedCookie;

  const auth = await getApiAuth();
  return auth ? spotifyIdForAuthUser(auth.user.id) : null;
}

/**
 * Looks the link up with the service-role client deliberately. `anon` and
 * `authenticated` are denied SELECT on `users` at the GRANT level, so an
 * RLS-bound client returns 42501 here, which would surface as a null viewer —
 * indistinguishable from a bad token, and silently breaking every route.
 */
async function spotifyIdForAuthUser(authUserId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("spotify_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    console.error("[identity] link lookup failed:", error.code, error.message);
    return null;
  }
  return (data?.spotify_id as string | undefined) ?? null;
}
