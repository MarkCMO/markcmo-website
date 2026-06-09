import XCTest
@testable import PetChores

/// Verifies recurrence math and whole-window schedule building (Section 6).
final class ScheduleGeneratorTests: XCTestCase {

    private let gen = ScheduleGenerator()
    private let cal = Calendar.current

    private func makeTemplate(id: String, frequency: TaskFrequency, timesPerDay: Int = 1) -> CareTaskTemplate {
        CareTaskTemplate(id: id, label: id, frequency: frequency.rawValue, timesPerDay: timesPerDay,
                         suggestedTime: "07:30", difficulty: 1, realAction: "", consequence: "")
    }

    private func species(tasks: [CareTaskTemplate]) -> PetSpecies {
        PetSpecies(id: "test", name: "Test", category: "mammal", difficulty: 2, recommendedMinAge: 6,
                   lifespanYears: "1-2", blurb: "", supplies: [], startupCost: 0, monthlyCost: 0,
                   yearlyCost: 0, tasks: tasks)
    }

    private func instance(length: Int) -> PetInstance {
        let start = cal.startOfDay(for: Date())
        return PetInstance(speciesId: "test", nickname: "T", startDate: start,
                           trainingLengthDays: length,
                           lastSettledDay: cal.date(byAdding: .day, value: -1, to: start)!)
    }

    private var settings: ParentSettings {
        ParentSettings(pinHash: "x", pinSalt: "y")
    }

    func testDailyRecurrence() {
        let idx = gen.occurrenceDayIndexes(for: makeTemplate(id: "d", frequency: .daily), trainingLengthDays: 21)
        XCTAssertEqual(idx, Array(0..<21))
    }

    func testWeeklyRecurrence() {
        let idx = gen.occurrenceDayIndexes(for: makeTemplate(id: "w", frequency: .weekly), trainingLengthDays: 21)
        XCTAssertEqual(idx, [0, 7, 14])
    }

    func testMonthlyRecurrenceShortWindow() {
        let idx = gen.occurrenceDayIndexes(for: makeTemplate(id: "m", frequency: .monthly), trainingLengthDays: 21)
        XCTAssertEqual(idx, [0])
    }

    func testYearlyScheduledOnceWhenWindowLongEnough() {
        let idx = gen.occurrenceDayIndexes(for: makeTemplate(id: "y", frequency: .yearly), trainingLengthDays: 21)
        XCTAssertEqual(idx, [0])
    }

    func testYearlySkippedForShortWindow() {
        let idx = gen.occurrenceDayIndexes(for: makeTemplate(id: "y", frequency: .yearly), trainingLengthDays: 5)
        XCTAssertTrue(idx.isEmpty)
    }

    func testBuildTasksCountsForMixedSpecies() {
        let s = species(tasks: [
            makeTemplate(id: "daily1", frequency: .daily),
            makeTemplate(id: "daily2x", frequency: .daily, timesPerDay: 2),
            makeTemplate(id: "weekly1", frequency: .weekly),
            makeTemplate(id: "yearly1", frequency: .yearly)
        ])
        let tasks = gen.buildTasks(for: instance(length: 21), species: s, settings: settings)

        let daily1 = tasks.filter { $0.templateId == "daily1" }.count
        let daily2 = tasks.filter { $0.templateId == "daily2x" }.count
        let weekly = tasks.filter { $0.templateId == "weekly1" }.count
        let yearly = tasks.filter { $0.templateId == "yearly1" }.count

        XCTAssertEqual(daily1, 21)        // once per day
        XCTAssertEqual(daily2, 42)        // twice per day across 21 days
        XCTAssertEqual(weekly, 3)         // days 0, 7, 14
        XCTAssertEqual(yearly, 1)         // single educational occurrence
    }

    func testBuildTasksSortedByDueDate() {
        let s = species(tasks: [makeTemplate(id: "d", frequency: .daily)])
        let tasks = gen.buildTasks(for: instance(length: 7), species: s, settings: settings)
        let dueDates = tasks.map(\.dueAt)
        XCTAssertEqual(dueDates, dueDates.sorted())
    }
}
