import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_CLEARANCE } from "../../components/TabBar";
import { CommentsSheet } from "../../components/CommentsSheet";
import { api } from "../../lib/api";
import { onTabBarScroll } from "../../lib/tabBarScroll";
import { theme } from "../../lib/theme";
import type { ZunoNotification } from "../../lib/types";

/** "3h", "2d" — compact, because it sits at the end of a sentence. */
function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)}d`;
  return `${Math.floor(days / 7)}w`;
}

function describe(n: ZunoNotification): string {
  switch (n.type) {
    case "follow":
      return "started following you";
    case "vibe_like":
      return n.track_name ? `liked your vibe · ${n.track_name}` : "liked your vibe";
    case "vibe_comment":
      return n.comment_text ? `commented: ${n.comment_text}` : "commented on your vibe";
    default:
      return n.type.replace(/_/g, " ");
  }
}

function iconFor(type: string): { name: keyof typeof Ionicons.glyphMap; tint: string } {
  if (type === "follow") return { name: "person-add", tint: "#4ade80" };
  if (type === "vibe_comment") return { name: "chatbubble", tint: "#60a5fa" };
  return { name: "heart", tint: "#ff3b5c" };
}

export default function Notifications() {
  // The comment thread a notification opened, if any.
  const [openThread, setOpenThread] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ZunoNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ notifications: ZunoNotification[] }>("/api/notifications");
      setItems(data.notifications ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your activity.");
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Mark read once they have actually been shown, not on every render.
  useEffect(() => {
    if (loading || items.length === 0) return;
    if (!items.some((n) => !n.read)) return;
    api("/api/notifications", { method: "POST" }).catch(() => {});
  }, [loading, items]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <>
      <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(n) => n.id}
      scrollEventThrottle={16}
      onScroll={onTabBarScroll}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: TAB_BAR_CLEARANCE,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={theme.muted}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Activity</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        error ? null : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="heart-outline" size={28} color={theme.muted} />
            </View>
            <Text style={styles.emptyTitle}>Nothing yet</Text>
            <Text style={styles.emptyBody}>
              Likes, comments and new followers will show up here.
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => {
        const icon = iconFor(item.type);
        const handle = item.actor_username ?? item.actor_id;
        // "X commented on your vibe" should land on the comment, not on X's
        // profile — following the notification to a dead end is worse than
        // not sending it.
        const thread = item.type === "vibe_comment" ? item.history_id : null;
        return (
          <Pressable
            disabled={!handle && !thread}
            onPress={() => {
              if (thread) return setOpenThread(thread);
              if (handle) router.push(`/u/${encodeURIComponent(handle)}`);
            }}
            style={({ pressed }) => [
              styles.row,
              !item.read && styles.rowUnread,
              pressed && styles.rowPressed,
            ]}
          >
            <View>
              {item.actor_image ? (
                <Image source={{ uri: item.actor_image }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]} />
              )}
              <View style={[styles.badge, { backgroundColor: icon.tint }]}>
                <Ionicons name={icon.name} size={11} color="#fff" />
              </View>
            </View>

            <Text style={styles.text} numberOfLines={2}>
              <Text style={styles.actor}>{item.actor_name ?? "Someone"}</Text>{" "}
              {describe(item)}{" "}
              <Text style={styles.time}>{ago(item.created_at)}</Text>
            </Text>

            {!item.read ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        );
      }}
    />

      {openThread ? (
        <CommentsSheet
          historyId={openThread}
          visible
          onClose={() => setOpenThread(null)}
        />
      ) : null}
    </>
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
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  title: {
    color: theme.foreground,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  error: { color: "#ff6b6b", fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rowUnread: { backgroundColor: "rgba(255,255,255,0.04)" },
  rowPressed: { opacity: 0.6 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: theme.surface },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.background,
  },
  text: { flex: 1, color: theme.muted, fontSize: 15, lineHeight: 20 },
  actor: { color: theme.foreground, fontWeight: "600" },
  time: { color: theme.muted, fontSize: 13 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  empty: { alignItems: "center", paddingTop: 72, paddingHorizontal: 40, gap: 8 },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { color: theme.foreground, fontSize: 17, fontWeight: "600" },
  emptyBody: { color: theme.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
