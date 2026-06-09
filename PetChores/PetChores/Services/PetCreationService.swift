import Foundation
import SwiftData

/// Creates a fully wired pet instance: the PetInstance row, its whole-window schedule,
/// and its startup + monthly budget entries (Sections 5, 6, 10). Then reschedules
/// notifications so reminders begin immediately.
@MainActor
struct PetCreationService {

    var calendar: Calendar = .current
    var generator = ScheduleGenerator()
    var budget = BudgetService()

    @discardableResult
    func create(
        speciesId: String,
        nickname: String,
        trainingLengthDays: Int,
        context: ModelContext,
        now: Date = Date()
    ) -> PetInstance? {
        guard let species = DataStore.species(id: speciesId, context: context),
              let settings = DataStore.parentSettings(context) else { return nil }

        let startDay = calendar.startOfDay(for: now)
        // lastSettledDay is the day before start, so the start day itself gets settled
        // once it elapses.
        let dayBeforeStart = calendar.date(byAdding: .day, value: -1, to: startDay) ?? startDay

        let instance = PetInstance(
            speciesId: speciesId,
            nickname: nickname.trimmingCharacters(in: .whitespacesAndNewlines),
            startDate: now,
            trainingLengthDays: trainingLengthDays,
            lastSettledDay: dayBeforeStart
        )
        context.insert(instance)

        generator.generateAndInsert(for: instance, species: species, settings: settings, context: context)
        budget.seedEntries(for: instance, species: species, context: context)

        DataStore.save(context)

        // Begin reminders right away.
        MaintenanceService().rescheduleNotifications(context: context, settings: settings)
        return instance
    }

    /// Archive a finished pet (Section 11 Manage Pets). Keeps history; stops reminders.
    func archive(_ instance: PetInstance, context: ModelContext) {
        instance.isActive = false
        // Cancel its pending notifications.
        for task in DataStore.tasks(for: instance.instanceId, context: context) where task.status == .pending {
            NotificationService.shared.cancel(taskId: task.scheduledId)
        }
        DataStore.save(context)
    }

    /// Fully delete a pet, its tasks, budget, and photos. Lets a free user start fresh.
    func delete(_ instance: PetInstance, context: ModelContext) {
        let tasks = DataStore.tasks(for: instance.instanceId, context: context)
        for task in tasks {
            if let file = task.photoFileName { PhotoStore.delete(file) }
            NotificationService.shared.cancel(taskId: task.scheduledId)
            context.delete(task)
        }
        for entry in DataStore.budgetEntries(for: instance.instanceId, context: context) {
            context.delete(entry)
        }
        context.delete(instance)
        DataStore.save(context)
    }
}
