import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../../src/store";
import { Colors, timeStr } from "../../src/theme";

export default function Verify() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useStore();
  const tasks = state.tasks.filter((t) => t.status === "done")
    .sort((a, b) => +new Date(b.completedAt ?? b.dueAt) - +new Date(a.completedAt ?? a.dueAt));

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={Colors.text} /></Pressable>
        <Text style={s.title}>Verify Tasks</Text><View style={{ width: 26 }} />
      </View>
      {tasks.length === 0 ? (
        <View style={s.center}><Ionicons name="checkmark-done-circle" size={48} color="#CBD5E1" /><Text style={s.muted}>All caught up.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {tasks.map((t) => (
            <View key={t.scheduledId} style={s.card}>
              <Text style={s.label}>{t.label}</Text>
              <Text style={s.sub}>{t.completedAt ? `Marked done ${timeStr(t.completedAt)}` : ""} {t.onTime ? "· On time" : "· Late"}</Text>
              {t.photoUri && <Image source={{ uri: t.photoUri }} style={s.photo} />}
              <View style={s.btnRow}>
                <Pressable style={[s.btn, s.reject]} onPress={() => useStore.getState().rejectTask(t.scheduledId)}>
                  <Text style={[s.btnText, { color: Colors.orange }]}>Send back</Text>
                </Pressable>
                <Pressable style={[s.btn, s.verify]} onPress={() => useStore.getState().verifyTask(t.scheduledId)}>
                  <Text style={[s.btnText, { color: "#fff" }]}>Verify</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  title: { fontSize: 18, fontWeight: "800", color: Colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  muted: { color: Colors.muted },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  label: { fontSize: 16, fontWeight: "800", color: Colors.text },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  photo: { width: "100%", height: 150, borderRadius: 12, marginTop: 10 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  reject: { borderWidth: 1, borderColor: Colors.orange },
  verify: { backgroundColor: Colors.green },
  btnText: { fontWeight: "800" },
});
