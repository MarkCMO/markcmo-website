import React from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../../src/store";
import { Colors } from "../../src/theme";

export default function ParentHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useStore();
  const awaiting = state.tasks.filter((t) => t.status === "done").length;

  const Item = ({ icon, label, to, badge }: { icon: any; label: string; to: string; badge?: number }) => (
    <Pressable style={s.row} onPress={() => router.push(to as any)}>
      <Ionicons name={icon} size={22} color={Colors.blue} />
      <Text style={s.rowLabel}>{label}</Text>
      {badge ? <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View> : null}
      <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
    </Pressable>
  );

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.nav}>
        <Text style={s.title}>Parent Mode</Text>
        <Pressable onPress={() => router.replace("/(tabs)/home")}><Text style={s.done}>Done</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={s.card}>
          <Item icon="checkmark-circle" label="Verify Tasks" to="/parent/verify" badge={awaiting} />
          <Item icon="document-text" label="Readiness Report" to="/parent/readiness" />
          <Item icon="paw" label="Manage Pets" to="/parent/manage" />
          <Item icon="settings" label="Settings" to="/parent/settings" />
        </View>
        <Text style={s.section}>Unlock</Text>
        <View style={s.card}>
          <Item icon={state.unlocked ? "checkmark-done" : "lock-open"} label={state.unlocked ? "Full version unlocked" : "Unlock the full app"} to="/parent/store" />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  nav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  title: { fontSize: 26, fontWeight: "800", color: Colors.text },
  done: { color: Colors.blue, fontSize: 16, fontWeight: "700" },
  section: { fontSize: 14, fontWeight: "700", color: Colors.muted, marginTop: 16, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEE" },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: "600", color: Colors.text },
  badge: { backgroundColor: Colors.blue, borderRadius: 12, minWidth: 24, paddingHorizontal: 7, paddingVertical: 2, alignItems: "center" },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
