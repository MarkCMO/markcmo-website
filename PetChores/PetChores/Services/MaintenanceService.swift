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

        var careAlerts: [PendingCareAlert] = []
        var parentAlerts: [PendingParentAlert] = []
        let childName = DataStore.childProfile(context)?.name ?? "Your child"

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

            // 3b. Advance the real-time care needs and apply the strike consequence, and
            //     collect the escalating reminder for any pet whose needs are slipping.
            if let alert = advanceNeeds(instance: instance, species: species, settings: settings, now: now) {
                careAlerts.append(alert)
            }

            // 3c. Build the grown-up oversight alert when the child is falling behind.
            if settings.parentCareAlertsEnabled,
               let parent = parentAlert(for: instance, settings: settings, childName: childName,
                                        context: context, now: now) {
                parentAlerts.append(parent)
            }
        }

        // 4. Save.
        DataStore.save(context)

        // 5. Reschedule notifications: pending tasks, the child escalation reminders, and
        //    the grown-up oversight alerts.
        rescheduleNotifications(context: context, settings: settings,
                                careAlerts: careAlerts, parentAlerts: parentAlerts)
    }

    /// Build the parent oversight alert for one pet from the child's recent care record
    /// (missed chores today and this week, strikes, wellbeing, and the worst real-time need).
    func parentAlert(for instance: PetInstance, settings: ParentSettings, childName: String,
                     context: ModelContext, now: Date) -> PendingParentAlert? {
        let cal = Calendar.current
        let startToday = cal.startOfDay(for: now)
        let weekAgo = cal.date(byAdding: .day, value: -7, to: startToday) ?? startToday
        let petTasks = DataStore.tasks(for: instance.instanceId, context: context)
        let missedToday = petTasks.filter { $0.status == .missed && $0.dueAt >= startToday }.count
        let missedWeek = petTasks.filter { $0.status == .missed && $0.dueAt >= weekAgo }.count
        let worst = max(instance.hungerLevel,
                        max(instance.reliefLevel, max(instance.wasteLevel, instance.tankFoulLevel)))

        let signals = ParentAlert.CareSignals(missedToday: missedToday, missedThisWeek: missedWeek,
                                              strikes: instance.strikes, maxStrikes: settings.maxStrikes,
                                              wellbeing: instance.wellbeing, worstNeed: worst,
                                              isLost: instance.isLost)
        guard let alert = ParentAlert.current(childName: childName, petName: instance.nickname,
                                              signals: signals) else { return nil }
        return PendingParentAlert(instanceId: instance.instanceId, alert: alert)
    }

    /// Advance the pet's real-time needs by the time elapsed since the last tick, then apply
    /// the strike consequence when a need is critical, and build the escalating reminder for
    /// the pet's current state. Demo mode multiplies the elapsed time so it plays out in a
    /// minute. Grooming and exercise climb as ordinary daily life (even at Off intensity);
    /// hunger, mess, and tank fouling only carry strike stakes when consequences are on.
    @discardableResult
    func advanceNeeds(instance: PetInstance, species: PetSpecies, settings: ParentSettings, now: Date) -> PendingCareAlert? {
        guard !instance.isLost else { return nil }

        let last = instance.lastNeedTickAt ?? instance.startDate
        var hours = now.timeIntervalSince(last) / 3600.0
        guard hours > 0 else { return nil }
        if settings.demoMode { hours *= 1200.0 } // ~1 real minute fills a need at normal

        let habitat = Habitat(category: species.category, id: species.id)

        // A well-cared pet grows up a little each day; neglect stalls it (handled inside
        // GrowthService via the wellbeing gate). Reuses the same elapsed window as the needs.
        instance.growth = GrowthService.advance(instance.growth, wellbeing: instance.wellbeing,
                                                elapsedDays: hours / 24.0,
                                                windowDays: Double(max(1, instance.trainingLengthDays)))

        // Daily-life needs always climb: a coat gets scruffy, an active pet gets restless.
        // These never lose a pet; they nudge wellbeing and surface "brush me" / "play" prompts.
        if habitat.needsGrooming {
            instance.groomLevel = min(1.0, instance.groomLevel + hours * (1.0 / 96.0))   // ~4 days to scruffy
        }
        if habitat.needsExercise {
            instance.energyLevel = min(1.0, instance.energyLevel + hours * (1.0 / 30.0))  // restless in ~1.25 days
        }

        let intensity = settings.consequenceIntensity
        let isAquatic = habitat.usesTank
        let hasWaste = !isAquatic   // every land habitat makes a solid mess to clean

        if intensity != .off {
            let needs = ConsequenceService.Needs(hunger: instance.hungerLevel,
                                                 waste: instance.wasteLevel,
                                                 tank: instance.tankFoulLevel)
            let next = ConsequenceService.tick(needs, elapsedHours: hours, intensity: intensity,
                                               hasWaste: hasWaste, isAquatic: isAquatic)
            instance.hungerLevel = next.hunger
            instance.wasteLevel = next.waste
            instance.tankFoulLevel = next.tank

            // Yard animals build up a bladder; if it overflows before they are let out, it
            // is an accident that adds to the mess.
            if habitat.needsToGo {
                let relief = ConsequenceService.advanceRelief(instance.reliefLevel,
                                                              elapsedHours: hours, intensity: intensity)
                instance.reliefLevel = relief.relief
                // The overflow only becomes a real mess when the parent has accidents on.
                if relief.accident && settings.accidentsEnabled {
                    instance.wasteLevel = ConsequenceService.Needs.clamp(instance.wasteLevel + 0.4)
                }
            }

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
        instance.lastNeedTickAt = now

        // The escalating reminder reflects the worst real-time need and the strike count.
        let worst = max(instance.hungerLevel,
                        max(instance.reliefLevel, max(instance.wasteLevel, instance.tankFoulLevel)))
        if let alert = CareEscalation.current(needLevel: worst, strikes: instance.strikes,
                                              maxStrikes: settings.maxStrikes,
                                              nickname: instance.nickname, habitat: habitat,
                                              socialPressure: settings.socialPressureEnabled) {
            return PendingCareAlert(instanceId: instance.instanceId, alert: alert)
        }
        return nil
    }

    /// Rebuild the pending notification queue (the nearest 64) from current data, plus any
    /// escalating care reminders for pets whose needs are slipping.
    func rescheduleNotifications(context: ModelContext, settings: ParentSettings,
                                 careAlerts: [PendingCareAlert] = [],
                                 parentAlerts: [PendingParentAlert] = []) {
        let activeIds = Set(DataStore.activeInstances(context).map { $0.instanceId })
        let pending = DataStore.allTasks(context).filter {
            $0.status == .pending && activeIds.contains($0.instanceId)
        }
        let nicknames = DataStore.nicknameMap(context)
        NotificationService.shared.rescheduleAll(pendingTasks: pending, nicknames: nicknames,
                                                 settings: settings, careAlerts: careAlerts,
                                                 parentAlerts: parentAlerts)
    }
}
