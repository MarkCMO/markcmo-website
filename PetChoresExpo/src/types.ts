// Data model, ported 1:1 from the native Swift app (Section 3 of the build spec).
// Dates are kept as ISO strings in persisted state and converted to Date at the edges.

export type TaskFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type SupplyFrequency = "once" | "monthly" | "yearly";
export type TaskStatus = "pending" | "done" | "missed" | "verified" | "rejected";
export type BudgetEntryType = "startup" | "recurring";

export type Mood = "happy" | "content" | "needsAttention" | "sad" | "pleaseHelp";

export function moodFromWellbeing(w: number): Mood {
  if (w >= 80) return "happy";
  if (w >= 60) return "content";
  if (w >= 40) return "needsAttention";
  if (w >= 20) return "sad";
  return "pleaseHelp";
}

export function moodLabel(m: Mood): string {
  switch (m) {
    case "happy": return "Happy";
    case "content": return "Content";
    case "needsAttention": return "Needs attention";
    case "sad": return "Sad";
    case "pleaseHelp": return "Please help me";
  }
}

// --- Seed (read-only catalog) ---

export interface Supply {
  item: string;
  cost: number;
  frequency: SupplyFrequency;
}

export interface CareTaskTemplate {
  id: string;
  label: string;
  frequency: TaskFrequency;
  timesPerDay: number;
  suggestedTime: string; // "HH:mm"
  difficulty: number;    // 1..5
  realAction: string;
  consequence: string;
}

export interface PetSpecies {
  id: string;
  name: string;
  category: string;
  difficulty: number;
  recommendedMinAge: number;
  lifespanYears: string;
  blurb: string;
  supplies: Supply[];
  startupCost: number;
  monthlyCost: number;
  yearlyCost: number;
  tasks: CareTaskTemplate[];
}

export interface PetDatabase {
  schemaVersion: string;
  currency: string;
  note: string;
  pets: PetSpecies[];
}

// --- Runtime state ---

export interface PetInstance {
  instanceId: string;
  speciesId: string;
  nickname: string;
  startDate: string;          // ISO
  trainingLengthDays: number;
  wellbeing: number;          // 0..100, starts 80
  trust: number;              // 0..100, starts 0
  carePoints: number;
  currentStreakDays: number;
  longestStreakDays: number;
  isActive: boolean;
  lastSettledDay: string;     // ISO (start of day)
}

export interface ScheduledTask {
  scheduledId: string;
  instanceId: string;
  templateId: string;
  dueAt: string;              // ISO
  status: TaskStatus;
  completedAt?: string;       // ISO
  verifiedAt?: string;        // ISO
  // snapshot of template fields
  label: string;
  difficulty: number;
  frequency: TaskFrequency;
  realAction: string;
  consequence: string;
  snoozeCount: number;
  photoUri?: string;          // local file uri only
  onTime: boolean;
}

export interface BudgetEntry {
  id: string;
  instanceId: string;
  label: string;
  amount: number;
  type: BudgetEntryType;
  date: string;               // ISO
}

export interface ChildProfile {
  name: string;
  age: number;
  avatar: string;
}

export interface ParentSettings {
  pinHash: string;
  pinSalt: string;
  verificationRequired: boolean;
  photoProofRequired: boolean;
  quietHoursStart: string;    // "HH:mm"
  quietHoursEnd: string;      // "HH:mm"
  defaultTrainingLengthDays: number;
  carryOverMissedTasks: boolean;
}

// Helpers mirroring the Swift computed properties.
export function isHandled(t: ScheduledTask): boolean {
  return t.status === "done" || t.status === "verified";
}
export function isDaily(t: ScheduledTask): boolean {
  return t.frequency === "daily";
}
export function petLevel(trust: number): number {
  return Math.max(1, Math.floor(trust / 20) + 1);
}
