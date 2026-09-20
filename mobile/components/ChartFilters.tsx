import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../lib/theme";
import { CHART_COUNTRIES } from "../lib/types";

export type ChartKind = "songs" | "podcasts";

/**
 * The chip row above Trending: what you are looking at, and where.
 *
 * Apple has no worldwide storefront, so Global is songs-only — picking
 * podcasts while on Global moves you to a country rather than showing an
 * option that cannot return anything.
 */
export function ChartFilters({
  kind,
  country,
  onChange,
}: {
  kind: ChartKind;
  country: string;
  onChange: (next: { kind: ChartKind; country: string }) => void;
}) {
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState(false);

  const countryLabel =
    CHART_COUNTRIES.find((c) => c.code === country)?.label ?? "Global";

  const setKind = (next: ChartKind) => {
    const nextCountry =
      next === "podcasts" && country === "global" ? "se" : country;
    onChange({ kind: next, country: nextCountry });
  };

  return (
    <>
      <View style={styles.row}>
        <Pressable
          onPress={() => setPicking(true)}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <Ionicons name="location-outline" size={15} color={theme.foreground} />
          <Text style={styles.chipLabel}>{countryLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={theme.muted} />
        </Pressable>

        <Pressable
          onPress={() => setKind("songs")}
          style={({ pressed }) => [
            styles.chip,
            kind === "songs" && styles.chipOn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.chipLabel, kind === "songs" && styles.chipLabelOn]}>
            Songs
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setKind("podcasts")}
          style={({ pressed }) => [
            styles.chip,
            kind === "podcasts" && styles.chipOn,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.chipLabel, kind === "podcasts" && styles.chipLabelOn]}>
            Podcasts
          </Text>
        </Pressable>
      </View>

      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTap} onPress={() => setPicking(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Charts from</Text>
            <ScrollView>
              {CHART_COUNTRIES.filter(
                (c) => !(kind === "podcasts" && c.code === "global")
              ).map((c) => {
                const on = c.code === country;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      onChange({ kind, country: c.code });
                      setPicking(false);
                    }}
                    style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                  >
                    <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>
                      {c.label}
                    </Text>
                    {on ? (
                      <Ionicons name="checkmark" size={20} color={theme.foreground} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  chipOn: { backgroundColor: theme.foreground },
  chipLabel: { color: theme.foreground, fontSize: 14, fontWeight: "600" },
  chipLabelOn: { color: theme.background },
  pressed: { opacity: 0.6 },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  backdropTap: { flex: 1 },
  sheet: {
    maxHeight: "62%",
    backgroundColor: theme.elevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginBottom: 12,
  },
  sheetTitle: {
    color: theme.foreground,
    fontSize: 18,
    fontWeight: "700",
    paddingBottom: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  optionLabel: { color: theme.muted, fontSize: 16 },
  optionLabelOn: { color: theme.foreground, fontWeight: "600" },
});
