import XCTest
@testable import PetChores

/// Verifies budget totals and the first-year projection (Section 10).
final class BudgetServiceTests: XCTestCase {

    private let budget = BudgetService()

    private func species() -> PetSpecies {
        PetSpecies(
            id: "test", name: "Test", category: "mammal", difficulty: 2, recommendedMinAge: 6,
            lifespanYears: "1-2", blurb: "",
            supplies: [
                Supply(item: "Cage", cost: 100, frequency: "once"),
                Supply(item: "Bowl", cost: 20, frequency: "once"),
                Supply(item: "Food", cost: 30, frequency: "monthly"),
                Supply(item: "Vet", cost: 80, frequency: "yearly")
            ],
            startupCost: 120, monthlyCost: 30, yearlyCost: 0, tasks: []
        )
    }

    func testMonthlyTotalUsesSpeciesFigure() {
        XCTAssertEqual(budget.monthlyTotal(species: species()), 30)
    }

    func testFirstYearProjection() {
        // startup 120 + (30 * 12) + yearly supplies (80) = 560
        XCTAssertEqual(budget.firstYearProjection(species: species()), 560)
    }

    func testStartupTotalFromEntries() {
        let id = UUID()
        let entries = [
            BudgetEntry(instanceId: id, label: "Cage", amount: 100, type: .startup, date: Date()),
            BudgetEntry(instanceId: id, label: "Bowl", amount: 20, type: .startup, date: Date()),
            BudgetEntry(instanceId: id, label: "Food", amount: 30, type: .recurring, date: Date())
        ]
        XCTAssertEqual(budget.startupTotal(entries: entries), 120)
    }

    func testSupplyFrequencyGroupings() {
        let s = species()
        XCTAssertEqual(s.onceSupplies.count, 2)
        XCTAssertEqual(s.monthlySupplies.count, 1)
        XCTAssertEqual(s.yearlySupplies.count, 1)
    }
}
