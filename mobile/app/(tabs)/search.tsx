import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_CLEARANCE } from "../../components/TabBar";
import { api } from "../../lib/api";
import { onTabBarScroll } from "../../lib/tabBarScroll";
import { theme } from "../../lib/theme";
import type { SearchResponse, SearchUser } from "../../lib/types";

export default function Search() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const run = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const data = await api<SearchResponse>(
        `/api/search?q=${encodeURIComponent(trimmed)}`
      );
      setResults(data.users ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, []);

  // Search as you type, settling briefly so a four-letter name isn't four
  // round trips. Short enough that it still feels immediate.
  useEffect(() => {
    const id = setTimeout(() => void run(query), 250);
    return () => clearTimeout(id);
  }, [query, run]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={theme.muted} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search people"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            Keyboard.dismiss();
            void run(query);
          }}
        />
        {searching ? <ActivityIndicator color={theme.muted} size="small" /> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={results}
        keyExtractor={(u) => u.spotifyId}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={onTabBarScroll}
        contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_CLEARANCE }]}
        ListEmptyComponent={
          !searching && searched && !error ? (
            <Text style={styles.empty}>No one found for “{query.trim()}”.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/u/${encodeURIComponent(item.username ?? item.spotifyId)}`)
            }
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]} />
            )}
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.handle} numberOfLines={1}>
                @{item.username ?? item.spotifyId}
              </Text>
              {item.isLive && item.nowPlaying?.track ? (
                <Text style={styles.nowPlaying} numberOfLines={1}>
                  ♪ {item.nowPlaying.track}
                  {item.nowPlaying.artist ? ` — ${item.nowPlaying.artist}` : ""}
                </Text>
              ) : null}
            </View>
            {item.isLive ? <View style={styles.liveDot} /> : null}
            <Ionicons name="chevron-forward" size={18} color={theme.muted} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  input: { flex: 1, color: theme.foreground, fontSize: 16 },
  error: {
    color: "#ff6b6b",
    fontSize: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  listContent: { paddingTop: 8, paddingBottom: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: theme.surface },
  rowText: { flex: 1, gap: 2 },
  name: { color: theme.foreground, fontSize: 16, fontWeight: "600" },
  handle: { color: theme.muted, fontSize: 14 },
  nowPlaying: { color: theme.accent, fontSize: 12 },
  rowPressed: { opacity: 0.6 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  empty: {
    color: theme.muted,
    fontSize: 15,
    textAlign: "center",
    marginTop: 48,
    paddingHorizontal: 32,
  },
});
