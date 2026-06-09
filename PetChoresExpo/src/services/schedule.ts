// Whole-window schedule generation. Ported from ScheduleGenerator.swift (Section 6).

import { CareTaskTemplate, ParentSettings, PetInstance, PetSpecies, ScheduledTask } from "../types";
import { addDays, dailySlotTimes, dateOnDayAtTime, startOfDay } from "./time";
import { uid } from "./uid";

export function occurrenceDayIndexes(template: CareTaskTemplate, length: number): number[] {
  switch (template.frequency) {
    case "daily":
      return Array.from({ length }, (_, i) => i);
    case "weekly": {
      const out: number[] = [];
      for (let i = 0; i < length; i += 7) out.push(i);
      return out;
    }
    case "monthly": {
      const out: number[] = [];
      for (let i = 0; i < length; i += 30) out.push(i);
      return out;
    }
    case "yearly":
      return length < 7 ? [] : [0];
  }
}

function slotTimes(template: CareTaskTemplate, settings: ParentSettings): string[] {
  if (template.frequency !== "daily" || template.timesPerDay <= 1) {
    return [template.suggestedTime];
  }
  return dailySlotTimes(template.timesPerDay, template.suggestedTime,
    settings.quietHoursEnd, settings.quietHoursStart);
}

function makeTask(template: CareTaskTemplate, instance: PetInstance, dueAt: Date): ScheduledTask {
  return {
    scheduledId: uid(),
    instanceId: instance.instanceId,
    templateId: template.id,
    dueAt: dueAt.toISOString(),
    status: "pending",
    label: template.label,
    difficulty: template.difficulty,
    frequency: template.frequency,
    realAction: template.realAction,
    consequence: template.consequence,
    snoozeCount: 0,
    onTime: false,
  };
}

export function buildTasks(instance: PetInstance, species: PetSpecies, settings: ParentSettings): ScheduledTask[] {
  const tasks: ScheduledTask[] = [];
  const startDay = startOfDay(new Date(instance.startDate));
  const length = Math.max(instance.trainingLengthDays, 1);

  for (const template of species.tasks) {
    for (const dayIndex of occurrenceDayIndexes(template, length)) {
      const day = addDays(startDay, dayIndex);
      for (const slot of slotTimes(template, settings)) {
        tasks.push(makeTask(template, instance, dateOnDayAtTime(day, slot)));
      }
    }
  }
  return tasks.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

/** Idempotent top-up: rows the full schedule expects but that are missing (dedup by
 *  templateId + dueAt minute). Used by the maintenance pass. */
export function topUpMissing(
  instance: PetInstance, species: PetSpecies, settings: ParentSettings, existing: ScheduledTask[]
): ScheduledTask[] {
  const key = (templateId: string, iso: string) =>
    `${templateId}#${Math.floor(new Date(iso).getTime() / 60000)}`;
  const seen = new Set(existing.map((t) => key(t.templateId, t.dueAt)));
  return buildTasks(instance, species, settings).filter((t) => !seen.has(key(t.templateId, t.dueAt)));
}
