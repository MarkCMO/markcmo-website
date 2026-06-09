import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, TextInput, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../../src/store";
import { isValidPinFormat } from "../../src/services/pin";
import { Colors } from "../../src/theme";

const LENGTHS = [7, 14, 21, 30];

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useStore();
  const settings = state.settings;
  const [qStart, setQStart] = useState(settings?.quietHoursStart ?? "20:30");
  const [qEnd, setQEnd] = useState(settings?.quietHoursEnd ?? "07:00");
  const [pin, setPin] = useState("");

  if (!settings) return null;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={Colors.text} /></Pressable>
        <Text style={s.title}>Settings</Text><View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Group title="Verification">
          <Row label="Require grown-up to verify chores">
            <Switch value={settings.verificationRequired} onValueChange={(v) => state.updateSettings({ verificationRequired: v })} />
          </Row>
        </Group>

        <Group title="Missed tasks">
          <Row label="Carry over missed tasks">
            <Switch value={settings.carryOverMissedTasks} onValueChange={(v) => state.updateSettings({ carryOverMissedTasks: v })} />
          </Row>
          <Text style={s.note}>When on, a chore missed earlier keeps showing until done. When off, a miss is a miss and the day moves on.</Text>
        </Group>

        <Group title="Photo proof">
          {state.unlocked ? (
            <Row label="Require a photo when marking done">
              <Switch value={settings.photoProofRequired} onValueChange={(v) => state.updateSettings({ photoProofRequired: v })} />
            </Row>
          ) : (
            <Pressable style={s.lockRow} onPress={() => router.push("/parent/store")}>
              <Ionicons name="lock-closed" size={18} color={Colors.muted} />
              <Text style={s.lockText}>Require photo proof</Text>
              <Text style={s.unlock}>Unlock</Text>
            </Pressable>
          )}
        </Group>

        <Group title="Quiet hours">
          <Row label="Start">
            <TextInput style={s.time} value={qStart} onChangeText={setQStart} onEndEditing={() => state.updateSettings({ quietHoursStart: qStart })} placeholder="20:30" />
          </Row>
          <Row label="End">
            <TextInput style={s.time} value={qEnd} onChangeText={setQEnd} onEndEditing={() => state.updateSettings({ quietHoursEnd: qEnd })} placeholder="07:00" />
          </Row>
          <Text style={s.note}>No reminders are sent during quiet hours.</Text>
        </Group>

        <Group title="New pet default">
          <View style={s.pillRow}>
            {LENGTHS.map((d) => (
              <Pressable key={d} onPress={() => state.updateSettings({ defaultTrainingLengthDays: d })}
                style={[s.pill, settings.defaultTrainingLengthDays === d && s.pillOn]}>
                <Text style={[s.pillText, settings.defaultTrainingLengthDays === d && { color: "#fff" }]}>{d}d</Text>
              </Pressable>
            ))}
          </View>
        </Group>

        <Group title="Security">
          <Text style={s.note}>Change PIN (4 digits)</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <TextInput style={[s.time, { flex: 1 }]} value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" secureTextEntry placeholder="New PIN" />
            <Pressable style={s.saveBtn} disabled={!isValidPinFormat(pin)}
              onPress={async () => { await state.changePin(pin); setPin(""); Alert.alert("PIN updated"); }}>
              <Text style={[s.saveText, !isValidPinFormat(pin) && { opacity: 0.4 }]}>Save</Text>
            </Pressable>
          </View>
        </Group>
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ marginBottom: 16 }}><Text style={s.group}>{title}</Text><View style={s.card}>{children}</View></View>;
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={s.row}><Text style={s.rowLabel}>{label}</Text>{children}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  title: { fontSize: 18, fontWeight: "800", color: Colors.text },
  group: { fontSize: 13, fontWeight: "700", color: Colors.muted, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { fontSize: 15, color: Colors.text, flex: 1, paddingRight: 12 },
  note: { color: Colors.muted, fontSize: 12, marginTop: 6 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  lockText: { flex: 1, color: Colors.text, fontSize: 15 },
  unlock: { color: Colors.blue, fontWeight: "700" },
  time: { backgroundColor: "#F1F5F9", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, minWidth: 90, textAlign: "center" },
  pillRow: { flexDirection: "row", gap: 10 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F1F5F9" },
  pillOn: { backgroundColor: Colors.blue },
  pillText: { fontWeight: "700", color: Colors.text },
  saveBtn: { backgroundColor: Colors.blue, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "800" },
});
