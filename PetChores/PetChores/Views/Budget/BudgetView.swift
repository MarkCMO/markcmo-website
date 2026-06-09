import SwiftUI
import SwiftData

/// Budget tab: startup total, monthly total, projected first-year total, and a simple
/// child-friendly list (Section 10). Teaches that pets cost real money.
struct BudgetView: View {
    @Environment(\.modelContext) private var context
    let instance: PetInstance?
    let picker: AnyView

    private let budget = BudgetService()

    var body: some View {
        Group {
            if let instance, let species = DataStore.species(id: instance.speciesId, context: context) {
                content(instance: instance, species: species)
            } else {
                ContentUnavailableView("No pet yet", systemImage: "dollarsign.circle",
                                       description: Text("Start a pet in Parent Mode."))
            }
        }
        .navigationTitle("Budget")
    }

    private func content(instance: PetInstance, species: PetSpecies) -> some View {
        let entries = DataStore.budgetEntries(for: instance.instanceId, context: context)
        let startup = budget.startupTotal(entries: entries)

        return ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                picker

                HStack(spacing: 12) {
                    totalTile("Startup", Money.string(startup), "shippingbox.fill", .blue)
                    totalTile("Per month", Money.string(budget.monthlyTotal(species: species)), "repeat.circle.fill", .orange)
                }
                Card {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("True cost of a year", systemImage: "calendar")
                            .font(.headline)
                        Text(Money.string(budget.firstYearProjection(species: species)))
                            .font(.system(size: 40, weight: .heavy))
                        Text("Startup plus 12 months plus once-a-year items like vet visits.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }

                Card {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("What you bought to start").font(.headline)
                        ForEach(species.onceSupplies) { s in
                            lineRow(s.item, s.cost)
                        }
                    }
                }

                Card {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("What you buy every month").font(.headline)
                        ForEach(species.monthlySupplies) { s in
                            lineRow(s.item, s.cost)
                        }
                    }
                }

                if !species.yearlySupplies.isEmpty {
                    Card {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Once a year").font(.headline)
                            ForEach(species.yearlySupplies) { s in
                                lineRow(s.item, s.cost)
                            }
                        }
                    }
                }
            }
            .padding()
        }
    }

    private func totalTile(_ title: String, _ value: String, _ icon: String, _ color: Color) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: icon).foregroundStyle(color).font(.title2)
                Text(value).font(.title2.bold())
                Text(title).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private func lineRow(_ label: String, _ amount: Double) -> some View {
        HStack {
            Text(label).font(.subheadline)
            Spacer()
            Text(Money.string(amount)).font(.subheadline.weight(.semibold))
        }
    }
}
