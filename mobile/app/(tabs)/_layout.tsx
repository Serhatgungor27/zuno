import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TabBar } from "../../components/TabBar";
import { useAuth } from "../../lib/auth";
import { theme } from "../../lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; icon: IconName; activeIcon: IconName }[] = [
  { name: "feed", icon: "play-circle-outline", activeIcon: "play-circle" },
  { name: "discover", icon: "compass-outline", activeIcon: "compass" },
  { name: "search", icon: "search-outline", activeIcon: "search" },
  { name: "notifications", icon: "heart-outline", activeIcon: "heart" },
  { name: "profile", icon: "person-outline", activeIcon: "person" },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
  },
  // The selected tab sits on a lighter rounded chip, as Instagram's does.
  // The selected tab sits on a lighter pill, as Instagram's does.
  // Proportioned off Instagram's: the pill fills roughly 85% of the bar's
  // height, which is what makes it read as a substantial selection rather
  // than a small badge behind the icon.
  chip: {
    width: 52,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "rgba(255,255,255,0.16)" },
});
