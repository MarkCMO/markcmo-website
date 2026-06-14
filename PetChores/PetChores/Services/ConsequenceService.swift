import Foundation

/// The "serious lessons" engine (Phase 2). Pet needs climb in real time while a chore is
/// outstanding (the hybrid model on top of the real-world schedule). A day of critical
/// neglect costs a strike; consecutive cared-for days earn strikes back. At the parent's
/// strike limit the pet reaches a terminal outcome: a recoverable scare, or, if the parent
/// has opted in, permanent loss. Parents set the intensity (off -> harsh) so consequences
/// can be introduced gradually.
///
/// Everything here is pure and deterministic so it can be unit tested without a device;
/// MaintenanceService applies it to the SwiftData models on launch / foreground / midnight.
enum ConsequenceService {

    /// The real-time needs that can slip toward critical between scheduled chores.
    struct Needs: Equatable {
        var hunger: Double = 0   // every animal
        var waste: Double = 0    // yard animals (dog, chicken, rabbit run, ...)
        var tank: Double = 0     // aquatic animals (fish, betta, turtle)

        /// Clamp helper so levels always stay in 0...1.
        static func clamp(_ v: Double) -> Double { min(1.0, max(0.0, v)) }

        var anyCritical: Bool { hunger >= 1.0 || waste >= 1.0 || tank >= 1.0 }
    }

    /// What the child / parent sees for the pet right now.
    enum Outcome: Equatable {
        case safe       // comfortably below the limit
        case warning    // one strike away from the scare
        case scare      // at the limit, but recoverable with good care
        case lost       // permanently gone
    }

    /// Advance the real-time needs by `elapsedHours`. Only the needs relevant to the
    /// species climb (the others are passed through). Off intensity never accrues.
    static func tick(_ needs: Needs,
                     elapsedHours: Double,
                     intensity: ConsequenceIntensity,
                     hasWaste: Bool,
                     isAquatic: Bool) -> Needs {
        guard intensity != .off, elapsedHours > 0 else { return needs }
        let step = intensity.needRatePerHour * elapsedHours
        var out = needs
        out.hunger = Needs.clamp(out.hunger + step)
        if hasWaste { out.waste = Needs.clamp(out.waste + step) }
        if isAquatic { out.tank = Needs.clamp(out.tank + step) }
        return out
    }

    /// How much faster the bladder fills than the slow needs (hunger, mess). A pet needs to
    /// be let out well before its bowl is empty.
    static let reliefRateMultiplier = 2.5

    /// Advance a yard animal's bladder by `elapsedHours`. Returns the new level and whether
    /// it overflowed into an accident (a puddle). On an accident the bladder empties and the
    /// caller adds the puddle to the pet's mess. Off intensity never fills the bladder.
    static func advanceRelief(_ relief: Double,
                              elapsedHours: Double,
                              intensity: ConsequenceIntensity) -> (relief: Double, accident: Bool) {
        guard intensity != .off, elapsedHours > 0 else { return (relief, false) }
        let rate = intensity.needRatePerHour * reliefRateMultiplier
        let next = relief + rate * elapsedHours
        if next >= 1.0 { return (0.0, true) }
        return (Needs.clamp(next), false)
    }

    /// The net change to a pet's strike count for one settled day.
    /// +1 when the day was critically neglected; -1 when a redemption milestone is reached
    /// (a care streak that is an exact multiple of the intensity's regain cadence); else 0.
    /// Off intensity never changes strikes.
    static func dailyStrikeDelta(criticalNeglect: Bool,
                                 careStreakDays: Int,
                                 intensity: ConsequenceIntensity) -> Int {
        guard intensity != .off else { return 0 }
        if criticalNeglect { return 1 }
        let cadence = intensity.streakDaysToRegainStrike
        if cadence > 0, careStreakDays > 0, careStreakDays % cadence == 0 {
            return -1
        }
        return 0
    }

    /// Apply a delta to the current strikes, clamped to 0...maxStrikes.
    static func applyStrikeDelta(_ current: Int, delta: Int, maxStrikes: Int) -> Int {
        min(max(0, current + delta), max(0, maxStrikes))
    }

    /// Resolve what state the pet is in for a given strike count.
    static func outcome(strikes: Int,
                        maxStrikes: Int,
                        permanentLossEnabled: Bool) -> Outcome {
        if maxStrikes <= 0 { return .safe }
        if strikes >= maxStrikes {
            return permanentLossEnabled ? .lost : .scare
        }
        if strikes >= maxStrikes - 1 { return .warning }
        return .safe
    }
}
