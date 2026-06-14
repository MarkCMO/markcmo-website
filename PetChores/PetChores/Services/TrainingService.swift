import Foundation

/// A single trick a child can teach their pet (sit, stay, fetch, ...). Which tricks are
/// on offer depends on the kind of animal: a dog learns Sit and Fetch, a parakeet learns
/// Step Up and Whistle Back, a fish learns to follow a finger to its feeding spot.
struct Trick: Identifiable, Equatable {
    let id: String
    let name: String
    let icon: String   // SF Symbol

    init(_ id: String, _ name: String, _ icon: String) {
        self.id = id; self.name = name; self.icon = icon
    }
}

/// The trick-training mechanic (the "trainer" side of owning a pet). Teaching a trick takes
/// several short practice sessions; finishing one builds the pet's trust and earns care
/// points. Pure and deterministic so it can be unit tested without a device.
enum TrainingService {

    /// How much of the current trick one practice session completes. ~3 sessions per trick.
    static let progressPerSession = 0.34
    /// Trust earned each time a trick is fully learned.
    static let trustPerTrick = 8
    /// Care points earned for a single practice session.
    static let pointsPerSession = 4

    /// The trick list for a species, in teaching order, keyed off its habitat so each kind
    /// of animal gets a believable curriculum.
    static func tricks(speciesId: String, category: String) -> [Trick] {
        let habitat = Habitat(category: category, id: speciesId)
        switch habitat {
        case .backyard where speciesId == "cat":
            return [Trick("come", "Come", "hand.wave.fill"),
                    Trick("sit", "Sit", "figure.seated.side"),
                    Trick("highfive", "High Five", "hand.raised.fill"),
                    Trick("spin", "Spin", "arrow.clockwise"),
                    Trick("fetch", "Fetch", "figure.run")]
        case .backyard:   // dog
            return [Trick("sit", "Sit", "figure.seated.side"),
                    Trick("stay", "Stay", "hand.raised.fill"),
                    Trick("come", "Come", "hand.wave.fill"),
                    Trick("shake", "Shake", "pawprint.fill"),
                    Trick("fetch", "Fetch", "figure.run"),
                    Trick("rollover", "Roll Over", "arrow.clockwise")]
        case .cage:       // rabbit, hamster, guinea pig
            return [Trick("handtame", "Hand Tame", "hand.point.up.left.fill"),
                    Trick("come", "Come", "hand.wave.fill"),
                    Trick("stand", "Stand Up", "arrow.up"),
                    Trick("spin", "Spin", "arrow.clockwise"),
                    Trick("hoop", "Hop a Hoop", "circle")]
        case .birdcage:   // parakeet
            return [Trick("stepup", "Step Up", "hand.point.up.left.fill"),
                    Trick("wave", "Wave", "hand.wave.fill"),
                    Trick("turn", "Turn Around", "arrow.clockwise"),
                    Trick("whistle", "Whistle Back", "music.note")]
        case .coop:       // chicken
            return [Trick("come", "Come", "hand.wave.fill"),
                    Trick("target", "Target Peck", "target"),
                    Trick("jump", "Jump Up", "arrow.up"),
                    Trick("spin", "Spin", "arrow.clockwise")]
        case .aquarium:   // fish, betta, turtle
            return [Trick("follow", "Follow the Finger", "hand.point.up.left.fill"),
                    Trick("targetfeed", "Target Feed", "target"),
                    Trick("hoop", "Swim a Hoop", "circle")]
        case .terrarium:  // gecko, tortoise, tarantula
            return [Trick("handfeed", "Hand Feed", "hand.point.up.left.fill"),
                    Trick("target", "Target Touch", "target"),
                    Trick("follow", "Follow Target", "arrow.right")]
        }
    }

    /// The next trick still to be taught, or nil when the pet has learned them all.
    static func nextTrick(speciesId: String, category: String, learned: [String]) -> Trick? {
        tricks(speciesId: speciesId, category: category).first { !learned.contains($0.id) }
    }

    /// Apply one practice session to a (progress, learned) pair and return the new state,
    /// plus whether a trick was just finished (so the caller can award trust).
    /// Finishing carries any overshoot into the next trick's progress.
    static func practice(progress: Double,
                         learned: [String],
                         speciesId: String,
                         category: String) -> (progress: Double, learned: [String], finished: Trick?) {
        guard let current = nextTrick(speciesId: speciesId, category: category, learned: learned) else {
            return (1.0, learned, nil)   // nothing left to teach
        }
        let advanced = progress + progressPerSession
        if advanced >= 1.0 {
            var nowLearned = learned
            nowLearned.append(current.id)
            let carryOver = min(advanced - 1.0, progressPerSession)
            // If that was the last trick, park progress at full; otherwise carry the spillover.
            let more = nextTrick(speciesId: speciesId, category: category, learned: nowLearned) != nil
            return (more ? carryOver : 1.0, nowLearned, current)
        }
        return (advanced, learned, nil)
    }
}
