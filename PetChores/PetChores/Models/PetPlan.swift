import Foundation

/// Monetization model: a 3-day free trial, then a subscription is required to train pets.
/// Two single-pet billing options (weekly / monthly) and an unlimited-pets plan, all in one
/// auto-renewable subscription group. The highest active plan wins. `.none` means no active
/// subscription (trial not started or lapsed): the paywall is shown.
enum PetPlan: String, CaseIterable, Identifiable {
    case none = "none"
    case weekly = "petchores.weekly"        // 1 pet, $1.99/week, 3-day free trial
    case monthly = "petchores.monthly"      // 1 pet, $4.99/month, 3-day free trial
    case unlimited = "petchores.unlimited"  // unlimited pets, $19.99/month

    var id: String { rawValue }

    /// How many pets may be ACTIVE (in training) at once on this plan.
    var maxPets: Int {
        switch self {
        case .none:      return 0
        case .weekly:    return 1
        case .monthly:   return 1
        case .unlimited: return Int.max
        }
    }

    var title: String {
        switch self {
        case .none:      return "No plan"
        case .weekly:    return "One Pet"
        case .monthly:   return "One Pet"
        case .unlimited: return "Unlimited Pets"
        }
    }

    var blurb: String {
        switch self {
        case .none:      return "Start a 3-day free trial to train your first pet."
        case .weekly:    return "Train one pet at a time, billed weekly."
        case .monthly:   return "Train one pet at a time, billed monthly."
        case .unlimited: return "Train as many pets at once as your family can handle."
        }
    }

    /// Higher rank wins when resolving the active entitlement (weekly and monthly are the
    /// same access level: one pet).
    var rank: Int {
        switch self {
        case .none:      return 0
        case .weekly:    return 1
        case .monthly:   return 1
        case .unlimited: return 2
        }
    }

    /// The auto-renewable subscription product ids (the `.none` state has none).
    static let productIds: [String] = [PetPlan.weekly.rawValue,
                                        PetPlan.monthly.rawValue,
                                        PetPlan.unlimited.rawValue]

    static func plan(forProductId id: String) -> PetPlan? { PetPlan(rawValue: id) }
}
