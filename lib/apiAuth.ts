import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/app/lib/supabase/server";

// Supabase identity for API routes, from either transport:
//
//   - `Authorization: Bearer <access_token>` — native clients (the iOS app), which have no
//     cookie jar. The token is validated against the auth server by `getUser(jwt)`, not
//     decoded locally, so a forged or expired token fails the same way an unsigned identity
//     cookie does.
//   - the session cookie — the web app, unchanged.
//
// A request that presents a bearer token and fails validation is rejected outright rather
// than falling back to cookies; otherwise a bad token on a cookie-bearing request would
// silently authenticate as the cookie's user.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type ApiAuth = {
  user: User;
  /** Client bound to this user — RLS applies as them, in both transports. */
  client: SupabaseClient;
};

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export async function getApiAuth(req?: Request): Promise<ApiAuth | null> {
  const token = req ? bearerToken(req) : null;

  if (token) {
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return { user: data.user, client };
  }

  const client = await createCookieClient();
  const { data } = await client.auth.getUser();
  return data.user ? { user: data.user, client } : null;
}
