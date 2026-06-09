import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore, activeInstances } from "../../src/store";
import { speciesById } from "../../src/seed";
import { CareTaskTemplate, TaskFrequency } from "../../src/types";
import { Colors } from "../../src/theme";
import { PetVisual } from "../../src/components/PetVisual";

const FREQ_ORDER: TaskFrequency[] = ["daily", "weekly", "monthly", "yearly"];

export default function PetTab() {
  const insets = useSafeAreaInsets();
  const state = useStore();
  const pet = activeInstances(state)[0];
  if (!pet) return <Empty insetsTop={insets.top} />;
  const species = speciesById(pet.speciesId)!;

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 30 }}>
      <PetVisual speciesId={species.id} category={species.category} wellbeing={pet.wellbeing} height={220} />
      <Text style={s.name}>{pet.nickname}</Text>
      <Text style={s.species}>{species.name} {"\u{1F43E}".repeat(species.difficulty)}</Text>

      <Card>
        <Text style={s.cardTitle}>About</Text>
        <Text style={s.muted}>{species.blurb}</Text>
        <Fact label="Lifespan" value={`${species.lifespanYears} years`} />
        <Fact label="Wellbeing" value={`${pet.wellbeing} / 100`} />
        <Fact label="Trust" value={`${pet.trust} / 100`} />
        <Fact label="Training" value={`${pet.trainingLengthDays} days`} />
      </Card>

      <Card>
        <Text style={s.cardTitle}>What {pet.nickname} needs to be happy</Text>
        {species.tasks.filter((t) => t.frequency === "daily").slice(0, 5).map((t) => (
          <Text key={t.id} style={s.needLine}>{"❤️"}  {t.label}</Text>
        ))}
      </Card>

      <Card>
        <Text style={s.cardTitle}>Care schedule</Text>
        {FREQ_ORDER.map((f) => {
          const group = species.tasks.filter((t) => t.frequency === f);
          if (!group.length) return null;
          return (
            <View key={f} style={{ marginTop: 8 }}>
              <Text style={s.freq}>{f[0].toUpperCase() + f.slice(1)}</Text>
              {group.map((t: CareTaskTemplate) => (
                <View key={t.id} style={{ marginTop: 4 }}>
                  <Text style={s.taskLabel}>{t.label}</Text>
                  <Text style={s.taskAction}>{t.realAction}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

function Empty({ insetsTop }: { insetsTop: number }) {
  return <View style={[s.center, { paddingTop: insetsTop }]}><Text style={s.muted}>No pet yet. Start one in Parent Mode.</Text></View>;
}
function Card({ children }: { children: React.ReactNode }) { return <View style={s.card}>{children}</View>; }
function Fact({ label, value }: { label: string; value: string }) {
  return <View style={s.factRow}><Text style={s.muted}>{label}</Text><Text style={s.factVal}>{value}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  name: { fontSize: 30, fontWeight: "800", color: Colors.text, textAlign: "center", marginTop: 10 },
  species: { fontSize: 15, color: Colors.muted, textAlign: "center", marginBottom: 8 },
  card: { backgroundColor: Colors.card, borderRadius: 18, padding: 16, marginTop: 12 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: Colors.text, marginBottom: 6 },
  muted: { color: Colors.muted, fontSize: 14 },
  factRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  factVal: { fontWeight: "700", color: Colors.text },
  needLine: { color: Colors.muted, fontSize: 14, marginTop: 4 },
  freq: { fontWeight: "800", color: Colors.blue, marginBottom: 2 },
  taskLabel: { fontWeight: "700", color: Colors.text, fontSize: 14 },
  taskAction: { color: Colors.muted, fontSize: 12 },
});
