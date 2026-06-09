import Foundation
import SwiftData

/// Generates ScheduledTask rows for a pet instance across its training window
/// (Section 6). The full window is built at creation time; a top-up pass keeps the
/// schedule complete after reinstalls or edits without ever deleting history.
struct ScheduleGenerator {

    var calendar: Calendar = .current

    /// Build all scheduled tasks for the instance's whole training window.
    func buildTasks(
        for instance: PetInstance,
        species: PetSpecies,
        settings: ParentSettings
    ) -> [ScheduledTask] {
        var tasks: [ScheduledTask] = []
        let startDay = calendar.startOfDay(for: instance.startDate)
        let length = max(instance.trainingLengthDays, 1)

        for template in species.tasks {
            let occurrences = occurrenceDayIndexes(
                for: template,
                trainingLengthDays: length
            )
            for dayIndex in occurrences {
                guard let day = calendar.date(byAdding: .day, value: dayIndex, to: startDay) else { continue }
                let slotTimes = slotTimes(for: template, settings: settings)
                for slot in slotTimes {
                    let due = TimeUtilities.date(on: day, atTime: slot, calendar: calendar)
                    tasks.append(makeTask(template: template, instance: instance, dueAt: due))
                }
            }
        }
        return tasks.sorted { $0.dueAt < $1.dueAt }
    }

    /// Insert the full schedule and return the created rows.
    @discardableResult
    func generateAndInsert(
        for instance: PetInstance,
        species: PetSpecies,
        settings: ParentSettings,
        context: ModelContext
    ) -> [ScheduledTask] {
        let tasks = buildTasks(for: instance, species: species, settings: settings)
        for t in tasks { context.insert(t) }
        return tasks
    }

    /// Idempotent top-up: insert any rows that the full schedule expects but that are
    /// not already present (deduped by templateId + dueAt). Used by the midnight and
    /// foreground maintenance pass (Section 6, Section 7).
    @discardableResult
    func topUpMissing(
        for instance: PetInstance,
        species: PetSpecies,
        settings: ParentSettings,
        existing: [ScheduledTask],
        context: ModelContext
    ) -> [ScheduledTask] {
        let existingKeys = Set(existing.map { key(templateId: $0.templateId, dueAt: $0.dueAt) })
        let expected = buildTasks(for: instance, species: species, settings: settings)
        var inserted: [ScheduledTask] = []
        for t in expected where !existingKeys.contains(key(templateId: t.templateId, dueAt: t.dueAt)) {
            context.insert(t)
            inserted.append(t)
        }
        return inserted
    }

    // MARK: - Recurrence

    /// Which day indexes (0-based from startDate) a template fires on.
    func occurrenceDayIndexes(for template: CareTaskTemplate, trainingLengthDays length: Int) -> [Int] {
        switch template.frequencyKind {
        case .daily:
            return Array(0..<length)
        case .weekly:
            return stride(from: 0, to: length, by: 7).map { $0 }
        case .monthly:
            // Every 30 days, anchored to start. Likely fires at most once in a short window.
            return stride(from: 0, to: length, by: 30).map { $0 }
        case .yearly:
            // Educational one-time-during-training event near the start. Skip entirely if
            // the window is shorter than 7 days.
            return length < 7 ? [] : [0]
        }
    }

    // MARK: - Slots

    /// Slot times for a single day. Daily tasks with timesPerDay > 1 get spread out.
    private func slotTimes(for template: CareTaskTemplate, settings: ParentSettings) -> [String] {
        guard template.frequencyKind == .daily, template.timesPerDay > 1 else {
            return [template.suggestedTime]
        }
        return TimeUtilities.dailySlotTimes(
            count: template.timesPerDay,
            firstSlot: template.suggestedTime,
            wake: settings.quietHoursEnd,
            quietStart: settings.quietHoursStart
        )
    }

    // MARK: - Helpers

    private func makeTask(template: CareTaskTemplate, instance: PetInstance, dueAt: Date) -> ScheduledTask {
        ScheduledTask(
            instanceId: instance.instanceId,
            templateId: template.id,
            dueAt: dueAt,
            status: .pending,
            label: template.label,
            difficulty: template.difficulty,
            frequency: template.frequencyKind,
            realAction: template.realAction,
            consequence: template.consequence
        )
    }

    private func key(templateId: String, dueAt: Date) -> String {
        // Minute-granularity key is enough to dedupe identical slots.
        let t = Int(dueAt.timeIntervalSince1970 / 60)
        return "\(templateId)#\(t)"
    }
}
