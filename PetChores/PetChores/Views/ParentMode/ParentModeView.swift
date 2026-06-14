import SwiftUI
import SwiftData

/// Parent Mode hub (Section 11). Presented only after the PIN gate. Links to Verify
/// Tasks, Settings, Readiness Report, Manage Pets, and the unlock/restore screen.
struct ParentModeView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: StoreService

    @Query(filter: #Predicate<ScheduledTask> { $0.statusRaw == "done" },
           sort: [SortDescriptor(\ScheduledTask.completedAt, order: .reverse)])
    private var awaiting: [ScheduledTask]

    var body: some View {
        NavigationStack {
            List {
                ParentAlertsSection()

                Section {
                    NavigationLink {
                        VerifyTasksView()
                    } label: {
                        Label {
                            HStack {
                                Text("Verify Tasks")
                                Spacer()
                                if !awaiting.isEmpty {
                                    Text("\(awaiting.count)")
                                        .font(.caption.bold())
                                        .padding(.horizontal, 8).padding(.vertical, 2)
                                        .background(Color.accentColor, in: Capsule())
                                        .foregroundStyle(.white)
                                }
                            }
                        } icon: {
                            Image(systemName: "checkmark.circle")
                        }
                    }
                    NavigationLink { ReadinessListView() } label: {
                        Label("Readiness Report", systemImage: "doc.text.magnifyingglass")
                    }
                    NavigationLink { ManagePetsView() } label: {
                        Label("Manage Pets", systemImage: "pawprint.circle")
                    }
                    NavigationLink { ParentSettingsView() } label: {
                        Label("Settings", systemImage: "gearshape")
                    }
                }

                Section("Pet Plans") {
                    NavigationLink {
                        StoreView()
                    } label: {
                        Label(store.isUnlocked ? "\(store.activePlan.title) plan active" : "Add more pets",
                              systemImage: store.isUnlocked ? "checkmark.seal.fill" : "pawprint.circle")
                    }
                }
            }
            .navigationTitle("Parent Mode")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

/// The grown-up's at-a-glance view of how the child is keeping up with each pet's care.
/// Lists the current oversight alerts (the same ones sent as parent notifications), or a
/// reassuring all-clear when the child is on top of things.
private struct ParentAlertsSection: View {
    @Query(filter: #Predicate<PetInstance> { $0.isActive }) private var pets: [PetInstance]
    @Query private var settingsList: [ParentSettings]
    @Query private var children: [ChildProfile]
    @Query(filter: #Predicate<ScheduledTask> { $0.statusRaw == "missed" }) private var missed: [ScheduledTask]

    private var childName: String { children.first?.name ?? "Your child" }

    private struct Row: Identifiable {
        let id: UUID
        let alert: ParentAlert.Alert
    }

    private func rows() -> [Row] {
        guard let settings = settingsList.first else { return [] }
        let cal = Calendar.current
        let startToday = cal.startOfDay(for: Date())
        let weekAgo = cal.date(byAdding: .day, value: -7, to: startToday) ?? startToday

        return pets.compactMap { pet -> Row? in
            let petMissed = missed.filter { $0.instanceId == pet.instanceId }
            let missedToday = petMissed.filter { $0.dueAt >= startToday }.count
            let missedWeek = petMissed.filter { $0.dueAt >= weekAgo }.count
            let worst = max(pet.hungerLevel, max(pet.reliefLevel, max(pet.wasteLevel, pet.tankFoulLevel)))
            let signals = ParentAlert.CareSignals(missedToday: missedToday, missedThisWeek: missedWeek,
                                                  strikes: pet.strikes, maxStrikes: settings.maxStrikes,
                                                  wellbeing: pet.wellbeing, worstNeed: worst,
                                                  isLost: pet.isLost)
            guard let alert = ParentAlert.current(childName: childName, petName: pet.nickname,
                                                  signals: signals) else { return nil }
            return Row(id: pet.instanceId, alert: alert)
        }
        .sorted { $0.alert.urgency > $1.alert.urgency }
    }

    var body: some View {
        let alerts = rows()
        Section("Care alerts") {
            if alerts.isEmpty {
                Label("\(childName) is keeping up with pet care. Nice work.", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.green)
            } else {
                ForEach(alerts) { row in
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: icon(row.alert.urgency))
                            .foregroundStyle(color(row.alert.urgency))
                            .font(.title3)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.alert.title).font(.subheadline.bold())
                            Text(row.alert.body).font(.caption).foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private func icon(_ u: ParentAlert.Urgency) -> String {
        switch u {
        case .action:  return "exclamationmark.octagon.fill"
        case .concern: return "exclamationmark.triangle.fill"
        default:       return "bell.badge.fill"
        }
    }

    private func color(_ u: ParentAlert.Urgency) -> Color {
        switch u {
        case .action:  return .red
        case .concern: return .orange
        default:       return .blue
        }
    }
}
