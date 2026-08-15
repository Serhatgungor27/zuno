import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../lib/auth";
import { theme } from "../../lib/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 40 }}
    >
      <View style={styles.body}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.note}>
          Signed in as {session?.user.email ?? "unknown"}.
        </Text>
        <Text style={styles.note}>
          Next: wire to /api/profile/me, which already authenticates via Supabase
          rather than the Spotify cookie.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  body: { paddingHorizontal: 24, gap: 12 },
  title: { color: theme.foreground, fontSize: 28, fontWeight: "700" },
  note: { color: theme.muted, fontSize: 15, lineHeight: 22 },
  button: {
    marginTop: 24,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  pressed: { opacity: 0.7 },
  buttonLabel: { color: theme.foreground, fontSize: 16, fontWeight: "600" },
});
