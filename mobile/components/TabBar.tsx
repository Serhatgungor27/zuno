import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ActivityIcon,
  DiscoverIcon,
  FeedIcon,
  ProfileIcon,
  SearchIcon,
} from "./TabIcons";
import { theme } from "../lib/theme";

type IconProps = { size?: number; color: string; filled?: boolean };

/**
 * Minimal shape of what the navigator hands a custom tab bar. Declared here
 * because expo-router vendors react-navigation rather than exposing
 * @react-navigation/bottom-tabs as a resolvable package.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
  };
};

const ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  feed: FeedIcon,
  discover: DiscoverIcon,
  search: SearchIcon,
  notifications: ActivityIcon,
  profile: ProfileIcon,
};

/**
 * A floating capsule bar, rendered ourselves rather than styled through
 * `tabBarStyle`. The navigator positions its own container and overrides
 * left/right/bottom, so the capsule can only be inset from the screen edges
 * by drawing it directly.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 14 }]}
    >
      {/* Real frosted glass, not a flat translucent fill — content moving
          underneath shows through, which is what makes Instagram's blend. */}
      <BlurView intensity={60} tint="dark" style={styles.capsule}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name];
          if (!Icon) return null;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              style={styles.slot}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
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
  },
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    // Measured off Instagram: 352pt of a 393pt screen, 41pt tall, fully
    // rounded ends.
    height: 42,
    width: "89%",
    borderRadius: 21,
    backgroundColor: "rgba(28,28,30,0.45)",
    overflow: "hidden",
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
  pillActive: { backgroundColor: "rgba(255,255,255,0.16)" },
});
