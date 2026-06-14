import Foundation
import SwiftData

/// Player actions on the live care scenarios (scooping the yard, refreshing a fouled tank).
/// These clear a real-time need and reward a few care points, the way doing the chore would.
@MainActor
enum ScenarioActions {

    /// Clean up the pet's space (scoop the yard, muck the coop, change the bedding). Clears
    /// the solid-mess need and the annoyed neighbor, and earns care points. Used by every
    /// land habitat; the tank uses freshenTank instead.
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

    /// Groom the pet (brush, bath, nails). Clears the scruffiness need, lifts wellbeing a
    /// little, and builds a bit of trust, the way real handling does.
    static func groom(_ instance: PetInstance, context: ModelContext) {
        instance.groomLevel = 0
        instance.wellbeing = min(100, instance.wellbeing + 2)
        instance.trust = min(100, instance.trust + 2)
        instance.carePoints += 3
        DataStore.save(context)
    }

    /// Play with or walk the pet. Burns off restlessness, lifts wellbeing, and builds trust.
    static func play(_ instance: PetInstance, context: ModelContext) {
        instance.energyLevel = 0
        instance.wellbeing = min(100, instance.wellbeing + 3)
        instance.trust = min(100, instance.trust + 3)
        instance.carePoints += 3
        DataStore.save(context)
    }

    /// Run one trick-training session. Advances the current trick; finishing one builds a
    /// bigger jump of trust. Returns the trick just learned, if any (so the UI can cheer).
    @discardableResult
    static func train(_ instance: PetInstance, context: ModelContext) -> Trick? {
        let category = DataStore.species(id: instance.speciesId, context: context)?.category ?? ""
        let result = TrainingService.practice(progress: instance.trickProgress,
                                              learned: instance.tricksLearned,
                                              speciesId: instance.speciesId,
                                              category: category)
        instance.trickProgress = result.progress
        instance.tricksLearned = result.learned
        instance.carePoints += TrainingService.pointsPerSession
        instance.wellbeing = min(100, instance.wellbeing + 1)
        if result.finished != nil {
            instance.trust = min(100, instance.trust + TrainingService.trustPerTrick)
        }
        DataStore.save(context)
        return result.finished
    }

    /// Demo helper (Parent Mode): instantly make a mess so the scenario can be seen now.
    static func makeMessNow(_ instance: PetInstance, context: ModelContext) {
        instance.wasteLevel = 0.95
        instance.tankFoulLevel = 0.95
        instance.groomLevel = 0.8
        instance.energyLevel = 0.8
        DataStore.save(context)
    }
}
