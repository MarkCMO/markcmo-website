import SwiftUI
import SwiftData

/// Rewards tab: Care Points, badges, streak history, and level from Trust (Section 11).
struct RewardsView: View {
    @Environment(\.modelContext) private var context
    let instance: PetInstance?
    let picker: AnyView

    private let badgeService = BadgeService()

    var body: some View {
        Group {
            if let instance {
                content(instance: instance)
            } else {
                ContentUnavailableView("No pet yet", systemImage: "rosette",
                                       description: Text("Start a pet in Parent Mode."))
            }
        }
        .navigationTitle("Rewards")
    }

    private func content(instance: PetInstance) -> some View {
        let tasks = DataStore.tasks(for: instance.instanceId, context: context)
        let badges = badgeService.badges(for: instance, tasks: tasks)

        return ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                picker

                HStack(spacing: 12) {
                    statTile("Care Points", "\(instance.carePoints)", "star.fill", .yellow)
                    statTile("Level", "\(instance.level)", "arrow.up.circle.fill", .blue)
                }
                HStack(spacing: 12) {
                    statTile("Current streak", "\(instance.currentStreakDays)d", "flame.fill", .orange)
                    statTile("Best streak", "\(instance.longestStreakDays)d", "trophy.fill", .green)
                }

                Card {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Trust").font(.headline)
                        ProgressView(value: Double(instance.trust), total: 100)
                            .tint(.pink)
                        Text("\(instance.trust) / 100. You are becoming a great pet owner.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }

                Text("Badges").font(.title3.bold())
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                    ForEach(badges) { badge in
                        BadgeTile(badge: badge)
                    }
                }
            }
            .padding()
        }
    }

    private func statTile(_ title: String, _ value: String, _ icon: String, _ color: Color) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: icon).foregroundStyle(color).font(.title2)
                Text(value).font(.title.bold().monospacedDigit())
                Text(title).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}

private struct BadgeTile: View {
    let badge: BadgeService.Badge
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: badge.symbol)
                    .font(.system(size: 34))
                    .foregroundStyle(badge.earned ? Color.accentColor : Color.secondary.opacity(0.4))
                Text(badge.title).font(.subheadline.bold())
                Text(badge.earned ? "Earned" : badge.detail)
                    .font(.caption)
                    .foregroundStyle(badge.earned ? .green : .secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .opacity(badge.earned ? 1 : 0.7)
        }
    }
}
