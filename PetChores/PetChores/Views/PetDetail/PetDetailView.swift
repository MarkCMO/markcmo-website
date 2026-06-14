import SwiftUI
import SwiftData

/// Pet tab: portrait reflecting mood, species facts, the full task schedule, and a
/// "what this pet needs to be happy" summary built from the consequence texts
/// (Section 11).
struct PetDetailView: View {
    @Environment(\.modelContext) private var context
    let instance: PetInstance?
    let picker: AnyView

    var body: some View {
        Group {
            if let instance, let species = DataStore.species(id: instance.speciesId, context: context) {
                content(instance: instance, species: species)
            } else {
                ContentUnavailableView("No pet yet", systemImage: "pawprint",
                                       description: Text("Start a pet in Parent Mode."))
            }
        }
        .navigationTitle("Pet")
    }

    private func content(instance: PetInstance, species: PetSpecies) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                picker

                VStack(spacing: 10) {
                    PetScene(species: species, mood: instance.mood,
                             waste: Habitat(category: species.category, id: species.id) == .aquarium
                                 ? instance.tankFoulLevel : instance.wasteLevel,
                             hunger: instance.hungerLevel, relief: instance.reliefLevel)
                        .frame(height: 220)
                    Text(instance.nickname).font(.largeTitle.bold())
                    Text(species.name).font(.headline).foregroundStyle(.secondary)
                    pawMeter(species.difficulty)
                }
                .frame(maxWidth: .infinity)

                Card {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("About").font(.headline)
                        Text(species.blurb).foregroundStyle(.secondary)
                        fact("Lifespan", "\(species.lifespanYears) years")
                        fact("Wellbeing", "\(instance.wellbeing) / 100")
                        fact("Trust", "\(instance.trust) / 100")
                        fact("Training", "\(instance.trainingLengthDays) days")
                    }
                }

                Card {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("What \(instance.nickname) needs to be happy").font(.headline)
                        ForEach(needsSummary(species), id: \.self) { line in
                            Label(line, systemImage: "heart.fill")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Card {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Care schedule").font(.headline)
                        ForEach(TaskFrequency.allCases, id: \.self) { freq in
                            let group = species.tasks.filter { $0.frequencyKind == freq }
                            if !group.isEmpty {
                                Text(freq.rawValue.capitalized)
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(Color.accentColor)
                                ForEach(group) { t in
                                    HStack(alignment: .top) {
                                        Image(systemName: "circle.fill").font(.system(size: 6)).padding(.top, 6)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(t.label).font(.subheadline.weight(.semibold))
                                            Text(t.realAction).font(.caption).foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding()
        }
    }

    private func fact(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text(value).fontWeight(.semibold)
        }
        .font(.subheadline)
    }

    /// Build the happiness summary from the most important consequence texts.
    private func needsSummary(_ species: PetSpecies) -> [String] {
        species.dailyTasks.prefix(5).map { $0.label }
    }
}
