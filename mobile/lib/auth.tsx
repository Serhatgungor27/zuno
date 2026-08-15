import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { supabase } from "./supabase";

/**
 * Where Supabase sends the browser back to after Google sign-in. This exact
 * string must be on the Supabase redirect allow-list (Authentication → URL
 * Configuration) or the callback silently fails.
 */
export const AUTH_REDIRECT_URL = Linking.createURL("auth-callback");

type AuthValue = {
  session: Session | null;
  /** True until the stored session has been read back from the Keychain. */
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Supabase refreshes tokens on a timer, which iOS suspends in the background.
  // Restart it whenever the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    supabase.auth.startAutoRefresh();
    return () => {
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: AUTH_REDIRECT_URL,
        // We drive the browser ourselves rather than letting supabase-js
        // navigate, which it cannot do in a native app.
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error("Supabase returned no authorization URL.");

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      AUTH_REDIRECT_URL
    );
    if (result.type !== "success") return; // user dismissed the sheet

    const code = Linking.parse(result.url).queryParams?.code;
    if (typeof code !== "string") {
      throw new Error("Sign-in callback carried no authorization code.");
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      code
    );
    if (exchangeError) throw exchangeError;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({ session, loading, signInWithGoogle, signOut }),
    [session, loading, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside an AuthProvider.");
  return value;
}
