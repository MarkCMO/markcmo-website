import XCTest
@testable import PetChores

/// Verifies the Readiness Report metrics and verdict bands (Section 12).
final class ReadinessServiceTests: XCTestCase {

    private let service = ReadinessService()
    private let cal = Calendar.current

    func testVerdictBands() {
        XCTAssertEqual(service.verdict(forCompletionRate: 0.90), "Strong. Your child showed real consistency.")
        XCTAssertEqual(service.verdict(forCompletionRate: 0.75), "Good. A little reminder help may still be needed.")
        XCTAssertEqual(service.verdict(forCompletionRate: 0.60), "Getting there. More practice recommended before a real pet.")
        XCTAssertEqual(service.verdict(forCompletionRate: 0.40), "Not yet. Try a lower difficulty pet or a longer practice run.")
    }

    func testVerdictBoundaryAt85() {
        XCTAssertEqual(service.verdict(forCompletionRate: 0.85), "Strong. Your child showed real consistency.")
        XCTAssertEqual(service.verdict(forCompletionRate: 0.70), "Good. A little reminder help may still be needed.")
        XCTAssertEqual(service.verdict(forCompletionRate: 0.50), "Getting there. More practice recommended before a real pet.")
    }

    func testReportMetrics() {
        let now = Date()
        let start = cal.date(byAdding: .day, value: -3, to: now)!
        let inst = PetInstance(speciesId: "dog", nickname: "Rex", startDate: start,
                               trainingLengthDays: 21,
                               lastSettledDay: cal.date(byAdding: .day, value: -1, to: start)!)
        inst.longestStreakDays = 2

        let species = PetSpecies(id: "dog", name: "Dog", category: "mammal", difficulty: 4,
                                 recommendedMinAge: 8, lifespanYears: "10-15", blurb: "",
                                 supplies: [], startupCost: 0, monthlyCost: 0, yearlyCost: 0, tasks: [])

        let past = cal.date(byAdding: .day, value: -1, to: now)!
        func t(_ status: TaskStatus, onTime: Bool, difficulty: Int = 3, label: String = "Feed") -> ScheduledTask {
            ScheduledTask(instanceId: inst.instanceId, templateId: label, dueAt: past, status: status,
                          label: label, difficulty: difficulty, frequency: .daily,
                          realAction: "", consequence: "", onTime: onTime)
        }

        // 4 due: 2 verified (1 on time), 1 done on time, 1 missed.
        let tasks = [
            t(.verified, onTime: true),
            t(.verified, onTime: false),
            t(.done, onTime: true),
            t(.missed, onTime: false)
        ]

        let report = service.makeReport(instance: inst, species: species, tasks: tasks, now: now)
        XCTAssertEqual(report.totalDue, 4)
        XCTAssertEqual(report.totalCompleted, 3)               // verified + done
        XCTAssertEqual(report.completionPercent, 75)           // 3/4
        XCTAssertEqual(report.onTimePercent, 67)               // 2/3 on time, rounded
        XCTAssertEqual(report.longestStreak, 2)
        XCTAssertEqual(report.verdict, service.verdict(forCompletionRate: 0.75))
    }

    func testFutureTasksAreNotCountedAsDue() {
        let now = Date()
        let inst = PetInstance(speciesId: "dog", nickname: "Rex", startDate: now,
                               trainingLengthDays: 21, lastSettledDay: now)
        let species = PetSpecies(id: "dog", name: "Dog", category: "mammal", difficulty: 4,
                                 recommendedMinAge: 8, lifespanYears: "10-15", blurb: "",
                                 supplies: [], startupCost: 0, monthlyCost: 0, yearlyCost: 0, tasks: [])
        let future = now.addingTimeInterval(48 * 3600)
        let t = ScheduledTask(instanceId: inst.instanceId, templateId: "f", dueAt: future,
                              status: .pending, label: "Feed", difficulty: 1, frequency: .daily,
                              realAction: "", consequence: "")
        let report = service.makeReport(instance: inst, species: species, tasks: [t], now: now)
        XCTAssertEqual(report.totalDue, 0)
    }
}
