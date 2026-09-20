import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_CLEARANCE } from "../../components/TabBar";
import { api } from "../../lib/api";
import { onTabBarScroll } from "../../lib/tabBarScroll";
import { theme } from "../../lib/theme";
import type { FeedResponse, VibeItem } from "../../lib/types";

export default function Feed() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<VibeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<FeedResponse>("/api/feed?type=vibe");
      setItems(data.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the feed.");
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: TAB_BAR_CLEARANCE }}
      data={items}
      keyExtractor={(item) => item.vibeId}
      scrollEventThrottle={16}
      onScroll={onTabBarScroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.muted}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.wordmark}>zuno</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        error ? null : (
          <Text style={styles.empty}>Nothing playing in the last 48 hours.</Text>
        )
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          {item.albumImage ? (
            <Image source={{ uri: item.albumImage }} style={styles.art} />
          ) : (
            <View style={[styles.art, styles.artFallback]} />
          )}
          <View style={styles.rowText}>
            <Text style={styles.track} numberOfLines={1}>
              {item.track}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {item.artist}
            </Text>
            <Text style={styles.byline} numberOfLines={1}>
              {item.userName}
              {item.repeatCount > 1 ? ` · ×${item.repeatCount}` : ""}
            </Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
  },
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  wordmark: {
    color: theme.foreground,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  art: { width: 56, height: 56, borderRadius: 6 },
  artFallback: { backgroundColor: theme.surface },
  rowText: { flex: 1, gap: 2 },
  track: { color: theme.foreground, fontSize: 16, fontWeight: "600" },
  artist: { color: theme.muted, fontSize: 14 },
  byline: { color: theme.accent, fontSize: 12 },
  empty: {
    color: theme.muted,
    fontSize: 15,
    textAlign: "center",
    marginTop: 48,
  },
  error: { color: "#ff6b6b", fontSize: 14 },
});
