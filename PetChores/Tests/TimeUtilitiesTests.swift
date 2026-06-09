import XCTest
@testable import PetChores

/// Verifies the "HH:mm" parsing and quiet-hours math (Section 7).
final class TimeUtilitiesTests: XCTestCase {

    private let cal = Calendar.current

    private func date(_ hour: Int, _ minute: Int) -> Date {
        cal.date(bySettingHour: hour, minute: minute, second: 0, of: Date()) ?? Date()
    }

    func testMinutesSinceMidnight() {
        XCTAssertEqual(TimeUtilities.minutesSinceMidnight("20:30"), 1230)
        XCTAssertEqual(TimeUtilities.minutesSinceMidnight("07:00"), 420)
        XCTAssertEqual(TimeUtilities.minutesSinceMidnight("00:00"), 0)
    }

    func testComponentsFallbackOnBadInput() {
        let c = TimeUtilities.components(from: "not-a-time")
        XCTAssertEqual(c.hour, 8)
        XCTAssertEqual(c.minute, 0)
    }

    func testQuietHoursWrappingPastMidnight() {
        let start = "20:30", end = "07:00"
        XCTAssertTrue(TimeUtilities.isInQuietHours(date(22, 0), start: start, end: end))
        XCTAssertTrue(TimeUtilities.isInQuietHours(date(6, 0), start: start, end: end))
        XCTAssertFalse(TimeUtilities.isInQuietHours(date(12, 0), start: start, end: end))
        // The end boundary is exclusive.
        XCTAssertFalse(TimeUtilities.isInQuietHours(date(7, 0), start: start, end: end))
        // The start boundary is inclusive.
        XCTAssertTrue(TimeUtilities.isInQuietHours(date(20, 30), start: start, end: end))
    }

    func testQuietHoursSameDayWindow() {
        let start = "01:00", end = "06:00"
        XCTAssertTrue(TimeUtilities.isInQuietHours(date(3, 0), start: start, end: end))
        XCTAssertFalse(TimeUtilities.isInQuietHours(date(8, 0), start: start, end: end))
    }

    func testShiftOutOfQuietHoursMovesToEndTime() {
        let start = "20:30", end = "07:00"
        let late = date(21, 0)
        let shifted = TimeUtilities.shiftedOutOfQuietHours(late, start: start, end: end)
        let comps = cal.dateComponents([.hour, .minute], from: shifted)
        XCTAssertEqual(comps.hour, 7)
        XCTAssertEqual(comps.minute, 0)
        // A late-evening time must move to the NEXT day's wake time.
        XCTAssertGreaterThan(shifted, late)
    }

    func testShiftLeavesNonQuietTimesUnchanged() {
        let start = "20:30", end = "07:00"
        let noon = date(12, 0)
        XCTAssertEqual(TimeUtilities.shiftedOutOfQuietHours(noon, start: start, end: end), noon)
    }

    func testDailySlotTimesSpread() {
        let slots = TimeUtilities.dailySlotTimes(count: 2, firstSlot: "07:30", wake: "07:00", quietStart: "20:30")
        XCTAssertEqual(slots.count, 2)
        XCTAssertEqual(slots.first, "07:30")
        XCTAssertEqual(slots.last, "20:30")
    }

    func testDailySlotTimesSingle() {
        let slots = TimeUtilities.dailySlotTimes(count: 1, firstSlot: "09:00", wake: "07:00", quietStart: "20:30")
        XCTAssertEqual(slots, ["09:00"])
    }
}
