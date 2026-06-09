import Foundation
import SwiftData

/// Thin convenience layer over ModelContext for the fetches the app does repeatedly.
/// Keeps query predicates in one place. All methods are best-effort and return empty
/// or nil rather than throwing into the UI.
enum DataStore {

    // MARK: - Species

    static func allSpecies(_ context: ModelContext) -> [PetSpecies] {
        let descriptor = FetchDescriptor<PetSpecies>(sortBy: [SortDescriptor(\.difficulty), SortDescriptor(\.name)])
        return (try? context.fetch(descriptor)) ?? []
    }

    static func species(id: String, context: ModelContext) -> PetSpecies? {
        let descriptor = FetchDescriptor<PetSpecies>(predicate: #Predicate { $0.id == id })
        return (try? context.fetch(descriptor))?.first
    }

    // MARK: - Instances

    static func allInstances(_ context: ModelContext) -> [PetInstance] {
        let descriptor = FetchDescriptor<PetInstance>(sortBy: [SortDescriptor(\.startDate, order: .reverse)])
        return (try? context.fetch(descriptor)) ?? []
    }

    static func activeInstances(_ context: ModelContext) -> [PetInstance] {
        allInstances(context).filter { $0.isActive }
    }

    static func instance(id: UUID, context: ModelContext) -> PetInstance? {
        let descriptor = FetchDescriptor<PetInstance>(predicate: #Predicate { $0.instanceId == id })
        return (try? context.fetch(descriptor))?.first
    }

    // MARK: - Tasks

    static func tasks(for instanceId: UUID, context: ModelContext) -> [ScheduledTask] {
        let descriptor = FetchDescriptor<ScheduledTask>(
            predicate: #Predicate { $0.instanceId == instanceId },
            sortBy: [SortDescriptor(\.dueAt)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    static func task(id: UUID, context: ModelContext) -> ScheduledTask? {
        let descriptor = FetchDescriptor<ScheduledTask>(predicate: #Predicate { $0.scheduledId == id })
        return (try? context.fetch(descriptor))?.first
    }

    static func allTasks(_ context: ModelContext) -> [ScheduledTask] {
        let descriptor = FetchDescriptor<ScheduledTask>(sortBy: [SortDescriptor(\.dueAt)])
        return (try? context.fetch(descriptor)) ?? []
    }

    /// Tasks awaiting parent verification across all pets.
    static func tasksAwaitingVerification(_ context: ModelContext) -> [ScheduledTask] {
        let doneRaw = TaskStatus.done.rawValue
        let descriptor = FetchDescriptor<ScheduledTask>(
            predicate: #Predicate { $0.statusRaw == doneRaw },
            sortBy: [SortDescriptor(\.completedAt, order: .reverse)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    // MARK: - Budget

    static func budgetEntries(for instanceId: UUID, context: ModelContext) -> [BudgetEntry] {
        let descriptor = FetchDescriptor<BudgetEntry>(
            predicate: #Predicate { $0.instanceId == instanceId },
            sortBy: [SortDescriptor(\.date)]
        )
        return (try? context.fetch(descriptor)) ?? []
    }

    // MARK: - Singletons

    static func parentSettings(_ context: ModelContext) -> ParentSettings? {
        (try? context.fetch(FetchDescriptor<ParentSettings>()))?.first
    }

    static func childProfile(_ context: ModelContext) -> ChildProfile? {
        (try? context.fetch(FetchDescriptor<ChildProfile>()))?.first
    }

    // MARK: - Onboarding state

    /// Onboarding is complete once a child profile, parent settings, and at least one
    /// pet instance exist.
    static func isOnboardingComplete(_ context: ModelContext) -> Bool {
        childProfile(context) != nil
            && parentSettings(context) != nil
            && !allInstances(context).isEmpty
    }

    /// A lookup of instanceId to nickname for notification text.
    static func nicknameMap(_ context: ModelContext) -> [UUID: String] {
        var map: [UUID: String] = [:]
        for instance in allInstances(context) {
            map[instance.instanceId] = instance.nickname
        }
        return map
    }

    static func save(_ context: ModelContext) {
        try? context.save()
    }
}
