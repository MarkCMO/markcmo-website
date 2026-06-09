import Foundation
import SwiftData

/// Seeded species catalog entry (Section 3.1). Read only at runtime: it is inserted
/// once on first launch from pet_database.json and never edited by the app.
///
/// supplies and tasks are arrays of Codable value structs (Supply, CareTaskTemplate),
/// which SwiftData stores as composite attributes. That avoids a web of relationship
/// tables for data that is fixed and bundled.
@Model
final class PetSpecies {
    @Attribute(.unique) var id: String
    var name: String
    var category: String
    var difficulty: Int
    var recommendedMinAge: Int
    var lifespanYears: String
    var blurb: String
    var supplies: [Supply]
    var startupCost: Double
    var monthlyCost: Double
    var yearlyCost: Double
    var tasks: [CareTaskTemplate]

    init(
        id: String,
        name: String,
        category: String,
        difficulty: Int,
        recommendedMinAge: Int,
        lifespanYears: String,
        blurb: String,
        supplies: [Supply],
        startupCost: Double,
        monthlyCost: Double,
        yearlyCost: Double,
        tasks: [CareTaskTemplate]
    ) {
        self.id = id
        self.name = name
        self.category = category
        self.difficulty = difficulty
        self.recommendedMinAge = recommendedMinAge
        self.lifespanYears = lifespanYears
        self.blurb = blurb
        self.supplies = supplies
        self.startupCost = startupCost
        self.monthlyCost = monthlyCost
        self.yearlyCost = yearlyCost
        self.tasks = tasks
    }

    /// Build a model from a decoded seed entry.
    convenience init(seed: SeedSpecies) {
        self.init(
            id: seed.id,
            name: seed.name,
            category: seed.category,
            difficulty: seed.difficulty,
            recommendedMinAge: seed.recommendedMinAge,
            lifespanYears: seed.lifespanYears,
            blurb: seed.blurb,
            supplies: seed.supplies,
            startupCost: seed.startupCost,
            monthlyCost: seed.monthlyCost,
            yearlyCost: seed.yearlyCost,
            tasks: seed.tasks
        )
    }

    // Convenience groupings.
    var dailyTasks: [CareTaskTemplate] { tasks.filter { $0.frequencyKind == .daily } }
    var onceSupplies: [Supply] { supplies.filter { $0.frequencyKind == .once } }
    var monthlySupplies: [Supply] { supplies.filter { $0.frequencyKind == .monthly } }
    var yearlySupplies: [Supply] { supplies.filter { $0.frequencyKind == .yearly } }

    /// SF Symbol stand-in per category until real per pet art ships (Section 14).
    var iconName: String {
        switch category {
        case "mammal":        return "pawprint.fill"
        case "small_mammal":  return "hare.fill"
        case "aquatic":       return "fish.fill"
        case "bird":          return "bird.fill"
        case "reptile":       return "tortoise.fill"
        case "poultry":       return "bird"
        case "invertebrate":  return "ladybug.fill"
        default:              return "pawprint"
        }
    }
}
