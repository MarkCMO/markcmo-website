import SwiftUI
import SwiftData
import UIKit

/// Home tab: pet status card plus today's tasks grouped by time of day (Section 11).
struct HomeView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var notifications: NotificationService

    let instance: PetInstance?
    let picker: AnyView

    @Query private var todayTasks: [ScheduledTask]
    @Query private var carriedOverTasks: [ScheduledTask]

    @State private var showGate = false
    @State private var showParentMode = false

    init(instance: PetInstance?, picker: AnyView) {
        self.instance = instance
        self.picker = picker

        let id = instance?.instanceId ?? UUID()
        let start = Calendar.current.startOfDay(for: Date())
        let end = Calendar.current.date(byAdding: .day, value: 1, to: start) ?? start
        _todayTasks = Query(
            filter: #Predicate<ScheduledTask> {
                $0.instanceId == id && $0.dueAt >= start && $0.dueAt < end
            },
            sort: [SortDescriptor(\.dueAt)]
        )

        // Earlier-day misses, shown only when the parent enables carry-over (Section 3.8).
        let missedRaw = TaskStatus.missed.rawValue
        _carriedOverTasks = Query(
            filter: #Predicate<ScheduledTask> {
                $0.instanceId == id && $0.statusRaw == missedRaw && $0.dueAt < start
            },
            sort: [SortDescriptor(\.dueAt)]
        )
    }

    var body: some View {
        Group {
            if let instance, let species = DataStore.species(id: instance.speciesId, context: context) {
                content(instance: instance, species: species)
            } else {
                EmptyHomeState(showParentMode: $showParentMode, showGate: $showGate)
            }
        }
        .navigationTitle("Today")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showGate = true
                } label: {
                    Label("Grown-ups", systemImage: "lock.fill")
                }
            }
        }
        .sheet(isPresented: $showGate) {
            ParentGateView(title: "Parent Mode") { showParentMode = true }
        }
        .sheet(isPresented: $showParentMode) {
            ParentModeView()
        }
    }

    private func content(instance: PetInstance, species: PetSpecies) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                picker

                if notifications.authorizationStatus == .denied {
                    NotificationsOffBanner()
                }

                PetStatusCard(instance: instance, species: species)

                TricksCard(instance: instance, species: species)

                if instance.isTrainingComplete() {
                    TrainingCompleteCallout(instance: instance)
                }

                let carryOver = DataStore.parentSettings(context)?.carryOverMissedTasks ?? false
                if carryOver && !carriedOverTasks.isEmpty {
                    Section {
                        ForEach(carriedOverTasks) { task in
                            NavigationLink {
                                TaskCompletionView(task: task, petNickname: instance.nickname)
                            } label: {
                                TaskRow(task: task)
                            }
                            .buttonStyle(.plain)
                        }
                    } header: {
                        Text("Catch up from earlier")
                            .font(.headline)
                            .padding(.top, 4)
                    }
                }

                ForEach(TimeOfDay.allCases) { slot in
                    let tasks = todayTasks.filter { TimeOfDay.from(date: $0.dueAt) == slot }
                    if !tasks.isEmpty {
                        Section {
                            ForEach(tasks) { task in
                                NavigationLink {
                                    TaskCompletionView(task: task, petNickname: instance.nickname)
                                } label: {
                                    TaskRow(task: task)
                                }
                                .buttonStyle(.plain)
                            }
                        } header: {
                            Text(slot.rawValue)
                                .font(.headline)
                                .padding(.top, 4)
                        }
                    }
                }

                if todayTasks.isEmpty {
                    Card {
                        Text("No tasks for today. Nice and quiet.")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
        }
    }
}

// MARK: - Pieces

private struct PetStatusCard: View {
    @Environment(\.modelContext) private var context
    let instance: PetInstance
    let species: PetSpecies

    private var habitat: Habitat { Habitat(category: species.category, id: species.id) }
    private var isAquatic: Bool { habitat.usesTank }
    private var messy: Bool { (isAquatic ? instance.tankFoulLevel : instance.wasteLevel) >= 0.5 }
    private var hungry: Bool { instance.hungerLevel >= 0.5 }
    private var gottaGo: Bool { habitat.needsToGo && instance.reliefLevel >= 0.5 }
    private var needsGroom: Bool { habitat.needsGrooming && instance.groomLevel >= 0.6 }
    private var needsPlay: Bool { habitat.needsExercise && instance.energyLevel >= 0.6 }
    private var sick: Bool { instance.mood == .pleaseHelp || instance.strikes >= 4 }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                PetScene(species: species, mood: instance.mood,
                         waste: isAquatic ? instance.tankFoulLevel : instance.wasteLevel,
                         hunger: instance.hungerLevel, relief: instance.reliefLevel,
                         growth: instance.growth)
                    .frame(height: 160)

                if gottaGo {
                    Button {
                        withAnimation(.spring) { ScenarioActions.letOut(instance, context: context) }
                    } label: {
                        Label("Let \(instance.nickname) out!", systemImage: "door.left.hand.open")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(BigButtonStyle())
                    Text("\(instance.nickname) needs to go. Let them out before there is an accident in the yard.")
                        .font(.caption)
                        .foregroundStyle(Color(red: 0.70, green: 0.55, blue: 0.10))
                }

                if hungry {
                    Button {
                        withAnimation(.spring) { ScenarioActions.feed(instance, context: context) }
                    } label: {
                        Label("Feed \(instance.nickname)", systemImage: "fork.knife")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(BigButtonStyle())
                    Text(isAquatic ? "\(instance.nickname) is hungry. Sprinkle in some food."
                                   : "\(instance.nickname)'s bowl is empty. Time to fill it up.")
                        .font(.caption)
                        .foregroundStyle(Color(red: 0.55, green: 0.35, blue: 0.15))
                }

                if messy {
                    Button {
                        withAnimation(.spring) {
                            if isAquatic { ScenarioActions.freshenTank(instance, context: context) }
                            else { ScenarioActions.cleanYard(instance, context: context) }
                        }
                    } label: {
                        Label(habitat.cleanupTitle, systemImage: habitat.cleanupIcon)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(BigButtonStyle())
                    Text(habitat.cleanupHint)
                        .font(.caption)
                        .foregroundStyle(Color(red: 0.78, green: 0.35, blue: 0.10))
                }

                if needsGroom {
                    Button {
                        withAnimation(.spring) { ScenarioActions.groom(instance, context: context) }
                    } label: {
                        Label("Brush \(instance.nickname)", systemImage: "comb.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(BigButtonStyle())
                    Text("\(instance.nickname)'s coat is getting scruffy. A good brush keeps them healthy and happy.")
                        .font(.caption)
                        .foregroundStyle(Color(red: 0.45, green: 0.40, blue: 0.20))
                }

                if needsPlay {
                    Button {
                        withAnimation(.spring) { ScenarioActions.play(instance, context: context) }
                    } label: {
                        Label(habitat == .backyard ? "Take \(instance.nickname) for a walk" : "Play with \(instance.nickname)",
                              systemImage: "figure.run")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(BigButtonStyle())
                    Text("\(instance.nickname) has energy to burn. Exercise and play keep a pet content.")
                        .font(.caption)
                        .foregroundStyle(Color(red: 0.20, green: 0.40, blue: 0.55))
                }

                if sick {
                    Button {
                        withAnimation(.spring) { ScenarioActions.vetVisit(instance, context: context) }
                    } label: {
                        Label("Take \(instance.nickname) to the vet ($\(ScenarioActions.vetBill))",
                              systemImage: "cross.case.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(BigButtonStyle())
                    Text("\(instance.nickname) is very sick. A vet visit costs $\(ScenarioActions.vetBill) and some care points. Neglect is expensive.")
                        .font(.caption)
                        .foregroundStyle(Color(red: 0.80, green: 0.20, blue: 0.20))
                }

                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            Text(instance.nickname).font(.title2.bold())
                            GrowthChip(growth: instance.growth)
                        }
                        Text(moodMessage)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                    StreakFlame(days: instance.currentStreakDays)
                }
                WellbeingBar(wellbeing: instance.wellbeing)
            }
        }
    }

    /// Caring, never scary message (Section 9, Section 13).
    private var moodMessage: String {
        switch instance.mood {
        case .happy:          return "\(instance.nickname) is happy and well cared for."
        case .content:        return "\(instance.nickname) is content today."
        case .needsAttention: return "\(instance.nickname) could use a little attention."
        case .sad:            return "\(instance.nickname) is feeling lonely. A little care will help."
        case .pleaseHelp:     return "\(instance.nickname) really needs you today. Let's take care of them."
        }
    }
}

/// A small chip showing the pet's life stage (Baby / Growing up / Full grown), with a
/// progress dot so the child can see a young pet inching toward grown.
private struct GrowthChip: View {
    let growth: Double
    private var stage: GrowthStage { GrowthService.stage(growth) }

    private var color: Color {
        switch stage {
        case .baby:  return .pink
        case .young: return .orange
        case .grown: return .green
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: stage == .grown ? "pawprint.fill" : "leaf.fill")
                .font(.caption2)
            Text(stage.label)
                .font(.caption.bold())
        }
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(Capsule().fill(color.opacity(0.16)))
        .foregroundStyle(color)
    }
}

/// The "trainer" side of owning a pet: teach tricks over several short sessions. Each
/// practice builds toward the next trick; finishing one earns a jump of trust.
private struct TricksCard: View {
    @Environment(\.modelContext) private var context
    let instance: PetInstance
    let species: PetSpecies

    @State private var justLearned: String?

    private var allTricks: [Trick] {
        TrainingService.tricks(speciesId: species.id, category: species.category)
    }
    private var learnedIds: [String] { instance.tricksLearned }
    private var next: Trick? {
        TrainingService.nextTrick(speciesId: species.id, category: species.category, learned: learnedIds)
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("Tricks & Training", systemImage: "graduationcap.fill")
                        .font(.headline)
                    Spacer()
                    Text("\(learnedIds.count)/\(allTricks.count)")
                        .font(.subheadline.bold())
                        .foregroundStyle(.secondary)
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(allTricks) { trick in
                            let known = learnedIds.contains(trick.id)
                            HStack(spacing: 5) {
                                Image(systemName: known ? "checkmark.seal.fill" : trick.icon)
                                Text(trick.name)
                            }
                            .font(.caption.bold())
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(
                                Capsule().fill(known ? Color.green.opacity(0.18) : Color.secondary.opacity(0.12))
                            )
                            .foregroundStyle(known ? Color.green : Color.secondary)
                        }
                    }
                }

                if let justLearned {
                    Text("\(instance.nickname) learned \(justLearned)! Trust is growing.")
                        .font(.caption.bold())
                        .foregroundStyle(.green)
                }

                if let next {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Teaching: \(next.name)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        ProgressView(value: min(1, max(0, instance.trickProgress)))
                            .tint(.blue)
                    }
                    Button {
                        let finished = ScenarioActions.train(instance, context: context)
                        withAnimation(.spring) { justLearned = finished?.name }
                    } label: {
                        Label("Practice \(next.name)", systemImage: next.icon)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(BigButtonStyle())
                } else {
                    Text("\(instance.nickname) has learned every trick. What a star.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct TaskRow: View {
    let task: ScheduledTask
    private var overdue: Bool {
        task.status == .pending && Date() > task.dueAt
    }
    var body: some View {
        Card {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(task.label)
                        .font(.headline)
                        .foregroundStyle(task.status == .verified ? .secondary : .primary)
                    Text(DayFormat.time.string(from: task.dueAt))
                        .font(.caption)
                        .foregroundStyle(overdue ? .orange : .secondary)
                }
                Spacer()
                StatusChip(status: task.status)
            }
        }
        .overlay(alignment: .leading) {
            if overdue {
                RoundedRectangle(cornerRadius: 4)
                    .fill(.orange)
                    .frame(width: 4)
                    .padding(.vertical, 8)
            }
        }
    }
}

private struct NotificationsOffBanner: View {
    var body: some View {
        Card {
            HStack(spacing: 12) {
                Image(systemName: "bell.slash.fill").foregroundStyle(.orange)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Reminders are off").font(.subheadline.bold())
                    Text("Turn on notifications in Settings to get pet care reminders.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    Link("Open", destination: url).font(.subheadline.bold())
                }
            }
        }
    }
}

private struct TrainingCompleteCallout: View {
    let instance: PetInstance
    var body: some View {
        Card {
            HStack(spacing: 12) {
                Image(systemName: "checkmark.seal.fill").foregroundStyle(.green)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Training window finished").font(.subheadline.bold())
                    Text("Ask a grown-up to open Parent Mode to see the Readiness Report.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct EmptyHomeState: View {
    @Binding var showParentMode: Bool
    @Binding var showGate: Bool
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "pawprint.circle")
                .font(.system(size: 64)).foregroundStyle(.secondary)
            Text("No active pet").font(.title2.bold())
            Text("Ask a grown-up to start training a pet in Parent Mode.")
                .font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Open Parent Mode") { showGate = true }
                .buttonStyle(BigButtonStyle())
                .frame(maxWidth: 280)
        }
        .padding()
    }
}
