import { Redirect } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../lib/auth";
import { theme } from "../lib/theme";

export default function SignIn() {
  const { session, loading, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && session) return <Redirect href="/(tabs)/feed" />;

  async function onPress() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>zuno</Text>
        <Text style={styles.tagline}>
          see what the world is listening to
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        {busy ? (
          <ActivityIndicator color={theme.background} />
        ) : (
          <Text style={styles.buttonLabel}>Continue with Google</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 48,
  },
  header: { gap: 12 },
  wordmark: {
    color: theme.foreground,
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1,
  },
  tagline: { color: theme.muted, fontSize: 16 },
  button: {
    backgroundColor: theme.foreground,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  buttonPressed: { opacity: 0.8 },
  buttonLabel: {
    color: theme.background,
    fontSize: 16,
    fontWeight: "600",
  },
  error: { color: "#ff6b6b", fontSize: 14, textAlign: "center" },
});
