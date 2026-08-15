import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

// React Native ships no WebCrypto, so supabase-js silently downgrades the PKCE
// code challenge from S256 to `plain` — which sends the verifier itself and
// removes most of what PKCE is for. Back the two calls it needs with
// expo-crypto so the flow keeps real SHA-256.
const globalCrypto = globalThis as unknown as {
  crypto?: {
    getRandomValues?: unknown;
    subtle?: { digest: (algorithm: unknown, data: BufferSource) => unknown };
  };
};

if (!globalCrypto.crypto) globalCrypto.crypto = {};
if (!globalCrypto.crypto.getRandomValues) {
  globalCrypto.crypto.getRandomValues = Crypto.getRandomValues;
}
if (!globalCrypto.crypto.subtle) {
  globalCrypto.crypto.subtle = {
    digest: (algorithm: unknown, data: BufferSource) =>
      Crypto.digest(
        (typeof algorithm === "string"
          ? algorithm
          : (algorithm as { name: string }).name) as Crypto.CryptoDigestAlgorithm,
        data
      ),
  };
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy mobile/.env.example to mobile/.env.local and fill both in."
  );
}

/**
 * Session storage backed by the iOS Keychain.
 *
 * Note for a future Android build: SecureStore values are capped at 2048 bytes
 * there, and a Supabase session can exceed that. The Keychain has no such limit,
 * so this is fine while the MVP is iOS-only — revisit before shipping Android.
 */
const KeychainStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: KeychainStorage,
    autoRefreshToken: true,
    persistSession: true,
    // PKCE is the flow for public clients — the app never holds a secret.
    flowType: "pkce",
    // There is no URL bar to read a session back from in a native app; the
    // OAuth redirect is handled explicitly in lib/auth.tsx instead.
    detectSessionInUrl: false,
  },
});
