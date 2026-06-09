import XCTest
@testable import PetChores

/// Validates the bundled pet_database.json decodes and is internally consistent
/// (Section 3, Section 4). The JSON is added to the test bundle in project.yml so this
/// test does not need an app test host.
final class SeedContentTests: XCTestCase {

    private func loadDatabase() throws -> PetDatabase {
        let bundle = Bundle(for: SeedContentTests.self)
        return try SeedLoader.decodeDatabase(bundle: bundle)
    }

    func testSeedDecodes() throws {
        let db = try loadDatabase()
        XCTAssertEqual(db.schemaVersion, "1.0")
        XCTAssertEqual(db.currency, "USD")
        XCTAssertFalse(db.pets.isEmpty)
    }

    func testEverySpeciesHasTasksAndUniqueIds() throws {
        let db = try loadDatabase()
        var seenSpeciesIds = Set<String>()
        var seenTaskIds = Set<String>()

        for pet in db.pets {
            XCTAssertFalse(pet.name.isEmpty, "Species \(pet.id) has no name")
            XCTAssertFalse(pet.tasks.isEmpty, "Species \(pet.id) has no tasks")
            XCTAssertTrue((1...5).contains(pet.difficulty), "Species \(pet.id) difficulty out of range")
            XCTAssertTrue(seenSpeciesIds.insert(pet.id).inserted, "Duplicate species id \(pet.id)")

            for task in pet.tasks {
                XCTAssertTrue((1...5).contains(task.difficulty), "Task \(task.id) difficulty out of range")
                XCTAssertNotNil(TaskFrequency(rawValue: task.frequency), "Task \(task.id) has bad frequency")
                XCTAssertGreaterThanOrEqual(task.timesPerDay, 1, "Task \(task.id) timesPerDay < 1")
                // suggestedTime must parse as HH:mm.
                let parts = task.suggestedTime.split(separator: ":")
                XCTAssertEqual(parts.count, 2, "Task \(task.id) suggestedTime malformed")
                XCTAssertTrue(seenTaskIds.insert(task.id).inserted, "Duplicate task id \(task.id)")
            }

            for supply in pet.supplies {
                XCTAssertNotNil(SupplyFrequency(rawValue: supply.frequency), "Supply for \(pet.id) bad frequency")
                XCTAssertGreaterThan(supply.cost, 0, "Supply for \(pet.id) non-positive cost")
            }
        }
    }
}
