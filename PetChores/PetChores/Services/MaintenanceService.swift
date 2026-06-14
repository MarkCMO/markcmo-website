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

            // 3b. Advance the real-time care needs and apply the strike consequence.
            advanceNeeds(instance: instance, species: species, settings: settings, now: now)
        }

        // 4. Save.
        DataStore.save(context)

        // 5. Reschedule notifications from all pending tasks across active instances.
        rescheduleNotifications(context: context, settings: settings)
    }

    /// Advance the pet's real-time needs (yard waste, hunger, tank fouling) by the time
    /// elapsed since the last tick, then apply the strike consequence when a need is
    /// critical. Demo mode multiplies the elapsed time so it plays out in a minute.
    func advanceNeeds(instance: PetInstance, species: PetSpecies, settings: ParentSettings, now: Date) {
        let intensity = settings.consequenceIntensity
        guard intensity != .off, !instance.isLost else { return }

        let last = instance.lastNeedTickAt ?? instance.startDate
        var hours = now.timeIntervalSince(last) / 3600.0
        guard hours > 0 else { return }
        if settings.demoMode { hours *= 1200.0 } // ~1 real minute fills a need at normal

        let habitat = Habitat(category: species.category, id: species.id)
        let hasWaste = (habitat == .backyard || habitat == .coop)
        let isAquatic = (habitat == .aquarium)

        let needs = ConsequenceService.Needs(hunger: instance.hungerLevel,
                                             waste: instance.wasteLevel,
                                             tank: instance.tankFoulLevel)
        let next = ConsequenceService.tick(needs, elapsedHours: hours, intensity: intensity,
                                           hasWaste: hasWaste, isAquatic: isAquatic)
        instance.hungerLevel = next.hunger
        instance.wasteLevel = next.waste
        instance.tankFoulLevel = next.tank
        instance.lastNeedTickAt = now

        // A critical, unmet need costs a strike; a good care streak earns one back.
        let delta = ConsequenceService.dailyStrikeDelta(criticalNeglect: next.anyCritical,
                                                        careStreakDays: instance.currentStreakDays,
                                                        intensity: intensity)
        if delta != 0 {
            instance.strikes = ConsequenceService.applyStrikeDelta(instance.strikes, delta: delta,
                                                                   maxStrikes: settings.maxStrikes)
            if ConsequenceService.outcome(strikes: instance.strikes, maxStrikes: settings.maxStrikes,
                                          permanentLossEnabled: settings.permanentLossEnabled) == .lost {
                instance.lostAt = now
            }
        }
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
