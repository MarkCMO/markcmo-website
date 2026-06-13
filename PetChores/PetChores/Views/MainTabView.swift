import SwiftUI
import SwiftData

/// The child-facing tab bar: Home, Pet, Budget, Rewards (Section 11). Parent Mode is
/// reached from Home, not from the tab bar. A pet selector appears when more than one
/// pet is active (paid multi-pet).
struct MainTabView: View {
    @Query(filter: #Predicate<PetInstance> { $0.isActive },
           sort: [SortDescriptor(\PetInstance.startDate, order: .reverse)])
    private var activePets: [PetInstance]

    @State private var selectedId: UUID?

    private var selected: PetInstance? {
        if let id = selectedId, let match = activePets.first(where: { $0.instanceId == id }) {
            return match
        }
        return activePets.first
    }

    var body: some View {
        TabView {
            navWrapped { HomeView(instance: selected, picker: AnyView(petPicker)) }
                .tabItem { Label("Home", systemImage: "house.fill") }

            navWrapped { PetDetailView(instance: selected, picker: AnyView(petPicker)) }
                .tabItem { Label("Pet", systemImage: "pawprint.fill") }

            navWrapped { BudgetView(instance: selected, picker: AnyView(petPicker)) }
                .tabItem { Label("Budget", systemImage: "dollarsign.circle.fill") }

            navWrapped { RewardsView(instance: selected, picker: AnyView(petPicker)) }
                .tabItem { Label("Rewards", systemImage: "rosette") }
        }
        .onAppear { if selectedId == nil { selectedId = activePets.first?.instanceId } }
    }

    private func navWrapped<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        NavigationStack { content() }
    }

    @ViewBuilder
    private var petPicker: some View {
        if activePets.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(activePets) { pet in
                        Button {
                            selectedId = pet.instanceId
                        } label: {
                            Text(pet.nickname)
                                .font(.subheadline.weight(.semibold))
                                .padding(.horizontal, 14).padding(.vertical, 8)
                                .background(
                                    Capsule().fill(selected?.instanceId == pet.instanceId
                                                   ? Color.accentColor.opacity(0.2)
                                                   : Color(.secondarySystemBackground))
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)
            }
        }
    }
}
