import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";

import { theme } from "../lib/theme";

export function Scrubber({
  onSeek,
  progress,
  duration,
  onScrubStateChange,
}: {
  /** Lets the screen switch off any pager that would otherwise eat the drag. */
  onScrubStateChange?: (scrubbing: boolean) => void;
  /** Seconds to seek to. Takes a callback rather than a player so the same
   *  bar can drive audio previews and music videos alike. */
  onSeek: (seconds: number) => void;
  progress: number;
  duration: number;
}) {
  const [width, setWidth] = useState(0);

  // Everything the gesture touches is an Animated.Value or a ref. Driving the
  // bar through React state re-rendered the whole sheet on every finger move,
  // which is what made it feel slow — this way the position never goes through
  // a render at all.
  const pos = useMemo(() => new Animated.Value(0), []);
  const knobScale = useMemo(() => new Animated.Value(0), []);
  const barScale = useMemo(() => new Animated.Value(1), []);
  const widthRef = useRef(0);
  const durationRef = useRef(0);
  const scrubbing = useRef(false);
  const scrubPos = useRef(0);

  widthRef.current = width;
  durationRef.current = duration;

  // Follow playback only while the finger is off the bar.
  useEffect(() => {
    if (!scrubbing.current) pos.setValue(Math.min(1, Math.max(0, progress)));
  }, [progress, pos]);

  const setFromX = useCallback(
    (x: number) => {
      const w = widthRef.current;
      if (w <= 0) return;
      const ratio = Math.min(1, Math.max(0, x / w));
      scrubPos.current = ratio;
      pos.setValue(ratio);
    },
    [pos]
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Claim in the capture phase so an ancestor cannot take the drag
        // first, and block the native scroll view outright — a horizontal
        // pager otherwise reads a scrub as a page swipe.
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onShouldBlockNativeResponder: () => true,
        // Do not let the sheet's drag-to-dismiss steal a scrub.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          scrubbing.current = true;
          onScrubStateChange?.(true);
          Animated.parallel([
            Animated.spring(knobScale, {
              toValue: 1,
              useNativeDriver: true,
              bounciness: 8,
            }),
            Animated.timing(barScale, {
              toValue: 2.5,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start();
          setFromX(e.nativeEvent.locationX);
        },
        onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
        onPanResponderRelease: () => {
          scrubbing.current = false;
          Animated.parallel([
            Animated.timing(knobScale, {
              toValue: 0,
              duration: 140,
              useNativeDriver: true,
            }),
            Animated.timing(barScale, {
              toValue: 1,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start();
          onScrubStateChange?.(false);
          if (durationRef.current > 0) {
            try {
              onSeek(scrubPos.current * durationRef.current);
            } catch {
              // A failed seek should not strand the bar under the thumb.
            }
          }
        },
      }),
    [knobScale, barScale, onSeek, setFromX, onScrubStateChange]
  );

  return (
    <View
      style={styles.scrubRow}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
    >
      <Animated.View
        style={[styles.progressTrack, { transform: [{ scaleY: barScale }] }]}
      >
        <Animated.View
          style={[styles.progressFill, { transform: [{ scaleX: pos }] }]}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.knob,
          {
            transform: [
              {
                translateX: pos.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, width],
                }),
              },
              { scale: knobScale },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrubRow: { height: 22, justifyContent: "center" },
  // White played, grey remaining. The blue read as Spotify-adjacent and the
  // track was light enough that the fill barely separated from it.
  progressTrack: { height: 2, backgroundColor: "rgba(255,255,255,0.28)" },
  progressFill: {
    height: 2,
    width: "100%",
    backgroundColor: "#ffffff",
    transformOrigin: "left",
  },
  knob: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    backgroundColor: "#fff",
  },
});
