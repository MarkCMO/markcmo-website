// Local notifications via expo-notifications (Section 7). Schedules the nearest 64
// pending tasks, shifts out of quiet hours, registers Done / Snooze actions.
import * as Notifications from "expo-notifications";
import { ParentSettings, ScheduledTask } from "../types";
import { shiftedOutOfQuietHours } from "./time";

export const CATEGORY = "PET_TASK";
const MAX_PENDING = 64;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupNotifications(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: "DONE", buttonTitle: "Done" },
    { identifier: "SNOOZE", buttonTitle: "Snooze 30 min" },
  ]);
}

export async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getPermissionGranted(): Promise<boolean> {
  const s = await Notifications.getPermissionsAsync();
  return s.status === "granted";
}

function nudge(task: ScheduledTask): string {
  const first = task.realAction.split(".")[0];
  return first ? first + "." : task.realAction;
}

export async function rescheduleAll(
  pending: ScheduledTask[], nicknames: Record<string, string>, settings: ParentSettings
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();

  const upcoming = pending
    .filter((t) => t.status === "pending")
    .map((t) => {
      const shifted = shiftedOutOfQuietHours(new Date(t.dueAt), settings.quietHoursStart, settings.quietHoursEnd);
      const fire = Math.max(shifted.getTime(), new Date(t.dueAt).getTime());
      return { task: t, fire };
    })
    .filter((e) => e.fire > now)
    .sort((a, b) => a.fire - b.fire)
    .slice(0, MAX_PENDING);

  for (const e of upcoming) {
    const nickname = nicknames[e.task.instanceId] ?? "Your pet";
    await Notifications.scheduleNotificationAsync({
      identifier: e.task.scheduledId,
      content: {
        title: `${nickname} needs you`,
        body: `Time to ${e.task.label.toLowerCase()}. ${nudge(e.task)}`,
        categoryIdentifier: CATEGORY,
        data: { scheduledId: e.task.scheduledId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(e.fire),
      },
    });
  }
}

export async function cancel(taskId: string): Promise<void> {
  try { await Notifications.cancelScheduledNotificationAsync(taskId); } catch {}
}

export async function snoozeNotification(task: ScheduledTask, nickname: string): Promise<void> {
  await cancel(task.scheduledId);
  await Notifications.scheduleNotificationAsync({
    identifier: task.scheduledId,
    content: {
      title: `${nickname} needs you`,
      body: `Time to ${task.label.toLowerCase()}. ${nudge(task)}`,
      categoryIdentifier: CATEGORY,
      data: { scheduledId: task.scheduledId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 30 * 60,
    },
  });
}
