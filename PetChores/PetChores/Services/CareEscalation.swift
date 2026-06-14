import Foundation

/// Builds the escalating reminder ladder for a pet whose needs are slipping. As a real
/// need (a full yard, a fouling tank, an empty bowl) climbs and strikes pile up, the
/// reminders ramp from a gentle nudge to an urgent plea to a final animal-control style
/// warning. Pure and deterministic so the wording and tiers can be unit tested; the
/// NotificationService schedules whatever this returns.
enum CareEscalation {

    /// How loud the reminder is, low to high.
    enum Urgency: Int, Comparable {
        case calm = 0     // nothing pressing
        case nudge = 1    // a need is starting to climb
        case urgent = 2   // there is a real mess / empty bowl now
        case severe = 3   // one slip from losing the pet

        static func < (a: Urgency, b: Urgency) -> Bool { a.rawValue < b.rawValue }
    }

    /// A single scheduled message.
    struct Alert: Equatable {
        let urgency: Urgency
        let title: String
        let body: String
    }

    /// The single most-urgent alert that applies right now, or nil when all is well.
    /// `needLevel` is the highest of the pet's real-time needs (0...1). When `socialPressure`
    /// is off, the most-severe tier drops the neighbor / animal-control framing.
    static func current(needLevel: Double,
                        strikes: Int,
                        maxStrikes: Int,
                        nickname: String,
                        habitat: Habitat,
                        socialPressure: Bool = true) -> Alert? {
        let warning = maxStrikes > 0 && strikes >= maxStrikes - 1

        if warning || needLevel >= 0.95 {
            let tail = socialPressure ? " \(habitat.severeLine)" : ""
            return Alert(urgency: .severe,
                         title: "\(nickname) needs you now",
                         body: "Last chance: keep neglecting \(nickname) and you could lose them.\(tail)")
        }
        if needLevel >= 0.7 {
            return Alert(urgency: .urgent,
                         title: "\(nickname) really needs care",
                         body: habitat.urgentLine(nickname))
        }
        if needLevel >= 0.4 || strikes > 0 {
            return Alert(urgency: .nudge,
                         title: "\(nickname) needs you",
                         body: habitat.nudgeLine(nickname))
        }
        return nil
    }

    /// Every tier that applies now, calm-to-severe, for staggering several reminders over
    /// time. Always includes the current tier and the gentler tiers beneath it.
    static func ladder(needLevel: Double,
                       strikes: Int,
                       maxStrikes: Int,
                       nickname: String,
                       habitat: Habitat,
                       socialPressure: Bool = true) -> [Alert] {
        guard let top = current(needLevel: needLevel, strikes: strikes, maxStrikes: maxStrikes,
                                nickname: nickname, habitat: habitat, socialPressure: socialPressure) else { return [] }
        var rungs: [Alert] = []
        if top.urgency >= .nudge {
            rungs.append(Alert(urgency: .nudge, title: "\(nickname) needs you", body: habitat.nudgeLine(nickname)))
        }
        if top.urgency >= .urgent {
            rungs.append(Alert(urgency: .urgent, title: "\(nickname) really needs care", body: habitat.urgentLine(nickname)))
        }
        if top.urgency >= .severe {
            rungs.append(top)
        }
        return rungs
    }
}

/// Habitat-specific wording so the reminders read like the real animal: a dog needs to be
/// let out, a fish tank needs cleaning, a coop needs mucking.
extension Habitat {
    func nudgeLine(_ name: String) -> String {
        switch self {
        case .backyard:  return "Time to let \(name) out and check the yard."
        case .coop:      return "\(name)'s coop could use a look."
        case .aquarium:  return "\(name)'s water is starting to cloud up."
        case .cage:      return "\(name)'s cage could use a tidy."
        case .birdcage:  return "\(name)'s cage tray could use a tidy."
        case .terrarium: return "\(name)'s habitat could use a spot-clean."
        }
    }

    func urgentLine(_ name: String) -> String {
        switch self {
        case .backyard:  return "There is a mess in the yard for \(name). Clean it before it reaches the neighbor."
        case .coop:      return "The coop needs mucking out for \(name)."
        case .aquarium:  return "\(name)'s tank is getting foul. Freshen the water before \(name) gets sick."
        case .cage:      return "\(name)'s cage needs cleaning now."
        case .birdcage:  return "\(name)'s cage needs cleaning now."
        case .terrarium: return "\(name)'s habitat needs cleaning now."
        }
    }

    var severeLine: String {
        switch self {
        case .backyard:  return "The neighbor is fed up and talking about calling animal control."
        case .coop:      return "Neglect this bad gets animals taken away."
        case .aquarium:  return "A fouled tank can be fatal."
        case .cage, .birdcage, .terrarium: return "Neglect this bad gets animals taken away."
        }
    }
}
