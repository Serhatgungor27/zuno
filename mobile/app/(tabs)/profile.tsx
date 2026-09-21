import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import { useAuth } from "../../lib/auth";
import { theme } from "../../lib/theme";
import type {
  FollowStats,
  Repost,
  Taste,
  ZunoUser,
  LikedTrack,
} from "../../lib/types";

const GUTTER = 2;
const TILE = (Dimensions.get("window").width - GUTTER * 2) / 3;
// Two columns with a 16pt outer margin and a 10pt gutter, as Spotify uses.
// Sized so roughly two and a half cards show, which reads as "scrollable"
// without anyone having to try it.
const SHELF_CARD_W = Math.round((Dimensions.get("window").width - 32 - 20) / 2.4);

type TabKey = "liked" | "reposts" | "taste";

type Me = { ok: boolean; username: string; avatar_url: string | null };

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [me, setMe] = useState<Me | null>(null);
  const [user, setUser] = useState<ZunoUser | null>(null);
  const [follow, setFollow] = useState<FollowStats | null>(null);
  const [reposts, setReposts] = useState<Repost[]>([]);
  // Liking something and never seeing it again is the hole in the loop —
  // a like has to lead somewhere or it is just a vote for the algorithm.
  const [liked, setLiked] = useState<LikedTrack[]>([]);
  const [taste, setTaste] = useState<Taste | null>(null);

  const [tab, setTab] = useState<TabKey>("liked");
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [playingKey, setPlayingKey] = useState<string | undefined>(undefined);
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

      const [f, r, t, l] = await Promise.all([
        spotifyHandle
          ? api<FollowStats>(`/api/follow?userId=${encodeURIComponent(spotifyHandle)}`).catch(() => null)
          : null,
        api<{ reposts: Repost[] }>(`/api/repost?username=${encodeURIComponent(profile.username)}`).catch(() => null),
        api<Taste>("/api/taste").catch(() => null),
        api<{ tracks: LikedTrack[] }>("/api/discover/like").catch(() => null),
      ]);

      setFollow(f);
      setReposts(r?.reposts ?? []);
      setTaste(t);
      setLiked(l?.tracks ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your profile.");
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Leaving with the bar hidden would strand it on the next screen.
  useEffect(() => resetTabBar, []);

  /**
   * History and repost rows carry no preview URL, so the track is resolved on
   * demand. The card appears immediately in a loading state rather than after
   * the lookup — a tap that does nothing for a second reads as a broken tap.
   */
  const playTrack = useCallback(
    async (item: GridItem) => {
      setPlayingKey(item.key);
      setNowPlaying({
        title: item.label,
        artist: item.artist,
        image: item.image,
        url: null,
        spotifyUrl: item.spotifyUrl ?? null,
        // The vibe itself, not the catalogue track — likes and comments hang
        // off the play, not the song.
        historyId: item.historyId ?? item.trackId,
      });
      try {
        // A liked track already carries its preview; only look one up when it
        // does not.
        if (item.previewUrl) {
          setNowPlaying((p) => (p ? { ...p, url: item.previewUrl ?? null } : p));
          player.replace(item.previewUrl);
          try {
            player.loop = true;
          } catch {}
          player.play();
          return;
        }
        const params = new URLSearchParams({ track: item.label, artist: item.artist });
        if (item.trackId) params.set("trackId", item.trackId);
        const res = await api<{ previewUrl: string | null }>(`/api/preview?${params}`);
        if (!res.previewUrl) {
          setNowPlaying((p) => (p ? { ...p, error: "No preview available" } : p));
          return;
        }
        setNowPlaying((p) => (p ? { ...p, artist: item.artist, url: res.previewUrl } : p));
        player.replace(res.previewUrl);
        // Loop the 30s preview, but never let this stop playback starting.
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

  const stopTrack = useCallback(() => {
    player.pause();
    setNowPlaying(null);
    setPlayingKey(undefined);
  }, [player]);

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
      contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={(e) => {
        setScrollY(e.nativeEvent.contentOffset.y);
        onTabBarScroll(e);
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.muted} />
      }
    >
      <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.push("/settings")} hitSlop={12}>
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
          <Stat
            value={follow?.followingCount ?? 0}
            label="Following"
            onPress={handle ? () => router.push(`/follows?user=${encodeURIComponent(handle)}&type=following` as never) : undefined}
          />
          <View style={styles.statDivider} />
          <Stat
            value={follow?.followerCount ?? 0}
            label="Followers"
            onPress={handle ? () => router.push(`/follows?user=${encodeURIComponent(handle)}&type=followers` as never) : undefined}
          />
        </View>

        <Pressable
          onPress={() => router.push("/edit-profile")}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
        >
          <Text style={styles.editLabel}>Edit Profile</Text>
        </Pressable>
      </View>

      </View>

      <View style={styles.tabs}>
        <TabButton icon="heart" label="Liked" active={tab === "liked"} onPress={() => setTab("liked")} />
        <TabButton icon="repeat" label="Reposts" active={tab === "reposts"} onPress={() => setTab("reposts")} />
        <TabButton icon="sparkles" label="Taste" active={tab === "taste"} onPress={() => setTab("taste")} />
      </View>

      <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tab === "liked" ? (
        <Grid
          items={liked.map((l) => ({
            key: l.trackId,
            image: l.albumImage,
            label: l.name,
            artist: l.artist,
            trackId: l.trackId,
            previewUrl: l.previewUrl,
            spotifyUrl: l.spotifyUrl,
          }))}
          emptyTitle="Nothing liked yet"
          emptyBody="Tap the heart on a track in Discover and it lands here."
          onPress={playTrack}
          playingKey={playingKey}
        />
      ) : tab === "reposts" ? (
        <Grid
          items={reposts.map((r) => ({
            key: r.id,
            image: r.album_image,
            label: r.track_name,
            artist: r.artist,
            trackId: r.history_id,
            historyId: r.history_id,
            spotifyUrl: r.track_url,
          }))}
          emptyTitle="No reposts yet"
          emptyBody="Tracks you repost will appear here."
          onPress={playTrack}
          playingKey={playingKey}
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
        <TabButton icon="heart" label="Liked" active={tab === "liked"} onPress={() => setTab("liked")} />
        <TabButton icon="repeat" label="Reposts" active={tab === "reposts"} onPress={() => setTab("reposts")} />
        <TabButton icon="sparkles" label="Taste" active={tab === "taste"} onPress={() => setTab("taste")} />
      </View>
    ) : null}

    {nowPlaying ? (
      <PlayerSheet track={nowPlaying} player={player} onClose={stopTrack} />
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
  icon,
  label,
  active,
  onPress,
}: {
  icon: "grid" | "repeat" | "heart" | "sparkles";
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

type GridItem = {
  key: string;
  /** A preview already known, so the sheet need not look one up. */
  previewUrl?: string | null;
  /** The listening_history row, when this tile is a real play. */
  historyId?: string;
  image: string | null;
  label: string;
  artist: string;
  trackId?: string;
  spotifyUrl?: string | null;
};

function Grid({
  items,
  emptyTitle,
  emptyBody,
  onPress,
  playingKey,
}: {
  items: GridItem[];
  emptyTitle: string;
  emptyBody: string;
  onPress: (item: GridItem) => void;
  playingKey?: string;
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
          onPress={() => onPress(item)}
        >
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.tileImage} />
          ) : (
            <View style={[styles.tileImage, styles.avatarFallback]} />
          )}
          <View style={styles.tileScrim} />
          {playingKey === item.key ? (
            <View style={styles.tilePlaying}>
              <Ionicons name="volume-high" size={14} color={theme.accent} />
            </View>
          ) : null}
          <Text style={styles.tileLabel} numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Taste cards: real genre artwork behind a centred label.
 *
 * Deezer publishes curated collage art per genre and the ids are stable even
 * though the names come back localised, so the map is by id. Anything without
 * artwork — Country, every podcast genre, and free-text artists — falls back
 * to a colour block, hashed from the name so it stays the same between
 * sessions rather than shuffling on each render.
 */
const DEEZER_GENRE: Record<string, number> = {
  "Hip-Hop": 116,
  "R&B": 165,
  Pop: 132,
  Rock: 152,
  Electronic: 106,
  Jazz: 129,
  Classical: 98,
  Afrobeats: 2,
  Latin: 197,
  Metal: 464,
  Indie: 85,
  Soul: 169,
  Reggae: 144,
  Dance: 113,
  "K-Pop": 16,
};

/**
 * Podcast categories have no genre-artwork endpoint the way music does, so
 * each is pinned to the cover of a representative show from the iTunes
 * podcast directory. Resolved once and baked in rather than searched at
 * runtime — it is 15 fixed values, and a lookup per card would be 15 requests
 * every time the tab opens. If a URL ever dies the card falls back to its
 * colour block, because the colour is painted underneath the image.
 */
const PODCAST_ART: Record<string, string> = {
  "True Crime":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/8c/35/04/8c350430-2fbf-98d0-0a25-00b76550ffeb/mza_13445204151221888086.jpg/600x600bb.jpg",
  "Comedy":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts124/v4/88/f3/c0/88f3c004-6ba0-e581-35c8-f4bc692ec938/mza_5246233194426696407.jpg/600x600bb.jpg",
  "Tech":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/ec/7b/2c/ec7b2c25-5c3a-4ba0-5472-d83b1046f8aa/mza_11538258655927977860.jpg/600x600bb.jpg",
  "Business":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/ab/11/06/ab11065a-57cd-8472-526e-d5799b2a8163/mza_13207937671651466185.jpg/600x600bb.jpg",
  "Health":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/cd/da/74/cdda741e-3cc9-76ca-4133-f514254ea9eb/mza_3127523497318925467.jpg/600x600bb.jpg",
  "Sports":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/35/74/6a/35746a0c-7687-7dde-ff04-338d93e78303/mza_10377078556009223546.jpg/600x600bb.jpg",
  "News":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/27/a0/ab/27a0abb7-817f-d80c-4fed-6fd04d424333/mza_16804553558295235422.jpg/600x600bb.jpg",
  "Science":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/d7/88/9b/d7889bab-dca5-77ba-3d0c-7fae8f16ab11/mza_8810454848871508.jpg/600x600bb.jpg",
  "History":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/bf/89/a5/bf89a586-3f77-bf37-7ba3-b75f1bca7bfa/mza_1664785978944494824.jpg/600x600bb.jpg",
  "Culture":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/e1/e9/94/e1e994a8-4a05-9447-f3b4-a68cd3325a2f/mza_190305956483207942.jpg/600x600bb.jpg",
  "Politics":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/93/4f/85/934f8542-7a14-cf77-7d0e-63604579de3c/mza_4576536635025194283.jpg/600x600bb.jpg",
  "Education":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/c6/2f/c7/c62fc776-797d-6de9-2028-4031c6c97306/mza_5737607185143431930.jpg/600x600bb.jpg",
  "Finance":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/4a/57/b0/4a57b01e-df6a-0c5b-378e-07c8eb88b039/mza_17057213945640981147.jpeg/600x600bb.jpg",
  "Entertainment":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/2c/65/b3/2c65b33a-b613-b702-c74d-1803a8a0280e/mza_7123405816929739117.jpg/600x600bb.jpg",
  "Self-Help":
    "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/55/cb/2b/55cb2b32-1d7e-8231-1a09-b8bcac6a90e2/mza_11101309328025720899.png/600x600bb.jpg",
};

const CARD_COLOURS = [
  "#8D67AB", "#006450", "#477D1D", "#E13300", "#537AA1",
  "#E8115B", "#1E3264", "#DC148C", "#B02897", "#148A08",
  "#7358FF", "#BA5D07", "#503750", "#0D73EC", "#E91429",
];

/**
 * Artist photos, looked up once per name and kept for the session. Artists are
 * free text so they cannot be baked in like genres, but a given profile only
 * lists a handful and the cache means switching tabs does not refetch.
 */
const artistArt = new Map<string, string | null>();

async function fetchArtistArt(
  name: string,
  deezerId?: number
): Promise<string | null> {
  const key = deezerId ? `id:${deezerId}` : name;
  const cached = artistArt.get(key);
  if (cached !== undefined) return cached;
  try {
    // An id is exact: it is the artist the user picked out of the search list.
    // Without one, fall back to searching the name and take the artist with
    // the most fans, since a name on its own can belong to several people.
    const res = await fetch(
      deezerId
        ? `https://api.deezer.com/artist/${deezerId}`
        : `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`
    );
    const json = (await res.json()) as
      | { picture_xl?: string }
      | { data?: { picture_xl?: string; nb_fan?: number }[] };

    const url = deezerId
      ? ((json as { picture_xl?: string }).picture_xl ?? null)
      : ((json as { data?: { picture_xl?: string; nb_fan?: number }[] }).data ?? [])
          .slice()
          .sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0]?.picture_xl ?? null;

    artistArt.set(key, url);
    return url;
  } catch {
    artistArt.set(key, null);
    return null;
  }
}

function colourFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CARD_COLOURS[hash % CARD_COLOURS.length];
}

function TasteCard({
  label,
  artist,
  deezerId,
}: {
  label: string;
  artist?: boolean;
  deezerId?: number;
}) {
  const genreId = DEEZER_GENRE[label];
  const fixedArt = genreId
    // The endpoint 302s to the CDN; Image follows redirects.
    ? `https://api.deezer.com/genre/${genreId}/image?size=xl`
    : (PODCAST_ART[label] ?? null);

  const cacheKey = deezerId ? `id:${deezerId}` : label;
  const [lookedUp, setLookedUp] = useState<string | null>(
    artist ? (artistArt.get(cacheKey) ?? null) : null
  );

  useEffect(() => {
    if (!artist || fixedArt || artistArt.get(cacheKey) !== undefined) return;
    let alive = true;
    fetchArtistArt(label, deezerId).then((url) => {
      if (alive) setLookedUp(url);
    });
    return () => {
      alive = false;
    };
  }, [artist, label, fixedArt, deezerId, cacheKey]);

  const art = fixedArt ?? lookedUp;

  return (
    // The colour sits underneath always, so a failed image degrades to it
    // rather than to an empty box.
    <View style={[styles.tasteCard, { backgroundColor: colourFor(label) }]}>
      {art ? (
        <Image source={{ uri: art }} style={styles.tasteCardArt} />
      ) : null}
      {/* Enough scrim that a busy collage never swallows the label. */}
      <View style={styles.tasteCardScrim} />
      <Text style={styles.tasteCardLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function TasteView({ taste }: { taste: Taste | null }) {
  const sections: { title: string; values: string[]; artist?: boolean }[] = [
    { title: "FAVOURITE ARTISTS", values: taste?.favorite_artists ?? [], artist: true },
    { title: "MUSIC", values: taste?.music_genres ?? [] },
    { title: "PODCASTS", values: taste?.podcast_genres ?? [] },
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
          {/* A shelf per section: ten artists scroll sideways instead of
              pushing everything below them off the screen. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tasteRow}
          >
            {s.values.map((v) => (
              <TasteCard
                key={v}
                label={v}
                artist={s.artist}
                deezerId={taste?.favorite_artist_ids?.[v]}
              />
            ))}
          </ScrollView>
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
  tilePlaying: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
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
  taste: { paddingTop: 20, gap: 26 },
  tasteSection: { gap: 12 },
  tasteTitle: {
    color: theme.foreground,
    fontSize: 13,
    letterSpacing: 1.2,
    fontWeight: "700",
    paddingHorizontal: 18,
  },
  tasteRow: { gap: 10, paddingHorizontal: 16 },
  tasteCard: {
    width: SHELF_CARD_W,
    height: SHELF_CARD_W / 1.45,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  tasteCardArt: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  tasteCardScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  tasteCardLabel: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
    paddingHorizontal: 10,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 8,
  },
});
