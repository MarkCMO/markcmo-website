import Foundation

/// Builds the grown-up oversight alerts: messages addressed to the parent about how the
/// child is keeping up with a pet (missed chores, a pet slipping, a strike taken), as
/// opposed to the child-facing reminders in CareEscalation. Pure and deterministic so the
/// tiers and wording can be unit tested; MaintenanceService schedules them as parent
/// notifications and Parent Mode shows the current ones in-app.
enum ParentAlert {

    /// How much the parent needs to step in, low to high.
    enum Urgency: Int, Comparable {
        case none = 0
        case info = 1       // a few missed chores; a nudge would help
        case concern = 2    // the pet is slipping under the child's care
        case action = 3     // the pet is at real risk; step in now

        static func < (a: Urgency, b: Urgency) -> Bool { a.rawValue < b.rawValue }
    }

    /// The care signals that describe how the child is doing with one pet.
    struct CareSignals: Equatable {
        var missedToday: Int = 0
        var missedThisWeek: Int = 0
        var strikes: Int = 0
        var maxStrikes: Int = 5
        var wellbeing: Int = 80
        var worstNeed: Double = 0   // highest real-time need (0...1)
        var isLost: Bool = false
    }

    /// A single parent-addressed message.
    struct Alert: Equatable {
        let urgency: Urgency
        let title: String
        let body: String
    }

    /// The single most-pressing parent alert for a pet, or nil when the child is keeping up.
    static func current(childName: String, petName: String, signals s: CareSignals) -> Alert? {
        let warning = s.maxStrikes > 0 && s.strikes >= s.maxStrikes - 1
        let atLimit = s.maxStrikes > 0 && s.strikes >= s.maxStrikes

        if s.isLost || atLimit {
            return Alert(urgency: .action,
                         title: "\(petName) needs you and \(childName)",
                         body: "\(petName) is at the limit under \(childName)'s care. Step in together now before it is too late.")
        }
        if warning || s.wellbeing < 40 || s.worstNeed >= 0.9 {
            return Alert(urgency: .concern,
                         title: "\(petName) is slipping",
                         body: "\(childName) is falling behind on \(petName)'s care. A hand from a grown-up would help \(petName) right now.")
        }
        if s.missedToday >= 2 || s.strikes > 0 || s.missedThisWeek >= 4 || s.worstNeed >= 0.5 {
            return Alert(urgency: .info,
                         title: "\(childName) missed some of \(petName)'s care",
                         body: missedSummary(childName: childName, petName: petName, signals: s))
        }
        return nil
    }

    /// A short, specific summary of what is being missed, for the info tier.
    private static func missedSummary(childName: String, petName: String, signals s: CareSignals) -> String {
        if s.missedToday >= 2 {
            return "\(childName) has missed \(s.missedToday) of \(petName)'s chores today. A reminder might help."
        }
        if s.missedThisWeek >= 4 {
            return "\(childName) has missed \(s.missedThisWeek) of \(petName)'s chores this week. Worth a check-in."
        }
        if s.strikes > 0 {
            return "\(petName) has picked up a strike under \(childName)'s care. Catching up now keeps \(petName) safe."
        }
        return "\(petName)'s care is starting to slip with \(childName). A quick check-in would help."
    }
}
