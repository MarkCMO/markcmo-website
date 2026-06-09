import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore, activeInstances, tasksFor } from "../../src/store";
import { isHandled, petLevel } from "../../src/types";
import { Colors } from "../../src/theme";

export default function Rewards() {
  const insets = useSafeAreaInsets();
  const state = useStore();
  const pet = activeInstances(state)[0];
  if (!pet) return <View style={s.center}><Text style={s.muted}>No pet yet.</Text></View>;

  const tasks = tasksFor(state, pet.instanceId);
  const handled = tasks.filter(isHandled);
  const cleaning = handled.filter((t) => /clean|scoop|litter|cage|coop|spot/i.test(t.templateId + t.label)).length;
  const poop = handled.filter((t) => /poop|scoop|litter|spot_clean/i.test(t.templateId + t.label)).length;

  const badges = [
    { t: "First Week Done", e: "\u{1F4C5}", earned: pet.longestStreakDays >= 7 },
    { t: "Never Missed a Meal", e: "\u{1F37D}", earned: pet.currentStreakDays >= 1 && !tasks.some((x) => x.status === "missed" && /feed|food|hay/i.test(x.templateId + x.label)) },
    { t: "Poop Patrol Pro", e: "\u{1F9F9}", earned: poop >= 5 },
    { t: "Clean Cage Champion", e: "\u{2728}", earned: cleaning >= 4 },
    { t: "Trusted Friend", e: "\u{1F49B}", earned: pet.trust >= 50 },
    { t: "Point Collector", e: "\u{2B50}", earned: pet.carePoints >= 500 },
  ];

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 30 }}>
      <Text style={s.title}>Rewards</Text>
      <View style={s.tiles}>
        <Stat title="Care Points" value={`${pet.carePoints}`} />
        <Stat title="Level" value={`${petLevel(pet.trust)}`} />
      </View>
      <View style={s.tiles}>
        <Stat title="Current streak" value={`${pet.currentStreakDays}d`} />
        <Stat title="Best streak" value={`${pet.longestStreakDays}d`} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Trust</Text>
        <View style={s.barTrack}><View style={[s.barFill, { width: `${pet.trust}%` }]} /></View>
        <Text style={s.muted}>{pet.trust} / 100. You are becoming a great pet owner.</Text>
      </View>

      <Text style={s.section}>Badges</Text>
      <View style={s.grid}>
        {badges.map((b) => (
          <View key={b.t} style={[s.badge, !b.earned && { opacity: 0.5 }]}>
            <Text style={{ fontSize: 30 }}>{b.e}</Text>
            <Text style={s.badgeTitle}>{b.t}</Text>
            <Text style={[s.badgeState, { color: b.earned ? Colors.green : Colors.muted }]}>{b.earned ? "Earned" : "Keep going"}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return <View style={[s.card, { flex: 1 }]}><Text style={s.statVal}>{value}</Text><Text style={s.muted}>{title}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  title: { fontSize: 30, fontWeight: "800", color: Colors.text, marginBottom: 8 },
  tiles: { flexDirection: "row", gap: 12, marginTop: 4 },
  card: { backgroundColor: Colors.card, borderRadius: 18, padding: 16, marginTop: 8 },
  statVal: { fontSize: 26, fontWeight: "900", color: Colors.text },
  muted: { color: Colors.muted, fontSize: 13, marginTop: 2 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: Colors.text, marginBottom: 8 },
  barTrack: { height: 12, borderRadius: 8, backgroundColor: "#E2E8F0", overflow: "hidden" },
  barFill: { height: 12, borderRadius: 8, backgroundColor: "#EC4899" },
  section: { fontSize: 20, fontWeight: "800", color: Colors.text, marginTop: 16, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  badge: { width: "47%", backgroundColor: Colors.card, borderRadius: 16, padding: 14 },
  badgeTitle: { fontWeight: "800", color: Colors.text, marginTop: 6, fontSize: 14 },
  badgeState: { fontSize: 12, marginTop: 2 },
});
