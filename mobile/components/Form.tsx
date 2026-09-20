import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../lib/theme";

/** Shared building blocks for the settings-style screens. */

export function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <Pressable
        onPress={onBack}
        hitSlop={14}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={theme.foreground} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
    </View>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Field({
  label,
  note,
  ...input
}: { label: string; note?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.label}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <View style={[styles.inputWrap, input.editable === false && styles.inputDisabled]}>
        <TextInput
          style={[styles.input, input.multiline && styles.inputMultiline]}
          placeholderTextColor={theme.muted}
          {...input}
        />
      </View>
    </View>
  );
}

export function ChipGrid({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => onToggle(option)}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={on ? styles.chipLabelOn : styles.chipLabel}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "rgba(255,255,255,0.15)", true: theme.accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

export function NavRow({
  label,
  note,
  icon,
  onPress,
}: {
  label: string;
  note?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]}
    >
      <View style={styles.toggleText}>
        <Text style={styles.rowButtonLabel}>{label}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      <Ionicons
        name={icon ?? "chevron-forward"}
        size={20}
        color={theme.muted}
      />
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
  },
  headerTitle: { color: theme.foreground, fontSize: 20, fontWeight: "700" },
  error: { color: "#ff6b6b", fontSize: 14, paddingHorizontal: 20, paddingTop: 8 },
  section: { paddingHorizontal: 20, paddingTop: 22, gap: 12 },
  sectionTitle: {
    color: theme.muted,
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  field: { gap: 6 },
  fieldHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { color: theme.muted, fontSize: 12, letterSpacing: 0.8, fontWeight: "600" },
  labelSpaced: { marginTop: 10 },
  note: { color: theme.muted, fontSize: 12 },
  inputWrap: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    backgroundColor: theme.surface,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  inputDisabled: { opacity: 0.55 },
  input: { color: theme.foreground, fontSize: 16, paddingVertical: 10 },
  inputMultiline: { minHeight: 68, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  chipOn: { backgroundColor: theme.foreground, borderColor: theme.foreground },
  chipLabel: { color: theme.foreground, fontSize: 14 },
  chipLabelOn: { color: theme.background, fontSize: 14, fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { color: theme.foreground, fontSize: 16 },
  rowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowButtonLabel: { color: theme.foreground, fontSize: 16, fontWeight: "600" },
  pressed: { opacity: 0.7 },
});
