import Foundation
import SwiftData

/// App-wide parent settings (Section 3.8). A single row, created during onboarding.
/// The PIN is stored only as a salted hash; the raw PIN is never persisted.
@Model
final class ParentSettings {
    @Attribute(.unique) var id: UUID
    var pinHash: String
    var pinSalt: String
    var verificationRequired: Bool
    var photoProofRequired: Bool
    var quietHoursStart: String   // "HH:mm"
    var quietHoursEnd: String     // "HH:mm"
    var defaultTrainingLengthDays: Int

    /// When false (default), a task past its grace window is marked missed and the day
    /// advances. When true, an earlier missed task keeps appearing on later days until
    /// it is done (Section 3.8, borrowed from Chorsee). The original day's miss still
    /// counts for that day's wellbeing and streak; completing it late is a recovery
    /// that earns base points only.
    /// Inline default so SwiftData can lightly migrate stores created before this field.
    var carryOverMissedTasks: Bool = false

    init(
        id: UUID = UUID(),
        pinHash: String,
        pinSalt: String,
        verificationRequired: Bool = true,
        photoProofRequired: Bool = false,
        quietHoursStart: String = "20:30",
        quietHoursEnd: String = "07:00",
        defaultTrainingLengthDays: Int = 21,
        carryOverMissedTasks: Bool = false
    ) {
        self.id = id
        self.pinHash = pinHash
        self.pinSalt = pinSalt
        self.verificationRequired = verificationRequired
        self.photoProofRequired = photoProofRequired
        self.quietHoursStart = quietHoursStart
        self.quietHoursEnd = quietHoursEnd
        self.defaultTrainingLengthDays = defaultTrainingLengthDays
        self.carryOverMissedTasks = carryOverMissedTasks
    }
}
