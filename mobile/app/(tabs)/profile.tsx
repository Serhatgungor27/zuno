import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
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

import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { theme } from "../../lib/theme";
import type {
  FollowStats,
  HistoryTrack,
  Repost,
  Taste,
  ZunoUser,
} from "../../lib/types";

const GUTTER = 2;
const TILE = (Dimensions.get("window").width - GUTTER * 2) / 3;

type TabKey = "vibes" | "reposts" | "taste";

type Me = { ok: boolean; username: string; avatar_url: string | null };

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();

  const [me, setMe] = useState<Me | null>(null);
  const [user, setUser] = useState<ZunoUser | null>(null);
  const [follow, setFollow] = useState<FollowStats | null>(null);
  const [vibes, setVibes] = useState<HistoryTrack[]>([]);
  const [reposts, setReposts] = useState<Repost[]>([]);
  const [taste, setTaste] = useState<Taste | null>(null);

  const [tab, setTab] = useState<TabKey>("vibes");
  const [scrollY, setScrollY] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Two identities: the Spotify account keys history and follows, the
      // Supabase profile keys reposts. Both are "you".
      const [profile, account] = await Promise.all([
        api<Me>("/api/profile/me"),
        api<{ ok: boolean; user: ZunoUser }>("/api/user").catch(() => null),
      ]);
      setMe(profile);
      setUser(account?.user ?? null);

      const spotifyHandle = account?.user?.username ?? account?.user?.spotify_id;

      const [f, h, r, t] = await Promise.all([
        spotifyHandle
          ? api<FollowStats>(`/api/follow?userId=${encodeURIComponent(spotifyHandle)}`).catch(() => null)
          : null,
        spotifyHandle
          ? api<{ tracks: HistoryTrack[] }>(`/api/history?userId=${encodeURIComponent(spotifyHandle)}`).catch(() => null)
          : null,
        api<{ reposts: Repost[] }>(`/api/repost?username=${encodeURIComponent(profile.username)}`).catch(() => null),
        api<Taste>("/api/taste").catch(() => null),
      ]);

      setFollow(f);
      setVibes(h?.tracks ?? []);
      setReposts(r?.reposts ?? []);
      setTaste(t);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your profile.");
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

  const displayName = user?.display_name ?? session?.user.email ?? "";
  const handle = me?.username ?? user?.username ?? "";
  const avatar = user?.image ?? me?.avatar_url ?? null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.muted} />
      }
    >
      <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
      <View style={styles.topBar}>
        <Pressable onPress={() => void signOut()} hitSlop={12}>
          <Ionicons name="settings-outline" size={24} color={theme.foreground} />
        </Pressable>
      </View>

      <View style={styles.header}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]} />
        )}
        <Text style={styles.name}>{displayName}</Text>
        {handle ? <Text style={styles.handle}>@{handle}</Text> : null}

        <View style={styles.stats}>
          <Stat value={follow?.followingCount ?? 0} label="Following" />
          <View style={styles.statDivider} />
          <Stat value={follow?.followerCount ?? 0} label="Followers" />
          <View style={styles.statDivider} />
          <Stat value={vibes.length} label="Vibes" />
        </View>

        <Pressable
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
        >
          <Text style={styles.editLabel}>Edit Profile</Text>
        </Pressable>
      </View>

      </View>

      <View style={styles.tabs}>
        <TabButton icon="grid" label="Vibes" active={tab === "vibes"} onPress={() => setTab("vibes")} />
        <TabButton icon="repeat" label="Reposts" active={tab === "reposts"} onPress={() => setTab("reposts")} />
        <TabButton icon="heart" label="Taste" active={tab === "taste"} onPress={() => setTab("taste")} />
      </View>

      <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tab === "vibes" ? (
        <Grid
          items={vibes.map((v) => ({
            key: v.track_id + v.played_at,
            image: v.album_image,
            label: v.track_name,
            url: trackUrl(v.track_url, v.track_name, v.artist),
          }))}
          emptyTitle="No vibes yet"
          emptyBody="Your listening history will appear here."
        />
      ) : tab === "reposts" ? (
        <Grid
          items={reposts.map((r) => ({
            key: r.id,
            image: r.album_image,
            label: r.track_name,
            url: trackUrl(r.track_url, r.track_name, r.artist),
          }))}
          emptyTitle="No reposts yet"
          emptyBody="Tracks you repost will appear here."
        />
      ) : (
        <TasteView taste={taste} />
      )}
      </View>
    </ScrollView>

    {/* Pinned copy. Rendering our own avoids ScrollView's sticky wrapper,
        which collapsed the row. */}
    {scrollY >= headerHeight && headerHeight > 0 ? (
      <View style={[styles.tabs, styles.tabsPinned, { top: insets.top }]}>
        <TabButton icon="grid" label="Vibes" active={tab === "vibes"} onPress={() => setTab("vibes")} />
        <TabButton icon="repeat" label="Reposts" active={tab === "reposts"} onPress={() => setTab("reposts")} />
        <TabButton icon="heart" label="Taste" active={tab === "taste"} onPress={() => setTab("taste")} />
      </View>
    ) : null}
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: "grid" | "repeat" | "heart";
  label: string;
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

/**
 * Where a tile goes when tapped. Matches the web profile, which links to
 * track_url and falls back to a Spotify search when the row has none.
 */
function trackUrl(url: string | null, name: string, artist: string): string {
  if (url) return url;
  const q = encodeURIComponent(`${name} ${artist}`.trim());
  return `https://open.spotify.com/search/${q}`;
}

function Grid({
  items,
  emptyTitle,
  emptyBody,
}: {
  items: { key: string; image: string | null; label: string; url: string }[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="musical-notes" size={28} color={theme.muted} />
        </View>
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyBody}>{emptyBody}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          onPress={() => {
            // Opens the Spotify app when installed, the web player otherwise.
            Linking.openURL(item.url).catch(() => {});
          }}
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
  );
}

function TasteView({ taste }: { taste: Taste | null }) {
  const sections: { title: string; values: string[] }[] = [
    { title: "MUSIC", values: taste?.music_genres ?? [] },
    { title: "PODCASTS", values: taste?.podcast_genres ?? [] },
    { title: "ARTISTS", values: taste?.favorite_artists ?? [] },
  ].filter((s) => s.values.length > 0);

  if (sections.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="heart-outline" size={28} color={theme.muted} />
        </View>
        <Text style={styles.emptyTitle}>No taste set</Text>
        <Text style={styles.emptyBody}>Pick genres in Settings.</Text>
      </View>
    );
  }

  return (
    <View style={styles.taste}>
      {sections.map((s) => (
        <View key={s.title} style={styles.tasteSection}>
          <Text style={styles.tasteTitle}>{s.title}</Text>
          <View style={styles.chips}>
            {s.values.map((v) => (
              <View key={v} style={styles.chip}>
                <Text style={styles.chipLabel}>{v}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
  },
  topBar: { alignItems: "flex-end", paddingHorizontal: 20, paddingBottom: 4 },
  header: { alignItems: "center", paddingHorizontal: 24, gap: 6 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 8 },
  avatarFallback: { backgroundColor: theme.surface },
  name: { color: theme.foreground, fontSize: 24, fontWeight: "700" },
  handle: { color: theme.muted, fontSize: 16 },
  stats: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  stat: { alignItems: "center", paddingHorizontal: 28, gap: 2 },
  statValue: { color: theme.foreground, fontSize: 20, fontWeight: "700" },
  statLabel: { color: theme.muted, fontSize: 13 },
  statDivider: { width: 1, height: 32, backgroundColor: theme.border },
  editButton: {
    marginTop: 18,
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  pressed: { opacity: 0.7 },
  editLabel: { color: theme.foreground, fontSize: 16, fontWeight: "600" },
  tabs: {
    flexDirection: "row",
    // Explicit width and stretch: as a sticky header this View is wrapped by
    // the ScrollView, and a wrapper that does not stretch would collapse the
    // row and stack the tabs.
    width: "100%",
    alignSelf: "stretch",
    paddingTop: 24,
    backgroundColor: theme.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  tab: { flex: 1, flexBasis: 0, alignItems: "center", paddingTop: 10, gap: 4 },
  tabLabel: { color: theme.muted, fontSize: 13 },
  tabLabelActive: { color: theme.foreground, fontWeight: "600" },
  tabUnderline: { height: 2, width: 64, backgroundColor: "transparent", marginTop: 6 },
  tabUnderlineActive: { backgroundColor: theme.foreground },
  tabsPinned: { position: "absolute", left: 0, right: 0, paddingTop: 0 },
  error: { color: "#ff6b6b", fontSize: 14, padding: 20 },
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
  empty: { alignItems: "center", paddingTop: 56, paddingHorizontal: 32, gap: 8 },
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
  emptyBody: { color: theme.muted, fontSize: 14, textAlign: "center" },
  taste: { paddingHorizontal: 24, paddingTop: 24, gap: 24 },
  tasteSection: { gap: 10 },
  tasteTitle: { color: theme.muted, fontSize: 12, letterSpacing: 1.2, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipLabel: { color: theme.foreground, fontSize: 15 },
});
