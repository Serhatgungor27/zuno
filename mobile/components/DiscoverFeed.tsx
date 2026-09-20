import { Ionicons } from "@expo/vector-icons";
import { useEvent } from "expo";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
} from "expo-audio";
import * as Linking from "expo-linking";
import { useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView, type VideoPlayer } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Only a starting guess. The list's real viewport is measured on layout:
 * paging off the window height is wrong by however much the screen's chrome
 * takes, and that error accumulates card by card until a swipe snaps back to
 * one you already passed.
 */
const { height: WINDOW_H } = Dimensions.get("window");

/** Genre groups the route serves; a refresh moves to a different one. */
const PAGES = 5;

/** How far ahead to look up music videos, so they're ready on arrival. */
const PREFETCH = 3;

type Prefs = { genres: string[]; artists: string[]; excludeArtists: string[] };
type LikedResponse = { tracks: { trackId: string; artist: string }[] };
type RepostResponse = { reposts: { history_id: string | null }[] };
type VideoResponse = { videoUrl: string | null };
type DislikeResponse = { trackIds: string[]; artists: string[] };

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

/** Drops every cached lookup — Settings offers this as "Clear cache". */
export function clearDiscoverCache() {
  videoUrls.clear();
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

  // The list's measured viewport. Every paging number derives from this.
  const [cardH, setCardH] = useState(WINDOW_H);

  // What the route should personalise on. Null until taste and likes have
  // answered, so the feed is asked for once rather than loaded generic and
  // then replaced under the reader.
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  // Mirrored in refs so tapping a button repaints that button without putting
  // the sets in the fetch effect's deps, which would reload the whole feed.
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const likedRef = useRef<Set<string>>(new Set());
  const [repostedIds, setRepostedIds] = useState<Set<string>>(new Set());
  const dislikedRef = useRef<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  // `isActive` only tracks the pager. Leaving the feed for another tab doesn't
  // unmount this screen, so without watching focus the preview keeps playing
  // over whatever you opened next.
  const [focused, setFocused] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // One player, re-pointed as the active card changes. Creating a player per
  // card would keep 60 of them alive and fight over the audio session.
  //
  // Neither player's status is subscribed to here. Both tick several times a
  // second, and subscribing at this level re-rendered the whole list mid-swipe
  // — which is what made scrolling fight back. Only the active card listens.
  const player = useAudioPlayer(null);
  const video = useVideoPlayer(null, (p) => {
    p.loop = true;
  });
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // The track whose video is actually loaded in the player right now. The
  // VideoView is withheld until this matches the card, because the player is
  // shared: mounting it earlier shows the PREVIOUS card's video for a moment.
  const [videoFor, setVideoFor] = useState<string | null>(null);
  // Swaps are async and a fast scroll starts several. Only the newest may
  // finish — otherwise a stale one resolves last and plays the wrong track.
  const swapRef = useRef(0);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<Taste>("/api/taste").catch(() => null),
      api<LikedResponse>("/api/discover/like").catch(() => null),
      api<RepostResponse>("/api/repost").catch(() => null),
      api<DislikeResponse>("/api/discover/dislike").catch(() => null),
    ]).then(([taste, likes, reposts, dislikes]) => {
      if (!alive) return;

      setRepostedIds(
        new Set(
          (reposts?.reposts ?? [])
            .map((r) => r.history_id)
            .filter((id): id is string => !!id)
        )
      );

      dislikedRef.current = new Set(dislikes?.trackIds ?? []);

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
        excludeArtists: dislikes?.artists ?? [],
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
    // Defaulted rather than read straight off `prefs`: a Fast Refresh can hand
    // back a prefs object shaped by an older version of this file.
    const genres = prefs.genres ?? [];
    const artists = prefs.artists ?? [];
    const excludeArtists = prefs.excludeArtists ?? [];
    if (genres.length) params.set("genres", genres.join(","));
    if (artists.length) params.set("artists", artists.join(","));
    if (excludeArtists.length) params.set("excludeArtists", excludeArtists.join(","));
    // Read from the refs, not state: a reload right after liking should drop
    // what you just liked, but liking alone must not refetch.
    const exclude = [...likedRef.current, ...dislikedRef.current].slice(0, 120);
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

  // Look up this card's video, and the next few ahead of time so they're
  // already answered by the time you swipe onto them.
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
    for (const t of tracks.slice(activeIndex + 1, activeIndex + 1 + PREFETCH)) {
      void fetchVideo(t);
    }
    return () => {
      alive = false;
    };
  }, [active, tracks, activeIndex]);

  // Hand playback to whichever player owns this card.
  useEffect(() => {
    const trackId = active?.trackId;
    const turn = ++swapRef.current;

    if (!videoUrl || !trackId) {
      setVideoFor(null);
      try {
        video.pause();
      } catch {
        // Nothing loaded yet.
      }
      return;
    }

    // Hide the video and silence the preview for the moment the swap takes.
    setVideoFor(null);
    player.pause();

    video.replaceAsync(videoUrl).then(
      () => {
        // A newer card has already claimed the player — leave it alone.
        if (swapRef.current !== turn) return;
        setVideoFor(trackId);
        video.play();
      },
      () => {
        if (swapRef.current !== turn) return;
        // The video failed to load — put the audio preview back rather than
        // leaving the card silent.
        setVideoUrl(null);
        setVideoFor(null);
        player.play();
      }
    );
  }, [videoUrl, active?.trackId, video, player]);

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
      if (videoFor) video.play();
      else player.play();
    }
  }, [isActive, focused, player, video, videoFor, tracks.length]);

  // Read the state off the players rather than holding it here — that is the
  // whole point of not subscribing at this level.
  const toggle = useCallback(() => {
    if (videoFor) {
      if (video.playing) video.pause();
      else video.play();
      return;
    }
    if (player.playing) player.pause();
    else player.play();
  }, [player, video, videoFor]);

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

  /**
   * "Not for me". Records the track and its artist so the next batch avoids
   * them, then drops everything by that artist out of the list you're holding
   * — saying no and then being shown the same artist twice more reads as the
   * button doing nothing.
   */
  const dislike = useCallback((track: DiscoverTrack) => {
    dislikedRef.current.add(track.trackId);
    logInteraction("dislike", track);

    void api("/api/discover/dislike", {
      method: "POST",
      body: JSON.stringify({
        trackId: track.trackId,
        name: track.name,
        artist: track.artist,
      }),
    }).catch(() => {});

    setTracks((prev) => prev.filter((t) => t.artist !== track.artist));
  }, []);

  const onReposted = useCallback((trackId: string, next: boolean) => {
    setRepostedIds((prev) => {
      const updated = new Set(prev);
      if (next) updated.add(trackId);
      else updated.delete(trackId);
      return updated;
    });
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: DiscoverTrack; index: number }) => (
      <Card
        track={item}
        cardH={cardH}
        isActive={index === activeIndex}
        player={player}
        video={item.trackId === videoFor ? video : null}
        onToggle={toggle}
        liked={likedIds.has(item.trackId)}
        onToggleLike={() => void toggleLike(item)}
        onDislike={() => dislike(item)}
        reposted={repostedIds.has(item.trackId)}
        onReposted={onReposted}
      />
    ),
    [
      cardH,
      activeIndex,
      player,
      video,
      videoFor,
      toggle,
      likedIds,
      toggleLike,
      dislike,
      repostedIds,
      onReposted,
    ]
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
    <FlatList
      ref={listRef}
      style={styles.list}
      data={tracks}
      keyExtractor={(t) => t.trackId}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      // Measured, never assumed. See the note on WINDOW_H.
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - cardH) > 1) setCardH(h);
      }}
      snapToInterval={cardH}
      snapToAlignment="start"
      decelerationRate="fast"
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      getItemLayout={(_, index) => ({
        length: cardH,
        offset: cardH * index,
        index,
      })}
      windowSize={3}
      maxToRenderPerBatch={3}
      initialNumToRender={2}
      removeClippedSubviews
      renderItem={renderItem}
    />
  );
}

function Card({
  track,
  cardH,
  isActive,
  player,
  video,
  onToggle,
  liked,
  onToggleLike,
  onDislike,
  reposted,
  onReposted,
}: {
  track: DiscoverTrack;
  cardH: number;
  isActive: boolean;
  player: AudioPlayer;
  /** The shared video player, but only for the card that currently owns it. */
  video: VideoPlayer | null;
  onToggle: () => void;
  liked: boolean;
  onToggleLike: () => void;
  onDislike: () => void;
  reposted: boolean;
  onReposted: (trackId: string, next: boolean) => void;
}) {
  return (
    <Pressable onPress={onToggle} style={[styles.card, { height: cardH }]}>
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

      {/* Only the active card subscribes to playback state. */}
      {isActive ? (
        video ? (
          <VideoGlyph video={video} cardH={cardH} />
        ) : (
          <AudioGlyph player={player} cardH={cardH} />
        )
      ) : null}

      {/* Sits clear of the title block on the left and the tab bar below. */}
      <Rail
        track={track}
        liked={liked}
        onToggleLike={onToggleLike}
        onDislike={onDislike}
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

        {isActive ? (
          video ? (
            <VideoBar video={video} />
          ) : (
            <AudioBar player={player} />
          )
        ) : (
          <Scrubber onSeek={() => {}} progress={0} duration={0} />
        )}
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 * Playback state lives in these four, never in the feed. Each exists  *
 * only for the active card, so their ticking re-renders one small     *
 * subtree instead of the whole list.                                  *
 * ------------------------------------------------------------------ */

function Glyph({ cardH }: { cardH: number }) {
  return (
    <View style={[styles.glyph, { top: cardH / 2 - 34 }]}>
      <Ionicons name="play" size={44} color="rgba(255,255,255,0.92)" />
    </View>
  );
}

function AudioGlyph({ player, cardH }: { player: AudioPlayer; cardH: number }) {
  const status = useAudioPlayerStatus(player);
  return status.playing ? null : <Glyph cardH={cardH} />;
}

function VideoGlyph({ video, cardH }: { video: VideoPlayer; cardH: number }) {
  const { isPlaying } = useEvent(video, "playingChange", {
    isPlaying: video.playing,
  });
  return isPlaying ? null : <Glyph cardH={cardH} />;
}

function AudioBar({ player }: { player: AudioPlayer }) {
  const status = useAudioPlayerStatus(player);
  return (
    <Scrubber
      onSeek={(t) => player.seekTo(t)}
      progress={status.duration > 0 ? status.currentTime / status.duration : 0}
      duration={status.duration}
    />
  );
}

function VideoBar({ video }: { video: VideoPlayer }) {
  // timeUpdate carries currentTime only; duration is a player property that
  // fills in once the source loads.
  const tick = useEvent(video, "timeUpdate");
  const current = tick?.currentTime ?? video.currentTime ?? 0;
  const duration = video.duration ?? 0;
  return (
    <Scrubber
      onSeek={(t) => {
        video.currentTime = t;
      }}
      progress={duration > 0 ? current / duration : 0}
      duration={duration}
    />
  );
}

/**
 * Not-for-me, like, repost and share, stacked down the right edge.
 *
 * A repost stores the Deezer track id in place of a history id, which is what
 * the web app has always done for Discover — these tracks are chart rows, not
 * something anyone was caught listening to.
 */
function Rail({
  track,
  liked,
  onToggleLike,
  onDislike,
  reposted,
  onReposted,
  bottom,
}: {
  track: DiscoverTrack;
  liked: boolean;
  onToggleLike: () => void;
  onDislike: () => void;
  reposted: boolean;
  onReposted: (trackId: string, next: boolean) => void;
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
      onReposted(track.trackId, res.action === "reposted");
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
      {/* Above the heart, as the opposite of it. */}
      <RailButton
        icon="heart-dislike-outline"
        tint="#fff"
        onPress={onDislike}
      />
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
