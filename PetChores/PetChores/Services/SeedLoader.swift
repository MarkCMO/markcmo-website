import Foundation
import SwiftData

/// Loads pet_database.json from the bundle and seeds the local store once (Section 4).
/// Never crashes on a malformed seed; surfaces a friendly error instead (Section 4,
/// Section 17 acceptance criteria).
enum SeedLoader {

    static let seededFlagKey = "seeded_v1"

    enum SeedError: LocalizedError {
        case fileMissing
        case decodeFailed(String)

        var errorDescription: String? {
            switch self {
            case .fileMissing:
                return "We could not find the pet data file inside the app."
            case .decodeFailed(let detail):
                return "We could not read the pet data file. \(detail)"
            }
        }
    }

    /// Decode the bundled database. Throws SeedError on any problem.
    static func decodeDatabase(bundle: Bundle = .main) throws -> PetDatabase {
        guard let url = bundle.url(forResource: "pet_database", withExtension: "json") else {
            throw SeedError.fileMissing
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(PetDatabase.self, from: data)
        } catch {
            throw SeedError.decodeFailed(error.localizedDescription)
        }
    }

    /// Run once on first launch. Inserts every species and sets the seeded flag.
    /// Returns nil on success, or a SeedError to display on failure.
    @MainActor
    static func seedIfNeeded(context: ModelContext, defaults: UserDefaults = .standard) -> Error? {
        if defaults.bool(forKey: seededFlagKey) {
            // Already seeded; nothing to do unless the catalog is somehow empty.
            if (try? context.fetchCount(FetchDescriptor<PetSpecies>())) ?? 0 > 0 {
                return nil
            }
            // Seeded flag set but no rows (rare reinstall edge). Fall through to reseed.
        }

        let database: PetDatabase
        do {
            database = try decodeDatabase()
        } catch {
            return error
        }

        // Insert species not already present (idempotent).
        let existing = (try? context.fetch(FetchDescriptor<PetSpecies>())) ?? []
        let existingIds = Set(existing.map { $0.id })
        for seed in database.pets where !existingIds.contains(seed.id) {
            context.insert(PetSpecies(seed: seed))
        }

        do {
            try context.save()
            defaults.set(true, forKey: seededFlagKey)
            return nil
        } catch {
            return SeedError.decodeFailed(error.localizedDescription)
        }
    }
}
