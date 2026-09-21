import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlayerSheet, type NowPlaying } from "../../components/PlayerSheet";
import { TAB_BAR_CLEARANCE } from "../../components/TabBar";
import { api } from "../../lib/api";
import { onTabBarScroll, resetTabBar } from "../../lib/tabBarScroll";
import { theme } from "../../lib/theme";
import type { FollowStats, PublicProfile, Repost } from "../../lib/types";

const GUTTER = 2;
const TILE = (Dimensions.get("window").width - GUTTER * 2) / 3;

type TabKey = "reposts";
type GridItem = {
  key: string;
  /** The listening_history row, when this tile is a real play. */
  historyId?: string;
  image: string | null;
  label: string;
  artist: string;
  trackId?: string;
  spotifyUrl?: string | null;
};

export default function UserProfile() {
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [follow, setFollow] = useState<FollowStats | null>(null);
  const [reposts, setReposts] = useState<Repost[]>([]);
  const [tab, setTab] = useState<TabKey>("reposts");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const player = useAudioPlayer(null);

  // Leaving this screen for another tab doesn't unmount it, so the preview
  // would otherwise keep playing over whatever you opened next.
  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          player.pause();
        } catch {
          // Player already released — nothing to silence.
        }
      };
    }, [player])
  );


  const load = useCallback(async () => {
    if (!username) return;
    try {
      const p = await api<PublicProfile>(
        `/api/profile/user?username=${encodeURIComponent(username)}`
      );
      setProfile(p);
      const handle = p.username ?? p.id;
      const [f, r] = await Promise.all([
        api<FollowStats>(`/api/follow?userId=${encodeURIComponent(handle)}`).catch(() => null),
        api<{ reposts: Repost[] }>(`/api/repost?username=${encodeURIComponent(handle)}`).catch(() => null),
      ]);
      setFollow(f);
      setReposts(r?.reposts ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this profile.");
    }
  }, [username]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);
  useEffect(() => resetTabBar, []);

  const toggleFollow = useCallback(async () => {
    if (!profile || busy) return;
    const handle = profile.username ?? profile.id;
    const was = follow?.isFollowing ?? false;
    // Optimistic including the count, so the button answers immediately.
    setFollow((f) =>
      f ? { ...f, isFollowing: !was, followerCount: Math.max(0, f.followerCount + (was ? -1 : 1)) } : f
    );
    setBusy(true);
    try {
      await api("/api/follow", { method: "POST", body: JSON.stringify({ userId: handle }) });
    } catch {
      setFollow((f) =>
        f ? { ...f, isFollowing: was, followerCount: Math.max(0, f.followerCount + (was ? 1 : -1)) } : f
      );
    } finally {
      setBusy(false);
    }
  }, [profile, follow?.isFollowing, busy]);

  const playTrack = useCallback(
    async (item: GridItem) => {
      setNowPlaying({
        title: item.label,
        artist: item.artist,
        image: item.image,
        url: null,
        spotifyUrl: item.spotifyUrl ?? null,
        historyId: item.historyId ?? item.trackId,
      });
      try {
        const params = new URLSearchParams({ track: item.label, artist: item.artist });
        if (item.trackId) params.set("trackId", item.trackId);
        const res = await api<{ previewUrl: string | null }>(`/api/preview?${params}`);
        if (!res.previewUrl) {
          setNowPlaying((p) => (p ? { ...p, error: "No preview available" } : p));
          return;
        }
        setNowPlaying((p) => (p ? { ...p, url: res.previewUrl } : p));
        player.replace(res.previewUrl);
        try {
          player.loop = true;
        } catch {}
        player.play();
      } catch {
        setNowPlaying((p) => (p ? { ...p, error: "Could not load preview" } : p));
      }
    },
    [player]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Profile not found."}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkLabel}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const items: GridItem[] =
    reposts.map((r) => ({
          key: r.id,
          image: r.album_image,
          label: r.track_name,
          artist: r.artist,
          trackId: r.history_id,
          historyId: r.history_id,
          spotifyUrl: r.track_url,
        }));

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onTabBarScroll}
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
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={14} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={theme.foreground} />
          </Pressable>
        </View>

        <View style={styles.header}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]} />
          )}
          <Text style={styles.name}>{profile.display_name ?? profile.username}</Text>
          {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <View style={styles.stats}>
            <Stat
              value={follow?.followingCount ?? 0}
              label="Following"
              onPress={() => router.push(`/follows?user=${encodeURIComponent(username)}&type=following` as never)}
            />
            <View style={styles.statDivider} />
            <Stat
              value={follow?.followerCount ?? 0}
              label="Followers"
              onPress={() => router.push(`/follows?user=${encodeURIComponent(username)}&type=followers` as never)}
            />
          </View>

          {follow?.isSelf ? null : (
            <Pressable
              onPress={() => void toggleFollow()}
              style={({ pressed }) => [
                styles.followButton,
                follow?.isFollowing && styles.followingButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.followLabel, follow?.isFollowing && styles.followingLabel]}>
                {follow?.isFollowing ? "Following" : "Follow"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.tabs}>
          <TabButton label="Reposts" icon="repeat" active={tab === "reposts"} onPress={() => setTab("reposts")} />
        </View>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              "No reposts yet"
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => void playTrack(item)}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              >
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.tileImage} />
                ) : (
                  <View style={[styles.tileImage, styles.avatarFallback]} />
                )}
                <View style={styles.tileScrim} />
                <Text style={styles.tileLabel} numberOfLines={1}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {nowPlaying ? (
        <PlayerSheet
          track={nowPlaying}
          player={player}
          onClose={() => {
            player.pause();
            setNowPlaying(null);
          }}
        />
      ) : null}
    </View>
  );
}

function Stat({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, pressed && onPress ? styles.pressed : null]}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: "grid" | "repeat";
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Ionicons
        name={active ? icon : (`${icon}-outline` as never)}
        size={22}
        color={active ? theme.foreground : theme.muted}
      />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      <View style={[styles.tabUnderline, active && styles.tabUnderlineActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
    gap: 12,
    paddingHorizontal: 32,
  },
  error: { color: "#ff6b6b", fontSize: 15, textAlign: "center" },
  backLink: { paddingHorizontal: 18, paddingVertical: 10 },
  backLinkLabel: { color: theme.foreground, fontSize: 15, fontWeight: "600" },
  topBar: { paddingHorizontal: 16 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
  },
  header: { alignItems: "center", paddingHorizontal: 24, gap: 6, paddingTop: 4 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 8 },
  avatarFallback: { backgroundColor: theme.surface },
  name: { color: theme.foreground, fontSize: 24, fontWeight: "700" },
  handle: { color: theme.muted, fontSize: 16 },
  bio: { color: theme.foreground, fontSize: 15, textAlign: "center", marginTop: 4 },
  stats: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  stat: { alignItems: "center", paddingHorizontal: 28, gap: 2 },
  statValue: { color: theme.foreground, fontSize: 20, fontWeight: "700" },
  statLabel: { color: theme.muted, fontSize: 13 },
  statDivider: { width: 1, height: 32, backgroundColor: theme.border },
  followButton: {
    marginTop: 18,
    alignSelf: "stretch",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: theme.foreground,
  },
  followingButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.border,
  },
  followLabel: { color: theme.background, fontSize: 16, fontWeight: "700" },
  followingLabel: { color: theme.foreground },
  pressed: { opacity: 0.7 },
  tabs: {
    flexDirection: "row",
    marginTop: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  tab: { flex: 1, alignItems: "center", paddingTop: 10, gap: 4 },
  tabLabel: { color: theme.muted, fontSize: 13 },
  tabLabelActive: { color: theme.foreground, fontWeight: "600" },
  tabUnderline: { height: 2, width: 64, backgroundColor: "transparent", marginTop: 6 },
  tabUnderlineActive: { backgroundColor: theme.foreground },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GUTTER, paddingTop: GUTTER },
  tile: { width: TILE, height: TILE, backgroundColor: theme.surface },
  tilePressed: { opacity: 0.6 },
  tileImage: { width: "100%", height: "100%" },
  tileScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  tileLabel: {
    position: "absolute",
    left: 6,
    right: 6,
    bottom: 6,
    color: theme.foreground,
    fontSize: 11,
  },
  empty: { alignItems: "center", paddingTop: 56 },
  emptyTitle: { color: theme.foreground, fontSize: 17, fontWeight: "600" },
});
