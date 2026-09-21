import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
import type { ArtistResult, ArtistTrack } from "../../lib/types";

/** One artist's catalogue, reached from search. Tap a row to preview it. */
export default function ArtistScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [artist, setArtist] = useState<ArtistResult | null>(null);
  const [tracks, setTracks] = useState<ArtistTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const player = useAudioPlayer(null);

  useEffect(() => resetTabBar, []);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Leaving the screen ends the preview; the screen stays mounted otherwise.
  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          player.pause();
        } catch {
          // Nothing loaded.
        }
      };
    }, [player])
  );

  useEffect(() => {
    if (!id) return;
    let alive = true;
    api<{ artist: ArtistResult; tracks: ArtistTrack[] }>(
      `/api/artist?id=${encodeURIComponent(id)}`
    )
      .then((d) => {
        if (!alive) return;
        setArtist(d.artist);
        setTracks(d.tracks ?? []);
        setError(null);
      })
      .catch((e) =>
        alive && setError(e instanceof Error ? e.message : "Could not load this artist.")
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const play = useCallback(
    async (track: ArtistTrack) => {
      setNowPlaying({
        title: track.name,
        artist: track.artist,
        image: track.albumImage,
        url: null,
        spotifyUrl: track.spotifyUrl,
        historyId: track.trackId,
      });
      try {
        // Spotify names the track, Deezer supplies the sound — Spotify
        // stopped returning preview_url, so the preview is looked up on tap
        // rather than shipped with the list. /api/preview caches, so a second
        // tap on the same track is immediate.
        const params = new URLSearchParams({ track: track.name, artist: track.artist });
        const res = await api<{ previewUrl: string | null }>(`/api/preview?${params}`);
        if (!res.previewUrl) {
          setNowPlaying((p) => (p ? { ...p, error: "No preview for this one" } : p));
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

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={16}
        style={({ pressed }) => [
          styles.back,
          { top: insets.top + 6 },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="chevron-back" size={24} color={theme.foreground} />
      </Pressable>

      <FlatList
        data={tracks}
        keyExtractor={(t) => t.trackId}
        scrollEventThrottle={16}
        onScroll={onTabBarScroll}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + 24 }}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + 56 }]}>
            {artist?.image ? (
              <Image source={{ uri: artist.image }} style={styles.portrait} />
            ) : (
              <View style={[styles.portrait, styles.portraitFallback]} />
            )}
            <Text style={styles.name}>{artist?.name}</Text>
            <Text style={styles.meta}>
              {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>Nothing with a preview for this artist.</Text>
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => void play(item)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.position}>{index + 1}</Text>
            {item.albumImage ? (
              <Image source={{ uri: item.albumImage }} style={styles.art} />
            ) : (
              <View style={[styles.art, styles.artFallback]} />
            )}
            <View style={styles.rowText}>
              <Text style={styles.track} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {item.artist}
                {item.explicit ? "  ·  E" : ""}
              </Text>
            </View>
            <Ionicons name="play" size={16} color={theme.muted} />
          </Pressable>
        )}
      />

      {nowPlaying ? (
        <PlayerSheet
          track={nowPlaying}
          player={player}
          onClose={() => {
            try {
              player.pause();
            } catch {
              // Nothing loaded.
            }
            setNowPlaying(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
    paddingHorizontal: 32,
  },
  error: { color: "#ff6b6b", fontSize: 15, textAlign: "center" },
  header: { alignItems: "center", paddingBottom: 18, gap: 6 },
  // Fixed to the screen rather than the header: it was positioned inside a
  // block whose own top padding is the safe area, which put it under the
  // status bar and out of reach.
  back: {
    position: "absolute",
    left: 10,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  portrait: { width: 132, height: 132, borderRadius: 66, backgroundColor: theme.surface },
  portraitFallback: { backgroundColor: theme.surface },
  name: { color: theme.foreground, fontSize: 24, fontWeight: "700", marginTop: 6 },
  meta: { color: theme.muted, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  position: { color: theme.muted, fontSize: 13, width: 22, textAlign: "center" },
  art: { width: 46, height: 46, borderRadius: 6, backgroundColor: theme.surface },
  artFallback: { backgroundColor: theme.surface },
  rowText: { flex: 1, gap: 2 },
  track: { color: theme.foreground, fontSize: 15, fontWeight: "600" },
  sub: { color: theme.muted, fontSize: 13 },
  pressed: { opacity: 0.6 },
  empty: { color: theme.muted, fontSize: 15, textAlign: "center", marginTop: 40 },
});
