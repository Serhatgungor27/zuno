import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StyleSheet } from "react-native";

import {
  ChipGrid,
  Field,
  ScreenHeader,
  Section,
  styles,
} from "../components/Form";
import { api } from "../lib/api";
import { theme } from "../lib/theme";
import {
  MUSIC_GENRES,
  PODCAST_GENRES,
  type SettingsUser,
  type Taste,
} from "../lib/types";

type DeezerArtist = { id: number; name: string; picture_medium?: string };

export default function EditProfile() {
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<SettingsUser | null>(null);
  const [taste, setTaste] = useState<Taste | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [artist, setArtist] = useState("");
  const [matches, setMatches] = useState<DeezerArtist[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ user: SettingsUser }>("/api/settings"),
      api<Taste>("/api/taste").catch(() => null),
    ])
      .then(([s, t]) => {
        setUser(s.user);
        // A profile saved before the ids existed comes back without the map.
        setTaste(t ? { ...t, favorite_artist_ids: t.favorite_artist_ids ?? {} } : null);
        setBio(s.user.bio ?? "");
        setUsername(s.user.username ?? "");
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load your profile.")
      )
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (patch: Record<string, unknown>) => {
    try {
      await api("/api/settings", { method: "POST", body: JSON.stringify(patch) });
      return true;
    } catch (e) {
      Alert.alert("Not saved", e instanceof Error ? e.message : "Could not save.");
      return false;
    }
  }, []);

  const saveTaste = useCallback(async (next: Taste) => {
    setTaste(next);
    try {
      await api("/api/taste", {
        method: "POST",
        body: JSON.stringify({
          favorite_artists: next.favorite_artists,
          favorite_artist_ids: next.favorite_artist_ids,
          music_genres: next.music_genres,
          podcast_genres: next.podcast_genres,
        }),
      });
    } catch {
      Alert.alert("Not saved", "Your taste changes did not save.");
    }
  }, []);

  const toggleGenre = (kind: "music_genres" | "podcast_genres", value: string) => {
    if (!taste) return;
    const current = taste[kind] ?? [];
    void saveTaste({
      ...taste,
      [kind]: current.includes(value)
        ? current.filter((g) => g !== value)
        : [...current, value],
    });
  };

  // Suggest real artists as you type, so what you add is the actual person
  // rather than whatever you happened to spell.
  useEffect(() => {
    const q = artist.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    let alive = true;
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=6`
        );
        const data = (await res.json()) as { data?: DeezerArtist[] };
        if (alive) setMatches(data.data ?? []);
      } catch {
        if (alive) setMatches([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 280);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [artist]);

  const addNamed = (name: string, deezerId?: number) => {
    if (!taste) return;
    if (taste.favorite_artists.length >= 10) {
      Alert.alert("Limit reached", "You can list up to 10 artists.");
      return;
    }
    if (taste.favorite_artists.includes(name)) return;
    setArtist("");
    setMatches([]);
    void saveTaste({
      ...taste,
      favorite_artists: [...taste.favorite_artists, name],
      favorite_artist_ids: deezerId
        ? { ...taste.favorite_artist_ids, [name]: deezerId }
        : taste.favorite_artist_ids,
    });
  };

  const addArtist = () => {
    const name = artist.trim();
    if (!name || !taste) return;
    if (taste.favorite_artists.length >= 10) {
      Alert.alert("Limit reached", "You can list up to 10 artists.");
      return;
    }
    if (taste.favorite_artists.includes(name)) return;
    setArtist("");
    void saveTaste({ ...taste, favorite_artists: [...taste.favorite_artists, name] });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Edit profile" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Section title="PROFILE">
          <Field
            label="DISPLAY NAME"
            value={user?.display_name ?? ""}
            editable={false}
            note="From Spotify"
          />
          <Field
            label="BIO"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell the world what you're listening to"
            multiline
            maxLength={160}
            onBlur={() => void save({ bio })}
            note={`${bio.length}/160`}
          />
          <Field
            label="USERNAME"
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="username"
            autoCapitalize="none"
            maxLength={20}
            onBlur={() => {
              if (username && username !== user?.username) {
                void save({ username }).then((ok) => {
                  if (ok) setUser((u) => (u ? { ...u, username } : u));
                  else setUsername(user?.username ?? "");
                });
              }
            }}
            note="3–20 characters"
          />
        </Section>

        <Section title="MUSIC TASTE">
          <Text style={styles.label}>
            FAVOURITE ARTISTS ({taste?.favorite_artists.length ?? 0}/10)
          </Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={artist}
              onChangeText={setArtist}
              placeholder="Search for an artist…"
              placeholderTextColor={theme.muted}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={addArtist}
            />
          </View>

          {artist.trim().length >= 2 ? (
            <View style={local.matches}>
              {searching && matches.length === 0 ? (
                <Text style={styles.note}>Searching…</Text>
              ) : null}
              {matches.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => addNamed(m.name, m.id)}
                  style={({ pressed }) => [local.match, pressed && local.matchPressed]}
                >
                  {m.picture_medium ? (
                    <Image source={{ uri: m.picture_medium }} style={local.matchArt} />
                  ) : (
                    <View style={[local.matchArt, local.matchArtFallback]} />
                  )}
                  <Text style={local.matchName} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Ionicons name="add" size={20} color={theme.muted} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {taste?.favorite_artists.length ? (
            <View style={styles.chips}>
              {taste.favorite_artists.map((a) => (
                <Pressable
                  key={a}
                  onPress={() =>
                    void saveTaste({
                      ...taste,
                      favorite_artists: taste.favorite_artists.filter((x) => x !== a),
                      favorite_artist_ids: Object.fromEntries(
                        Object.entries(taste.favorite_artist_ids).filter(([k]) => k !== a)
                      ),
                    })
                  }
                  style={[styles.chip, styles.chipOn]}
                >
                  <Text style={styles.chipLabelOn}>{a}</Text>
                  <Ionicons name="close" size={14} color={theme.background} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={[styles.label, styles.labelSpaced]}>MUSIC GENRES</Text>
          <ChipGrid
            options={[...MUSIC_GENRES]}
            selected={taste?.music_genres ?? []}
            onToggle={(g) => toggleGenre("music_genres", g)}
          />

          <Text style={[styles.label, styles.labelSpaced]}>PODCAST GENRES</Text>
          <ChipGrid
            options={[...PODCAST_GENRES]}
            selected={taste?.podcast_genres ?? []}
            onToggle={(g) => toggleGenre("podcast_genres", g)}
          />
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const local = StyleSheet.create({
  matches: { gap: 2, marginTop: 4 },
  match: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  matchPressed: { opacity: 0.6 },
  matchArt: { width: 40, height: 40, borderRadius: 20 },
  matchArtFallback: { backgroundColor: theme.surface },
  matchName: { flex: 1, color: theme.foreground, fontSize: 16 },
});
