import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useStore } from "../../src/store";
import { Colors, timeStr } from "../../src/theme";

export default function TaskCompletion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useStore();

  const task = state.tasks.find((t) => t.scheduledId === id);
  const [showWhy, setShowWhy] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);

  if (!task) {
    return <View style={s.center}><Text style={s.muted}>Task not found.</Text></View>;
  }

  const photoRequired = !!state.settings?.photoProofRequired && state.unlocked;
  const steps = task.realAction.split(".").map((x) => x.trim()).filter(Boolean);
  const alreadyDone = task.status === "done" || task.status === "verified";
  const canDone = !alreadyDone && (!photoRequired || !!photo);

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
    if (!res.canceled && res.assets[0]) setPhoto(res.assets[0].uri);
  }

  function done() {
    useStore.getState().markDone(task!.scheduledId, photo);
    router.back();
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={Colors.text} /></Pressable>
        <Text style={s.navTitle} numberOfLines={1}>{task.label}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text style={s.due}>Due {timeStr(task.dueAt)}</Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>What to do</Text>
          {steps.map((step, i) => (
            <View key={i} style={s.stepRow}>
              <Ionicons name="ellipse-outline" size={18} color={Colors.blue} />
              <Text style={s.stepText}>{step}.</Text>
            </View>
          ))}
        </View>

        <Pressable style={s.card} onPress={() => setShowWhy(!showWhy)}>
          <View style={s.whyRow}>
            <Text style={s.whyTitle}>What happens if I skip this?</Text>
            <Ionicons name={showWhy ? "chevron-up" : "chevron-down"} size={18} color={Colors.muted} />
          </View>
          {showWhy && <Text style={s.muted}>{task.consequence}</Text>}
        </Pressable>

        {photoRequired && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Add a photo as proof</Text>
            {photo && <Image source={{ uri: photo }} style={s.photo} />}
            <Pressable style={s.secondary} onPress={pickPhoto}>
              <Ionicons name="camera" size={18} color={Colors.blue} />
              <Text style={s.secondaryText}>Choose photo</Text>
            </Pressable>
            <Text style={s.tiny}>Photos stay on this device and are never uploaded.</Text>
          </View>
        )}

        {task.status === "done" && (
          <View style={s.card}><Text style={s.waiting}>Waiting for grown-up to check</Text></View>
        )}
      </ScrollView>

      {!alreadyDone && (
        <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={[s.bigBtn, !canDone && { opacity: 0.4 }]} disabled={!canDone} onPress={done}>
            <Text style={s.bigBtnText}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8 },
  navTitle: { fontSize: 18, fontWeight: "800", color: Colors.text, flex: 1, textAlign: "center" },
  due: { color: Colors.muted, marginBottom: 8 },
  card: { backgroundColor: Colors.card, borderRadius: 18, padding: 16, marginTop: 12 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: Colors.text, marginBottom: 8 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 6 },
  stepText: { fontSize: 16, color: Colors.text, flex: 1 },
  whyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  whyTitle: { fontWeight: "700", color: Colors.text },
  muted: { color: Colors.muted, fontSize: 14, marginTop: 8 },
  photo: { width: "100%", height: 160, borderRadius: 12, marginBottom: 10 },
  secondary: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { color: Colors.blue, fontWeight: "700" },
  tiny: { color: Colors.muted, fontSize: 11, marginTop: 8 },
  waiting: { color: "#7C3AED", fontWeight: "700" },
  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: "rgba(255,250,247,0.95)", borderTopWidth: 1, borderTopColor: "#EEE" },
  bigBtn: { backgroundColor: Colors.blue, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  bigBtnText: { color: "#fff", fontSize: 18, fontWeight: "800" },
});
