import Foundation

// Value types that mirror the structure of pet_database.json (Sections 3.1 to 3.3).
// Supply and CareTaskTemplate are plain Codable structs. SwiftData can persist arrays
// of Codable structs as composite attributes, so PetSpecies (the @Model) stores them
// directly without needing separate model tables or relationships. This keeps the
// schema simple and matches the read-only nature of the seed data.

/// A single supply line item with its cost and how often it recurs.
struct Supply: Codable, Hashable, Identifiable {
    var item: String
    var cost: Double
    var frequency: String   // raw "once" | "monthly" | "yearly"

    // Composed id so the same item name in different frequencies stays distinct.
    var id: String { "\(item)|\(frequency)|\(cost)" }

    var frequencyKind: SupplyFrequency {
        SupplyFrequency(rawValue: frequency) ?? .once
    }
}

/// A care task template as defined in the seed (Section 3.3).
struct CareTaskTemplate: Codable, Hashable, Identifiable {
    var id: String
    var label: String
    var frequency: String   // raw "daily" | "weekly" | "monthly" | "yearly"
    var timesPerDay: Int
    var suggestedTime: String   // "HH:mm" 24 hour
    var difficulty: Int         // 1 to 5
    var realAction: String
    var consequence: String

    var frequencyKind: TaskFrequency {
        TaskFrequency(rawValue: frequency) ?? .daily
    }
}

/// One species entry as decoded straight from the JSON. Mapped into the PetSpecies
/// @Model by SeedLoader on first launch.
struct SeedSpecies: Codable, Identifiable {
    var id: String
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
}

/// Root object of pet_database.json.
struct PetDatabase: Codable {
    var schemaVersion: String
    var currency: String
    var note: String
    var pets: [SeedSpecies]
}
