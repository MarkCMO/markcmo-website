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
    let instance: PetInstance
    let species: PetSpecies
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                PetScene(species: species, mood: instance.mood)
                    .frame(height: 160)
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(instance.nickname).font(.title2.bold())
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
