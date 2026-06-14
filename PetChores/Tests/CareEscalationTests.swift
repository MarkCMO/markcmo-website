import XCTest
@testable import PetChores

/// Verifies the escalating reminder ladder: tiers by need level and strikes, and that the
/// wording follows the real animal's habitat.
final class CareEscalationTests: XCTestCase {

    typealias E = CareEscalation

    func testCalmReturnsNoAlert() {
        XCTAssertNil(E.current(needLevel: 0.1, strikes: 0, maxStrikes: 5,
                               nickname: "Rex", habitat: .backyard))
    }

    func testNudgeTierWhenNeedClimbs() {
        let a = E.current(needLevel: 0.5, strikes: 0, maxStrikes: 5, nickname: "Rex", habitat: .backyard)
        XCTAssertEqual(a?.urgency, .nudge)
    }

    func testAnyStrikeProducesAtLeastANudge() {
        let a = E.current(needLevel: 0.0, strikes: 1, maxStrikes: 5, nickname: "Rex", habitat: .backyard)
        XCTAssertEqual(a?.urgency, .nudge)
    }

    func testUrgentTierWhenThereIsARealMess() {
        let a = E.current(needLevel: 0.8, strikes: 0, maxStrikes: 5, nickname: "Rex", habitat: .backyard)
        XCTAssertEqual(a?.urgency, .urgent)
    }

    func testSevereTierAtWarningStrikeCount() {
        // 4 of 5 strikes is one slip from losing the pet, regardless of the current need.
        let a = E.current(needLevel: 0.0, strikes: 4, maxStrikes: 5, nickname: "Rex", habitat: .backyard)
        XCTAssertEqual(a?.urgency, .severe)
    }

    func testSevereTierWhenNeedIsMaxed() {
        let a = E.current(needLevel: 0.97, strikes: 0, maxStrikes: 5, nickname: "Rex", habitat: .backyard)
        XCTAssertEqual(a?.urgency, .severe)
    }

    func testWordingFollowsHabitat() {
        let yard = E.current(needLevel: 0.8, strikes: 0, maxStrikes: 5, nickname: "Rex", habitat: .backyard)
        let tank = E.current(needLevel: 0.8, strikes: 0, maxStrikes: 5, nickname: "Bubbles", habitat: .aquarium)
        XCTAssertNotEqual(yard?.body, tank?.body)
        XCTAssertTrue(tank?.body.contains("tank") ?? false)
    }

    func testLadderIncludesGentlerTiersBelowTheTop() {
        let rungs = E.ladder(needLevel: 0.97, strikes: 0, maxStrikes: 5, nickname: "Rex", habitat: .backyard)
        let urgencies = rungs.map(\.urgency)
        XCTAssertTrue(urgencies.contains(.nudge))
        XCTAssertTrue(urgencies.contains(.urgent))
        XCTAssertTrue(urgencies.contains(.severe))
    }

    func testLadderEmptyWhenCalm() {
        XCTAssertTrue(E.ladder(needLevel: 0.1, strikes: 0, maxStrikes: 5, nickname: "Rex", habitat: .backyard).isEmpty)
    }
}
