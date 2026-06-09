import SwiftUI
import SwiftData

/// Picks which pet's Readiness Report to view.
struct ReadinessListView: View {
    @Query(sort: [SortDescriptor(\PetInstance.startDate, order: .reverse)])
    private var pets: [PetInstance]

    var body: some View {
        Group {
            if pets.isEmpty {
                ContentUnavailableView("No pets yet", systemImage: "doc.text.magnifyingglass")
            } else {
                List(pets) { pet in
                    NavigationLink {
                        ReadinessReportView(instance: pet)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(pet.nickname).font(.headline)
                            Text("\(pet.speciesId.capitalized) - started \(DayFormat.short.string(from: pet.startDate))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Readiness")
    }
}

/// The Readiness Report itself (Section 12). Export is gated to the paid unlock.
struct ReadinessReportView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var store: StoreService
    let instance: PetInstance

    @State private var showStore = false

    private let service = ReadinessService()

    private var report: ReadinessService.Report? {
        guard let species = DataStore.species(id: instance.speciesId, context: context) else { return nil }
        let tasks = DataStore.tasks(for: instance.instanceId, context: context)
        return service.makeReport(instance: instance, species: species, tasks: tasks)
    }

    var body: some View {
        ScrollView {
            if let report {
                VStack(alignment: .leading, spacing: 16) {
                    verdictCard(report)

                    HStack(spacing: 12) {
                        metric("Completion", "\(report.completionPercent)%", "checkmark.circle.fill", .green)
                        metric("On time", "\(report.onTimePercent)%", "clock.fill", .blue)
                    }
                    HStack(spacing: 12) {
                        metric("Longest streak", "\(report.longestStreak)d", "flame.fill", .orange)
                        metric("Tasks done", "\(report.totalCompleted)/\(report.totalDue)", "list.bullet", .purple)
                    }

                    if let hardest = report.hardestHandledLabel {
                        Card {
                            VStack(alignment: .leading, spacing: 4) {
                                Label("Hardest task handled well", systemImage: "star.fill")
                                    .font(.headline)
                                Text("\(hardest) at \(report.hardestHandledPercent)%")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    if !report.topMissed.isEmpty {
                        Card {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Most often missed").font(.headline)
                                ForEach(report.topMissed) { m in
                                    HStack {
                                        Text(m.label)
                                        Spacer()
                                        Text("\(m.count) times").foregroundStyle(.secondary)
                                    }
                                    .font(.subheadline)
                                }
                            }
                        }
                    }

                    exportSection(report)

                    Text("This report is a guide for your family, not a guarantee. A real pet is a long term commitment for the whole household.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding()
            } else {
                ProgressView()
            }
        }
        .navigationTitle(instance.nickname)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showStore) { NavigationStack { StoreView() } }
    }

    private func verdictCard(_ r: ReadinessService.Report) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                Text("Verdict").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Text(r.verdict).font(.title3.bold())
            }
        }
    }

    private func metric(_ title: String, _ value: String, _ icon: String, _ color: Color) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: icon).foregroundStyle(color).font(.title2)
                Text(value).font(.title2.bold())
                Text(title).font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private func exportSection(_ r: ReadinessService.Report) -> some View {
        if FreeTier.exportAvailable(isUnlocked: store.isUnlocked) {
            let text = service.exportText(r)
            VStack(spacing: 10) {
                ShareLink(item: text) {
                    Label("Share as text", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)

                if let pdfURL = ReadinessExporter.makePDF(title: "Pet Chores Readiness Report", body: text) {
                    ShareLink(item: pdfURL) {
                        Label("Share as PDF", systemImage: "doc.fill")
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        } else {
            Button {
                showStore = true
            } label: {
                Label("Export report (unlock)", systemImage: "lock.fill")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.bordered)
        }
    }
}
