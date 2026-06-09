import Foundation
import SwiftUI
import SwiftData
import Observation

/// Holds the in-progress onboarding answers and creates the child profile, parent
/// settings, and first pet at the end (Section 5).
@Observable
final class OnboardingViewModel {

    enum Step: Int, CaseIterable {
        case welcome
        case whoPlaying
        case parentSetup
        case pickPet
        case meetPet
        case nameAndLength
    }

    var step: Step = .welcome

    // Child (Screen 2).
    var childName: String = ""
    var childAge: Int = 8
    var avatar: String = OnboardingViewModel.avatars.first ?? "person.circle.fill"

    // Parent (Screen 3).
    var pin: String = ""
    var pinConfirm: String = ""

    // Pet choice (Screens 4 to 6).
    var selectedSpeciesId: String?
    var nickname: String = ""
    var trainingLengthDays: Int?       // nil until the parent explicitly taps a choice

    static let avatars = [
        "person.circle.fill", "face.smiling.fill", "star.circle.fill",
        "heart.circle.fill", "bolt.circle.fill", "leaf.circle.fill"
    ]

    static let trainingLengthOptions = [7, 14, 21, 30]
    static let suggestedTrainingLength = 21

    // MARK: - Validation

    var canLeaveWhoPlaying: Bool {
        !childName.trimmingCharacters(in: .whitespaces).isEmpty && (4...14).contains(childAge)
    }

    var canLeaveParentSetup: Bool {
        PINManager.isValidFormat(pin) && pin == pinConfirm
    }

    var canFinish: Bool {
        selectedSpeciesId != nil
            && !nickname.trimmingCharacters(in: .whitespaces).isEmpty
            && trainingLengthDays != nil
    }

    func selectedSpecies(in context: ModelContext) -> PetSpecies? {
        guard let id = selectedSpeciesId else { return nil }
        return DataStore.species(id: id, context: context)
    }

    // MARK: - Finalize

    /// Persist everything and create the first pet. Returns true on success.
    @MainActor
    func finalize(context: ModelContext) -> Bool {
        guard canFinish,
              let speciesId = selectedSpeciesId,
              let length = trainingLengthDays else { return false }

        // Child profile.
        let child = ChildProfile(
            name: childName.trimmingCharacters(in: .whitespaces),
            age: childAge,
            avatar: avatar
        )
        context.insert(child)

        // Parent settings with a salted PIN hash.
        let salt = PINManager.newSalt()
        let settings = ParentSettings(
            pinHash: PINManager.hash(pin: pin, salt: salt),
            pinSalt: salt,
            defaultTrainingLengthDays: length
        )
        context.insert(settings)
        DataStore.save(context)

        // First pet (schedule + budget wired by the service).
        let created = PetCreationService().create(
            speciesId: speciesId,
            nickname: nickname,
            trainingLengthDays: length,
            context: context
        )
        return created != nil
    }
}
