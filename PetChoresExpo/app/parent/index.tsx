import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../../src/store";
import { verifyPin } from "../../src/services/pin";
import { Colors } from "../../src/theme";

export default function ParentGate() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useStore((s) => s.settings);
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onDigit(d: string) {
    if (entry.length >= 4) return;
    const next = entry + d;
    setEntry(next);
    if (next.length === 4) {
      const ok = settings ? await verifyPin(next, settings.pinSalt, settings.pinHash) : false;
      if (ok) router.replace("/parent/hub");
      else { setError("That PIN was not right. Try again."); setEntry(""); }
    }
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <View style={[s.root, { paddingTop: insets.top + 20 }]}>
      <Pressable style={s.cancel} onPress={() => router.back()}><Text style={s.cancelText}>Cancel</Text></Pressable>
      <Ionicons name="lock-closed" size={44} color={Colors.muted} style={{ marginTop: 30 }} />
      <Text style={s.title}>Parent Mode</Text>
      <Text style={s.muted}>Ask a grown up to enter the PIN.</Text>
      <View style={s.dots}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={[s.dot, i < entry.length && s.dotOn]} />)}
      </View>
      {error && <Text style={s.err}>{error}</Text>}
      <View style={s.pad}>
        {keys.map((k, i) => k === "" ? <View key={i} style={s.key} /> : (
          <Pressable key={i} style={s.key} onPress={() => k === "del" ? setEntry(entry.slice(0, -1)) : onDigit(k)}>
            {k === "del" ? <Ionicons name="backspace-outline" size={26} color={Colors.text} /> : <Text style={s.keyText}>{k}</Text>}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, alignItems: "center" },
  cancel: { position: "absolute", left: 16, top: 16 },
  cancelText: { color: Colors.blue, fontSize: 16, fontWeight: "600" },
  title: { fontSize: 26, fontWeight: "800", color: Colors.text, marginTop: 14 },
  muted: { color: Colors.muted, marginTop: 4 },
  dots: { flexDirection: "row", gap: 18, marginTop: 26 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: Colors.muted },
  dotOn: { backgroundColor: Colors.blue, borderColor: Colors.blue },
  err: { color: "#EF4444", marginTop: 14 },
  pad: { flexDirection: "row", flexWrap: "wrap", width: 300, marginTop: 30, justifyContent: "space-between" },
  key: { width: 90, height: 70, alignItems: "center", justifyContent: "center", marginBottom: 12, borderRadius: 16, backgroundColor: Colors.card },
  keyText: { fontSize: 28, fontWeight: "700", color: Colors.text },
});
