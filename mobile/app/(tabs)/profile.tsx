import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, apiBaseUrl } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { theme } from "../../lib/theme";

type Me = { ok: boolean; username: string; avatar_url: string | null };

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setMe(await api<Me>("/api/profile/me"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 40 }}
    >
      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={theme.accent} />
        ) : me ? (
          <>
            {me.avatar_url ? (
              <Image source={{ uri: me.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]} />
            )}
            <Text style={styles.username}>@{me.username}</Text>
            <Text style={styles.email}>{session?.user.email}</Text>
            <Text style={styles.ok}>
              Authenticated via bearer token ✓
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.hint}>API: {apiBaseUrl}</Text>
          </>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => void load()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Reload</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  body: { paddingHorizontal: 24, gap: 12, alignItems: "flex-start" },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { backgroundColor: theme.surface },
  username: { color: theme.foreground, fontSize: 28, fontWeight: "700" },
  email: { color: theme.muted, fontSize: 15 },
  ok: { color: theme.accent, fontSize: 14, fontWeight: "600" },
  title: { color: theme.foreground, fontSize: 28, fontWeight: "700" },
  error: { color: "#ff6b6b", fontSize: 14, lineHeight: 20 },
  hint: { color: theme.muted, fontSize: 12 },
  button: {
    marginTop: 12,
    alignSelf: "stretch",
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  pressed: { opacity: 0.7 },
  buttonLabel: { color: theme.foreground, fontSize: 16, fontWeight: "600" },
});
