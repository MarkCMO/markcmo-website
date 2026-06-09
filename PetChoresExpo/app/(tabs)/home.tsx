import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStore, activeInstances, tasksFor } from "../../src/store";
import { speciesById } from "../../src/seed";
import { moodFromWellbeing, moodLabel, ScheduledTask } from "../../src/types";
import { startOfDay, addDays, timeStr } from "../../src/services/time";
import { Colors } from "../../src/theme";
import { PetVisual } from "../../src/components/PetVisual";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useStore();
  const pets = activeInstances(state);
  const pet = pets[0];

  if (!pet) {
    return (
      <View style={[st.center, { paddingTop: insets.top }]}>
        <Text style={{ fontSize: 56 }}>{"\u{1F43E}"}</Text>
        <Text style={st.h1}>No active pet</Text>
        <Text style={st.muted}>Ask a grown-up to start a pet in Parent Mode.</Text>
        <Pressable style={st.btn} onPress={() => router.push("/parent")}>
          <Text style={st.btnText}>Open Parent Mode</Text>
        </Pressable>
      </View>
    );
  }

  const species = speciesById(pet.speciesId)!;
  const mood = moodFromWellbeing(pet.wellbeing);
  const today0 = startOfDay(new Date());
  const today1 = addDays(today0, 1);
  const all = tasksFor(state, pet.instanceId);
  const today = all.filter((t) => {
    const d = new Date(t.dueAt);
    return d >= today0 && d < today1;
  });
  const carry = state.settings?.carryOverMissedTasks
    ? all.filter((t) => t.status === "missed" && new Date(t.dueAt) < today0)
    : [];

  const groups: { title: string; items: ScheduledTask[] }[] = [
    { title: "Morning", items: today.filter((t) => new Date(t.dueAt).getHours() < 12) },
    { title: "Afternoon", items: today.filter((t) => { const h = new Date(t.dueAt).getHours(); return h >= 12 && h < 17; }) },
    { title: "Evening", items: today.filter((t) => new Date(t.dueAt).getHours() >= 17) },
  ];

  const moodMsg: Record<string, string> = {
    happy: `${pet.nickname} is happy and well cared for.`,
    content: `${pet.nickname} is content today.`,
    needsAttention: `${pet.nickname} could use a little attention.`,
    sad: `${pet.nickname} is feeling lonely. A little care will help.`,
    pleaseHelp: `${pet.nickname} really needs you today. Let's take care of them.`,
  };

  return (
    <ScrollView style={st.root} contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 30 }}>
      <View style={st.headerRow}>
        <Text style={st.title}>Today</Text>
        <Pressable style={st.grownups} onPress={() => router.push("/parent")}>
          <Ionicons name="lock-closed" size={14} color={Colors.muted} />
          <Text style={st.grownupsText}>Grown-ups</Text>
        </Pressable>
      </View>

      <View style={st.card}>
        <PetVisual speciesId={species.id} category={species.category} wellbeing={pet.wellbeing} />
        <View style={st.statusRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.nick}>{pet.nickname}</Text>
            <Text style={st.muted}>{moodMsg[mood]}</Text>
          </View>
          <View style={st.flame}>
            <Ionicons name="flame" size={18} color={pet.currentStreakDays > 0 ? Colors.orange : "#CBD5E1"} />
            <Text style={st.flameText}>{pet.currentStreakDays}</Text>
          </View>
        </View>
        <WellbeingBar value={pet.wellbeing} />
      </View>

      {carry.length > 0 && (
        <Section title="Catch up from earlier">
          {carry.map((t) => <TaskRow key={t.scheduledId} task={t} onPress={() => router.push(`/task/${t.scheduledId}`)} />)}
        </Section>
      )}

      {groups.map((g) => g.items.length > 0 && (
        <Section key={g.title} title={g.title}>
          {g.items.map((t) => <TaskRow key={t.scheduledId} task={t} onPress={() => router.push(`/task/${t.scheduledId}`)} />)}
        </Section>
      ))}

      {today.length === 0 && (
        <View style={st.card}><Text style={st.muted}>No tasks for today. Nice and quiet.</Text></View>
      )}
    </ScrollView>
  );
}

function WellbeingBar({ value }: { value: number }) {
  return (
    <View style={{ marginTop: 12 }}>
      <View style={st.barRow}>
        <Text style={st.barLabel}>Wellbeing</Text>
        <Text style={st.barVal}>{value}</Text>
      </View>
      <View style={st.barTrack}><View style={[st.barFill, { width: `${value}%` }]} /></View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={st.section}>{title}</Text>
      {children}
    </View>
  );
}

function TaskRow({ task, onPress }: { task: ScheduledTask; onPress: () => void }) {
  const overdue = task.status === "pending" && new Date() > new Date(task.dueAt);
  const chip = chipFor(task.status);
  return (
    <Pressable style={st.taskCard} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={st.taskLabel}>{task.label}</Text>
        <Text style={[st.taskTime, overdue && { color: Colors.orange }]}>{timeStr(task.dueAt)}</Text>
      </View>
      <View style={[st.chip, { backgroundColor: chip.bg }]}><Text style={[st.chipText, { color: chip.fg }]}>{chip.text}</Text></View>
    </Pressable>
  );
}

function chipFor(status: string): { text: string; bg: string; fg: string } {
  switch (status) {
    case "verified": return { text: "Done", bg: "#DCFCE7", fg: "#16A34A" };
    case "done": return { text: "Waiting for grown-up", bg: "#EDE9FE", fg: "#7C3AED" };
    case "missed": return { text: "Missed", bg: "#FFEDD5", fg: "#EA580C" };
    default: return { text: "To do", bg: "#DBEAFE", fg: "#2563EB" };
  }
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg, padding: 24, gap: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 30, fontWeight: "800", color: Colors.text },
  grownups: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6 },
  grownupsText: { color: Colors.muted, fontWeight: "600" },
  card: { backgroundColor: Colors.card, borderRadius: 22, padding: 16, marginBottom: 4 },
  statusRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 12 },
  nick: { fontSize: 22, fontWeight: "800", color: Colors.text },
  muted: { color: Colors.muted, fontSize: 14 },
  flame: { flexDirection: "row", alignItems: "center", gap: 4 },
  flameText: { fontWeight: "800", fontSize: 16, color: Colors.text },
  barRow: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { color: Colors.muted, fontWeight: "600", fontSize: 12 },
  barVal: { fontWeight: "800", fontSize: 12, color: Colors.text },
  barTrack: { height: 12, borderRadius: 8, backgroundColor: "#E2E8F0", marginTop: 4, overflow: "hidden" },
  barFill: { height: 12, borderRadius: 8, backgroundColor: "#22C55E" },
  section: { fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 6 },
  taskCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  taskLabel: { fontSize: 16, fontWeight: "700", color: Colors.text },
  taskTime: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  chip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 11, fontWeight: "700" },
  h1: { fontSize: 22, fontWeight: "800", color: Colors.text },
  btn: { backgroundColor: Colors.blue, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
