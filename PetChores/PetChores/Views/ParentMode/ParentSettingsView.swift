import SwiftUI
import SwiftData

/// Parent settings (Section 11): verification toggle, photo proof toggle (paid), quiet
/// hours, default training length, and change PIN.
struct ParentSettingsView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var store: StoreService

    @Query private var settingsList: [ParentSettings]
    private var settings: ParentSettings? { settingsList.first }

    @Query(filter: #Predicate<PetInstance> { $0.isActive }) private var activePets: [PetInstance]

    @State private var quietStart = Date()
    @State private var quietEnd = Date()
    @State private var loaded = false
    @State private var showChangePIN = false
    @State private var showStore = false

    var body: some View {
        Form {
            if let settings {
                Section("Verification") {
                    Toggle("Require grown-up to verify chores", isOn: binding(\.verificationRequired))
                }

                Section("Missed tasks") {
                    Toggle("Carry over missed tasks", isOn: binding(\.carryOverMissedTasks))
                    Text("When on, a chore missed on an earlier day keeps showing until it is done. When off, a miss is a miss and the day moves on, like real pet care.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("Photo proof") {
                    if FreeTier.photoProofAvailable(isUnlocked: store.isUnlocked) {
                        Toggle("Require a photo when marking done", isOn: binding(\.photoProofRequired))
                    } else {
                        Button {
                            showStore = true
                        } label: {
                            HStack {
                                Label("Require photo proof", systemImage: "lock.fill")
                                Spacer()
                                Text("Unlock").foregroundStyle(Color.accentColor)
                            }
                        }
                    }
                }

                Section("Quiet hours") {
                    DatePicker("Start", selection: $quietStart, displayedComponents: .hourAndMinute)
                    DatePicker("End", selection: $quietEnd, displayedComponents: .hourAndMinute)
                    Text("No reminders are sent during quiet hours.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("New pet default") {
                    Picker("Training length", selection: binding(\.defaultTrainingLengthDays)) {
                        ForEach(OnboardingViewModel.trainingLengthOptions, id: \.self) { d in
                            Text("\(d) days").tag(d)
                        }
                    }
                }

                Section {
                    Picker("How real should it get?", selection: binding(\.consequenceIntensityRaw)) {
                        ForEach(ConsequenceIntensity.allCases) { lvl in
                            Text(lvl.label).tag(lvl.rawValue)
                        }
                    }
                    Text(settings.consequenceIntensity.subtitle)
                        .font(.caption).foregroundStyle(.secondary)

                    Toggle("Accidents in the yard", isOn: binding(\.accidentsEnabled))
                    Toggle("Pets can get sick (vet bills)", isOn: binding(\.vetBillsEnabled))
                    Toggle("Neighbors and animal control", isOn: binding(\.socialPressureEnabled))
                    Toggle("Pet can be lost for good", isOn: binding(\.permanentLossEnabled))
                } header: {
                    Text("Real-life consequences")
                } footer: {
                    Text("Set how harsh the lessons are. \"How real\" sets the overall pace, from no stakes (Off) to the full lesson (Harsh). Turn each consequence on as your child is ready: messy accidents, vet bills when a pet gets sick, the annoyed neighbor and animal-control warnings, and whether a badly neglected pet can be lost for good.")
                }

                Section("Demo") {
                    Toggle("Speed up needs", isOn: binding(\.demoMode))
                    Button("Make a mess now") {
                        for pet in activePets { ScenarioActions.makeMessNow(pet, context: context) }
                    }
                    Text("Use the demo controls to see the care scenarios right away, like a messy yard or a fouling tank.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("Grown-up alerts") {
                    Toggle("Notify me about care problems", isOn: binding(\.parentCareAlertsEnabled))
                    Text("Get a heads-up when your child falls behind on a pet's care, like missed chores or a pet that is slipping. Separate from the reminders your child sees.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                Section("Security") {
                    Button("Change PIN") { showChangePIN = true }
                }
            } else {
                Text("Settings are not available.")
            }
        }
        .navigationTitle("Settings")
        .onAppear(perform: loadTimes)
        .onChange(of: quietStart) { _, _ in saveQuietHours() }
        .onChange(of: quietEnd) { _, _ in saveQuietHours() }
        .sheet(isPresented: $showChangePIN) { ChangePINView() }
        .sheet(isPresented: $showStore) { NavigationStack { StoreView() } }
    }

    private func loadTimes() {
        guard !loaded, let settings else { return }
        quietStart = TimeUtilities.date(on: Date(), atTime: settings.quietHoursStart)
        quietEnd = TimeUtilities.date(on: Date(), atTime: settings.quietHoursEnd)
        loaded = true
    }

    private func saveQuietHours() {
        guard loaded, let settings else { return }
        settings.quietHoursStart = hhmm(quietStart)
        settings.quietHoursEnd = hhmm(quietEnd)
        DataStore.save(context)
        MaintenanceService().rescheduleNotifications(context: context, settings: settings)
    }

    private func hhmm(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }

    /// Two-way binding into the settings model that saves on change.
    private func binding<Value>(_ keyPath: ReferenceWritableKeyPath<ParentSettings, Value>) -> Binding<Value> {
        Binding(
            get: { settings?[keyPath: keyPath] ?? defaultValue(for: keyPath) },
            set: {
                settings?[keyPath: keyPath] = $0
                DataStore.save(context)
            }
        )
    }

    private func defaultValue<Value>(for keyPath: ReferenceWritableKeyPath<ParentSettings, Value>) -> Value {
        // Only used while settings is nil, which the UI guards against.
        fatalError("settings unavailable")
    }
}

/// Change PIN sheet.
private struct ChangePINView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var pin = ""
    @State private var confirm = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("New PIN") {
                    PinField(title: "PIN", text: $pin)
                    PinField(title: "Confirm", text: $confirm)
                    if !pin.isEmpty && pin != confirm {
                        Text("The PINs do not match yet.").font(.footnote).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Change PIN")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!(PINManager.isValidFormat(pin) && pin == confirm))
                }
            }
        }
    }

    private func save() {
        guard let settings = DataStore.parentSettings(context) else { return }
        let salt = PINManager.newSalt()
        settings.pinSalt = salt
        settings.pinHash = PINManager.hash(pin: pin, salt: salt)
        DataStore.save(context)
        dismiss()
    }
}
