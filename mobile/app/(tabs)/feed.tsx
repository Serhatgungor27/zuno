import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DiscoverFeed } from "../../components/DiscoverFeed";
import { PlayerSheet, type NowPlaying } from "../../components/PlayerSheet";
import { TAB_BAR_CLEARANCE } from "../../components/TabBar";
import { api } from "../../lib/api";
import { onTabBarScroll, resetTabBar } from "../../lib/tabBarScroll";
import { theme } from "../../lib/theme";
import type { FeedResponse, TrendingTrack, VibeItem } from "../../lib/types";

const WIDTH = Dimensions.get("window").width;

type Tab = "vibe" | "discover" | "trending";
const TABS: { key: Tab; label: string }[] = [
  { key: "vibe", label: "Vibe" },
  { key: "discover", label: "Discover" },
  { key: "trending", label: "Trending" },
];

/**
 * One feed screen with three modes, matching the web app. Discover is a tab
 * here rather than its own destination because it is a way of looking at the
 * feed, not a separate place.
 */
export default function Feed() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("discover");
  const [discoverKey, setDiscoverKey] = useState(0);

  const pager = useRef<ScrollView>(null);

  const goTo = useCallback((next: Tab) => {
    setTab(next);
    pager.current?.scrollTo({ x: WIDTH * TABS.findIndex((t) => t.key === next), animated: true });
  }, []);

  return (
    <View style={styles.container}>
      {/* All three pages stay mounted so swiping between them is instant and
          each keeps its scroll position. */}
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: WIDTH * TABS.findIndex((t) => t.key === "discover"), y: 0 }}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / WIDTH);
          const next = TABS[index]?.key;
          if (next && next !== tab) setTab(next);
        }}
      >
        <View style={styles.page}>
          <ListFeed tab="vibe" />
        </View>
        <View style={styles.page}>
          {/* Paused when swiped away from, or it keeps playing behind the
              other tabs. */}
          <DiscoverFeed refreshKey={discoverKey} isActive={tab === "discover"} />
        </View>
        <View style={styles.page}>
          <ListFeed tab="trending" />
        </View>
      </ScrollView>

      {/* Floats over Discover's artwork, sits above the lists. */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Text style={styles.wordmark}>zuno</Text>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => goTo(t.key)}
              hitSlop={8}
              style={styles.tabSlot}
            >
              <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
              {tab === t.key ? <View style={styles.tabMark} /> : null}
            </Pressable>
          ))}
        </View>
        <View style={styles.headerSpacer}>
          {tab === "discover" ? (
            <Pressable
              onPress={() => setDiscoverKey((k) => k + 1)}
              hitSlop={12}
              style={({ pressed }) => pressed && styles.refreshPressed}
            >
              <Ionicons name="refresh" size={22} color={theme.foreground} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Vibe and Trending are both lists of tracks, differing only in source. */
function ListFeed({ tab }: { tab: "vibe" | "trending" }) {
  const insets = useSafeAreaInsets();
  const [vibes, setVibes] = useState<VibeItem[]>([]);
  const [trending, setTrending] = useState<TrendingTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const player = useAudioPlayer(null);

  const load = useCallback(async () => {
    try {
      if (tab === "vibe") {
        const data = await api<FeedResponse>("/api/feed?type=vibe");
        setVibes(data.items ?? []);
      } else {
        const data = await api<{ tracks: TrendingTrack[] }>("/api/feed?type=trending");
        setTrending(data.tracks ?? []);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the feed.");
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);
  useEffect(() => resetTabBar, []);

  const play = useCallback(
    async (item: { title: string; artist: string; image: string | null; trackId?: string; url?: string | null }) => {
      setNowPlaying({
        title: item.title,
        artist: item.artist,
        image: item.image,
        url: null,
        spotifyUrl: item.url ?? null,
        historyId: item.trackId,
      });
      try {
        const params = new URLSearchParams({ track: item.title, artist: item.artist });
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

  const rows =
    tab === "vibe"
      ? vibes.map((v) => ({
          key: v.vibeId,
          title: v.track,
          artist: v.artist,
          image: v.albumImage,
          trackId: v.trackId,
          url: v.trackUrl,
          meta: v.userName + (v.repeatCount > 1 ? ` · ×${v.repeatCount}` : ""),
        }))
      : trending.map((t, i) => ({
          key: t.track_id,
          title: t.track_name,
          artist: t.artist,
          image: t.album_image,
          trackId: t.track_id,
          url: t.track_url,
          meta: `#${i + 1} · ${t.count} play${t.count === 1 ? "" : "s"}`,
        }));

  return (
    <>
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(r) => r.key}
        scrollEventThrottle={16}
        onScroll={onTabBarScroll}
        contentContainerStyle={{
          paddingTop: insets.top + 86,
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
        ListEmptyComponent={
          <Text style={styles.empty}>
            {error ??
              (tab === "vibe"
                ? "Nothing playing in the last 48 hours."
                : "No trending tracks in the last 24 hours.")}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void play(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.art} />
            ) : (
              <View style={[styles.art, styles.artFallback]} />
            )}
            <View style={styles.rowText}>
              <Text style={styles.track} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {item.artist}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.meta}
              </Text>
            </View>
          </Pressable>
        )}
      />

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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  page: { width: WIDTH },
  list: { flex: 1, backgroundColor: theme.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  wordmark: {
    width: 70,
    color: theme.foreground,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerSpacer: { width: 70, alignItems: "flex-end" },
  refreshPressed: { opacity: 0.5 },
  tabs: { flex: 1, flexDirection: "row" },
  tabSlot: { flex: 1, alignItems: "center" },
  tabLabel: { color: "rgba(255,255,255,0.4)", fontSize: 15, fontWeight: "700", textAlign: "center" },
  tabLabelActive: { color: theme.foreground },
  tabMark: {
    position: "absolute",
    bottom: -8,
    alignSelf: "center",
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.foreground,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  rowPressed: { opacity: 0.6 },
  art: { width: 56, height: 56, borderRadius: 6 },
  artFallback: { backgroundColor: theme.surface },
  rowText: { flex: 1, gap: 2 },
  track: { color: theme.foreground, fontSize: 16, fontWeight: "600" },
  artist: { color: theme.muted, fontSize: 14 },
  meta: { color: theme.accent, fontSize: 12 },
  empty: {
    color: theme.muted,
    fontSize: 15,
    textAlign: "center",
    marginTop: 48,
    paddingHorizontal: 32,
  },
});
