import SwiftUI

/// The environment a pet is shown in. Derived from the species category, with a couple
/// of per-species overrides (a turtle is a reptile but lives in water).
enum Habitat {
    case backyard     // dogs, cats
    case aquarium     // fish, betta, turtle (semi-aquatic)
    case terrarium    // gecko, tortoise, tarantula
    case birdcage     // parakeet
    case cage         // hamster, guinea pig, rabbit
    case coop         // chickens

    init(category: String, id: String) {
        switch id {
        case "turtle":
            self = .aquarium
            return
        default:
            break
        }
        switch category {
        case "mammal":        self = .backyard
        case "small_mammal":  self = .cage
        case "aquatic":       self = .aquarium
        case "bird":          self = .birdcage
        case "reptile":       self = .terrarium
        case "poultry":       self = .coop
        case "invertebrate":  self = .terrarium
        default:              self = .backyard
        }
    }

    /// A short friendly label for accessibility.
    var label: String {
        switch self {
        case .backyard:  return "in the backyard"
        case .aquarium:  return "in the tank"
        case .terrarium: return "in the terrarium"
        case .birdcage:  return "in the cage"
        case .cage:      return "in the cage"
        case .coop:      return "in the coop"
        }
    }

    // MARK: - Mess and cleanup (every habitat has its own kind of mess to clean)

    /// True when the mess is a fouling tank rather than a solid mess to scoop. Aquatic only.
    var usesTank: Bool { self == .aquarium }

    /// Label for the cleanup button shown when the pet's space gets messy.
    var cleanupTitle: String {
        switch self {
        case .backyard:  return "Scoop the poop!"
        case .coop:      return "Muck out the coop!"
        case .cage:      return "Clean the cage!"
        case .birdcage:  return "Clean the cage tray!"
        case .terrarium: return "Spot-clean the habitat!"
        case .aquarium:  return "Freshen the tank!"
        }
    }

    /// SF Symbol for the cleanup button.
    var cleanupIcon: String {
        usesTank ? "drop.fill" : "trash.fill"
    }

    /// The warning under the cleanup button.
    var cleanupHint: String {
        switch self {
        case .backyard:  return "The yard needs cleaning before it reaches the neighbor!"
        case .coop:      return "The coop needs mucking out before the hens get sick."
        case .cage:      return "The bedding is soiled. Clean it before your pet gets sick."
        case .birdcage:  return "The cage tray is dirty. Clean it before your bird gets sick."
        case .terrarium: return "The habitat is soiled. Spot-clean it before your pet gets sick."
        case .aquarium:  return "The water is getting dirty. Clean it before the fish gets sick."
        }
    }

    /// Furry and feathered animals need grooming; tank and hard-shell animals do not.
    var needsGrooming: Bool {
        switch self {
        case .backyard, .cage, .birdcage, .coop: return true
        case .aquarium, .terrarium:               return false
        }
    }

    /// Active animals need exercise and play; tank and terrarium animals do not.
    var needsExercise: Bool {
        switch self {
        case .backyard, .cage, .birdcage, .coop: return true
        case .aquarium, .terrarium:               return false
        }
    }
}
