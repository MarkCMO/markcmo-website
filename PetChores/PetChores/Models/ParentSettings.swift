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

    // MARK: Consequence engine (the "serious lessons" stakes). Inline defaults keep older
    // stores migrating cleanly. Defaults start easy so a parent can ramp up gradually.
    var consequenceIntensityRaw: Int = ConsequenceIntensity.gentle.rawValue
    /// Strikes a pet can take before the terminal outcome. Five by design.
    var maxStrikes: Int = 5
    /// When true, the final strike means the pet is gone for good. When false, the final
    /// strike is a recoverable scare (animal-control warning / very sick) the child can
    /// pull back from with good care.
    var permanentLossEnabled: Bool = false

    // MARK: Granular harshness dials. Each one lets a parent turn a specific real-life
    // consequence on or off, on top of the overall intensity, so the lessons can be
    // introduced one at a time. Inline defaults keep older stores migrating.
    /// When on, a yard pet that is not let out in time has an accident that adds to the mess.
    var accidentsEnabled: Bool = true
    /// When on, a sick pet costs a real vet bill (and care points) to nurse back. When off,
    /// the child can still nurse the pet, but it is free.
    var vetBillsEnabled: Bool = true
    /// When on, neglect brings social pressure: the annoyed neighbor over the fence and the
    /// animal-control warning. When off, the reminders stay gentle and private.
    var socialPressureEnabled: Bool = true

    /// Demo mode hugely speeds up how fast needs build, so the care scenarios (a messy
    /// yard, a fouling tank) can be seen and played within a minute instead of over days.
    /// For TestFlight demos only; off by default.
    var demoMode: Bool = false

    /// When on (default), the grown-up gets notifications when the child falls behind on a
    /// pet's care (missed chores, a slipping pet, a strike taken). Distinct from the
    /// child-facing reminders. Inline default so older stores migrate cleanly.
    var parentCareAlertsEnabled: Bool = true

    var consequenceIntensity: ConsequenceIntensity {
        get { ConsequenceIntensity(rawValue: consequenceIntensityRaw) ?? .gentle }
        set { consequenceIntensityRaw = newValue.rawValue }
    }

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
