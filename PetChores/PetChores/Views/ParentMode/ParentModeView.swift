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

                Section("Unlock") {
                    NavigationLink {
                        StoreView()
                    } label: {
                        Label(store.isUnlocked ? "Full version unlocked" : "Unlock the full app",
                              systemImage: store.isUnlocked ? "checkmark.seal.fill" : "lock.open")
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
