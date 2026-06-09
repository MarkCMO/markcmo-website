import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.blue }}>
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="pet" options={{ title: "Pet", tabBarIcon: ({ color, size }) => <Ionicons name="paw" color={color} size={size} /> }} />
      <Tabs.Screen name="budget" options={{ title: "Budget", tabBarIcon: ({ color, size }) => <Ionicons name="cash" color={color} size={size} /> }} />
      <Tabs.Screen name="rewards" options={{ title: "Rewards", tabBarIcon: ({ color, size }) => <Ionicons name="ribbon" color={color} size={size} /> }} />
    </Tabs>
  );
}
