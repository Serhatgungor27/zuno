import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../lib/api";
import { theme } from "../lib/theme";
import type { VibeComment } from "../lib/types";

/** The server truncates at 200; saying so beats silently losing the tail. */
const MAX_LENGTH = 200;

/** Shortest form that still reads as a time: 3m, 4h, 2d. */
function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)}d`;
  return `${Math.floor(days / 7)}w`;
}

export function CommentsSheet({
  historyId,
  visible,
  onClose,
  onCountChange,
}: {
  /** The vibe being discussed. */
  historyId: string;
  visible: boolean;
  onClose: () => void;
  /** Lets the opener keep its count badge honest without refetching. */
  onCountChange?: (count: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<VibeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<VibeComment>>(null);

  useEffect(() => {
    if (!visible || !historyId) return;
    let alive = true;
    setLoading(true);
    api<{ comments: VibeComment[]; count: number }>(
      `/api/vibe/comments?historyId=${encodeURIComponent(historyId)}`
    )
      .then((data) => {
        if (!alive) return;
        setComments(data.comments ?? []);
        onCountChange?.(data.count ?? 0);
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "Could not load comments.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // onCountChange is a reporting channel, not an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, historyId]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await api<{ comment: VibeComment }>("/api/vibe/comments", {
        method: "POST",
        body: JSON.stringify({ historyId, text }),
      });
      setDraft("");
      setComments((prev) => {
        const next = [...prev, res.comment];
        onCountChange?.(next.length);
        return next;
      });
      // Newest sits at the bottom, so follow it down.
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setError("That comment didn't send.");
    } finally {
      setSending(false);
    }
  }, [draft, sending, historyId, onCountChange]);

  /** Optimistic: a heart that waits on a round trip feels broken. */
  const toggleLike = useCallback(async (comment: VibeComment) => {
    const liked = !comment.user_liked;
    setComments((prev) =>
      prev.map((c) =>
        c.id === comment.id
          ? { ...c, user_liked: liked, like_count: c.like_count + (liked ? 1 : -1) }
          : c
      )
    );
    try {
      await api("/api/vibe/comment-like", {
        method: "POST",
        body: JSON.stringify({ commentId: comment.id }),
      });
    } catch {
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id
            ? { ...c, user_liked: !liked, like_count: c.like_count + (liked ? -1 : 1) }
            : c
        )
      );
    }
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTap} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheet}
        >
          <View style={styles.handle} />
          <Text style={styles.heading}>
            {comments.length > 0 ? `${comments.length} comments` : "Comments"}
          </Text>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={comments}
              keyExtractor={(c) => c.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.empty}>No comments yet.</Text>
                  <Text style={styles.emptyHint}>Say the first thing.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Comment
                  comment={item}
                  onOpenProfile={() => {
                    if (!item.user_username) return;
                    onClose();
                    router.push(`/u/${item.user_username}` as never);
                  }}
                  onToggleLike={() => void toggleLike(item)}
                />
              )}
            />
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={(t) => setDraft(t.slice(0, MAX_LENGTH))}
              placeholder="Add a comment…"
              placeholderTextColor={theme.muted}
              multiline
              maxLength={MAX_LENGTH}
              returnKeyType="send"
              onSubmitEditing={() => void send()}
            />
            <Pressable
              onPress={() => void send()}
              disabled={!draft.trim() || sending}
              style={({ pressed }) => [
                styles.send,
                (!draft.trim() || sending) && styles.sendOff,
                pressed && styles.pressed,
              ]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="arrow-up" size={19} color="#fff" />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Comment({
  comment,
  onOpenProfile,
  onToggleLike,
}: {
  comment: VibeComment;
  onOpenProfile: () => void;
  onToggleLike: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onOpenProfile} hitSlop={6}>
        {comment.user_image ? (
          <Image source={{ uri: comment.user_image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.initial}>
              {(comment.user_name ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </Pressable>

      <View style={styles.body}>
        <View style={styles.byline}>
          <Pressable onPress={onOpenProfile} hitSlop={6}>
            <Text style={styles.name}>
              {comment.user_username ? `@${comment.user_username}` : comment.user_name ?? "Someone"}
            </Text>
          </Pressable>
          <Text style={styles.time}>{ago(comment.created_at)}</Text>
        </View>
        <Text style={styles.text}>{comment.text}</Text>
      </View>

      <Pressable onPress={onToggleLike} hitSlop={8} style={styles.like}>
        <Ionicons
          name={comment.user_liked ? "heart" : "heart-outline"}
          size={15}
          color={comment.user_liked ? "#ff3b5c" : theme.muted}
        />
        {comment.like_count > 0 ? (
          <Text style={styles.likeCount}>{comment.like_count}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  backdropTap: { flex: 1 },
  sheet: {
    maxHeight: "78%",
    minHeight: "52%",
    backgroundColor: theme.elevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
    alignSelf: "center",
    marginTop: 8,
  },
  heading: {
    color: theme.foreground,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  list: { flex: 1 },
  listContent: { paddingVertical: 8 },
  centered: { paddingTop: 44, alignItems: "center", gap: 4 },
  empty: { color: theme.foreground, fontSize: 15, fontWeight: "600" },
  emptyHint: { color: theme.muted, fontSize: 13 },
  error: { color: "#ff6b6b", fontSize: 13, textAlign: "center", paddingBottom: 6 },
  row: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 9 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.surface },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  initial: { color: theme.muted, fontSize: 14, fontWeight: "600" },
  body: { flex: 1, gap: 2 },
  byline: { flexDirection: "row", alignItems: "center", gap: 7 },
  name: { color: theme.foreground, fontSize: 13, fontWeight: "600" },
  time: { color: theme.muted, fontSize: 12 },
  text: { color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 19 },
  like: { alignItems: "center", gap: 2, paddingTop: 4, width: 26 },
  likeCount: { color: theme.muted, fontSize: 11 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  input: {
    flex: 1,
    maxHeight: 96,
    color: theme.foreground,
    fontSize: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
  },
  send: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2d6cf6",
  },
  sendOff: { backgroundColor: "rgba(255,255,255,0.14)" },
  pressed: { opacity: 0.6 },
});
