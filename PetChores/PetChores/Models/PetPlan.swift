import Foundation

/// Monetization model: one pet is always free to train; parents subscribe monthly to
/// train more pets at once. The plans are auto-renewable subscriptions in a single group;
/// when more than one is somehow active, the highest plan wins. "Charge per pet, per
/// month" is offered as tiers the parent chooses from.
enum PetPlan: String, CaseIterable, Identifiable {
    case free = "free"
    case three = "petchores.plan.three"
    case unlimited = "petchores.plan.unlimited"

    var id: String { rawValue }

    /// How many pets may be ACTIVE (in training) at once on this plan.
    var maxPets: Int {
        switch self {
        case .free:      return 1
        case .three:     return 3
        case .unlimited: return Int.max
        }
    }

    var title: String {
        switch self {
        case .free:      return "One Pet"
        case .three:     return "Three Pets"
        case .unlimited: return "Unlimited Pets"
        }
    }

    var blurb: String {
        switch self {
        case .free:      return "Train one pet at a time, free forever."
        case .three:     return "Train up to three pets at once."
        case .unlimited: return "As many pets as your family can handle."
        }
    }

    /// Higher rank wins when resolving the active entitlement.
    var rank: Int {
        switch self {
        case .free:      return 0
        case .three:     return 1
        case .unlimited: return 2
        }
    }

    /// The auto-renewable subscription product ids (the free plan has none).
    static let productIds: [String] = [PetPlan.three.rawValue, PetPlan.unlimited.rawValue]

    static func plan(forProductId id: String) -> PetPlan? { PetPlan(rawValue: id) }
}
