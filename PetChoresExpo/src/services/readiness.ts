// Readiness Report. Ported from ReadinessService.swift (Section 12).

import { PetInstance, PetSpecies, ScheduledTask, isHandled } from "../types";

export interface MissedTask { label: string; count: number; }

export interface ReadinessReport {
  petNickname: string;
  speciesName: string;
  completionRate: number; // 0..1
  onTimeRate: number;     // 0..1
  longestStreak: number;
  topMissed: MissedTask[];
  hardestHandledLabel?: string;
  hardestHandledRate: number;
  totalDue: number;
  totalCompleted: number;
  verdict: string;
}

export function verdict(completionRate: number): string {
  const pct = completionRate * 100;
  if (pct >= 85) return "Strong. Your child showed real consistency.";
  if (pct >= 70) return "Good. A little reminder help may still be needed.";
  if (pct >= 50) return "Getting there. More practice recommended before a real pet.";
  return "Not yet. Try a lower difficulty pet or a longer practice run.";
}

export function makeReport(
  instance: PetInstance, species: PetSpecies, tasks: ScheduledTask[], now: Date = new Date()
): ReadinessReport {
  const due = tasks.filter((t) => new Date(t.dueAt).getTime() <= now.getTime());
  const completed = due.filter(isHandled);
  const totalDue = due.length;
  const totalCompleted = completed.length;

  const completionRate = totalDue === 0 ? 0 : totalCompleted / totalDue;
  const onTimeRate = totalCompleted === 0 ? 0 : completed.filter((t) => t.onTime).length / totalCompleted;

  const missedCounts: Record<string, number> = {};
  for (const t of due) if (t.status === "missed") missedCounts[t.label] = (missedCounts[t.label] || 0) + 1;
  const topMissed = Object.entries(missedCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, count }));

  const hard = due.filter((t) => t.difficulty >= 3);
  const groups: Record<string, ScheduledTask[]> = {};
  for (const t of hard) (groups[t.label] ||= []).push(t);
  let bestLabel: string | undefined;
  let bestRate = 0;
  for (const [label, group] of Object.entries(groups)) {
    const rate = group.filter(isHandled).length / group.length;
    if (rate > bestRate) { bestRate = rate; bestLabel = label; }
  }

  return {
    petNickname: instance.nickname,
    speciesName: species.name,
    completionRate,
    onTimeRate,
    longestStreak: instance.longestStreakDays,
    topMissed,
    hardestHandledLabel: bestLabel,
    hardestHandledRate: bestRate,
    totalDue,
    totalCompleted,
    verdict: verdict(completionRate),
  };
}

export function exportText(r: ReadinessReport): string {
  const lines: string[] = [];
  lines.push("Pet Chores Readiness Report");
  lines.push(`Pet: ${r.petNickname} (${r.speciesName})`);
  lines.push("");
  lines.push(`Completion rate: ${Math.round(r.completionRate * 100)}% (${r.totalCompleted} of ${r.totalDue} tasks)`);
  lines.push(`On-time rate: ${Math.round(r.onTimeRate * 100)}%`);
  lines.push(`Longest streak: ${r.longestStreak} days`);
  if (r.hardestHandledLabel) lines.push(`Hardest task handled well: ${r.hardestHandledLabel} at ${Math.round(r.hardestHandledRate * 100)}%`);
  if (r.topMissed.length) {
    lines.push("");
    lines.push("Most often missed:");
    for (const m of r.topMissed) lines.push(`  - ${m.label}: missed ${m.count} times`);
  }
  lines.push("");
  lines.push(`Verdict: ${r.verdict}`);
  lines.push("");
  lines.push("This report is a guide for your family, not a guarantee. A real pet is a long term commitment for the whole household.");
  return lines.join("\n");
}
