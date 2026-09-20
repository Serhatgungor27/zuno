import { BlurView } from "expo-blur";
import { router, useSegments } from "expo-router";
import { useEffect } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ActivityIcon,
  DiscoverIcon,
  FeedIcon,
  ProfileIcon,
  SearchIcon,
} from "./TabIcons";
import { expandTabBar, tabBarRetract } from "../lib/tabBarScroll";
import { Fade } from "./Fade";
import { theme } from "../lib/theme";

/**
 * How much room a scrolling screen must leave at the bottom so its last row
 * clears the floating capsule: the bar itself, the gap it sits in, and a
 * little breathing space. Screens add this to their contentContainer padding.
 */
const FADE_HEIGHT = 130;

export const TAB_BAR_CLEARANCE = 42 + 24 + 16;

type IconProps = { size?: number; color: string; filled?: boolean };

const ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  feed: FeedIcon,
  discover: DiscoverIcon,
  search: SearchIcon,
  notifications: ActivityIcon,
  profile: ProfileIcon,
};

const ORDER = ["feed", "search", "notifications", "profile"] as const;

export function TabBar() {
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const current = segments as string[];
  const active = ORDER.find((name) => current.includes(name)) ?? "feed";

  // Any tab change brings the bar back out, however you got there — a tap, a
  // deep link, or going back.
  useEffect(() => {
    expandTabBar();
  }, [active]);

  // Shrinks and sinks as you scroll down, restores on the way back up.
  const scale = tabBarRetract.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.82],
  });
  // The bar rests 19pt above the screen edge (insets.bottom 34, less the 15
  // the wrap takes back). Scaling to 0.82 lifts its bottom edge by about 4pt,
  // so sinking 18 left it roughly 5pt from the bottom — almost touching. 6
  // keeps around 17pt of air while still reading as a sink.
  const translateY = tabBarRetract.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });
  const opacity = tabBarRetract.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.55],
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 15, 10) }]}
    >
      <Fade direction="bottom" height={FADE_HEIGHT} style={{ bottom: 0 }} />

      {/* Real frosted glass, not a flat translucent fill — content moving
          underneath shows through, which is what makes Instagram's blend. */}
      <Animated.View style={{ transform: [{ scale }, { translateY }], opacity }}>
      <BlurView intensity={55} tint="light" style={styles.capsule}>
        {ORDER.map((name) => {
          const focused = active === name;
          const Icon = ICONS[name];
          if (!Icon) return null;

          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              style={styles.slot}
              onPress={() => {
                // Expand immediately rather than waiting for the route to
                // settle, so the tap feels answered.
                expandTabBar();
                if (!focused) router.navigate(`/(tabs)/${name}` as never);
              }}
            >
              <View style={[styles.pill, focused && styles.pillActive]}>
                <Icon
                  size={23}
                  filled={focused}
                  color={focused ? theme.foreground : "rgba(255,255,255,0.6)"}
                />
              </View>
            </Pressable>
          );
        })}
      </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingTop: 8,
  },
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    // Measured off Instagram: 352pt of a 393pt screen, 41pt tall, fully
    // rounded ends.
    height: 42,
    width: "89%",
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  slot: { flex: 1, alignItems: "center", justifyContent: "center" },
  // 50x33 measured off Instagram, fully rounded. It reads as a lozenge
  // rather than a circle because it is half again as wide as it is tall —
  // the earlier version looked circular because it was nearly square, not
  // because the radius was too large.
  pill: {
    width: 52,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: "rgba(255,255,255,0.22)" },
});
