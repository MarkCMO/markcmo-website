import Foundation

/// Encouraging-only badges (Section 11 Rewards). No badges for neglect.
struct BadgeService {

    struct Badge: Identifiable {
        let id: String
        let title: String
        let symbol: String
        let earned: Bool
        let detail: String
    }

    func badges(for instance: PetInstance, tasks: [ScheduledTask]) -> [Badge] {
        let verifiedOrDone = tasks.filter { $0.isHandled }
        let cleaningDone = verifiedOrDone.filter { containsAny($0, ["clean", "scoop", "litter", "cage", "coop", "spot"]) }.count
        let poopDone = verifiedOrDone.filter { containsAny($0, ["poop", "scoop", "litter", "spot_clean"]) }.count
        let mealsMissed = tasks.filter { $0.status == .missed && containsAny($0, ["feed", "food", "hay"]) }.count
        let anyMealDue = tasks.contains { containsAny($0, ["feed", "food", "hay"]) }

        return [
            Badge(
                id: "first_week",
                title: "First Week Done",
                symbol: "calendar.badge.checkmark",
                earned: instance.longestStreakDays >= 7,
                detail: "Keep a 7 day streak."
            ),
            Badge(
                id: "never_missed_meal",
                title: "Never Missed a Meal",
                symbol: "fork.knife.circle.fill",
                earned: anyMealDue && mealsMissed == 0 && instance.currentStreakDays >= 1,
                detail: "Never miss a feeding."
            ),
            Badge(
                id: "poop_patrol",
                title: "Poop Patrol Pro",
                symbol: "trash.circle.fill",
                earned: poopDone >= 5,
                detail: "Handle 5 cleanups."
            ),
            Badge(
                id: "clean_cage",
                title: "Clean Cage Champion",
                symbol: "sparkles",
                earned: cleaningDone >= 4,
                detail: "Finish 4 cleaning tasks."
            ),
            Badge(
                id: "trusted",
                title: "Trusted Friend",
                symbol: "heart.circle.fill",
                earned: instance.trust >= 50,
                detail: "Reach 50 Trust."
            ),
            Badge(
                id: "point_collector",
                title: "Point Collector",
                symbol: "star.circle.fill",
                earned: instance.carePoints >= 500,
                detail: "Earn 500 Care Points."
            )
        ]
    }

    private func containsAny(_ task: ScheduledTask, _ needles: [String]) -> Bool {
        let haystack = (task.templateId + " " + task.label).lowercased()
        return needles.contains { haystack.contains($0) }
    }
}
