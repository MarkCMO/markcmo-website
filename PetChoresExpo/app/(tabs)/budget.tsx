import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore, activeInstances } from "../../src/store";
import { speciesById } from "../../src/seed";
import { startupTotal, monthlyTotal, firstYearProjection, yearlySupplies } from "../../src/services/budget";
import { Colors, money } from "../../src/theme";

export default function Budget() {
  const insets = useSafeAreaInsets();
  const state = useStore();
  const pet = activeInstances(state)[0];
  if (!pet) return <View style={s.center}><Text style={s.muted}>No pet yet.</Text></View>;
  const species = speciesById(pet.speciesId)!;
  const entries = state.budget.filter((b) => b.instanceId === pet.instanceId);
  const once = species.supplies.filter((x) => x.frequency === "once");
  const monthly = species.supplies.filter((x) => x.frequency === "monthly");
  const yearly = yearlySupplies(species);

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 30 }}>
      <Text style={s.title}>Budget</Text>
      <View style={s.tiles}>
        <Tile title="Startup" value={money(startupTotal(entries))} />
        <Tile title="Per month" value={money(monthlyTotal(species))} />
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>True cost of a year</Text>
        <Text style={s.big}>{money(firstYearProjection(species))}</Text>
        <Text style={s.muted}>Startup plus 12 months plus once-a-year items like vet visits.</Text>
      </View>

      <Lines title="What you bought to start" items={once} />
      <Lines title="What you buy every month" items={monthly} />
      {yearly.length > 0 && <Lines title="Once a year" items={yearly} />}
    </ScrollView>
  );
}

function Tile({ title, value }: { title: string; value: string }) {
  return <View style={[s.card, { flex: 1 }]}><Text style={s.big}>{value}</Text><Text style={s.muted}>{title}</Text></View>;
}
function Lines({ title, items }: { title: string; items: { item: string; cost: number }[] }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {items.map((x, i) => (
        <View key={i} style={s.lineRow}><Text style={s.line}>{x.item}</Text><Text style={s.lineVal}>{money(x.cost)}</Text></View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  title: { fontSize: 30, fontWeight: "800", color: Colors.text, marginBottom: 8 },
  tiles: { flexDirection: "row", gap: 12 },
  card: { backgroundColor: Colors.card, borderRadius: 18, padding: 16, marginTop: 12 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: Colors.text, marginBottom: 6 },
  big: { fontSize: 30, fontWeight: "900", color: Colors.text },
  muted: { color: Colors.muted, fontSize: 13, marginTop: 2 },
  lineRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  line: { color: Colors.text, fontSize: 14, flex: 1 },
  lineVal: { fontWeight: "700", color: Colors.text },
});
