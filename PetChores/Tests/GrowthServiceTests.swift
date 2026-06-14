import XCTest
@testable import PetChores

/// Verifies the growth engine: daily growth while cared for, neglect stalling it, clamping,
/// stage thresholds, and the draw-scale curve.
final class GrowthServiceTests: XCTestCase {

    typealias G = GrowthService

    func testGrowsWhileCaredFor() {
        // 7 well-cared days into a 21-day window adds 1/3 of the way.
        let out = G.advance(0.2, wellbeing: 80, elapsedDays: 7, windowDays: 21)
        XCTAssertEqual(out, 0.2 + 7.0 / 21.0, accuracy: 0.0001)
    }

    func testNeglectStallsGrowth() {
        let out = G.advance(0.4, wellbeing: 20, elapsedDays: 10, windowDays: 21)
        XCTAssertEqual(out, 0.4, "a neglected pet does not grow")
    }

    func testGrowthClampsAtFullGrown() {
        let out = G.advance(0.95, wellbeing: 90, elapsedDays: 100, windowDays: 21)
        XCTAssertEqual(out, 1.0)
    }

    func testNoTimeNoGrowth() {
        XCTAssertEqual(G.advance(0.5, wellbeing: 90, elapsedDays: 0, windowDays: 21), 0.5)
    }

    func testStageThresholds() {
        XCTAssertEqual(G.stage(0.1), .baby)
        XCTAssertEqual(G.stage(0.34), .young)
        XCTAssertEqual(G.stage(0.5), .young)
        XCTAssertEqual(G.stage(0.75), .grown)
        XCTAssertEqual(G.stage(1.0), .grown)
    }

    func testScaleGrowsWithMaturity() {
        XCTAssertEqual(G.scale(0.0), 0.6, accuracy: 0.0001, "a newborn is the smallest")
        XCTAssertEqual(G.scale(1.0), 1.0, accuracy: 0.0001, "an adult is full size")
        XCTAssertLessThan(G.scale(0.2), G.scale(0.9))
    }

    func testScaleClampsOutOfRangeInput() {
        XCTAssertEqual(G.scale(-1), 0.6, accuracy: 0.0001)
        XCTAssertEqual(G.scale(5), 1.0, accuracy: 0.0001)
    }
}
