// Budget tracker math. Ported from BudgetService.swift (Section 10).

import { BudgetEntry, PetInstance, PetSpecies, Supply } from "../types";
import { addDays } from "./time";
import { uid } from "./uid";

const onceSupplies = (s: PetSpecies): Supply[] => s.supplies.filter((x) => x.frequency === "once");
const monthlySupplies = (s: PetSpecies): Supply[] => s.supplies.filter((x) => x.frequency === "monthly");
export const yearlySupplies = (s: PetSpecies): Supply[] => s.supplies.filter((x) => x.frequency === "yearly");

/** Startup entries for "once" supplies + a monthly block for each 30-day block in window. */
export function seedEntries(instance: PetInstance, species: PetSpecies): BudgetEntry[] {
  const out: BudgetEntry[] = [];
  const start = new Date(instance.startDate);

  for (const sup of onceSupplies(species)) {
    out.push({ id: uid(), instanceId: instance.instanceId, label: sup.item, amount: sup.cost, type: "startup", date: start.toISOString() });
  }
  const length = Math.max(instance.trainingLengthDays, 1);
  for (let block = 0; block < length; block += 30) {
    const blockDate = addDays(start, block);
    for (const sup of monthlySupplies(species)) {
      out.push({ id: uid(), instanceId: instance.instanceId, label: sup.item, amount: sup.cost, type: "recurring", date: blockDate.toISOString() });
    }
  }
  return out;
}

export function startupTotal(entries: BudgetEntry[]): number {
  return entries.filter((e) => e.type === "startup").reduce((s, e) => s + e.amount, 0);
}

export function monthlyTotal(species: PetSpecies): number {
  return species.monthlyCost;
}

export function firstYearProjection(species: PetSpecies): number {
  return species.startupCost + species.monthlyCost * 12 + yearlySupplies(species).reduce((s, x) => s + x.cost, 0);
}
