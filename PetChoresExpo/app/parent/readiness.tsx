import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Share } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStore, tasksFor } from "../../src/store";
import { speciesById, speciesEmoji } from "../../src/seed";
import { makeReport, exportText } from "../../src/services/readiness";
import { Colors } from "../../src/theme";

export default function Readiness() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useStore();
  const [selId, setSelId] = useState<string | null>(state.instances[0]?.instanceId ?? null);

  const pet = state.instances.find((i) => i.instanceId === selId) ?? state.instances[0];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={Colors.text} /></Pressable>
        <Text style={s.title}>Readiness</Text><View style={{ width: 26 }} />
      </View>
      {!pet ? (
        <View style={s.center}><Text style={s.muted}>No pets yet.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {state.instances.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {state.instances.map((p) => (
                <Pressable key={p.instanceId} onPress={() => setSelId(p.instanceId)}
                  style={[s.tab, pet.instanceId === p.instanceId && s.tabOn]}>
                  <Text>{speciesEmoji(p.speciesId)} {p.nickname}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <Report pet={pet} />
        </ScrollView>
      )}
    </View>
  );
}

function Report({ pet }: { pet: any }) {
  const state = useStore();
  const router = useRouter();
  const species = speciesById(pet.speciesId)!;
  const r = makeReport(pet, species, tasksFor(state, pet.instanceId));

  return (
    <View>
      <View style={s.verdictCard}>
        <Text style={s.verdictLabel}>Verdict</Text>
        <Text style={s.verdict}>{r.verdict}</Text>
      </View>
      <View style={s.metrics}>
        <Metric label="Completion" value={`${Math.round(r.completionRate * 100)}%`} />
        <Metric label="On time" value={`${Math.round(r.onTimeRate * 100)}%`} />
      </View>
      <View style={s.metrics}>
        <Metric label="Longest streak" value={`${r.longestStreak}d`} />
        <Metric label="Tasks done" value={`${r.totalCompleted}/${r.totalDue}`} />
      </View>
      {r.hardestHandledLabel && (
        <View style={s.card}><Text style={s.cardTitle}>Hardest task handled well</Text><Text style={s.muted}>{r.hardestHandledLabel} at {Math.round(r.hardestHandledRate * 100)}%</Text></View>
      )}
      {r.topMissed.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Most often missed</Text>
          {r.topMissed.map((m) => <View key={m.label} style={s.missRow}><Text style={s.text}>{m.label}</Text><Text style={s.muted}>{m.count} times</Text></View>)}
        </View>
      )}

      {state.unlocked ? (
        <Pressable style={s.shareBtn} onPress={() => Share.share({ message: exportText(r) })}>
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={s.shareText}>Share report</Text>
        </Pressable>
      ) : (
        <Pressable style={s.lockBtn} onPress={() => router.push("/parent/store")}>
          <Ionicons name="lock-closed" size={18} color={Colors.blue} />
          <Text style={s.lockText}>Export report (unlock)</Text>
        </Pressable>
      )}
      <Text style={s.disclaimer}>This report is a guide for your family, not a guarantee. A real pet is a long term commitment for the whole household.</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={[s.card, { flex: 1 }]}><Text style={s.metricVal}>{value}</Text><Text style={s.muted}>{label}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  title: { fontSize: 18, fontWeight: "800", color: Colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tab: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.card, borderRadius: 20, marginRight: 8 },
  tabOn: { backgroundColor: "#DBEAFE" },
  verdictCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16 },
  verdictLabel: { color: Colors.muted, fontWeight: "700", fontSize: 12 },
  verdict: { fontSize: 20, fontWeight: "800", color: Colors.text, marginTop: 4 },
  metrics: { flexDirection: "row", gap: 12, marginTop: 12 },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginTop: 12 },
  cardTitle: { fontWeight: "800", color: Colors.text, marginBottom: 4 },
  metricVal: { fontSize: 24, fontWeight: "900", color: Colors.text },
  muted: { color: Colors.muted, fontSize: 13 },
  text: { color: Colors.text },
  missRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  shareBtn: { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center", backgroundColor: Colors.blue, borderRadius: 14, paddingVertical: 14, marginTop: 16 },
  shareText: { color: "#fff", fontWeight: "800" },
  lockBtn: { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.blue, borderRadius: 14, paddingVertical: 14, marginTop: 16 },
  lockText: { color: Colors.blue, fontWeight: "800" },
  disclaimer: { color: Colors.muted, fontSize: 12, marginTop: 16 },
});
