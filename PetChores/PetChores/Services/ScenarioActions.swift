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

    /// Demo helper (Parent Mode): instantly make a mess so the scenario can be seen now.
    static func makeMessNow(_ instance: PetInstance, context: ModelContext) {
        instance.wasteLevel = 0.95
        instance.tankFoulLevel = 0.95
        DataStore.save(context)
    }
}
