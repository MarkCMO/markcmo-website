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
}
