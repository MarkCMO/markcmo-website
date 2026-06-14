import Foundation

/// A pet's life stage, derived from how grown it is.
enum GrowthStage: String {
    case baby
    case young
    case grown

    /// A friendly, species-agnostic label for the status line.
    var label: String {
        switch self {
        case .baby:  return "Baby"
        case .young: return "Growing up"
        case .grown: return "Full grown"
        }
    }
}

/// Pets grow up the way real ones do: a little every day they are well cared for, and not
/// at all on the days they are neglected. Growth drives how big the animal is drawn, so a
/// loved pet visibly matures from a tiny newborn into a full-grown adult. Pure and
/// deterministic so it can be unit tested; MaintenanceService applies it over time.
enum GrowthService {

    /// Where a freshly adopted pet starts (a small baby).
    static let newbornGrowth = 0.2

    /// Minimum wellbeing for a pet to keep growing. Below this, neglect stalls growth.
    static let healthyWellbeing = 40

    /// Advance growth by the days elapsed, but only while the pet is reasonably cared for.
    /// `windowDays` is how many well-cared days it takes to go from newborn to full grown.
    static func advance(_ growth: Double, wellbeing: Int, elapsedDays: Double, windowDays: Double) -> Double {
        let clamped = min(1.0, max(0.0, growth))
        guard wellbeing >= healthyWellbeing, elapsedDays > 0, windowDays > 0 else { return clamped }
        return min(1.0, clamped + elapsedDays / windowDays)
    }

    /// The life stage for a growth value.
    static func stage(_ growth: Double) -> GrowthStage {
        switch growth {
        case ..<0.34: return .baby
        case ..<0.75: return .young
        default:      return .grown
        }
    }

    /// How big to draw the animal for a growth value: a baby is about 60% the size of a
    /// full-grown adult, scaling smoothly up to full size.
    static func scale(_ growth: Double) -> Double {
        let g = min(1.0, max(0.0, growth))
        return 0.6 + 0.4 * g
    }
}
