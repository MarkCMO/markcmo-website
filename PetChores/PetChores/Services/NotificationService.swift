import Foundation
import UserNotifications

/// Wraps UNUserNotificationCenter for local-only reminders (Section 7). Schedules the
/// nearest upcoming tasks within the iOS 64-pending cap, respects quiet hours, and
/// registers the actionable "PET_TASK" category with Done and Snooze actions.
@MainActor
final class NotificationService: ObservableObject {

    static let shared = NotificationService()

    static let categoryId = "PET_TASK"
    static let doneActionId = "PET_TASK_DONE"
    static let snoozeActionId = "PET_TASK_SNOOZE"
    static let maxPending = 64
    static let maxSnoozes = 2

    /// Published so views can show the "reminders are off" banner (Section 15).
    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined

    /// Set by the app at launch. Called when the user taps a notification action.
    /// Marked @MainActor since the handler mutates the SwiftData store on the main actor.
    var onAction: (@MainActor (NotificationActionPayload) -> Void)?

    private let center = UNUserNotificationCenter.current()

    private init() {}

    // MARK: - Setup

    /// Register the actionable category once at launch.
    func registerCategories() {
        let done = UNNotificationAction(
            identifier: Self.doneActionId,
            title: "Done",
            options: []
        )
        let snooze = UNNotificationAction(
            identifier: Self.snoozeActionId,
            title: "Snooze 30 min",
            options: []
        )
        let category = UNNotificationCategory(
            identifier: Self.categoryId,
            actions: [done, snooze],
            intentIdentifiers: [],
            options: []
        )
        center.setNotificationCategories([category])
    }

    /// Ask for permission. Call with a clear pre-prompt shown first (Section 7).
    func requestAuthorization() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            await refreshAuthorizationStatus()
            return granted
        } catch {
            await refreshAuthorizationStatus()
            return false
        }
    }

    func refreshAuthorizationStatus() async {
        let settings = await center.notificationSettings()
        authorizationStatus = settings.authorizationStatus
    }

    // MARK: - Scheduling

    /// Replace the pending queue with the nearest upcoming tasks plus any escalating care
    /// reminders. `nicknames` maps an instanceId to the pet nickname for the text.
    func rescheduleAll(pendingTasks: [ScheduledTask],
                       nicknames: [UUID: String],
                       settings: ParentSettings,
                       careAlerts: [PendingCareAlert] = []) {
        center.removeAllPendingNotificationRequests()

        let now = Date()
        // Reserve a few slots for the escalation reminders so a busy schedule never crowds
        // out the "your pet needs you now" warning.
        let taskCap = max(0, Self.maxPending - careAlerts.count)
        // Only future, pending tasks. Shift any that fall in quiet hours.
        let upcoming = pendingTasks
            .filter { $0.status == .pending }
            .map { task -> (task: ScheduledTask, fireDate: Date) in
                let shifted = TimeUtilities.shiftedOutOfQuietHours(
                    task.dueAt,
                    start: settings.quietHoursStart,
                    end: settings.quietHoursEnd
                )
                return (task, max(shifted, task.dueAt))
            }
            .filter { $0.fireDate > now }
            .sorted { $0.fireDate < $1.fireDate }
            .prefix(taskCap)

        for entry in upcoming {
            schedule(task: entry.task, fireDate: entry.fireDate, nickname: nicknames[entry.task.instanceId] ?? "Your pet")
        }

        scheduleCareAlerts(careAlerts, settings: settings, now: now)
    }

    /// Schedule one escalating care reminder per slipping pet, ~45 minutes out (shifted past
    /// quiet hours). A stable per-pet id means a fresh maintenance pass replaces the old
    /// reminder with the current, possibly louder, tier rather than stacking duplicates.
    private func scheduleCareAlerts(_ alerts: [PendingCareAlert], settings: ParentSettings, now: Date) {
        for pending in alerts {
            let base = now.addingTimeInterval(45 * 60)
            let fire = max(
                TimeUtilities.shiftedOutOfQuietHours(base, start: settings.quietHoursStart, end: settings.quietHoursEnd),
                base
            )
            let content = UNMutableNotificationContent()
            content.title = pending.alert.title
            content.body = pending.alert.body
            content.sound = .default
            let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fire)
            let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
            let id = "care-escalation-\(pending.instanceId.uuidString)"
            center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
        }
    }

    /// Schedule a single calendar-trigger notification for a task.
    func schedule(task: ScheduledTask, fireDate: Date, nickname: String) {
        let content = UNMutableNotificationContent()
        content.title = "\(nickname) needs you"
        content.body = "Time to \(task.label.lowercased()). \(shortNudge(for: task))"
        content.sound = .default
        content.categoryIdentifier = Self.categoryId
        content.userInfo = ["scheduledId": task.scheduledId.uuidString]

        let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: fireDate)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let request = UNNotificationRequest(identifier: task.scheduledId.uuidString, content: content, trigger: trigger)
        center.add(request)
    }

    /// Cancel a task's pending notification when it is completed (Section 7).
    func cancel(taskId: UUID) {
        center.removePendingNotificationRequests(withIdentifiers: [taskId.uuidString])
    }

    /// Reschedule a task 30 minutes later for a Snooze action.
    func snooze(task: ScheduledTask, nickname: String) {
        let fire = Date().addingTimeInterval(30 * 60)
        cancel(taskId: task.scheduledId)
        schedule(task: task, fireDate: fire, nickname: nickname)
    }

    private func shortNudge(for task: ScheduledTask) -> String {
        // Use the first sentence of the real action as a gentle nudge.
        if let firstSentence = task.realAction.split(separator: ".").first {
            return String(firstSentence) + "."
        }
        return task.realAction
    }
}

/// An escalating care reminder to schedule for one pet (built by CareEscalation).
struct PendingCareAlert {
    let instanceId: UUID
    let alert: CareEscalation.Alert
}

/// Payload passed from the AppDelegate notification handler to the app.
struct NotificationActionPayload {
    enum Kind { case done, snooze }
    let kind: Kind
    let scheduledId: UUID
}
