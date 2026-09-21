import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChartFilters, type ChartKind } from "../../components/ChartFilters";
import { DiscoverFeed } from "../../components/DiscoverFeed";
import { Fade } from "../../components/Fade";
import { PlayerSheet, type NowPlaying } from "../../components/PlayerSheet";
import { TAB_BAR_CLEARANCE } from "../../components/TabBar";
import { api } from "../../lib/api";
import { expandTabBar, onTabBarScroll, resetTabBar } from "../../lib/tabBarScroll";
import { theme } from "../../lib/theme";
import * as Linking from "expo-linking";

import type { ChartRow, FollowingItem } from "../../lib/types";

const WIDTH = Dimensions.get("window").width;

type Tab = "following" | "discover" | "trending";
const TABS: { key: Tab; label: string }[] = [
  { key: "following", label: "Following" },
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
  // True while Discover's progress bar is being dragged; the pager stands down
  // so the drag scrubs instead of changing tab.
  const [scrubbing, setScrubbing] = useState(false);

  // Moving between Following, Discover and Trending brings the bar back out.
  // It only expanded on route changes before, and the pager never changes
  // route — these three tabs are one screen with internal state.
  useEffect(() => {
    expandTabBar();
  }, [tab]);
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
        // Dragging Discover's progress bar is a horizontal gesture too, and
        // the pager would otherwise read it as a swipe to the next tab.
        scrollEnabled={!scrubbing}
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: WIDTH * TABS.findIndex((t) => t.key === "discover"), y: 0 }}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / WIDTH);
          const next = TABS[index]?.key;
          if (next && next !== tab) setTab(next);
        }}
      >
        <View style={styles.page}>
          <ListFeed tab="following" isActive={tab === "following"} />
        </View>
        <View style={styles.page}>
          {/* Paused when swiped away from, or it keeps playing behind the
              other tabs. */}
          <DiscoverFeed
            refreshKey={discoverKey}
            isActive={tab === "discover"}
            onScrubbing={setScrubbing}
          />
        </View>
        <View style={styles.page}>
          <ListFeed tab="trending" isActive={tab === "trending"} />
        </View>
      </ScrollView>

      {/* Floats over Discover's artwork, sits above the lists. */}
      <Fade
        direction="top"
        height={insets.top + 96}
        style={{ top: 0 }}
      />

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
function ListFeed({
  tab,
  isActive,
}: {
  tab: "following" | "trending";
  /** False while the pager is showing one of the other two tabs. */
  isActive: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [following, setFollowing] = useState<FollowingItem[]>([]);
  const [trending, setTrending] = useState<ChartRow[]>([]);
  const [kind, setKind] = useState<ChartKind>("songs");
  const [country, setCountry] = useState("global");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const player = useAudioPlayer(null);

  // Leaving this screen for another tab doesn't unmount it, so the preview
  // would otherwise keep playing over whatever you opened next.
  // Swiping to another tab does not unmount this list, so without this a
  // track started here keeps playing under Discover — two songs at once.
  useEffect(() => {
    if (isActive) return;
    try {
      player.pause();
    } catch {
      // Nothing loaded.
    }
  }, [isActive, player]);

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
    try {
      if (tab === "following") {
        const data = await api<{ items: FollowingItem[] }>("/api/feed?type=following_feed");
        setFollowing(data.items ?? []);
      } else {
        const data = await api<{ tracks: ChartRow[] }>(
          `/api/feed?type=trending_global&kind=${kind}&country=${country}`
        );
        setTrending(data.tracks ?? []);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the feed.");
    }
  }, [tab, kind, country]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);
  useEffect(() => resetTabBar, []);

  const play = useCallback(
    async (item: {
      title: string;
      artist: string;
      image: string | null;
      trackId?: string;
      url?: string | null;
      /** A real Spotify link, or null when the source has none. */
      spotifyUrl?: string | null;
      appleUrl?: string | null;
      preview?: string | null;
    }) => {
      setNowPlaying({
        title: item.title,
        artist: item.artist,
        image: item.image,
        url: null,
        spotifyUrl: item.spotifyUrl ?? null,
        appleUrl: item.appleUrl ?? null,
        historyId: item.trackId,
      });
      try {
        if (item.preview) {
          setNowPlaying((p) => (p ? { ...p, url: item.preview ?? null } : p));
          player.replace(item.preview);
          try {
            player.loop = true;
          } catch {}
          player.play();
          return;
        }
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
    tab === "following"
      ? following.map((f) => ({
          key: f.id,
          title: f.track,
          artist: f.artist,
          image: f.albumImage,
          trackId: f.trackId ?? undefined,
          url: f.trackUrl,
          // Likes and reposts carry the Spotify link they were saved with.
          spotifyUrl: f.trackUrl,
          appleUrl: null as string | null,
          openUrl: null as string | null,
          // Says who, and whether they played it or reposted it.
          meta: `${f.userName} ${f.kind === "repost" ? "reposted" : "liked"}`,
          preview: null as string | null,
        }))
      : trending.map((t) => ({
          key: t.trackId,
          title: t.name,
          artist: t.artist,
          image: t.albumImage,
          trackId: t.trackId,
          url: t.sourceUrl,
          // A chart row has no Spotify link. Leaving this null lets the sheet
          // fall back to a Spotify search for the track, instead of opening
          // Deezer or Apple Music from a button that says Spotify.
          spotifyUrl: null,
          // A country chart row IS an Apple Music link, so hand it over rather
          // than making Apple Music search for something we already know.
          appleUrl: t.source === "apple" ? t.sourceUrl : null,
          meta: `#${t.position}`,
          // Deezer's global chart ships previews; Apple's country charts do
          // not, so those fall back to the lookup.
          preview: t.previewUrl,
          // A podcast is not a 30-second preview — it opens where it lives.
          openUrl: t.kind === "podcast" ? t.sourceUrl : null,
        }));

  return (
    <>
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(r) => r.key}
        scrollEventThrottle={16}
        onScroll={onTabBarScroll}
        ListHeaderComponent={
          tab === "trending" ? (
            <ChartFilters
              kind={kind}
              country={country}
              onChange={(next) => {
                setKind(next.kind);
                setCountry(next.country);
              }}
            />
          ) : null
        }
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
              (tab === "following"
                ? "Follow some people and their music will show up here."
                : "Could not load the chart.")}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              const open = (item as { openUrl?: string | null }).openUrl;
              if (open) Linking.openURL(open).catch(() => {});
              else void play(item);
            }}
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
