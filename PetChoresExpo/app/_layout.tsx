import React, { useEffect } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useStore } from "../src/store";
import { setupNotifications } from "../src/services/notifications";

export default function RootLayout() {
  const runMaintenance = useStore((s) => s.runMaintenance);
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    setupNotifications().catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const id = resp.notification.request.content.data?.scheduledId as string | undefined;
      if (!id) return;
      if (resp.actionIdentifier === "DONE") useStore.getState().markDone(id);
      else if (resp.actionIdentifier === "SNOOZE") useStore.getState().snoozeTask(id);
    });
    const appSub = AppState.addEventListener("change", (st) => {
      if (st === "active") useStore.getState().runMaintenance();
    });
    return () => { sub.remove(); appSub.remove(); };
  }, []);

  useEffect(() => {
    if (hydrated) runMaintenance();
  }, [hydrated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
