import SwiftUI
import SwiftData

@main
struct PetChoresApp: App {

    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    @StateObject private var store = StoreService()
    @StateObject private var notifications = NotificationService.shared

    let container: ModelContainer

    init() {
        // Build the SwiftData container for every model. iOS 17+ (see README for the
        // iOS 16 / Core Data note). If the on-disk store cannot open, fall back to an
        // in-memory store so the app still launches rather than crashing.
        let schema = Schema([
            PetSpecies.self,
            PetInstance.self,
            ScheduledTask.self,
            BudgetEntry.self,
            ChildProfile.self,
            ParentSettings.self
        ])
        do {
            container = try ModelContainer(for: schema)
        } catch {
            let memoryConfig = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
            // If even this fails it is a true programmer error; let it crash with a
            // clear message rather than limp along in an undefined state.
            container = try! ModelContainer(for: schema, configurations: memoryConfig)
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(notifications)
        }
        .modelContainer(container)
    }
}
