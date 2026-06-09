import UIKit
import UserNotifications

/// Handles notification presentation and action responses (Section 7). UIKit is used
/// here only because notification delegate handling is cleanest in an AppDelegate, as
/// the spec allows.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task { @MainActor in
            NotificationService.shared.registerCategories()
            await NotificationService.shared.refreshAuthorizationStatus()
        }
        return true
    }

    /// Show reminders even while the app is in the foreground.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .list])
    }

    /// Route Done / Snooze taps back into the app via NotificationService.onAction.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        if let idString = userInfo["scheduledId"] as? String, let id = UUID(uuidString: idString) {
            let kind: NotificationActionPayload.Kind?
            switch response.actionIdentifier {
            case NotificationService.doneActionId:
                kind = .done
            case NotificationService.snoozeActionId:
                kind = .snooze
            default:
                kind = nil   // tapping the notification body just opens the app
            }
            if let kind {
                Task { @MainActor in
                    NotificationService.shared.onAction?(NotificationActionPayload(kind: kind, scheduledId: id))
                }
            }
        }
        completionHandler()
    }
}
