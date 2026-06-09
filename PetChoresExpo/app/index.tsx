import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useStore, isOnboarded } from "../src/store";

export default function Index() {
  const state = useStore();
  if (!state.hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFAF7" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <Redirect href={isOnboarded(state) ? "/(tabs)/home" : "/onboarding"} />;
}
