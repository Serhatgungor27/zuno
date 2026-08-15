import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../lib/theme";

/** Temporary scaffold screen — replace as each tab gets built out. */
export function Placeholder({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 24,
    gap: 8,
  },
  title: { color: theme.foreground, fontSize: 28, fontWeight: "700" },
  note: { color: theme.muted, fontSize: 15, lineHeight: 22 },
});
