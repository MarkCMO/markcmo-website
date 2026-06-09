import XCTest
@testable import PetChores

/// Verifies grace windows, Care Points, wellbeing, streak, and trust (Sections 8, 9).
final class ScoringServiceTests: XCTestCase {

    private let scoring = ScoringService()
    private let cal = Calendar.current

    private func task(
        templateId: String,
        label: String,
        frequency: TaskFrequency,
        difficulty: Int = 1,
        dueAt: Date,
        status: TaskStatus = .pending,
        onTime: Bool = false
    ) -> ScheduledTask {
        ScheduledTask(
            instanceId: UUID(),
            templateId: templateId,
            dueAt: dueAt,
            status: status,
            label: label,
            difficulty: difficulty,
            frequency: frequency,
            realAction: "",
            consequence: "",
            onTime: onTime
        )
    }

    private func instance(start: Date, length: Int = 21) -> PetInstance {
        let startDay = cal.startOfDay(for: start)
        let before = cal.date(byAdding: .day, value: -1, to: startDay)!
        return PetInstance(speciesId: "dog", nickname: "Rex", startDate: start,
                           trainingLengthDays: length, lastSettledDay: before)
    }

    // MARK: - Grace windows

    func testFeedingGraceIsTwoHours() {
        let due = Date()
        let t = task(templateId: "dog_feed_am", label: "Feed breakfast", frequency: .daily, dueAt: due)
        XCTAssertEqual(scoring.graceDeadline(for: t).timeIntervalSince(due), 2 * 3600, accuracy: 1)
    }

    func testWaterGraceIsTwoHours() {
        let due = Date()
        let t = task(templateId: "dog_water", label: "Refresh water", frequency: .daily, dueAt: due)
        XCTAssertEqual(scoring.graceDeadline(for: t).timeIntervalSince(due), 2 * 3600, accuracy: 1)
    }

    func testWalkGraceIsFourHours() {
        let due = Date()
        let t = task(templateId: "dog_walk_am", label: "Morning walk", frequency: .daily, dueAt: due)
        XCTAssertEqual(scoring.graceDeadline(for: t).timeIntervalSince(due), 4 * 3600, accuracy: 1)
    }

    func testWeeklyGraceIsEndOfDay() {
        let due = cal.date(bySettingHour: 10, minute: 0, second: 0, of: Date())!
        let t = task(templateId: "dog_brush", label: "Brush coat", frequency: .weekly, dueAt: due)
        let deadline = scoring.graceDeadline(for: t)
        let comps = cal.dateComponents([.hour, .minute], from: deadline)
        XCTAssertEqual(comps.hour, 23)
        XCTAssertEqual(comps.minute, 59)
    }

    func testOverdueAndOnTime() {
        let due = Date().addingTimeInterval(-3 * 3600) // 3 hours ago
        let feeding = task(templateId: "dog_feed_am", label: "Feed", frequency: .daily, dueAt: due)
        XCTAssertTrue(scoring.isOverdue(feeding, now: Date()))      // past the 2h window
        let walk = task(templateId: "dog_walk_am", label: "Walk", frequency: .daily, dueAt: due)
        XCTAssertFalse(scoring.isOverdue(walk, now: Date()))        // still inside the 4h window
    }

    // MARK: - Points

    func testBasePoints() {
        XCTAssertEqual(scoring.basePoints(difficulty: 1), 10)
        XCTAssertEqual(scoring.basePoints(difficulty: 5), 50)
        XCTAssertEqual(scoring.basePoints(difficulty: 9), 50)  // clamped
    }

    func testApplyDoneOnTimeDailyAwardsPointsAndWellbeing() {
        let now = Date()
        let inst = instance(start: now)
        let t = task(templateId: "dog_poop_yard", label: "Pick up poop", frequency: .daily,
                     difficulty: 3, dueAt: now)
        let pts = scoring.applyDone(task: t, instance: inst, now: now)
        XCTAssertEqual(pts, 35)            // 10*3 + 5 on-time
        XCTAssertEqual(inst.carePoints, 35)
        XCTAssertEqual(inst.wellbeing, 81) // +1 for on-time daily
        XCTAssertTrue(t.onTime)
    }

    func testApplyVerifiedAddsBonusAndTrust() {
        let now = Date()
        let inst = instance(start: now)
        let t = task(templateId: "dog_feed_am", label: "Feed", frequency: .daily, dueAt: now)
        scoring.applyVerified(task: t, instance: inst, now: now)
        XCTAssertEqual(inst.carePoints, 5)
        XCTAssertEqual(inst.trust, 1)
        XCTAssertNotNil(t.verifiedAt)
    }

    // MARK: - Day settlement

    func testSettleRewardsStreakAndTrustForGoodDay() {
        let now = cal.startOfDay(for: Date())
        let start = cal.date(byAdding: .day, value: -2, to: now)!
        let inst = instance(start: start)

        let yesterday = cal.date(byAdding: .day, value: -1, to: now)!
        let due = cal.date(bySettingHour: 8, minute: 0, second: 0, of: yesterday)!
        let t = task(templateId: "dog_feed_am", label: "Feed", frequency: .daily,
                     dueAt: due, status: .verified, onTime: true)

        scoring.settleElapsedDays(instance: inst, tasks: [t], now: now)
        XCTAssertEqual(inst.currentStreakDays, 1)
        XCTAssertEqual(inst.longestStreakDays, 1)
        XCTAssertEqual(inst.trust, 2)          // +2 per streak day
        XCTAssertEqual(inst.wellbeing, 80)     // no penalties
    }

    func testSettlePenalizesMissedDailyAndResetsStreak() {
        let now = cal.startOfDay(for: Date())
        let start = cal.date(byAdding: .day, value: -2, to: now)!
        let inst = instance(start: start)
        inst.currentStreakDays = 4

        let yesterday = cal.date(byAdding: .day, value: -1, to: now)!
        let due = cal.date(bySettingHour: 8, minute: 0, second: 0, of: yesterday)!
        let t = task(templateId: "dog_feed_am", label: "Feed", frequency: .daily,
                     dueAt: due, status: .missed)

        scoring.settleElapsedDays(instance: inst, tasks: [t], now: now)
        XCTAssertEqual(inst.currentStreakDays, 0)   // reset
        XCTAssertEqual(inst.wellbeing, 71)          // -4 missed daily, -5 zero-day
    }

    func testSettleIsIdempotent() {
        let now = cal.startOfDay(for: Date())
        let start = cal.date(byAdding: .day, value: -2, to: now)!
        let inst = instance(start: start)
        let yesterday = cal.date(byAdding: .day, value: -1, to: now)!
        let due = cal.date(bySettingHour: 8, minute: 0, second: 0, of: yesterday)!
        let t = task(templateId: "dog_feed_am", label: "Feed", frequency: .daily,
                     dueAt: due, status: .verified, onTime: true)

        scoring.settleElapsedDays(instance: inst, tasks: [t], now: now)
        let trustAfterFirst = inst.trust
        scoring.settleElapsedDays(instance: inst, tasks: [t], now: now)  // run again
        XCTAssertEqual(inst.trust, trustAfterFirst)   // no double counting
    }
}
