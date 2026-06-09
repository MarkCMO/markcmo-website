import Foundation
import SwiftData

/// Budget tracker math and entry creation (Section 10).
struct BudgetService {

    var calendar: Calendar = .current

    /// On instance creation, add all "once" supplies as startup entries, and the first
    /// 30-day block of "monthly" supplies as recurring entries. Yearly items are not
    /// deducted here; they appear in the first-year projection only.
    func seedEntries(for instance: PetInstance, species: PetSpecies, context: ModelContext) {
        let start = instance.startDate

        for supply in species.onceSupplies {
            context.insert(BudgetEntry(
                instanceId: instance.instanceId,
                label: supply.item,
                amount: supply.cost,
                type: .startup,
                date: start
            ))
        }

        // Add monthly entries for each 30-day block that begins within the window.
        let length = max(instance.trainingLengthDays, 1)
        var blockStart = 0
        while blockStart < length {
            guard let blockDate = calendar.date(byAdding: .day, value: blockStart, to: start) else { break }
            for supply in species.monthlySupplies {
                context.insert(BudgetEntry(
                    instanceId: instance.instanceId,
                    label: supply.item,
                    amount: supply.cost,
                    type: .recurring,
                    date: blockDate
                ))
            }
            blockStart += 30
        }
    }

    // MARK: - Totals

    func startupTotal(entries: [BudgetEntry]) -> Double {
        entries.filter { $0.type == .startup }.reduce(0) { $0 + $1.amount }
    }

    /// Monthly total uses the species figure so it reads as a true monthly cost even in
    /// a short training window.
    func monthlyTotal(species: PetSpecies) -> Double {
        species.monthlyCost
    }

    /// Projected first-year total = startup + 12 monthly + yearly items (Section 10).
    func firstYearProjection(species: PetSpecies) -> Double {
        species.startupCost + (species.monthlyCost * 12) + species.yearlySupplies.reduce(0) { $0 + $1.cost }
    }
}
