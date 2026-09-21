import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "../components/Form";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import type { FollowUser } from "../lib/types";

/**
 * The follower and following lists. Reached by tapping either count on a
 * profile, which until now were dead numbers.
 */
export default function Follows() {
  const insets = useSafeAreaInsets();
  const { user, type } = useLocalSearchParams<{
    user: string;
    type: "followers" | "following";
  }>();

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ users: FollowUser[] }>(
      `/api/follow/list?userId=${encodeURIComponent(user)}&type=${type ?? "followers"}`
    )
      .then((d) => setUsers(d.users ?? []))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load that list.")
      )
      .finally(() => setLoading(false));
  }, [user, type]);

  const title = type === "following" ? "Following" : "Followers";

  return (
    <View style={styles.screen}>
      <ScreenHeader title={title} onBack={() => router.back()} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.spotifyId}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.empty}>
                {type === "following"
                  ? "Not following anyone yet."
                  : "No followers yet."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() =>
                router.push(`/u/${item.username ?? item.spotifyId}` as never)
              }
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.initial}>
                    {(item.name ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.names}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.username ? (
                  <Text style={styles.handle} numberOfLines={1}>
                    @{item.username}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  centered: {
    paddingTop: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  error: { color: "#ff6b6b", fontSize: 15, textAlign: "center" },
  empty: { color: theme.muted, fontSize: 15, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pressed: { opacity: 0.6 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.surface },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  initial: { color: theme.muted, fontSize: 18, fontWeight: "600" },
  names: { flex: 1, gap: 2 },
  name: { color: theme.foreground, fontSize: 15, fontWeight: "600" },
  handle: { color: theme.muted, fontSize: 13 },
});
