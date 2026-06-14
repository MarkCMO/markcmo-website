import SwiftUI
import SwiftData

/// Decides which top-level flow to show and runs the maintenance pass on launch and
/// whenever the app returns to the foreground (Section 15).
struct RootView: View {

    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    @EnvironmentObject private var store: StoreService

    @Query private var children: [ChildProfile]
    @Query private var instances: [PetInstance]
    @Query private var settings: [ParentSettings]

    @State private var seedError: Error?
    @State private var didBootstrap = false

    private var isOnboarded: Bool {
        !children.isEmpty && !instances.isEmpty && !settings.isEmpty
    }

    var body: some View {
        Group {
            if let seedError {
                SeedErrorView(message: seedError.localizedDescription)
            } else if isOnboarded {
                MainTabView()
            } else {
                OnboardingFlow()
            }
        }
        .onAppear(perform: bootstrap)
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                Task { @MainActor in
                    MaintenanceService().run(context: context)
                    await store.refreshEntitlement()
                    await NotificationService.shared.refreshAuthorizationStatus()
                }
            }
        }
    }

    private func bootstrap() {
        guard !didBootstrap else { return }
        didBootstrap = true

        // 1. Seed the catalog once.
        if let error = SeedLoader.seedIfNeeded(context: context) {
            seedError = error
            return
        }

        // 1b. Demo seed for screenshots / UI tests only. Gated by a launch argument,
        // so it never runs in normal use. Lets a tool launch straight into a populated,
        // happy state (Home, Pet, Budget, Rewards) without driving onboarding.
        if ProcessInfo.processInfo.arguments.contains("-uitestSeed") {
            seedDemoForScreenshots()
        }

        // 2. Wire the notification action handler to the store.
        NotificationService.shared.onAction = { payload in
            handleNotificationAction(payload)
        }

        // 3. Start StoreKit and run maintenance.
        Task { @MainActor in
            await store.start()
            MaintenanceService().run(context: context)
        }
    }

    /// Populate a believable, varied, pet-packed state for App Store screenshots:
    /// several animals across different habitats and moods, a happy hero pet, earned
    /// badges, and a chore waiting for a grown-up to verify. No-op if a child profile
    /// already exists. Only ever called under the -uitestSeed launch argument.
    private func seedDemoForScreenshots() {
        guard DataStore.childProfile(context) == nil else { return }
        context.insert(ChildProfile(name: "Sam", age: 9,
                                    avatar: OnboardingViewModel.avatars.first ?? "person.circle.fill"))
        let salt = PINManager.newSalt()
        context.insert(ParentSettings(pinHash: PINManager.hash(pin: "1234", salt: salt),
                                      pinSalt: salt, defaultTrainingLengthDays: 21))
        DataStore.save(context)

        let creator = PetCreationService()
        func make(_ species: String, _ name: String, wellbeing: Int, trust: Int = 0,
                  points: Int = 0, streak: Int = 0, longest: Int = 0, waste: Double = 0) -> PetInstance? {
            guard let pet = creator.create(speciesId: species, nickname: name,
                                           trainingLengthDays: 21, context: context) else { return nil }
            pet.wellbeing = wellbeing
            pet.trust = trust
            pet.carePoints = points
            pet.currentStreakDays = streak
            pet.longestStreakDays = longest
            pet.wasteLevel = waste
            return pet
        }

        // A varied cast for the "many pets / many habitats" shots. The hero (dog) is
        // created last so it is the most recent and shows first on Home.
        _ = make("cat", "Luna", wellbeing: 72, trust: 18, points: 110, streak: 2, longest: 4)        // content
        _ = make("fish", "Bubbles", wellbeing: 32, points: 50)                                       // needs attention
        _ = make("rabbit", "Clover", wellbeing: 86, trust: 24, points: 160, streak: 3, longest: 5)   // happy
        let hero = make("dog", "Rex", wellbeing: 94, trust: 56, points: 640, streak: 6, longest: 9, waste: 0.95) // hero + messy-yard scenario demo

        // Leave a couple of the hero's chores done-but-unverified so Parent Mode ->
        // Verify Tasks has content for that screenshot.
        if let hero {
            let actions = TaskActions()
            for task in DataStore.tasks(for: hero.instanceId, context: context).prefix(2) {
                actions.markDone(task, context: context)
            }
            // Re-assert the showcase stats (markDone nudges them).
            hero.wellbeing = 94
            hero.trust = 56
            hero.carePoints = 640
            hero.currentStreakDays = 6
            hero.longestStreakDays = 9
        }
        DataStore.save(context)
    }

    private func handleNotificationAction(_ payload: NotificationActionPayload) {
        guard let task = DataStore.task(id: payload.scheduledId, context: context) else { return }
        let actions = TaskActions()
        switch payload.kind {
        case .done:
            // A notification Done still requires parent verification later, per spec.
            actions.markDone(task, context: context)
        case .snooze:
            actions.snooze(task, context: context)
        }
    }
}
