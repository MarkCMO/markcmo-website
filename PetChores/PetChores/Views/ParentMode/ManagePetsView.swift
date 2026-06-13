import SwiftUI
import SwiftData

/// Manage Pets (Section 11): start a new pet, archive a finished one, or delete.
/// New-pet creation respects the free-tier one-pet limit (Section 13B).
struct ManagePetsView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var store: StoreService

    @Query(sort: [SortDescriptor(\PetInstance.startDate, order: .reverse)])
    private var pets: [PetInstance]

    @State private var showAdd = false
    @State private var showLockedAlert = false
    @State private var showStore = false

    private var active: [PetInstance] { pets.filter { $0.isActive } }
    private var archived: [PetInstance] { pets.filter { !$0.isActive } }

    var body: some View {
        List {
            Section {
                Button {
                    startNewPet()
                } label: {
                    Label("Start a new pet", systemImage: "plus.circle.fill")
                }
            }

            if !active.isEmpty {
                Section("Active") {
                    ForEach(active) { pet in PetManageRow(pet: pet) }
                }
            }

            if !archived.isEmpty {
                Section("Finished") {
                    ForEach(archived) { pet in PetManageRow(pet: pet) }
                }
            }
        }
        .navigationTitle("Manage Pets")
        .sheet(isPresented: $showAdd) { AddPetView() }
        .sheet(isPresented: $showStore) { NavigationStack { StoreView() } }
        .alert("Add more pets", isPresented: $showLockedAlert) {
            Button("Not now", role: .cancel) {}
            Button("See plans") { showStore = true }
        } message: {
            Text("One pet is free. Subscribe to a monthly plan to train more pets at the same time.")
        }
    }

    private func startNewPet() {
        let activeCount = pets.filter { $0.isActive }.count
        if FreeTier.canCreatePet(maxPets: store.maxPets, activePetCount: activeCount) {
            showAdd = true
        } else {
            showLockedAlert = true
        }
    }
}

private struct PetManageRow: View {
    @Environment(\.modelContext) private var context
    @Bindable var pet: PetInstance
    @State private var confirmDelete = false

    private let service = PetCreationService()

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(pet.nickname).font(.headline)
                Text("\(pet.speciesId.capitalized) - \(pet.trainingLengthDays) day window")
                    .font(.caption).foregroundStyle(.secondary)
                if pet.isTrainingComplete() {
                    Text("Training complete").font(.caption2).foregroundStyle(.green)
                }
            }
            Spacer()
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) { confirmDelete = true } label: {
                Label("Delete", systemImage: "trash")
            }
            if pet.isActive {
                Button { service.archive(pet, context: context) } label: {
                    Label("Archive", systemImage: "archivebox")
                }
                .tint(.gray)
            }
        }
        .alert("Delete \(pet.nickname)?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) { service.delete(pet, context: context) }
        } message: {
            Text("This removes the pet, its chores, budget, and any photos. This cannot be undone.")
        }
    }
}

/// Compact new-pet flow used from Manage Pets.
private struct AddPetView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @Query(sort: [SortDescriptor(\PetSpecies.difficulty), SortDescriptor(\PetSpecies.name)])
    private var species: [PetSpecies]

    @State private var selectedId: String?
    @State private var nickname = ""
    @State private var length = OnboardingViewModel.suggestedTrainingLength

    private var canCreate: Bool {
        selectedId != nil && !nickname.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Pick a pet") {
                    Picker("Pet", selection: $selectedId) {
                        Text("Choose").tag(String?.none)
                        ForEach(species) { s in
                            Text(s.name).tag(String?.some(s.id))
                        }
                    }
                }
                Section("Name") {
                    TextField("Pet name", text: $nickname)
                }
                Section("Training length") {
                    Picker("Days", selection: $length) {
                        ForEach(OnboardingViewModel.trainingLengthOptions, id: \.self) { d in
                            Text("\(d) days").tag(d)
                        }
                    }
                }
            }
            .navigationTitle("New Pet")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Start") { create() }.disabled(!canCreate)
                }
            }
        }
    }

    private func create() {
        guard let id = selectedId else { return }
        _ = PetCreationService().create(
            speciesId: id,
            nickname: nickname,
            trainingLengthDays: length,
            context: context
        )
        dismiss()
    }
}
