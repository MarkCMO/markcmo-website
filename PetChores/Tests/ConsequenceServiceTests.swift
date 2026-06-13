import XCTest
@testable import PetChores

/// Verifies the consequence engine (Phase 2): need accumulation, strike accrual and
/// redemption, clamping, and terminal-outcome resolution across intensities.
final class ConsequenceServiceTests: XCTestCase {

    typealias C = ConsequenceService

    // MARK: - tick (real-time need accumulation)

    func testTickAccumulatesRelevantNeedsOnly() {
        let start = C.Needs()
        // 18 hours at harsh (rate 1/18 per hour) takes a need from 0 to 1.0.
        let out = C.tick(start, elapsedHours: 18, intensity: .harsh, hasWaste: true, isAquatic: false)
        XCTAssertEqual(out.hunger, 1.0, accuracy: 0.0001)
        XCTAssertEqual(out.waste, 1.0, accuracy: 0.0001)
        XCTAssertEqual(out.tank, 0.0, accuracy: 0.0001, "non-aquatic pet never fouls a tank")
    }

    func testTickAquaticFoulsTank() {
        let out = C.tick(C.Needs(), elapsedHours: 36, intensity: .normal, hasWaste: false, isAquatic: true)
        XCTAssertEqual(out.tank, 1.0, accuracy: 0.0001)
        XCTAssertEqual(out.waste, 0.0, accuracy: 0.0001)
    }

    func testTickClampsAtOne() {
        let out = C.tick(C.Needs(hunger: 0.9), elapsedHours: 1000, intensity: .harsh, hasWaste: false, isAquatic: false)
        XCTAssertEqual(out.hunger, 1.0)
    }

    func testTickOffNeverAccumulates() {
        let out = C.tick(C.Needs(), elapsedHours: 1000, intensity: .off, hasWaste: true, isAquatic: true)
        XCTAssertEqual(out, C.Needs())
    }

    func testNeedsAnyCritical() {
        XCTAssertTrue(C.Needs(hunger: 1.0).anyCritical)
        XCTAssertTrue(C.Needs(tank: 1.0).anyCritical)
        XCTAssertFalse(C.Needs(hunger: 0.99, waste: 0.99, tank: 0.99).anyCritical)
    }

    // MARK: - dailyStrikeDelta (accrual + redemption)

    func testNeglectAddsAStrike() {
        XCTAssertEqual(C.dailyStrikeDelta(criticalNeglect: true, careStreakDays: 0, intensity: .normal), 1)
    }

    func testRedemptionMilestoneRemovesAStrike() {
        // normal cadence is every 3 cared-for days.
        XCTAssertEqual(C.dailyStrikeDelta(criticalNeglect: false, careStreakDays: 3, intensity: .normal), -1)
        XCTAssertEqual(C.dailyStrikeDelta(criticalNeglect: false, careStreakDays: 6, intensity: .normal), -1)
        XCTAssertEqual(C.dailyStrikeDelta(criticalNeglect: false, careStreakDays: 4, intensity: .normal), 0)
    }

    func testNeglectTakesPriorityOverRedemption() {
        XCTAssertEqual(C.dailyStrikeDelta(criticalNeglect: true, careStreakDays: 3, intensity: .normal), 1)
    }

    func testOffNeverChangesStrikes() {
        XCTAssertEqual(C.dailyStrikeDelta(criticalNeglect: true, careStreakDays: 0, intensity: .off), 0)
        XCTAssertEqual(C.dailyStrikeDelta(criticalNeglect: false, careStreakDays: 99, intensity: .off), 0)
    }

    func testHarshIsHarderToRedeemThanGentle() {
        XCTAssertEqual(C.dailyStrikeDelta(criticalNeglect: false, careStreakDays: 2, intensity: .gentle), -1)
        XCTAssertEqual(C.dailyStrikeDelta(criticalNeglect: false, careStreakDays: 2, intensity: .harsh), 0,
                       "harsh needs 5 cared-for days to earn a strike back, not 2")
    }

    // MARK: - applyStrikeDelta (clamping)

    func testApplyStrikeClampsToRange() {
        XCTAssertEqual(C.applyStrikeDelta(0, delta: -1, maxStrikes: 5), 0)
        XCTAssertEqual(C.applyStrikeDelta(5, delta: 1, maxStrikes: 5), 5)
        XCTAssertEqual(C.applyStrikeDelta(2, delta: 1, maxStrikes: 5), 3)
        XCTAssertEqual(C.applyStrikeDelta(3, delta: -1, maxStrikes: 5), 2)
    }

    // MARK: - outcome resolution

    func testOutcomeSafeWarningScale() {
        XCTAssertEqual(C.outcome(strikes: 0, maxStrikes: 5, permanentLossEnabled: false), .safe)
        XCTAssertEqual(C.outcome(strikes: 3, maxStrikes: 5, permanentLossEnabled: false), .safe)
        XCTAssertEqual(C.outcome(strikes: 4, maxStrikes: 5, permanentLossEnabled: false), .warning)
    }

    func testOutcomeRecoverableScareWhenNotPermanent() {
        XCTAssertEqual(C.outcome(strikes: 5, maxStrikes: 5, permanentLossEnabled: false), .scare)
        XCTAssertEqual(C.outcome(strikes: 6, maxStrikes: 5, permanentLossEnabled: false), .scare)
    }

    func testOutcomePermanentLossWhenEnabled() {
        XCTAssertEqual(C.outcome(strikes: 5, maxStrikes: 5, permanentLossEnabled: true), .lost)
    }

    // MARK: - intensity table sanity

    func testIntensityRatesOrdered() {
        XCTAssertEqual(ConsequenceIntensity.off.needRatePerHour, 0)
        XCTAssertLessThan(ConsequenceIntensity.gentle.needRatePerHour, ConsequenceIntensity.normal.needRatePerHour)
        XCTAssertLessThan(ConsequenceIntensity.normal.needRatePerHour, ConsequenceIntensity.harsh.needRatePerHour)
    }
}
