import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  BudgetEntry, ChildProfile, ParentSettings, PetInstance, PetSpecies, ScheduledTask,
} from "./types";
import { speciesById } from "./seed";
import { buildTasks, topUpMissing } from "./services/schedule";
import { applyDone, applyVerified, isOverdue, settleElapsedDays } from "./services/scoring";
import { seedEntries } from "./services/budget";
import { newSalt, hashPin } from "./services/pin";
import { startOfDay, addDays } from "./services/time";
import { uid } from "./services/uid";
import * as Notif from "./services/notifications";

interface State {
  hydrated: boolean;
  child: ChildProfile | null;
  settings: ParentSettings | null;
  instances: PetInstance[];
  tasks: ScheduledTask[];
  budget: BudgetEntry[];
  unlocked: boolean;

  setHydrated: (v: boolean) => void;
  setUnlocked: (v: boolean) => void;

  createChild: (name: string, age: number, avatar: string) => void;
  createParentSettings: (pin: string, defaultTrainingLengthDays: number) => Promise<void>;
  updateSettings: (patch: Partial<ParentSettings>) => void;
  changePin: (pin: string) => Promise<void>;

  createPet: (speciesId: string, nickname: string, trainingLengthDays: number) => PetInstance | null;
  archivePet: (instanceId: string) => void;
  deletePet: (instanceId: string) => void;

  markDone: (taskId: string, photoUri?: string) => void;
  verifyTask: (taskId: string) => void;
  rejectTask: (taskId: string) => void;
  snoozeTask: (taskId: string) => void;

  runMaintenance: () => void;
}

const isOnboarded = (s: State) =>
  !!s.child && !!s.settings && s.instances.length > 0;

function nicknameMap(instances: PetInstance[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const i of instances) m[i.instanceId] = i.nickname;
  return m;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      child: null,
      settings: null,
      instances: [],
      tasks: [],
      budget: [],
      unlocked: false,

      setHydrated: (v) => set({ hydrated: v }),
      setUnlocked: (v) => set({ unlocked: v }),

      createChild: (name, age, avatar) => set({ child: { name: name.trim(), age, avatar } }),

      createParentSettings: async (pin, defaultTrainingLengthDays) => {
        const salt = newSalt();
        const pinHash = await hashPin(pin, salt);
        set({
          settings: {
            pinHash, pinSalt: salt,
            verificationRequired: true,
            photoProofRequired: false,
            quietHoursStart: "20:30",
            quietHoursEnd: "07:00",
            defaultTrainingLengthDays,
            carryOverMissedTasks: false,
          },
        });
      },

      updateSettings: (patch) => {
        const s = get().settings;
        if (!s) return;
        const next = { ...s, ...patch };
        set({ settings: next });
        // Quiet-hours changes affect scheduling.
        const pending = get().tasks.filter((t) => t.status === "pending");
        Notif.rescheduleAll(pending, nicknameMap(get().instances), next).catch(() => {});
      },

      changePin: async (pin) => {
        const s = get().settings;
        if (!s) return;
        const salt = newSalt();
        const pinHash = await hashPin(pin, salt);
        set({ settings: { ...s, pinSalt: salt, pinHash } });
      },

      createPet: (speciesId, nickname, trainingLengthDays) => {
        const species = speciesById(speciesId);
        const settings = get().settings;
        if (!species || !settings) return null;

        const now = new Date();
        const startDay = startOfDay(now);
        const instance: PetInstance = {
          instanceId: uid(),
          speciesId,
          nickname: nickname.trim(),
          startDate: now.toISOString(),
          trainingLengthDays,
          wellbeing: 80,
          trust: 0,
          carePoints: 0,
          currentStreakDays: 0,
          longestStreakDays: 0,
          isActive: true,
          lastSettledDay: addDays(startDay, -1).toISOString(),
        };
        const newTasks = buildTasks(instance, species, settings);
        const newBudget = seedEntries(instance, species);

        const instances = [instance, ...get().instances];
        set({
          instances,
          tasks: [...get().tasks, ...newTasks],
          budget: [...get().budget, ...newBudget],
        });

        const pending = get().tasks.filter((t) => t.status === "pending");
        Notif.rescheduleAll(pending, nicknameMap(instances), settings).catch(() => {});
        return instance;
      },

      archivePet: (instanceId) => {
        const instances = get().instances.map((i) =>
          i.instanceId === instanceId ? { ...i, isActive: false } : i);
        set({ instances });
        get().tasks.filter((t) => t.instanceId === instanceId && t.status === "pending")
          .forEach((t) => Notif.cancel(t.scheduledId));
      },

      deletePet: (instanceId) => {
        get().tasks.filter((t) => t.instanceId === instanceId)
          .forEach((t) => Notif.cancel(t.scheduledId));
        set({
          instances: get().instances.filter((i) => i.instanceId !== instanceId),
          tasks: get().tasks.filter((t) => t.instanceId !== instanceId),
          budget: get().budget.filter((b) => b.instanceId !== instanceId),
        });
      },

      markDone: (taskId, photoUri) => {
        const now = new Date();
        const tasks = get().tasks.map((t) => ({ ...t }));
        const instances = get().instances.map((i) => ({ ...i }));
        const task = tasks.find((t) => t.scheduledId === taskId);
        const instance = task && instances.find((i) => i.instanceId === task.instanceId);
        if (!task || !instance) return;
        applyDone(task, instance, now);
        task.status = "done";
        if (photoUri) task.photoUri = photoUri;
        set({ tasks, instances });
        Notif.cancel(taskId);
      },

      verifyTask: (taskId) => {
        const now = new Date();
        const tasks = get().tasks.map((t) => ({ ...t }));
        const instances = get().instances.map((i) => ({ ...i }));
        const task = tasks.find((t) => t.scheduledId === taskId);
        const instance = task && instances.find((i) => i.instanceId === task.instanceId);
        if (!task || !instance || task.status !== "done") return;
        applyVerified(task, instance, now);
        task.status = "verified";
        set({ tasks, instances });
      },

      rejectTask: (taskId) => {
        const tasks = get().tasks.map((t) => ({ ...t }));
        const instances = get().instances.map((i) => ({ ...i }));
        const task = tasks.find((t) => t.scheduledId === taskId);
        const instance = task && instances.find((i) => i.instanceId === task.instanceId);
        if (!task || !instance || task.status !== "done") return;
        let points = 10 * Math.max(1, Math.min(task.difficulty, 5));
        if (task.onTime) points += 5;
        instance.carePoints = Math.max(0, instance.carePoints - points);
        if (task.frequency === "daily" && task.onTime) instance.wellbeing = Math.max(0, instance.wellbeing - 1);
        task.completedAt = undefined;
        task.onTime = false;
        task.photoUri = undefined;
        task.status = "pending";
        set({ tasks, instances });
      },

      snoozeTask: (taskId) => {
        const tasks = get().tasks.map((t) => ({ ...t }));
        const task = tasks.find((t) => t.scheduledId === taskId);
        if (!task || task.snoozeCount >= 2) return;
        task.snoozeCount += 1;
        set({ tasks });
        const nickname = get().instances.find((i) => i.instanceId === task.instanceId)?.nickname ?? "Your pet";
        Notif.snoozeNotification(task, nickname).catch(() => {});
      },

      runMaintenance: () => {
        const settings = get().settings;
        if (!settings) return;
        const now = new Date();
        let tasks = get().tasks.map((t) => ({ ...t }));
        const instances = get().instances.map((i) => ({ ...i }));

        for (const instance of instances) {
          if (!instance.isActive) continue;
          const species = speciesById(instance.speciesId);
          if (!species) continue;

          const existing = tasks.filter((t) => t.instanceId === instance.instanceId);
          const added = topUpMissing(instance, species, settings, existing);
          if (added.length) tasks = [...tasks, ...added];

          for (const t of tasks) {
            if (t.instanceId === instance.instanceId && t.status === "pending" && isOverdue(t, now)) {
              t.status = "missed";
            }
          }
          const settled = tasks.filter((t) => t.instanceId === instance.instanceId);
          settleElapsedDays(instance, settled, now);
        }

        set({ tasks, instances });
        const pending = tasks.filter((t) => t.status === "pending" &&
          instances.find((i) => i.instanceId === t.instanceId)?.isActive);
        Notif.rescheduleAll(pending, nicknameMap(instances), settings).catch(() => {});
      },
    }),
    {
      name: "petchores-state-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        child: s.child, settings: s.settings, instances: s.instances,
        tasks: s.tasks, budget: s.budget, unlocked: s.unlocked,
      }),
      onRehydrateStorage: () => (state) => { state?.setHydrated(true); },
    }
  )
);

export { isOnboarded };
export const activeInstances = (s: State) => s.instances.filter((i) => i.isActive);
export const tasksFor = (s: State, instanceId: string) =>
  s.tasks.filter((t) => t.instanceId === instanceId).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
