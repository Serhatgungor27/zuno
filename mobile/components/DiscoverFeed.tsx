import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect } from "expo-router";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView, type VideoPlayer } from "expo-video";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
} from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";

import { Scrubber } from "./Scrubber";
import { TAB_BAR_CLEARANCE } from "./TabBar";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import type { DiscoverResponse, DiscoverTrack, Taste } from "../lib/types";

const { height: SCREEN_H } = Dimensions.get("window");

/** Genre groups the route serves; a refresh moves to a different one. */
const PAGES = 5;

type Prefs = { genres: string[]; artists: string[] };
type LikedResponse = { tracks: { trackId: string; artist: string }[] };
type RepostResponse = { reposts: { history_id: string | null }[] };
type VideoResponse = { videoUrl: string | null };

/**
 * Music videos, looked up once per track and kept for the session. Roughly
 * half of Discover's tracks have one; the rest fall back to the artwork.
 */
const videoUrls = new Map<string, string | null>();

async function fetchVideo(track: DiscoverTrack): Promise<string | null> {
  const cached = videoUrls.get(track.trackId);
  if (cached !== undefined) return cached;
  try {
    const params = new URLSearchParams({ track: track.name, artist: track.artist });
    const res = await api<VideoResponse>(`/api/discover/video?${params}`);
    videoUrls.set(track.trackId, res.videoUrl);
    return res.videoUrl;
  } catch {
    videoUrls.set(track.trackId, null);
    return null;
  }
}

/**
 * Analytics for what a card actually got: a like, a hand-off to Spotify, a
 * share. Fire-and-forget — nothing the reader does should wait on it.
 */
function logInteraction(action: string, track: DiscoverTrack) {
  void api("/api/discover/interact", {
    method: "POST",
    body: JSON.stringify({
      trackId: track.trackId,
      artist: track.artist,
      action,
    }),
  }).catch(() => {});
}

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
  // What the route should personalise on. Null until both taste and likes have
  // answered, so the feed is asked for once rather than loaded generic and
  // then replaced under the reader.
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  // Mirrored in a ref so liking a track repaints its heart without putting the
  // liked set in the fetch effect's deps, which would reload the whole feed.
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const likedRef = useRef<Set<string>>(new Set());
  // Reposts are toggled server-side, so without knowing what's already
  // reposted the button would offer to repost something it would delete.
  const [repostedIds, setRepostedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  // `isActive` only tracks the pager. Leaving the feed for another tab doesn't
  // unmount this screen, so without watching focus the preview keeps playing
  // over whatever you opened next.
  const [focused, setFocused] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // One player, re-pointed as the active card changes. Creating a player per
  // card would keep 60 of them alive and fight over the audio session.
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // A second player for the music video. When a track has one it carries the
  // sound as well as the picture, so the audio preview steps aside — a video
  // of one part of the song under the audio of another looks broken.
  const video = useVideoPlayer(null, (p) => {
    p.loop = true;
  });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // expo-video reports state through events rather than a status hook.
  const { isPlaying: videoPlaying } = useEvent(video, "playingChange", {
    isPlaying: video.playing,
  });
  // timeUpdate carries currentTime only; duration is a player property that
  // fills in once the source loads, so it's read directly each render.
  const timeUpdate = useEvent(video, "timeUpdate");
  const videoTime = timeUpdate?.currentTime ?? video.currentTime ?? 0;
  const videoDuration = video.duration ?? 0;

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<Taste>("/api/taste").catch(() => null),
      api<LikedResponse>("/api/discover/like").catch(() => null),
      api<RepostResponse>("/api/repost").catch(() => null),
    ]).then(([taste, likes, reposts]) => {
      if (!alive) return;

      setRepostedIds(
        new Set(
          (reposts?.reposts ?? [])
            .map((r) => r.history_id)
            .filter((id): id is string => !!id)
        )
      );

      const liked = likes?.tracks ?? [];
      const ids = new Set(liked.map((t) => t.trackId));
      likedRef.current = ids;
      setLikedIds(ids);

      // An artist you actually hearted is a stronger signal than one you typed
      // into settings once, so those come first.
      const likedArtists = [...new Set(liked.map((t) => t.artist).filter(Boolean))];
      setPrefs({
        genres: taste?.music_genres ?? [],
        artists: [...likedArtists, ...(taste?.favorite_artists ?? [])].slice(0, 3),
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    // Music has to keep playing when the ringer switch is off, or the feed is
    // silent for anyone who leaves their phone muted — which is most people.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!prefs) return;

    // Each refresh asks for a different genre group, so you get a genuinely
    // new set rather than the same chart reshuffled.
    if (refreshKey > 0) {
      pageRef.current = (pageRef.current + 1 + Math.floor(Math.random() * (PAGES - 1))) % PAGES;
    }
    setLoading(true);
    const params = new URLSearchParams({ page: String(pageRef.current) });
    if (prefs.genres.length) params.set("genres", prefs.genres.join(","));
    if (prefs.artists.length) params.set("artists", prefs.artists.join(","));
    // Read from the ref, not state: a reload right after liking should drop
    // what you just liked, but liking alone must not refetch.
    const exclude = [...likedRef.current].slice(0, 100);
    if (exclude.length) params.set("excludeIds", exclude.join(","));

    api<DiscoverResponse>(`/api/discover?${params}`)
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
  }, [refreshKey, prefs]);

  // Identity changes only when one of the sets is replaced, so rows re-render
  // on a like or repost and not on every frame.
  const rowState = useMemo(
    () => ({ likedIds, repostedIds }),
    [likedIds, repostedIds]
  );

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

  // Ask Apple whether this track has a music video. The audio preview is
  // already playing by now, so a slow answer costs nothing — the video takes
  // over when and if it arrives.
  useEffect(() => {
    if (!active) {
      setVideoUrl(null);
      return;
    }
    let alive = true;
    setVideoUrl(videoUrls.get(active.trackId) ?? null);
    fetchVideo(active).then((url) => {
      if (alive) setVideoUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [active]);

  // Hand playback to whichever player owns this card.
  useEffect(() => {
    if (videoUrl) {
      player.pause();
      video.replaceAsync(videoUrl).then(
        () => video.play(),
        () => {
          // The video failed to load — put the audio preview back rather than
          // leaving the card silent.
          setVideoUrl(null);
          player.play();
        }
      );
    } else {
      try {
        video.pause();
      } catch {
        // Nothing loaded yet.
      }
    }
  }, [videoUrl, video, player]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (typeof first?.index === "number") setActiveIndex(first.index);
    }
  ).current;

  // Silence it the moment the pager moves away or the screen loses focus;
  // resume when it comes back.
  useEffect(() => {
    if (!isActive || !focused) {
      player.pause();
      try {
        video.pause();
      } catch {
        // Nothing loaded yet.
      }
    } else if (tracks.length > 0) {
      if (videoUrl) video.play();
      else player.play();
    }
  }, [isActive, focused, player, video, videoUrl, tracks.length]);

  const toggle = useCallback(() => {
    if (videoUrl) {
      if (video.playing) video.pause();
      else video.play();
      return;
    }
    if (status.playing) player.pause();
    else player.play();
  }, [status.playing, player, video, videoUrl]);

  const toggleLike = useCallback(async (track: DiscoverTrack) => {
    const wasLiked = likedRef.current.has(track.trackId);

    // Optimistic — a heart that waits on a round trip feels broken.
    const next = new Set(likedRef.current);
    if (wasLiked) next.delete(track.trackId);
    else next.add(track.trackId);
    likedRef.current = next;
    setLikedIds(next);
    logInteraction(wasLiked ? "unlike" : "like", track);

    try {
      await api("/api/discover/like", {
        method: "POST",
        body: JSON.stringify({
          trackId: track.trackId,
          name: track.name,
          artist: track.artist,
          albumImage: track.albumImage,
          previewUrl: track.previewUrl,
          spotifyUrl: track.spotifyUrl,
        }),
      });
    } catch {
      // Put the heart back rather than showing a like that didn't save.
      const back = new Set(likedRef.current);
      if (wasLiked) back.add(track.trackId);
      else back.delete(track.trackId);
      likedRef.current = back;
      setLikedIds(back);
    }
  }, []);

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
      // Rows are only re-rendered when something they read actually changes,
      // and the liked set lives outside `data`.
      extraData={rowState}
      renderItem={({ item, index }) => (
        <Card
          track={item}
          isActive={index === activeIndex}
          isPlaying={videoUrl ? videoPlaying : status.playing}
          progress={
            videoUrl
              ? videoDuration > 0
                ? videoTime / videoDuration
                : 0
              : status.duration > 0
                ? status.currentTime / status.duration
                : 0
          }
          duration={videoUrl ? videoDuration : status.duration}
          onSeek={(t) => {
            if (videoUrl) video.currentTime = t;
            else player.seekTo(t);
          }}
          video={index === activeIndex && videoUrl ? video : null}
          onToggle={toggle}
          liked={likedIds.has(item.trackId)}
          onToggleLike={() => void toggleLike(item)}
          reposted={repostedIds.has(item.trackId)}
          onReposted={(next) =>
            setRepostedIds((prev) => {
              const updated = new Set(prev);
              if (next) updated.add(item.trackId);
              else updated.delete(item.trackId);
              return updated;
            })
          }
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
  onSeek,
  video,
  onToggle,
  liked,
  onToggleLike,
  reposted,
  onReposted,
}: {
  track: DiscoverTrack;
  isActive: boolean;
  isPlaying: boolean;
  progress: number;
  duration: number;
  onSeek: (seconds: number) => void;
  /** The shared video player, but only for the card that currently owns it. */
  video: VideoPlayer | null;
  onToggle: () => void;
  liked: boolean;
  onToggleLike: () => void;
  reposted: boolean;
  onReposted: (next: boolean) => void;
}) {
  return (
    <Pressable onPress={onToggle} style={[styles.card, { height: SCREEN_H }]}>
      {track.albumImage ? (
        <Image source={{ uri: track.albumImage }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artFallback]} />
      )}

      {/* The video sits over the artwork, which stays underneath as the
          fallback for the half of tracks Apple has no video for. Its own
          controls are off: this is a background, and the card's play/pause
          tap and scrubber drive it. */}
      {video ? (
        <VideoView
          player={video}
          style={styles.art}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
          fullscreenOptions={{ enable: false }}
        />
      ) : null}

      {/* Keeps the title legible over bright artwork. */}
      <View style={styles.scrim} />

      {isActive && !isPlaying ? (
        <View style={styles.glyph}>
          <Ionicons name="play" size={44} color="rgba(255,255,255,0.92)" />
        </View>
      ) : null}

      {/* Sits clear of the title block on the left and the tab bar below. */}
      <Rail
        track={track}
        liked={liked}
        onToggleLike={onToggleLike}
        reposted={reposted}
        onReposted={onReposted}
        bottom={TAB_BAR_CLEARANCE + 96}
      />

      <View style={[styles.meta, { paddingBottom: TAB_BAR_CLEARANCE }]}>
        <Text style={[styles.track, styles.metaText]} numberOfLines={2}>
          {track.name}
        </Text>
        <View style={[styles.artistRow, styles.metaText]}>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist}
          </Text>
          {track.explicit ? <Text style={styles.explicit}>E</Text> : null}
        </View>

        <OpenIn track={track} />

        <Scrubber onSeek={onSeek} progress={progress} duration={duration} />
      </View>
    </Pressable>
  );
}

/**
 * Like, repost and share, stacked down the right edge of the card.
 *
 * A repost stores the Deezer track id in place of a history id, which is what
 * the web app has always done for Discover — these tracks are chart rows, not
 * something anyone was caught listening to.
 */
function Rail({
  track,
  liked,
  onToggleLike,
  reposted,
  onReposted,
  bottom,
}: {
  track: DiscoverTrack;
  liked: boolean;
  onToggleLike: () => void;
  reposted: boolean;
  onReposted: (next: boolean) => void;
  bottom: number;
}) {
  const [busy, setBusy] = useState(false);

  const toggleRepost = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    logInteraction(reposted ? "unrepost" : "repost", track);
    try {
      const res = await api<{ action: "reposted" | "removed" }>("/api/repost", {
        method: "POST",
        body: JSON.stringify({
          historyId: track.trackId,
          trackName: track.name,
          artist: track.artist,
          albumImage: track.albumImage,
          trackUrl: track.spotifyUrl ?? track.deezerUrl ?? null,
        }),
      });
      onReposted(res.action === "reposted");
    } catch {
      // Say nothing rather than claim a repost that did not happen.
    } finally {
      setBusy(false);
    }
  }, [busy, reposted, track, onReposted]);

  const share = useCallback(() => {
    logInteraction("share", track);
    const url =
      track.spotifyUrl ??
      track.deezerUrl ??
      `https://open.spotify.com/search/${encodeURIComponent(`${track.name} ${track.artist}`.trim())}`;
    Share.share({ message: `${track.name} — ${track.artist}\n${url}` }).catch(
      () => {}
    );
  }, [track]);

  return (
    <View style={[styles.rail, { bottom }]}>
      <RailButton
        icon={liked ? "heart" : "heart-outline"}
        tint={liked ? "#ff3b5c" : "#fff"}
        active={liked}
        activeBorder="rgba(255,59,92,0.6)"
        onPress={onToggleLike}
      />
      <RailButton
        icon="repeat"
        tint={reposted ? "#4ade80" : "#fff"}
        active={reposted}
        activeBorder="rgba(74,222,128,0.6)"
        onPress={() => void toggleRepost()}
      />
      <RailButton icon="share-social-outline" tint="#fff" onPress={share} />
    </View>
  );
}

function RailButton({
  icon,
  tint,
  active,
  activeBorder,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  active?: boolean;
  activeBorder?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.railButton,
        active && activeBorder ? { borderColor: activeBorder } : null,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={21} color={tint} />
    </Pressable>
  );
}

/**
 * Hand-off buttons. The YouTube id is looked up only when asked for: that
 * route costs API quota on a miss, though it caches each track.
 */
function OpenIn({ track }: { track: DiscoverTrack }) {
  const [findingVideo, setFindingVideo] = useState(false);

  const openSpotify = () => {
    logInteraction("open_spotify", track);
    const url =
      track.spotifyUrl ??
      `https://open.spotify.com/search/${encodeURIComponent(`${track.name} ${track.artist}`.trim())}`;
    Linking.openURL(url).catch(() => {});
  };

  const openYouTube = async () => {
    logInteraction("open_youtube", track);
    setFindingVideo(true);
    const params = new URLSearchParams({ track: track.name, artist: track.artist });
    let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${track.name} ${track.artist}`.trim())}`;
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
        <Ionicons name="musical-note" size={15} color="#fff" />
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
          <Ionicons name="logo-youtube" size={15} color="#fff" />
        )}
        <Text style={styles.pillLabel}>Full video</Text>
      </Pressable>
    </View>
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
  // Only the text and pills keep clear of the rail — the scrubber still runs
  // the full width of the card.
  metaText: { paddingRight: 62 },
  pressed: { opacity: 0.6 },
  rail: { position: "absolute", right: 12, gap: 16, alignItems: "center" },
  railButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  openIn: { flexDirection: "row", gap: 8, paddingTop: 2, paddingRight: 62 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  spotify: { backgroundColor: "#1db954" },
  youtube: { backgroundColor: "rgba(255,255,255,0.16)" },
  pillLabel: { color: "#fff", fontSize: 13, fontWeight: "600" },
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
