import crypto from "crypto";
import { cookies } from "next/headers";

// Signed identity cookie (item A). The cookie value is `${spotifyId}.${hmac}` where the
// signature is an HMAC-SHA256 of the id under a server-only secret. Because the secret never
// reaches the browser and the cookie is httpOnly, a caller can neither read another user's
// cookie nor forge one for an id they don't own — closing the account-takeover hole where
// anyone could set `document.cookie = "zuno_user_id=<victim spotify_id>"`.

export const AUTH_COOKIE_NAME = "zuno_user_id";

const secret = process.env.AUTH_COOKIE_SECRET;

function hmac(value: string): string {
  if (!secret) throw new Error("AUTH_COOKIE_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function signUserId(spotifyId: string): string {
  return `${spotifyId}.${hmac(spotifyId)}`;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    // localhost is http, so a secure cookie would silently never be set in dev.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}

// Verify a raw cookie value and return the spotify_id it authenticates, or null if the
// signature is missing, malformed, or doesn't match. base64url signatures never contain a
// ".", so the id is everything before the final "." even if the id itself contains dots.
export function verifyUserId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const sep = raw.lastIndexOf(".");
  if (sep < 1) return null;
  const id = raw.slice(0, sep);
  const sig = raw.slice(sep + 1);

  let expected: string;
  try {
    expected = hmac(id);
  } catch {
    return null;
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return id;
}

// Read and verify the identity cookie from the incoming request. Returns the spotify_id of
// the authenticated user, or null when there is no valid signed cookie.
export async function getVerifiedUserId(): Promise<string | null> {
  const store = await cookies();
  return verifyUserId(store.get(AUTH_COOKIE_NAME)?.value);
}
