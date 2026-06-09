import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../../src/store";
import { catalog, speciesEmoji } from "../../src/seed";
import { Colors } from "../../src/theme";

const LENGTHS = [7, 14, 21, 30];

export default function Manage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useStore();
  const [adding, setAdding] = useState(false);
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [length, setLength] = useState(state.settings?.defaultTrainingLengthDays ?? 21);

  const canCreate = state.unlocked || state.instances.length === 0;

  function startNew() {
    if (canCreate) setAdding(true);
    else Alert.alert("Unlock more pets",
      "The free version includes one pet for one training window. Unlock the full app to add more.",
      [{ text: "Not now" }, { text: "See unlock", onPress: () => router.push("/parent/store") }]);
  }

  function create() {
    if (!speciesId || !nickname.trim()) return;
    state.createPet(speciesId, nickname, length);
    setAdding(false); setSpeciesId(null); setNickname("");
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={Colors.text} /></Pressable>
        <Text style={s.title}>Manage Pets</Text><View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {!adding ? (
          <Pressable style={s.addRow} onPress={startNew}>
            <Ionicons name="add-circle" size={22} color={Colors.blue} />
            <Text style={s.addText}>Start a new pet</Text>
          </Pressable>
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>New pet</Text>
            <View style={s.grid}>
              {catalog.map((p) => (
                <Pressable key={p.id} onPress={() => setSpeciesId(p.id)}
                  style={[s.petPick, speciesId === p.id && s.petPickOn]}>
                  <Text style={{ fontSize: 26 }}>{speciesEmoji(p.id)}</Text>
                  <Text style={s.petPickName}>{p.name}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={s.input} value={nickname} onChangeText={setNickname} placeholder="Pet name" />
            <View style={s.pillRow}>
              {LENGTHS.map((d) => (
                <Pressable key={d} onPress={() => setLength(d)} style={[s.pill, length === d && s.pillOn]}>
                  <Text style={[s.pillText, length === d && { color: "#fff" }]}>{d}d</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <Pressable style={[s.btn, { backgroundColor: "#E2E8F0" }]} onPress={() => setAdding(false)}><Text style={[s.btnText, { color: Colors.text }]}>Cancel</Text></Pressable>
              <Pressable style={[s.btn, { backgroundColor: Colors.blue }, !(speciesId && nickname.trim()) && { opacity: 0.4 }]} disabled={!(speciesId && nickname.trim())} onPress={create}>
                <Text style={[s.btnText, { color: "#fff" }]}>Start</Text>
              </Pressable>
            </View>
          </View>
        )}

        {state.instances.map((p) => (
          <View key={p.instanceId} style={s.petRow}>
            <Text style={{ fontSize: 26 }}>{speciesEmoji(p.speciesId)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.petName}>{p.nickname}</Text>
              <Text style={s.muted}>{p.isActive ? "Active" : "Finished"} · {p.trainingLengthDays} day window</Text>
            </View>
            {p.isActive && (
              <Pressable onPress={() => state.archivePet(p.instanceId)} hitSlop={10}><Ionicons name="archive-outline" size={22} color={Colors.muted} /></Pressable>
            )}
            <Pressable onPress={() => Alert.alert(`Delete ${p.nickname}?`, "This removes the pet, its chores, and budget.", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => state.deletePet(p.instanceId) }])} hitSlop={10}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  title: { fontSize: 18, fontWeight: "800", color: Colors.text },
  addRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.card, borderRadius: 14, padding: 16, marginBottom: 12 },
  addText: { fontSize: 16, fontWeight: "700", color: Colors.blue },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardTitle: { fontWeight: "800", color: Colors.text, fontSize: 16, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  petPick: { width: "23%", alignItems: "center", paddingVertical: 8, borderRadius: 12, backgroundColor: "#F1F5F9" },
  petPickOn: { backgroundColor: "#DBEAFE", borderWidth: 1, borderColor: Colors.blue },
  petPickName: { fontSize: 10, color: Colors.text, marginTop: 2 },
  input: { backgroundColor: "#F1F5F9", borderRadius: 10, padding: 12, fontSize: 16, marginTop: 12 },
  pillRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F1F5F9" },
  pillOn: { backgroundColor: Colors.blue },
  pillText: { fontWeight: "700", color: Colors.text },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  btnText: { fontWeight: "800" },
  petRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  petName: { fontWeight: "800", color: Colors.text, fontSize: 16 },
  muted: { color: Colors.muted, fontSize: 12 },
});
