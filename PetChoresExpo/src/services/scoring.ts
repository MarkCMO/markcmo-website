// Scoring, grace windows, wellbeing, trust, and streaks. Ported from ScoringService.swift
// (Sections 8 and 9). Functions mutate the passed instance/task objects in place; the
// store clones before calling so state updates stay immutable at the React layer.

import { ScheduledTask, PetInstance, isHandled, isDaily } from "../types";
import { endOfDay, startOfDay, addDays, isSameDay } from "./time";

export const ON_TIME_BONUS = 5;
export const VERIFIED_BONUS = 5;

function isFeedingOrWater(task: ScheduledTask): boolean {
  const hay = (task.templateId + " " + task.label).toLowerCase();
  return ["feed", "water", "food", "hay", "greens", "veggies", "pellet"].some((n) => hay.includes(n));
}

export function graceDeadline(task: ScheduledTask): Date {
  const due = new Date(task.dueAt);
  if (task.frequency === "daily") {
    const hours = isFeedingOrWater(task) ? 2 : 4;
    return new Date(due.getTime() + hours * 3600 * 1000);
  }
  return endOfDay(due);
}

export function isOverdue(task: ScheduledTask, now: Date): boolean {
  return now.getTime() > graceDeadline(task).getTime();
}

export function wasOnTime(task: ScheduledTask, completedAt: Date): boolean {
  return completedAt.getTime() <= graceDeadline(task).getTime();
}

export function basePoints(difficulty: number): number {
  return 10 * Math.max(1, Math.min(difficulty, 5));
}

/** Child marks a task done. Mutates task + instance. Returns points awarded. */
export function applyDone(task: ScheduledTask, instance: PetInstance, now: Date): number {
  const onTime = wasOnTime(task, now);
  task.onTime = onTime;
  task.completedAt = now.toISOString();
  let points = basePoints(task.difficulty);
  if (onTime) points += ON_TIME_BONUS;
  instance.carePoints += points;
  if (isDaily(task) && onTime) {
    instance.wellbeing = Math.min(100, instance.wellbeing + 1);
  }
  return points;
}

/** Parent verifies. Mutates task + instance. Returns points awarded. */
export function applyVerified(task: ScheduledTask, instance: PetInstance, now: Date): number {
  task.verifiedAt = now.toISOString();
  instance.carePoints += VERIFIED_BONUS;
  instance.trust = Math.min(100, instance.trust + 1);
  return VERIFIED_BONUS;
}

/** Settle every fully elapsed, in-window day not yet settled. Mutates instance. */
export function settleElapsedDays(instance: PetInstance, tasks: ScheduledTask[], now: Date): void {
  const today = startOfDay(now);
  const start = startOfDay(new Date(instance.startDate));
  const endDay = startOfDay(endOfDay(addDays(start, Math.max(instance.trainingLengthDays - 1, 0))));

  let day = addDays(startOfDay(new Date(instance.lastSettledDay)), 1);
  if (day.getTime() < start.getTime()) day = start;

  while (day.getTime() < today.getTime() && day.getTime() <= endDay.getTime()) {
    settleSingleDay(instance, day, tasks);
    instance.lastSettledDay = day.toISOString();
    day = addDays(day, 1);
  }
}

function settleSingleDay(instance: PetInstance, day: Date, tasks: ScheduledTask[]): void {
  const dayTasks = tasks.filter((t) => isSameDay(new Date(t.dueAt), day));
  if (dayTasks.length === 0) return;

  const dailyDue = dayTasks.filter(isDaily);
  const missedDaily = dayTasks.filter((t) => isDaily(t) && t.status === "missed").length;
  const missedWeekly = dayTasks.filter((t) => t.frequency === "weekly" && t.status === "missed").length;
  const anyHandled = dayTasks.some(isHandled);

  let wb = instance.wellbeing;
  wb -= 4 * missedDaily;
  wb -= 6 * missedWeekly;
  if (!anyHandled) wb -= 5; // a full day with zero tasks done
  instance.wellbeing = Math.max(0, Math.min(100, wb));

  const onTimeDaily = dailyDue.filter((t) => isHandled(t) && t.onTime).length;
  const ratio = dailyDue.length === 0 ? 1 : onTimeDaily / dailyDue.length;
  if (ratio >= 0.9) {
    instance.currentStreakDays += 1;
    instance.longestStreakDays = Math.max(instance.longestStreakDays, instance.currentStreakDays);
    instance.trust = Math.min(100, instance.trust + 2);
  } else {
    instance.currentStreakDays = 0;
  }
}
