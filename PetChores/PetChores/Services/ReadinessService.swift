import Foundation

/// Computes the Readiness Report (Section 12). Advisory only; the verdict text makes
/// clear this is a guide for the family, not a guarantee.
struct ReadinessService {

    var calendar: Calendar = .current

    struct MissedTask: Identifiable {
        var id: String { label }
        let label: String
        let count: Int
    }

    struct Report {
        let petNickname: String
        let speciesName: String
        let completionRate: Double      // 0...1
        let onTimeRate: Double          // 0...1
        let longestStreak: Int
        let topMissed: [MissedTask]
        let hardestHandledLabel: String?
        let hardestHandledRate: Double  // 0...1
        let totalDue: Int
        let totalCompleted: Int
        let verdict: String

        var completionPercent: Int { Int((completionRate * 100).rounded()) }
        var onTimePercent: Int { Int((onTimeRate * 100).rounded()) }
        var hardestHandledPercent: Int { Int((hardestHandledRate * 100).rounded()) }
    }

    /// Build the report for an instance from its tasks. `now` bounds which tasks count
    /// as "due".
    func makeReport(
        instance: PetInstance,
        species: PetSpecies,
        tasks: [ScheduledTask],
        now: Date = Date()
    ) -> Report {
        let dueTasks = tasks.filter { $0.dueAt <= now }
        let totalDue = dueTasks.count
        let completed = dueTasks.filter { $0.isHandled }
        let totalCompleted = completed.count

        let completionRate = totalDue == 0 ? 0 : Double(totalCompleted) / Double(totalDue)
        let onTimeRate = totalCompleted == 0 ? 0 : Double(completed.filter { $0.onTime }.count) / Double(totalCompleted)

        // Top 3 most-missed task labels.
        var missedCounts: [String: Int] = [:]
        for t in dueTasks where t.status == .missed {
            missedCounts[t.label, default: 0] += 1
        }
        let topMissed = missedCounts
            .sorted { $0.value > $1.value }
            .prefix(3)
            .map { MissedTask(label: $0.key, count: $0.value) }

        // Hardest task handled well: among difficulty 3+ labels, highest completion rate.
        let hard = dueTasks.filter { $0.difficulty >= 3 }
        var bestLabel: String?
        var bestRate = 0.0
        let grouped = Dictionary(grouping: hard, by: { $0.label })
        for (label, group) in grouped {
            let rate = Double(group.filter { $0.isHandled }.count) / Double(group.count)
            if rate > bestRate {
                bestRate = rate
                bestLabel = label
            }
        }

        return Report(
            petNickname: instance.nickname,
            speciesName: species.name,
            completionRate: completionRate,
            onTimeRate: onTimeRate,
            longestStreak: instance.longestStreakDays,
            topMissed: Array(topMissed),
            hardestHandledLabel: bestLabel,
            hardestHandledRate: bestRate,
            totalDue: totalDue,
            totalCompleted: totalCompleted,
            verdict: verdict(forCompletionRate: completionRate)
        )
    }

    /// Plain-language verdict band (Section 12).
    func verdict(forCompletionRate rate: Double) -> String {
        let pct = rate * 100
        switch pct {
        case 85...:
            return "Strong. Your child showed real consistency."
        case 70..<85:
            return "Good. A little reminder help may still be needed."
        case 50..<70:
            return "Getting there. More practice recommended before a real pet."
        default:
            return "Not yet. Try a lower difficulty pet or a longer practice run."
        }
    }

    /// Shareable plain-text summary for export (Section 12).
    func exportText(_ r: Report) -> String {
        var lines: [String] = []
        lines.append("Pet Chores Readiness Report")
        lines.append("Pet: \(r.petNickname) (\(r.speciesName))")
        lines.append("")
        lines.append("Completion rate: \(r.completionPercent)% (\(r.totalCompleted) of \(r.totalDue) tasks)")
        lines.append("On-time rate: \(r.onTimePercent)%")
        lines.append("Longest streak: \(r.longestStreak) days")
        if let hardest = r.hardestHandledLabel {
            lines.append("Hardest task handled well: \(hardest) at \(r.hardestHandledPercent)%")
        }
        if !r.topMissed.isEmpty {
            lines.append("")
            lines.append("Most often missed:")
            for m in r.topMissed {
                lines.append("  - \(m.label): missed \(m.count) times")
            }
        }
        lines.append("")
        lines.append("Verdict: \(r.verdict)")
        lines.append("")
        lines.append("This report is a guide for your family, not a guarantee. A real pet is a long term commitment for the whole household.")
        return lines.joined(separator: "\n")
    }
}
