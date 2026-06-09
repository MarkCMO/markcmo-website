import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { habitatColors, speciesEmoji } from "../seed";
import { moodFromWellbeing } from "../types";
import { moodEmoji } from "../theme";

export function PetVisual({
  speciesId, category, wellbeing, height = 170,
}: { speciesId: string; category: string; wellbeing: number; height?: number }) {
  const mood = moodFromWellbeing(wellbeing);
  const [c1, c2] = habitatColors(category, speciesId);
  return (
    <LinearGradient
      colors={[c1, c2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.scene, { height }]}
    >
      <Text style={{ fontSize: height * 0.42 }}>{speciesEmoji(speciesId)}</Text>
      <View style={styles.moodBadge}>
        <Text style={{ fontSize: 26 }}>{moodEmoji(mood)}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scene: {
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  moodBadge: {
    position: "absolute",
    bottom: 10,
    right: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
