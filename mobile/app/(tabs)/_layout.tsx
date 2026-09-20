import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { TabBar } from "../../components/TabBar";
import { useAuth } from "../../lib/auth";
import { theme } from "../../lib/theme";

const TABS = ["feed", "search", "notifications", "profile"];

export default function TabsLayout() {
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
    <View style={styles.container}>
      {/* The navigator renders no bar of its own, so every screen is full
          height and nothing is inset. Ours is drawn on top as a sibling —
          that is what lets content pass underneath it, which in turn gives
          the blur something real to frost. */}
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.background },
        }}
      >
        {TABS.map((name) => (
          <Tabs.Screen key={name} name={name} />
        ))}
      </Tabs>

      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
    backgroundColor: theme.background,
  },
});
