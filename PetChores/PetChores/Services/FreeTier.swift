import Foundation

/// Free-tier limits and paid-feature gates (Section 13B). One pet is always free to
/// train; a monthly subscription plan raises how many pets may be active at once (Three
/// Pets / Unlimited) and unlocks photo proof and Readiness Report export.
enum FreeTier {

    /// A new pet may be started while the number of ACTIVE pets is under the plan's
    /// limit. Free = 1, Three = 3, Unlimited = no limit. Archived pets do not count, so
    /// finishing one always frees a slot.
    static func canCreatePet(maxPets: Int, activePetCount: Int) -> Bool {
        activePetCount < maxPets
    }

    static func photoProofAvailable(isUnlocked: Bool) -> Bool { isUnlocked }
    static func multiPetAvailable(isUnlocked: Bool) -> Bool { isUnlocked }
    static func exportAvailable(isUnlocked: Bool) -> Bool { isUnlocked }

    /// Friendly, child-safe message shown when a locked feature is tapped. Never shows a
    /// buy button to the child; routes to the parental gate first (Section 13B).
    static let lockedMessage = "Ask a grown up to add more pets."
}
