import Foundation

/// All scoring, grace-window, wellbeing, trust, and streak math (Sections 8 and 9).
/// Pure functions where possible so the rules are easy to read and test.
///
/// Split of when points/wellbeing are applied:
///  - On Done: base + on-time Care Points are awarded, and an on-time daily task gives
///    +1 wellbeing immediately so the pet reacts the same day.
///  - On Verify: +5 Care Points and +1 Trust.
///  - At day settle (maintenance, once per fully elapsed day): missed-task and
///    zero-day wellbeing penalties, streak update, and +2 Trust per streak day.
/// This split keeps the "app killed for days" recompute deterministic (Section 15):
/// any day that passed without a Done simply never got the +1 and gets penalties at
/// settle.
struct ScoringService {

    var calendar: Calendar = .current

    // MARK: - Grace window (Section 8)

    /// The latest moment a task is still "on time".
    func graceDeadline(for task: ScheduledTask) -> Date {
        switch task.frequency {
        case .daily:
            return task.dueAt.addingTimeInterval(isFeedingOrWater(task) ? 2 * 3600 : 4 * 3600)
        case .weekly, .monthly, .yearly:
            return endOfDay(task.dueAt)
        }
    }

    /// Feeding and water daily tasks get the tighter 2 hour window.
    private func isFeedingOrWater(_ task: ScheduledTask) -> Bool {
        let haystack = (task.templateId + " " + task.label).lowercased()
        for needle in ["feed", "water", "food", "hay", "greens", "veggies", "pellet"] where haystack.contains(needle) {
            return true
        }
        return false
    }

    /// Has the grace window passed with no completion?
    func isOverdue(_ task: ScheduledTask, now: Date) -> Bool {
        now > graceDeadline(for: task)
    }

    /// Was a completion at `completedAt` within the grace window?
    func wasOnTime(_ task: ScheduledTask, completedAt: Date) -> Bool {
        completedAt <= graceDeadline(for: task)
    }

    // MARK: - Care Points (Section 9)

    /// Base points for completing a task = 10 * difficulty (10 to 50).
    func basePoints(difficulty: Int) -> Int {
        10 * max(1, min(difficulty, 5))
    }

    let onTimeBonus = 5
    let verifiedBonus = 5

    // MARK: - Completion effects (applied live)

    /// Mutates the instance and task for a Done action. Returns points awarded.
    @discardableResult
    func applyDone(task: ScheduledTask, instance: PetInstance, now: Date) -> Int {
        let onTime = wasOnTime(task, completedAt: now)
        task.onTime = onTime
        task.completedAt = now

        var points = basePoints(difficulty: task.difficulty)
        if onTime { points += onTimeBonus }
        instance.carePoints += points

        // On-time daily completion nudges wellbeing up immediately.
        if task.isDaily && onTime {
            instance.wellbeing = min(100, instance.wellbeing + 1)
        }
        return points
    }

    /// Mutates the instance for a parent Verify action. Returns points awarded.
    @discardableResult
    func applyVerified(task: ScheduledTask, instance: PetInstance, now: Date) -> Int {
        task.verifiedAt = now
        instance.carePoints += verifiedBonus
        instance.trust = min(100, instance.trust + 1)
        return verifiedBonus
    }

    // MARK: - Day settlement (Section 9)

    /// Settle every fully elapsed, in-window day that has not been settled yet.
    /// `tasks` must be all scheduled tasks for the instance, with overdue rows already
    /// flipped to .missed (the maintenance pass does that first).
    func settleElapsedDays(instance: PetInstance, tasks: [ScheduledTask], now: Date) {
        let today = calendar.startOfDay(for: now)
        let startDay = calendar.startOfDay(for: instance.startDate)
        let endDay = calendar.startOfDay(for: instance.endDate(calendar: calendar))

        var day = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: instance.lastSettledDay)) ?? startDay
        if day < startDay { day = startDay }

        while day < today && day <= endDay {
            settleSingleDay(instance: instance, day: day, tasks: tasks)
            instance.lastSettledDay = day
            guard let next = calendar.date(byAdding: .day, value: 1, to: day) else { break }
            day = next
        }
    }

    private func settleSingleDay(instance: PetInstance, day: Date, tasks: [ScheduledTask]) {
        let dayTasks = tasks.filter { calendar.isDate($0.dueAt, inSameDayAs: day) }
        guard !dayTasks.isEmpty else { return }

        let dailyDue = dayTasks.filter { $0.isDaily }
        let missedDaily = dayTasks.filter { $0.isDaily && $0.status == .missed }.count
        let missedWeekly = dayTasks.filter { $0.frequency == .weekly && $0.status == .missed }.count
        let anyHandled = dayTasks.contains { $0.isHandled }

        // Wellbeing penalties.
        var wb = instance.wellbeing
        wb -= 4 * missedDaily
        wb -= 6 * missedWeekly
        if !anyHandled { wb -= 5 }   // a full day with zero tasks done
        instance.wellbeing = max(0, min(100, wb))

        // Streak: at least 90% of the day's required daily tasks done on time.
        let onTimeDaily = dailyDue.filter { $0.isHandled && $0.onTime }.count
        let ratio = dailyDue.isEmpty ? 1.0 : Double(onTimeDaily) / Double(dailyDue.count)
        if ratio >= 0.9 {
            instance.currentStreakDays += 1
            instance.longestStreakDays = max(instance.longestStreakDays, instance.currentStreakDays)
            instance.trust = min(100, instance.trust + 2)   // +2 Trust per streak day
        } else {
            instance.currentStreakDays = 0
        }
    }

    // MARK: - Helpers

    private func endOfDay(_ date: Date) -> Date {
        let start = calendar.startOfDay(for: date)
        return calendar.date(bySettingHour: 23, minute: 59, second: 59, of: start) ?? date
    }
}
