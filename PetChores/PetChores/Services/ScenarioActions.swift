import Foundation
import SwiftData

/// Player actions on the live care scenarios (scooping the yard, refreshing a fouled tank).
/// These clear a real-time need and reward a few care points, the way doing the chore would.
@MainActor
enum ScenarioActions {

    /// Scoop the yard: clears the mess (and the annoyed neighbor) and earns care points.
    static func cleanYard(_ instance: PetInstance, context: ModelContext) {
        guard instance.wasteLevel > 0 else { return }
        instance.wasteLevel = 0
        instance.carePoints += 4
        DataStore.save(context)
    }

    /// Freshen a fouled aquatic tank.
    static func freshenTank(_ instance: PetInstance, context: ModelContext) {
        guard instance.tankFoulLevel > 0 else { return }
        instance.tankFoulLevel = 0
        instance.carePoints += 4
        DataStore.save(context)
    }

    /// A real vet bill in dollars, the way an unexpected illness costs a real owner.
    static let vetBill = 45

    /// Take the pet to the vet: nurses it back to health and clears the worst of the
    /// strikes, but it costs real money (a vet bill) and some of the child's care points.
    /// Neglect is expensive, just like real life.
    static func vetVisit(_ instance: PetInstance, context: ModelContext) {
        instance.wellbeing = max(instance.wellbeing, 55)
        instance.strikes = max(0, instance.strikes - 1)
        instance.lostAt = nil                       // recovered from the scare
        instance.carePoints = max(0, instance.carePoints - 25)
        // Record the bill against this pet's true cost of ownership.
        let bill = BudgetEntry(instanceId: instance.instanceId,
                               label: "Vet visit",
                               amount: Double(vetBill),
                               type: .recurring,
                               date: Date())
        context.insert(bill)
        DataStore.save(context)
    }

    /// Demo helper (Parent Mode): instantly make a mess so the scenario can be seen now.
    static func makeMessNow(_ instance: PetInstance, context: ModelContext) {
        instance.wasteLevel = 0.95
        instance.tankFoulLevel = 0.95
        DataStore.save(context)
    }
}
