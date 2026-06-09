import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { catalog, speciesById, speciesEmoji } from "../src/seed";
import { useStore } from "../src/store";
import { isValidPinFormat } from "../src/services/pin";
import { requestPermission } from "../src/services/notifications";
import { Colors, money } from "../src/theme";
import { PetVisual } from "../src/components/PetVisual";

const AVATARS = ["\u{1F9D2}", "\u{1F466}", "\u{1F467}", "\u{1F31F}", "\u{1F680}", "\u{1F984}"];
const LENGTHS = [7, 14, 21, 30];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const store = useStore();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState(8);
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [speciesId, setSpeciesId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [length, setLength] = useState(21);

  const species = speciesId ? speciesById(speciesId) : undefined;

  async function finish() {
    await requestNotif();
    store.createChild(name, age, avatar);
    await store.createParentSettings(pin, length);
    store.createPet(speciesId!, nickname, length);
    router.replace("/(tabs)/home");
  }

  async function requestNotif() {
    try { await requestPermission(); } catch {}
  }

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: 40 }}>
      {step === 0 && (
        <View>
          <Text style={s.emojiBig}>{"\u{1F43E}"}</Text>
          <Text style={s.h1}>Pet Chores</Text>
          <Text style={s.sub}>Train to care for a real pet before you get one.</Text>
          <Btn label="Get Started" onPress={() => setStep(1)} />
        </View>
      )}

      {step === 1 && (
        <View>
          <Text style={s.h1}>Who is playing?</Text>
          <Card>
            <Text style={s.label}>First name</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Your name" />
            <Text style={s.label}>Age: {age}</Text>
            <View style={s.row}>
              <Btn small label="-" onPress={() => setAge(Math.max(4, age - 1))} />
              <Btn small label="+" onPress={() => setAge(Math.min(14, age + 1))} />
            </View>
            <Text style={s.label}>Pick an avatar</Text>
            <View style={s.wrap}>
              {AVATARS.map((a) => (
                <Pressable key={a} onPress={() => setAvatar(a)}
                  style={[s.avatar, avatar === a && s.avatarSel]}>
                  <Text style={{ fontSize: 34 }}>{a}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
          <Btn label="Next" disabled={!name.trim()} onPress={() => setStep(2)} />
        </View>
      )}

      {step === 2 && (
        <View>
          <Text style={s.h1}>Grown-up setup</Text>
          <Text style={s.sub}>Create a 4 digit PIN. Parent Mode is where you verify chores and see the Readiness Report.</Text>
          <Card>
            <Text style={s.label}>Create PIN</Text>
            <TextInput style={s.input} value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad" secureTextEntry />
            <Text style={s.label}>Confirm PIN</Text>
            <TextInput style={s.input} value={pin2} onChangeText={(t) => setPin2(t.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad" secureTextEntry />
            {!!pin && pin !== pin2 && <Text style={s.err}>The PINs do not match yet.</Text>}
          </Card>
          <Btn label="Next" disabled={!(isValidPinFormat(pin) && pin === pin2)} onPress={() => setStep(3)} />
        </View>
      )}

      {step === 3 && (
        <View>
          <Text style={s.h1}>Pick your pet</Text>
          <View style={s.grid}>
            {catalog.map((p) => (
              <Pressable key={p.id} style={s.petCard}
                onPress={() => { setSpeciesId(p.id); setStep(4); }}>
                <Text style={{ fontSize: 40 }}>{speciesEmoji(p.id)}</Text>
                <Text style={s.petName}>{p.name}</Text>
                <Text style={s.paws}>{"\u{1F43E}".repeat(p.difficulty)}</Text>
                <Text style={s.minor}>Best for ages {p.recommendedMinAge}+</Text>
                {age < p.recommendedMinAge && (
                  <Text style={s.note}>Usually best for ages {p.recommendedMinAge}+. You can still practice.</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {step === 4 && species && (
        <View>
          <PetVisual speciesId={species.id} category={species.category} wellbeing={90} height={150} />
          <Text style={[s.h1, { marginTop: 14 }]}>Meet your {species.name.toLowerCase()}</Text>
          <Text style={s.sub}>{species.blurb}</Text>
          <Card>
            <Reality label="Lifespan" value={`${species.lifespanYears} years`} />
            <Reality label="Startup" value={money(species.startupCost)} />
            <Reality label="Every month" value={money(species.monthlyCost)} />
            <Reality label="First year" value={money(species.yearlyCost)} />
          </Card>
          <Btn label="Start Training" onPress={() => setStep(5)} />
          <Pressable onPress={() => setStep(3)}><Text style={s.linkCenter}>Pick a different pet</Text></Pressable>
        </View>
      )}

      {step === 5 && species && (
        <View>
          <Text style={s.h1}>Name your pet</Text>
          <Card>
            <Text style={s.label}>Pet name</Text>
            <TextInput style={s.input} value={nickname} onChangeText={setNickname} placeholder="Give your pet a name" />
            <Text style={[s.label, { marginTop: 12 }]}>Training length (a grown-up chooses)</Text>
            <View style={s.wrap}>
              {LENGTHS.map((d) => (
                <Pressable key={d} onPress={() => setLength(d)}
                  style={[s.lenPill, length === d && s.lenPillSel]}>
                  <Text style={[s.lenText, length === d && { color: "#fff" }]}>{d} days{d === 21 ? " ★" : ""}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
          <Btn label="Start Training" disabled={!nickname.trim()} onPress={() => { finish().catch(() => Alert.alert("Something went wrong")); }} />
        </View>
      )}
    </ScrollView>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
function Reality({ label, value }: { label: string; value: string }) {
  return (
    <View style={[s.row, { justifyContent: "space-between", marginVertical: 3 }]}>
      <Text style={{ color: Colors.muted }}>{label}</Text>
      <Text style={{ fontWeight: "700", color: Colors.text }}>{value}</Text>
    </View>
  );
}
function Btn({ label, onPress, disabled, small }: { label: string; onPress: () => void; disabled?: boolean; small?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={[small ? s.btnSmall : s.btn, disabled && { opacity: 0.4 }]}>
      <Text style={small ? s.btnSmallText : s.btnText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  emojiBig: { fontSize: 90, textAlign: "center", marginTop: 40 },
  h1: { fontSize: 30, fontWeight: "800", color: Colors.text, marginBottom: 8 },
  sub: { fontSize: 16, color: Colors.muted, marginBottom: 16 },
  label: { fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, fontSize: 18 },
  err: { color: "#EF4444", marginTop: 6 },
  card: { backgroundColor: Colors.card, borderRadius: 18, padding: 16, marginBottom: 16 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  avatar: { width: 64, height: 64, borderRadius: 14, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  avatarSel: { backgroundColor: "#DBEAFE", borderWidth: 2, borderColor: Colors.blue },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  petCard: { width: "47%", backgroundColor: Colors.card, borderRadius: 18, padding: 14, marginBottom: 4 },
  petName: { fontSize: 17, fontWeight: "800", color: Colors.text, marginTop: 4 },
  paws: { fontSize: 12, marginTop: 2 },
  minor: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  note: { fontSize: 11, color: Colors.orange, marginTop: 4 },
  linkCenter: { textAlign: "center", color: Colors.blue, marginTop: 12, fontWeight: "600" },
  lenPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F1F5F9" },
  lenPillSel: { backgroundColor: Colors.blue },
  lenText: { fontWeight: "700", color: Colors.text },
  btn: { backgroundColor: Colors.blue, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  btnSmall: { backgroundColor: Colors.blue, borderRadius: 10, width: 48, height: 40, alignItems: "center", justifyContent: "center" },
  btnSmallText: { color: "#fff", fontSize: 20, fontWeight: "800" },
});
