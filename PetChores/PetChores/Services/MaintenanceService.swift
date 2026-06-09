import Foundation
import SwiftData

/// The maintenance pass that keeps state correct over time (Sections 6, 7, 9, 15).
/// Runs on app launch, on foreground, and via the midnight scheduling top-up. Safe to
/// run repeatedly. Never deletes history.
///
/// Order matters:
///   1. Top up any missing scheduled rows for active instances (handles reinstalls).
///   2. Flip overdue pending tasks to missed.
///   3. Settle every fully elapsed, unsettled day (wellbeing, streak, trust).
///   4. Save.
///   5. Reschedule the nearest 64 notifications.
@MainActor
struct MaintenanceService {

    var scoring = ScoringService()
    var generator = ScheduleGenerator()

    func run(context: ModelContext, now: Date = Date()) {
        guard let settings = DataStore.parentSettings(context) else { return }
        let instances = DataStore.activeInstances(context)

        for instance in instances {
            guard let species = DataStore.species(id: instance.speciesId, context: context) else { continue }
            let existing = DataStore.tasks(for: instance.instanceId, context: context)

            // 1. Top up missing rows.
            generator.topUpMissing(
                for: instance,
                species: species,
                settings: settings,
                existing: existing,
                context: context
            )

            // Refetch after possible inserts.
            let tasks = DataStore.tasks(for: instance.instanceId, context: context)

            // 2. Flip overdue pending to missed.
            for task in tasks where task.status == .pending && scoring.isOverdue(task, now: now) {
                task.status = .missed
            }

            // 3. Settle elapsed days.
            let settled = DataStore.tasks(for: instance.instanceId, context: context)
            scoring.settleElapsedDays(instance: instance, tasks: settled, now: now)
        }

        // 4. Save.
        DataStore.save(context)

        // 5. Reschedule notifications from all pending tasks across active instances.
        rescheduleNotifications(context: context, settings: settings)
    }

    /// Rebuild the pending notification queue (the nearest 64) from current data.
    func rescheduleNotifications(context: ModelContext, settings: ParentSettings) {
        let activeIds = Set(DataStore.activeInstances(context).map { $0.instanceId })
        let pending = DataStore.allTasks(context).filter {
            $0.status == .pending && activeIds.contains($0.instanceId)
        }
        let nicknames = DataStore.nicknameMap(context)
        NotificationService.shared.rescheduleAll(pendingTasks: pending, nicknames: nicknames, settings: settings)
    }
}
