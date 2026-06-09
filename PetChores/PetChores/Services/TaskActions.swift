import Foundation
import SwiftData

/// The write-side actions for a single task: Done, Verify, Reject, Snooze
/// (Sections 8 and 11). Centralizes the scoring + notification side effects so the
/// views and the notification handler behave identically.
@MainActor
struct TaskActions {

    var scoring = ScoringService()
    var notifications = NotificationService.shared

    /// Child marks a task done. Awards provisional points, updates wellbeing, cancels
    /// the pending notification. The task waits for verification only if required.
    func markDone(
        _ task: ScheduledTask,
        photoFileName: String? = nil,
        context: ModelContext,
        now: Date = Date()
    ) {
        guard let instance = DataStore.instance(id: task.instanceId, context: context) else { return }
        scoring.applyDone(task: task, instance: instance, now: now)
        task.photoFileName = photoFileName
        task.status = .done
        notifications.cancel(taskId: task.scheduledId)
        DataStore.save(context)
    }

    /// Parent confirms a task happened (Section 11).
    func verify(_ task: ScheduledTask, context: ModelContext, now: Date = Date()) {
        guard task.status == .done,
              let instance = DataStore.instance(id: task.instanceId, context: context) else { return }
        scoring.applyVerified(task: task, instance: instance, now: now)
        task.status = .verified
        DataStore.save(context)
    }

    /// Parent rejects a completion; it returns to pending. We back out the provisional
    /// points and the on-time wellbeing nudge so totals stay honest.
    func reject(_ task: ScheduledTask, context: ModelContext) {
        guard task.status == .done,
              let instance = DataStore.instance(id: task.instanceId, context: context) else { return }

        var points = scoring.basePoints(difficulty: task.difficulty)
        if task.onTime { points += scoring.onTimeBonus }
        instance.carePoints = max(0, instance.carePoints - points)
        if task.isDaily && task.onTime {
            instance.wellbeing = max(0, instance.wellbeing - 1)
        }

        // Remove any attached photo so rejected proof does not linger.
        if let file = task.photoFileName {
            PhotoStore.delete(file)
            task.photoFileName = nil
        }
        task.completedAt = nil
        task.onTime = false
        task.status = .pending
        DataStore.save(context)
    }

    /// Snooze a task 30 minutes, up to the cap (Section 7). Returns false if at the cap.
    @discardableResult
    func snooze(_ task: ScheduledTask, context: ModelContext) -> Bool {
        guard task.snoozeCount < NotificationService.maxSnoozes else { return false }
        task.snoozeCount += 1
        DataStore.save(context)
        let nickname = DataStore.instance(id: task.instanceId, context: context)?.nickname ?? "Your pet"
        notifications.snooze(task: task, nickname: nickname)
        return true
    }
}
