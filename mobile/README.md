# zuno — iOS app

Expo / React Native (TypeScript) frontend for zuno. The backend is **not** rebuilt:
this app calls the same production Next.js API routes on Vercel
(`https://botan-now-playing.vercel.app/api/*`) and the same Supabase project.

## Setup

```sh
cd mobile
npm install
cp .env.example .env.local   # then fill in EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

Press `i` for the iOS simulator, or scan the QR code with the Expo Go app on your
iPhone.

## Layout

| Path | What it is |
| --- | --- |
| `app/_layout.tsx` | Root stack, wraps everything in `AuthProvider` |
| `app/index.tsx` | Entry redirect — feed if signed in, otherwise sign-in |
| `app/sign-in.tsx` | Google OAuth via Supabase |
| `app/(tabs)/` | Feed, Discover, Search, Activity, Profile |
| `lib/supabase.ts` | Supabase client; session stored in the iOS Keychain |
| `lib/auth.tsx` | `AuthProvider` / `useAuth`, PKCE OAuth flow |
| `lib/api.ts` | `api()` — fetch wrapper that attaches the bearer token |
| `lib/theme.ts` | Palette, mirrors the web app's `app/globals.css` |

## Auth

The app uses Supabase auth directly (Google OAuth via `expo-auth-session`), with
the session in `expo-secure-store` (Keychain). `lib/api.ts` sends the access
token as `Authorization: Bearer <jwt>`.

**The backend does not read that header yet.** `app/lib/supabase/server.ts`
builds its client from `cookies()`, and the other 13 routes verify the signed
Spotify cookie in `lib/authCookie.ts`. Public reads (`/api/feed`, `/api/search`,
`/api/discover`) work today; authenticated calls will 401 until a bearer path is
added server-side. That work is backlog item B (unify the two auth systems).

## Manual setup outside this repo

- Supabase → Authentication → URL Configuration → redirect allow-list. Add
  **both**, or the Google callback fails silently:
  - `zuno://auth-callback` — dev/production builds, which use the app scheme.
  - `exp://*/--/auth-callback` — Expo Go, where `Linking.createURL` returns an
    `exp://<your-lan-ip>:8081/--/…` URL instead of the scheme.
- Apple Developer Program ($99/yr) is only needed for TestFlight or device builds
  beyond Expo Go's 7-day limit. Expo Go is enough for now.

## Not part of the Vercel build

`mobile/` is excluded from the Next.js deployment via `.vercelignore`, the root
`tsconfig.json` `exclude`, and the root `eslint.config.mjs` ignore list. Keep it
that way — the root `tsconfig.json` globs `**/*.tsx`, so without the exclude the
React Native files break `next build`.
