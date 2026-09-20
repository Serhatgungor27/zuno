import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NavRow, ScreenHeader, Section, Toggle, styles } from "../components/Form";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { theme } from "../lib/theme";
import type { SettingsUser } from "../lib/types";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const [user, setUser] = useState<SettingsUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ user: SettingsUser }>("/api/settings")
      .then((s) => setUser(s.user))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load settings.")
      )
      .finally(() => setLoading(false));
  }, []);

  /** Optimistic, with rollback — a toggle that lags feels broken. */
  const toggleFlag = useCallback(
    async (key: "show_last_active" | "show_top_stats", value: boolean) => {
      setUser((u) => (u ? { ...u, [key]: value } : u));
      try {
        await api("/api/settings", {
          method: "POST",
          body: JSON.stringify({ [key]: value }),
        });
      } catch {
        setUser((u) => (u ? { ...u, [key]: !value } : u));
        Alert.alert("Not saved", "That setting did not change.");
      }
    },
    []
  );

  const toggleGhost = useCallback(async () => {
    const previous = user?.ghost_mode ?? false;
    setUser((u) => (u ? { ...u, ghost_mode: !previous } : u));
    try {
      // This route toggles server-side rather than taking a value.
      const res = await api<{ ghostMode: boolean }>("/api/privacy", { method: "POST" });
      setUser((u) => (u ? { ...u, ghost_mode: res.ghostMode } : u));
    } catch {
      setUser((u) => (u ? { ...u, ghost_mode: previous } : u));
      Alert.alert("Not saved", "Ghost mode did not change.");
    }
  }, [user?.ghost_mode]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Section title="ACCOUNT">
          <NavRow
            label="Edit profile"
            note="Bio, username and music taste"
            onPress={() => router.push("/edit-profile")}
          />
        </Section>

        <Section title="PRIVACY">
          <Toggle
            label="Ghost mode"
            note="Hide your listening from the feed"
            value={!!user?.ghost_mode}
            onChange={() => void toggleGhost()}
          />
          <Toggle
            label="Show last active"
            value={user?.show_last_active !== false}
            onChange={(v) => void toggleFlag("show_last_active", v)}
          />
          <Toggle
            label="Show top stats"
            value={user?.show_top_stats !== false}
            onChange={(v) => void toggleFlag("show_top_stats", v)}
          />
        </Section>

        <Section title="SESSION">
          <Pressable
            onPress={() => void signOut()}
            style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]}
          >
            <Text style={styles.rowButtonLabel}>Sign out</Text>
          </Pressable>
        </Section>
      </ScrollView>
    </View>
  );
}
