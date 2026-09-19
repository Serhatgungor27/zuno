import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

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

const ICONS: Record<string, { idle: IconName; active: IconName }> = {
  feed: { idle: "play-circle-outline", active: "play-circle" },
  discover: { idle: "compass-outline", active: "compass" },
  search: { idle: "search-outline", active: "search" },
  notifications: { idle: "heart-outline", active: "heart" },
  profile: { idle: "person-outline", active: "person" },
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
      <View style={styles.capsule}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const icon = ICONS[route.name];
          if (!icon) return null;

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
                <Ionicons
                  name={focused ? icon.active : icon.idle}
                  size={24}
                  color={focused ? theme.foreground : "rgba(255,255,255,0.55)"}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
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
    height: 52,
    // Inset from both edges so it reads as a floating object.
    width: "78%",
    borderRadius: 26,
    backgroundColor: "rgba(32,32,34,0.92)",
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  slot: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Rounded rectangle, not a capsule: radius well under half the height so
  // the sides stay flat, as Instagram's does.
  pill: {
    width: 56,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: "rgba(255,255,255,0.16)" },
});
