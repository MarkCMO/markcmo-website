import Foundation
import SwiftData

/// A pet a child is actively training on (Section 3.4). Created during onboarding or
/// from Parent Mode "Manage Pets". Linked to a PetSpecies by speciesId.
@Model
final class PetInstance {
    @Attribute(.unique) var instanceId: UUID
    var speciesId: String
    var nickname: String
    var startDate: Date
    var trainingLengthDays: Int
    var wellbeing: Int          // 0 to 100, starts at 80
    var trust: Int              // 0 to 100, starts at 0
    var carePoints: Int         // cumulative
    var currentStreakDays: Int
    var longestStreakDays: Int
    var isActive: Bool

    /// Last calendar day (start of day) that the maintenance pass has already settled.
    /// Used so streak and wellbeing are recomputed exactly once per elapsed day.
    var lastSettledDay: Date

    init(
        instanceId: UUID = UUID(),
        speciesId: String,
        nickname: String,
        startDate: Date,
        trainingLengthDays: Int,
        wellbeing: Int = 80,
        trust: Int = 0,
        carePoints: Int = 0,
        currentStreakDays: Int = 0,
        longestStreakDays: Int = 0,
        isActive: Bool = true,
        lastSettledDay: Date
    ) {
        self.instanceId = instanceId
        self.speciesId = speciesId
        self.nickname = nickname
        self.startDate = startDate
        self.trainingLengthDays = trainingLengthDays
        self.wellbeing = wellbeing
        self.trust = trust
        self.carePoints = carePoints
        self.currentStreakDays = currentStreakDays
        self.longestStreakDays = longestStreakDays
        self.isActive = isActive
        self.lastSettledDay = lastSettledDay
    }

    /// Last day of the training window (inclusive), as an end-of-day boundary.
    func endDate(calendar: Calendar = .current) -> Date {
        let start = calendar.startOfDay(for: startDate)
        let last = calendar.date(byAdding: .day, value: max(trainingLengthDays - 1, 0), to: start) ?? start
        return calendar.date(bySettingHour: 23, minute: 59, second: 59, of: last) ?? last
    }

    /// Whether the training window has fully elapsed as of `now`.
    func isTrainingComplete(now: Date = Date(), calendar: Calendar = .current) -> Bool {
        now > endDate(calendar: calendar)
    }

    var mood: Mood { Mood.from(wellbeing: wellbeing) }

    /// Trust drives the level shown in Rewards (Section 11). Simple banded level.
    var level: Int { max(1, (trust / 20) + 1) }
}
