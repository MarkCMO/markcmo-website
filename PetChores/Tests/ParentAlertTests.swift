import XCTest
@testable import PetChores

/// Verifies the grown-up oversight engine: tiers from the child's care record, and that the
/// messages name the child and the pet.
final class ParentAlertTests: XCTestCase {

    typealias P = ParentAlert

    private func alert(_ s: P.CareSignals, child: String = "Sam", pet: String = "Rex") -> P.Alert? {
        P.current(childName: child, petName: pet, signals: s)
    }

    func testNoAlertWhenChildIsKeepingUp() {
        XCTAssertNil(alert(P.CareSignals(missedToday: 0, strikes: 0, wellbeing: 90, worstNeed: 0.1)))
    }

    func testInfoTierWhenAFewChoresMissedToday() {
        let a = alert(P.CareSignals(missedToday: 2, wellbeing: 80))
        XCTAssertEqual(a?.urgency, .info)
    }

    func testInfoTierWhenAStrikeButNotYetWarning() {
        let a = alert(P.CareSignals(strikes: 1, maxStrikes: 5, wellbeing: 80))
        XCTAssertEqual(a?.urgency, .info)
    }

    func testInfoTierOnAWeekOfMisses() {
        let a = alert(P.CareSignals(missedThisWeek: 4, wellbeing: 80))
        XCTAssertEqual(a?.urgency, .info)
    }

    func testConcernTierAtWarningStrikeCount() {
        let a = alert(P.CareSignals(strikes: 4, maxStrikes: 5, wellbeing: 80))
        XCTAssertEqual(a?.urgency, .concern)
    }

    func testConcernTierWhenWellbeingIsLow() {
        let a = alert(P.CareSignals(strikes: 0, wellbeing: 30, worstNeed: 0.2))
        XCTAssertEqual(a?.urgency, .concern)
    }

    func testActionTierAtStrikeLimit() {
        let a = alert(P.CareSignals(strikes: 5, maxStrikes: 5, wellbeing: 20))
        XCTAssertEqual(a?.urgency, .action)
    }

    func testActionTierWhenPetIsLost() {
        let a = alert(P.CareSignals(isLost: true))
        XCTAssertEqual(a?.urgency, .action)
    }

    func testMessagesNameTheChildAndPet() {
        let a = alert(P.CareSignals(missedToday: 3), child: "Mia", pet: "Clover")
        XCTAssertTrue(a?.title.contains("Mia") ?? false || a?.body.contains("Mia") ?? false)
        XCTAssertTrue(a?.body.contains("Clover") ?? false)
    }

    func testTierOrderingIsActionThenConcernThenInfo() {
        XCTAssertTrue(P.Urgency.action > P.Urgency.concern)
        XCTAssertTrue(P.Urgency.concern > P.Urgency.info)
        XCTAssertTrue(P.Urgency.info > P.Urgency.none)
    }
}
