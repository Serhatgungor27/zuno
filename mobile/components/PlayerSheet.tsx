import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayerStatus, type AudioPlayer } from "expo-audio";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Scrubber } from "./Scrubber";
import { api } from "../lib/api";
import { theme } from "../lib/theme";

export type NowPlaying = {
  title: string;
  artist: string;
  image: string | null;
  /** null while the preview URL is still being looked up. */
  url: string | null;
  /** Set when there is no preview to be had. */
  error?: string;
  spotifyUrl?: string | null;
  /** Identifies the track for likes and reposts. */
  historyId?: string;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_H * 0.8;
const ART_SIZE = Math.min(SCREEN_W * 0.74, SHEET_HEIGHT * 0.44);

/**
 * The track sheet: full-bleed artwork with the metadata and actions laid over
 * it, the same composition as a Discover card rather than a conventional
 * player. Sized to 80% so the profile stays visible behind it and the
 * drag-to-dismiss is discoverable.
 */
export function PlayerSheet({
  track,
  player,
  onClose,
}: {
  track: NowPlaying;
  player: AudioPlayer;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const status = useAudioPlayerStatus(player);
  const loading = track.url === null && !track.error;
  const progress =
    status.duration > 0 ? status.currentTime / status.duration : 0;

  const dragY = useMemo(() => new Animated.Value(0), []);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 110 || g.vy > 0.7) {
            Animated.timing(dragY, {
              toValue: SHEET_HEIGHT,
              duration: 170,
              useNativeDriver: true,
            }).start(onClose);
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
      }),
    [dragY, onClose]
  );

  // Gentle repeating nudge so the handle reads as draggable.
  const hintY = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hintY, { toValue: 5, duration: 700, useNativeDriver: true }),
        Animated.timing(hintY, { toValue: 0, duration: 700, useNativeDriver: true }),
        Animated.delay(900),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hintY]);

  const glyphOpacity = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    glyphOpacity.setValue(1);
    // While the preview is still resolving the spinner has to stay put.
    if (loading) return;
    const anim = Animated.sequence([
      Animated.delay(1100),
      Animated.timing(glyphOpacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [status.playing, loading, glyphOpacity]);

  const toggle = () => {
    if (loading || track.error) return;
    if (status.playing) player.pause();
    else player.play();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY: dragY }] }]}
        >
          <Pressable style={styles.card} onPress={toggle}>
            {/* Blurred artwork backdrop, as on a Discover card. */}
            {track.image ? (
              <Image
                source={{ uri: track.image }}
                style={styles.backdropArt}
                blurRadius={40}
              />
            ) : null}
            <View style={styles.scrim} />

            <View style={styles.artWrap}>
              {track.image ? (
                <Image source={{ uri: track.image }} style={styles.art} />
              ) : (
                <View style={[styles.art, styles.artFallback]} />
              )}
            </View>

            <Animated.View
              style={[styles.centerGlyph, { opacity: glyphOpacity }]}
              pointerEvents="none"
            >
              <View style={styles.glyph}>
                {loading ? (
                  <ActivityIndicator color="rgba(255,255,255,0.92)" />
                ) : (
                  <Ionicons
                    name={status.playing ? "pause" : "play"}
                    size={44}
                    color="rgba(255,255,255,0.92)"
                  />
                )}
              </View>
            </Animated.View>

            <Rail track={track} />

            <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
              <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={2}>
                  {track.title}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {track.error ?? track.artist}
                </Text>
              </View>

              <Scrubber player={player} progress={progress} duration={status.duration} />

              <OpenIn track={track} />
            </View>
          </Pressable>

          {/* Overlaid so the artwork reaches the top edge of the sheet. */}
          <View style={styles.handleZone} {...pan.panHandlers}>
            <Animated.View
              style={[styles.grabber, { transform: [{ translateY: hintY }] }]}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Draggable progress bar. The visible bar stays thin, but the touch target is
 * the full row height — a 4px bar is almost impossible to grab with a thumb.
 */
/** Vertical action rail, laid over the artwork on the right. */
function Rail({ track }: { track: NowPlaying }) {
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [busy, setBusy] = useState(false);

  const id = track.historyId;

  useEffect(() => {
    if (!id) return;
    api<{ liked: boolean }>(
      `/api/vibe/like?historyId=${encodeURIComponent(id)}`
    )
      .then((r) => setLiked(!!r.liked))
      .catch(() => {});
  }, [id]);

  const toggleLike = useCallback(async () => {
    if (!id || busy) return;
    // Optimistic — a heart that waits on a round trip feels broken.
    const next = !liked;
    setLiked(next);
    setBusy(true);
    try {
      await api("/api/vibe/like", {
        method: "POST",
        body: JSON.stringify({ historyId: id }),
      });
    } catch {
      setLiked(!next);
    } finally {
      setBusy(false);
    }
  }, [id, liked, busy]);

  const toggleRepost = useCallback(async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const res = await api<{ action: "reposted" | "removed" }>("/api/repost", {
        method: "POST",
        body: JSON.stringify({
          historyId: id,
          trackName: track.title,
          artist: track.artist,
          albumImage: track.image,
          trackUrl: track.spotifyUrl ?? null,
        }),
      });
      setReposted(res.action === "reposted");
    } catch {
      // Say nothing rather than claim a repost that did not happen.
    } finally {
      setBusy(false);
    }
  }, [id, busy, track]);

  const share = useCallback(() => {
    const url =
      track.spotifyUrl ??
      `https://open.spotify.com/search/${encodeURIComponent(`${track.title} ${track.artist}`.trim())}`;
    Share.share({
      message: `${track.title} — ${track.artist}\n${url}`,
    }).catch(() => {});
  }, [track]);

  return (
    <View style={styles.rail}>
      <RailButton
        icon={liked ? "heart" : "heart-outline"}
        tint={liked ? "#ff3b5c" : "#fff"}
        onPress={() => void toggleLike()}
      />
      <RailButton
        icon="repeat"
        tint={reposted ? "#4ade80" : "#fff"}
        onPress={() => void toggleRepost()}
      />
      <RailButton icon="share-social-outline" tint="#fff" onPress={share} />
    </View>
  );
}

function RailButton({
  icon,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.railButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={22} color={tint} />
    </Pressable>
  );
}

/**
 * Hand-off buttons. The YouTube id is looked up only when asked for: that
 * route costs API quota on a miss, though it caches each track.
 */
function OpenIn({ track }: { track: NowPlaying }) {
  const [findingVideo, setFindingVideo] = useState(false);

  const openSpotify = () => {
    const url =
      track.spotifyUrl ??
      `https://open.spotify.com/search/${encodeURIComponent(`${track.title} ${track.artist}`.trim())}`;
    Linking.openURL(url).catch(() => {});
  };

  const openYouTube = async () => {
    setFindingVideo(true);
    const params = new URLSearchParams({ track: track.title, artist: track.artist });
    let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${track.title} ${track.artist}`.trim())}`;
    try {
      const res = await api<{ videoId: string | null }>(`/api/discover/youtube?${params}`);
      if (res.videoId) url = `https://www.youtube.com/watch?v=${res.videoId}`;
    } catch {
      // Fall through to the search page rather than failing the tap.
    }
    setFindingVideo(false);
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.openIn}>
      <Pressable
        onPress={openSpotify}
        style={({ pressed }) => [styles.pill, styles.spotify, pressed && styles.pressed]}
      >
        <Ionicons name="musical-note" size={16} color="#fff" />
        <Text style={styles.pillLabel}>Spotify</Text>
      </Pressable>

      <Pressable
        onPress={() => void openYouTube()}
        disabled={findingVideo}
        style={({ pressed }) => [styles.pill, styles.youtube, pressed && styles.pressed]}
      >
        {findingVideo ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="logo-youtube" size={16} color="#fff" />
        )}
        <Text style={styles.pillLabel}>Full video</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  backdropTap: { flex: 1 },
  sheet: {
    height: SHEET_HEIGHT,
    backgroundColor: theme.elevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  handleZone: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 46,
    justifyContent: "center",
    alignItems: "center",
  },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.95)",
    // A dark halo round a white bar reads on both black and white artwork; a
    // single flat colour always disappears against one or the other.
    shadowColor: "#000",
    shadowOpacity: 0.65,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
  },
  card: {
    flex: 1,
    overflow: "hidden",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  // Blurred cover behind everything, dimmed hard so the overlays stay legible.
  backdropArt: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transform: [{ scale: 1.1 }],
    opacity: 0.45,
  },
  artWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 24 },
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  artFallback: { backgroundColor: theme.surface },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.32)",
  },
  centerGlyph: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  // Same glyph as a Discover card: filled play in a dark disc, not an outline.
  glyph: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  // Everything below the artwork, matching the Discover card's stack.
  bottom: { paddingLeft: 18, paddingRight: 78, gap: 10 },
  meta: { gap: 1 },
  title: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "700",
    letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowRadius: 8,
  },
  artist: { color: "rgba(255,255,255,0.7)", fontSize: 15 },
  rail: { position: "absolute", right: 12, bottom: 90, gap: 14, alignItems: "center" },
  railButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  openIn: { flexDirection: "row", gap: 10 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  spotify: { backgroundColor: "#1db954" },
  youtube: { backgroundColor: "#ff0000" },
  pillLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.6 },
});
