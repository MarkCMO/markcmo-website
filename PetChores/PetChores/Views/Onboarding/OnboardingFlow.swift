import SwiftUI
import SwiftData

/// The six-screen onboarding sequence (Section 5).
struct OnboardingFlow: View {
    @Environment(\.modelContext) private var context
    @State private var model = OnboardingViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color("BrandBackground").ignoresSafeArea()
                content
                    .padding()
                    .frame(maxWidth: 520)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.step {
        case .welcome:        WelcomeScreen(model: model)
        case .whoPlaying:     WhoPlayingScreen(model: model)
        case .parentSetup:    ParentSetupScreen(model: model)
        case .pickPet:        PickPetScreen(model: model)
        case .meetPet:        MeetPetScreen(model: model)
        case .nameAndLength:  NameAndLengthScreen(model: model)
        }
    }
}

// MARK: - Screen 1: Welcome

private struct WelcomeScreen: View {
    @Bindable var model: OnboardingViewModel
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "pawprint.circle.fill")
                .font(.system(size: 88))
                .foregroundStyle(Color.accentColor)
            Text("Pet Chores")
                .font(.largeTitle.bold())
            Text("Train to care for a real pet before you get one.")
                .font(.title3)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Spacer()
            Button("Get Started") { model.step = .whoPlaying }
                .buttonStyle(BigButtonStyle())
        }
    }
}

// MARK: - Screen 2: Who is playing

private struct WhoPlayingScreen: View {
    @Bindable var model: OnboardingViewModel
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Who is playing?")
                .font(.largeTitle.bold())

            Card {
                VStack(alignment: .leading, spacing: 14) {
                    Text("First name").font(.headline)
                    TextField("Your name", text: $model.childName)
                        .textFieldStyle(.roundedBorder)
                        .font(.title3)

                    Stepper(value: $model.childAge, in: 4...14) {
                        Text("Age: \(model.childAge)").font(.headline)
                    }

                    Text("Pick an avatar").font(.headline)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 12) {
                        ForEach(OnboardingViewModel.avatars, id: \.self) { name in
                            Button {
                                model.avatar = name
                            } label: {
                                Image(systemName: name)
                                    .font(.system(size: 40))
                                    .frame(maxWidth: .infinity, minHeight: 64)
                                    .foregroundStyle(model.avatar == name ? Color.accentColor : .secondary)
                                    .background(
                                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                                            .fill(model.avatar == name ? Color.accentColor.opacity(0.15) : Color(.tertiarySystemBackground))
                                    )
                            }
                        }
                    }
                }
            }
            Spacer()
            Button("Next") { model.step = .parentSetup }
                .buttonStyle(BigButtonStyle())
                .disabled(!model.canLeaveWhoPlaying)
        }
    }
}

// MARK: - Screen 3: Parent setup

private struct ParentSetupScreen: View {
    @Bindable var model: OnboardingViewModel
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Grown-up setup")
                .font(.largeTitle.bold())
            Text("Create a 4 digit PIN. Parent Mode is where you verify chores and see the Readiness Report. We store only a scrambled version of the PIN, never the real one.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Card {
                VStack(alignment: .leading, spacing: 14) {
                    PinField(title: "Create PIN", text: $model.pin)
                    PinField(title: "Confirm PIN", text: $model.pinConfirm)
                    if !model.pin.isEmpty && model.pin != model.pinConfirm {
                        Text("The PINs do not match yet.")
                            .font(.footnote).foregroundStyle(.red)
                    }
                }
            }
            Spacer()
            Button("Next") { model.step = .pickPet }
                .buttonStyle(BigButtonStyle())
                .disabled(!model.canLeaveParentSetup)
        }
    }
}

/// 4-digit numeric PIN entry.
struct PinField: View {
    let title: String
    @Binding var text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline)
            SecureField("****", text: $text)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
                .font(.title2.monospacedDigit())
                .onChange(of: text) { _, newValue in
                    let digits = newValue.filter { $0.isNumber }
                    text = String(digits.prefix(4))
                }
        }
    }
}

// MARK: - Screen 4: Pick your pet

private struct PickPetScreen: View {
    @Bindable var model: OnboardingViewModel
    @Query(sort: [SortDescriptor(\PetSpecies.difficulty), SortDescriptor(\PetSpecies.name)])
    private var species: [PetSpecies]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Pick your pet")
                .font(.largeTitle.bold())
            ScrollView {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 2), spacing: 12) {
                    ForEach(species) { s in
                        Button {
                            model.selectedSpeciesId = s.id
                            model.step = .meetPet
                        } label: {
                            SpeciesCard(species: s, childAge: model.childAge)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

private struct SpeciesCard: View {
    let species: PetSpecies
    let childAge: Int
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: species.iconName)
                    .font(.system(size: 40))
                    .foregroundStyle(Color.accentColor)
                Text(species.name).font(.headline)
                pawMeter(species.difficulty)
                Text("Best for ages \(species.recommendedMinAge)+")
                    .font(.caption).foregroundStyle(.secondary)
                if childAge < species.recommendedMinAge {
                    Text("Usually best for ages \(species.recommendedMinAge) and up. You can still practice.")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
            }
        }
    }
}

// MARK: - Screen 5: Meet your pet (reality check)

private struct MeetPetScreen: View {
    @Bindable var model: OnboardingViewModel
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var notifications: NotificationService
    @State private var showNotifPrompt = false

    var body: some View {
        Group {
            if let species = model.selectedSpecies(in: context) {
                VStack(alignment: .leading, spacing: 16) {
                    PetScene(species: species, mood: .happy)
                        .frame(height: 160)
                    HStack(spacing: 14) {
                        Image(systemName: species.iconName)
                            .font(.system(size: 48)).foregroundStyle(Color.accentColor)
                        VStack(alignment: .leading) {
                            Text("Meet your \(species.name.lowercased())")
                                .font(.title.bold())
                            pawMeter(species.difficulty)
                        }
                    }
                    Text(species.blurb)
                        .font(.body).foregroundStyle(.secondary)

                    Card {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("The real cost").font(.headline)
                            costRow("Lifespan", "\(species.lifespanYears) years")
                            costRow("Startup", Money.string(species.startupCost))
                            costRow("Every month", Money.string(species.monthlyCost))
                            costRow("First year", Money.string(species.yearlyCost))
                        }
                    }
                    Spacer()
                    Button("Start Training") { showNotifPrompt = true }
                        .buttonStyle(BigButtonStyle())
                    Button("Pick a different pet") { model.step = .pickPet }
                        .font(.subheadline)
                        .frame(maxWidth: .infinity)
                }
                .alert("Turn on reminders?", isPresented: $showNotifPrompt) {
                    Button("Not now") { model.step = .nameAndLength }
                    Button("Turn on") {
                        Task { @MainActor in
                            _ = await notifications.requestAuthorization()
                            model.step = .nameAndLength
                        }
                    }
                } message: {
                    Text("So we can remind you when your pet needs care.")
                }
            } else {
                ProgressView()
            }
        }
    }

    private func costRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).fontWeight(.semibold)
        }
        .font(.subheadline)
    }
}

// MARK: - Screen 6: Name + training length

private struct NameAndLengthScreen: View {
    @Bindable var model: OnboardingViewModel
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var store: StoreService
    @State private var showGate = false
    @State private var lengthUnlocked = false
    @State private var showPaywall = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Name your pet")
                .font(.largeTitle.bold())

            Card {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Pet name").font(.headline)
                    TextField("Give your pet a name", text: $model.nickname)
                        .textFieldStyle(.roundedBorder)
                        .font(.title3)
                }
            }

            Card {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Training length").font(.headline)
                    Text("A grown-up chooses how long to practice.")
                        .font(.caption).foregroundStyle(.secondary)

                    if lengthUnlocked {
                        lengthPicker
                    } else {
                        Button {
                            showGate = true
                        } label: {
                            Label("Set training length (grown-ups)", systemImage: "lock.fill")
                                .frame(maxWidth: .infinity, minHeight: 44)
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }

            Spacer()
            Button("Start Training") { finish() }
                .buttonStyle(BigButtonStyle())
                .disabled(!model.canFinish)
        }
        .sheet(isPresented: $showGate) {
            ParentGateView(
                title: "Set the training length",
                verifyOverride: { $0 == model.pin },
                onSuccess: { lengthUnlocked = true }
            )
        }
        .sheet(isPresented: $showPaywall) {
            NavigationStack { StoreView() }
        }
        // When the trial / subscription becomes active, create the first pet and let
        // RootView route into the app.
        .onChange(of: store.isUnlocked) { _, unlocked in
            if unlocked {
                showPaywall = false
                _ = model.finalize(context: context)
            }
        }
    }

    private var lengthPicker: some View {
        VStack(spacing: 10) {
            ForEach(OnboardingViewModel.trainingLengthOptions, id: \.self) { days in
                Button {
                    model.trainingLengthDays = days
                } label: {
                    HStack {
                        Text("\(days) days")
                            .fontWeight(.semibold)
                        if days == OnboardingViewModel.suggestedTrainingLength {
                            Text("Suggested")
                                .font(.caption2)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.15), in: Capsule())
                        }
                        Spacer()
                        if model.trainingLengthDays == days {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.accentColor)
                        }
                    }
                    .frame(minHeight: 44)
                    .padding(.horizontal, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(model.trainingLengthDays == days ? Color.accentColor.opacity(0.12) : Color(.tertiarySystemBackground))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func finish() {
        // A subscription (including the 3-day free trial) is required to train a pet.
        // If one is already active, create the pet now; otherwise present the paywall and
        // create the pet once the trial/subscription starts (see onChange above).
        if store.isUnlocked {
            _ = model.finalize(context: context)
            // RootView's @Query updates and routes to the main app automatically.
        } else {
            showPaywall = true
        }
    }
}
