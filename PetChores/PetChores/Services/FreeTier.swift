import Foundation

/// Free-tier limits and paid-feature gates (Section 13B). The free tier gives full
/// access to ONE pet for ONE training window. The paid unlock adds all pets, multiple
/// pets at once, photo proof, and Readiness Report export.
enum FreeTier {

    /// Free users may create a pet only when they have none yet. Paid users are
    /// unlimited. Count includes archived pets so the free window is genuinely "one".
    static func canCreatePet(isUnlocked: Bool, existingInstanceCount: Int) -> Bool {
        isUnlocked || existingInstanceCount == 0
    }

    static func photoProofAvailable(isUnlocked: Bool) -> Bool { isUnlocked }
    static func multiPetAvailable(isUnlocked: Bool) -> Bool { isUnlocked }
    static func exportAvailable(isUnlocked: Bool) -> Bool { isUnlocked }

    /// Friendly, child-safe message shown when a locked feature is tapped. Never shows a
    /// buy button to the child; routes to the parental gate first (Section 13B).
    static let lockedMessage = "Ask a grown up to unlock more pets."
}
