import { Ionicons } from "@expo/vector-icons";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Scrubber } from "./Scrubber";
import { TAB_BAR_CLEARANCE } from "./TabBar";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import type { DiscoverResponse, DiscoverTrack } from "../lib/types";

const { height: SCREEN_H } = Dimensions.get("window");

/** Genre groups the route serves; a refresh moves to a different one. */
const PAGES = 5;

export function DiscoverFeed({
  refreshKey = 0,
  isActive = true,
}: {
  refreshKey?: number;
  /** False while the pager has swiped to another tab. */
  isActive?: boolean;
}) {
  const listRef = useRef<FlatList<DiscoverTrack>>(null);
  const pageRef = useRef(0);
  const [tracks, setTracks] = useState<DiscoverTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // One player, re-pointed as the active card changes. Creating a player per
  // card would keep 60 of them alive and fight over the audio session.
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    // Music has to keep playing when the ringer switch is off, or the feed is
    // silent for anyone who leaves their phone muted — which is most people.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    // Each refresh asks for a different genre group, so you get a genuinely
    // new set rather than the same chart reshuffled.
    if (refreshKey > 0) {
      pageRef.current = (pageRef.current + 1 + Math.floor(Math.random() * (PAGES - 1))) % PAGES;
    }
    setLoading(true);
    api<DiscoverResponse>(`/api/discover?page=${pageRef.current}`)
      .then((data) => {
        setTracks((data.tracks ?? []).filter((t) => t.previewUrl));
        setActiveIndex(0);
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        setError(null);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load Discover.")
      )
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const active = tracks[activeIndex];

  // Swap the source when the visible card changes, and start it immediately —
  // a feed that waits for a tap before making sound isn't a feed.
  useEffect(() => {
    if (!active?.previewUrl) return;
    try {
      player.replace(active.previewUrl);
      // Loop the 30s preview, but never let this stop playback starting.
      try {
        player.loop = true;
      } catch {}
      player.play();
    } catch {
      // A source that fails to load shouldn't take the screen down with it.
    }
  }, [active?.previewUrl, player]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (typeof first?.index === "number") setActiveIndex(first.index);
    }
  ).current;

  // Silence it the moment the pager moves away; resume when it comes back.
  useEffect(() => {
    if (!isActive) {
      player.pause();
    } else if (tracks.length > 0) {
      player.play();
    }
  }, [isActive, player, tracks.length]);

  const toggle = useCallback(() => {
    if (status.playing) player.pause();
    else player.play();
  }, [status.playing, player]);

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
    <FlatList
      ref={listRef}
      style={styles.list}
      data={tracks}
      keyExtractor={(t) => t.trackId}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={SCREEN_H}
      snapToAlignment="start"
      decelerationRate="fast"
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      getItemLayout={(_, index) => ({
        length: SCREEN_H,
        offset: SCREEN_H * index,
        index,
      })}
      renderItem={({ item, index }) => (
        <Card
          track={item}
          isActive={index === activeIndex}
          isPlaying={status.playing}
          progress={status.duration > 0 ? status.currentTime / status.duration : 0}
          duration={status.duration}
          player={player}
          onToggle={toggle}
        />
      )}
    />
  );
}

function Card({
  track,
  isActive,
  isPlaying,
  progress,
  duration,
  player,
  onToggle,
}: {
  track: DiscoverTrack;
  isActive: boolean;
  isPlaying: boolean;
  progress: number;
  duration: number;
  player: AudioPlayer;
  onToggle: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable onPress={onToggle} style={[styles.card, { height: SCREEN_H }]}>
      {track.albumImage ? (
        <Image source={{ uri: track.albumImage }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artFallback]} />
      )}

      {/* Keeps the title legible over bright artwork. */}
      <View style={styles.scrim} />

      {isActive && !isPlaying ? (
        <View style={styles.glyph}>
          <Ionicons name="play" size={44} color="rgba(255,255,255,0.92)" />
        </View>
      ) : null}

      <View style={[styles.meta, { paddingBottom: TAB_BAR_CLEARANCE }]}>
        <Text style={styles.track} numberOfLines={2}>
          {track.name}
        </Text>
        <View style={styles.artistRow}>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist}
          </Text>
          {track.explicit ? <Text style={styles.explicit}>E</Text> : null}
        </View>

        <Scrubber player={player} progress={progress} duration={duration} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
    paddingHorizontal: 32,
  },
  error: { color: "#ff6b6b", fontSize: 15, textAlign: "center" },
  card: { width: "100%", backgroundColor: theme.background },
  art: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  artFallback: { backgroundColor: theme.surface },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  glyph: {
    position: "absolute",
    alignSelf: "center",
    top: SCREEN_H / 2 - 34,
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  meta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    gap: 8,
  },
  track: {
    color: theme.foreground,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  artistRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  artist: { color: "rgba(255,255,255,0.82)", fontSize: 16, flexShrink: 1 },
  explicit: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: "hidden",
  },
});
