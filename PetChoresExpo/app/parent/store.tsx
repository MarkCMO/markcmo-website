import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "../../src/store";
import { initIAP, endIAP, fetchUnlockPrice, buyUnlock, hasUnlock, addPurchaseListeners } from "../../src/services/iap";
import { Colors } from "../../src/theme";

const BENEFITS: [any, string][] = [
  ["paw", "Unlock every pet in the catalog"],
  ["albums", "Train several pets at the same time"],
  ["camera", "Turn on photo proof for chores"],
  ["share", "Export the Readiness Report"],
  ["sparkles", "All future pets added in updates"],
];

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useStore();
  const [price, setPrice] = useState("$4.99");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let remove = () => {};
    (async () => {
      await initIAP();
      remove = addPurchaseListeners(() => { useStore.getState().setUnlocked(true); setBusy(false); });
      setPrice(await fetchUnlockPrice());
    })();
    return () => { remove(); endIAP(); };
  }, []);

  async function buy() {
    setBusy(true);
    try { await buyUnlock(); } catch { setBusy(false); }
  }
  async function restore() {
    setBusy(true);
    const ok = await hasUnlock();
    state.setUnlocked(ok);
    setBusy(false);
    Alert.alert(ok ? "Restored" : "Nothing to restore", ok ? "The full version is unlocked." : "No previous purchase found for this Apple ID.");
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={Colors.text} /></Pressable>
        <Text style={s.title}>Unlock</Text><View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, alignItems: "center" }}>
        <Ionicons name="lock-open" size={54} color={Colors.blue} />
        <Text style={s.h1}>{state.unlocked ? "Full version unlocked" : "Unlock the full app"}</Text>
        {!state.unlocked && <Text style={s.muted}>One simple purchase. No subscriptions, no ads.</Text>}

        <View style={s.card}>
          {BENEFITS.map(([icon, label]) => (
            <View key={label} style={s.benefit}>
              <Ionicons name={icon} size={20} color={Colors.blue} />
              <Text style={s.benefitText}>{label}</Text>
            </View>
          ))}
        </View>

        {state.unlocked ? (
          <View style={s.thanks}><Ionicons name="checkmark-done" size={20} color={Colors.green} /><Text style={s.thanksText}>Thank you. Everything is unlocked.</Text></View>
        ) : (
          <>
            <Pressable style={s.buy} onPress={buy} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.buyText}>Unlock for {price}</Text>}
            </Pressable>
            <Pressable onPress={restore} disabled={busy}><Text style={s.restore}>Restore Purchases</Text></Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 },
  title: { fontSize: 18, fontWeight: "800", color: Colors.text },
  h1: { fontSize: 26, fontWeight: "800", color: Colors.text, marginTop: 12, textAlign: "center" },
  muted: { color: Colors.muted, marginTop: 4 },
  card: { backgroundColor: Colors.card, borderRadius: 18, padding: 18, marginTop: 20, width: "100%" },
  benefit: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 7 },
  benefitText: { fontSize: 15, color: Colors.text },
  buy: { backgroundColor: Colors.blue, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, marginTop: 20, minWidth: 240, alignItems: "center" },
  buyText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  restore: { color: Colors.blue, fontWeight: "700", marginTop: 16 },
  thanks: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 20 },
  thanksText: { color: Colors.green, fontWeight: "700" },
});
