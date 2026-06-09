import SwiftUI

/// "Weekend box office, competitive intel" plus the trending-this-week list.
struct BoxOfficeView: View {
    @ObservedObject var intel: FilmIntelService
    @State private var quick: TrendingTitle?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeader(eyebrow: "Box Office", title: "In theaters and trending",
                              subtitle: intel.updatedAt.map { "Updated \(Fmt.timeAgo($0.ISO8601Format()))" } ?? nil) {
                    LivePill(label: "TMDB")
                }

                if intel.isLoading && intel.nowPlaying.isEmpty {
                    CenterMessage(systemImage: "chart.bar", text: "Loading box office intel...")
                } else if let error = intel.error, intel.nowPlaying.isEmpty {
                    ErrorBanner(message: error) { Task { await intel.load(force: true) } }
                } else {
                    if !intel.nowPlaying.isEmpty {
                        Panel(title: "In theaters now, US", tag: "LIVE VIA TMDB") {
                            VStack(spacing: 0) {
                                ForEach(Array(intel.nowPlaying.enumerated()), id: \.element.id) { idx, m in
                                    TitleRow(rank: idx + 1, title: m) { quick = m }
                                    if idx < intel.nowPlaying.count - 1 { Divider().overlay(Theme.border) }
                                }
                            }
                        }
                    }
                    if !intel.trending.isEmpty {
                        Panel(title: "Trending this week", tag: "TOP \(intel.trending.count)") {
                            VStack(spacing: 0) {
                                ForEach(Array(intel.trending.enumerated()), id: \.element.id) { idx, m in
                                    TitleRow(rank: idx + 1, title: m) { quick = m }
                                    if idx < intel.trending.count - 1 { Divider().overlay(Theme.border) }
                                }
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("Box Office")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.bg, for: .navigationBar)
        .task { await intel.load() }
        .refreshable { await intel.load(force: true) }
        .sheet(item: $quick) { TitleQuickSheet(title: $0) }
    }
}

private struct TitleRow: View {
    let rank: Int
    let title: TrendingTitle
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Text("\(rank)").font(.system(size: 13, weight: .bold)).foregroundStyle(Theme.dim).frame(width: 20)
                PosterImage(url: title.poster, width: 40, height: 60, corner: 6)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title.title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text).lineLimit(2)
                    HStack(spacing: 10) {
                        RatingChip(value: title.voteAverage, count: title.voteCount)
                        if let pop = title.popularity {
                            Label("\(Int(pop))", systemImage: trend(pop))
                                .font(.caption2).foregroundStyle(popColor(pop))
                        }
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.caption2).foregroundStyle(Theme.dim)
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func trend(_ pop: Double) -> String {
        pop > 80 ? "arrow.up.right" : (pop < 30 ? "arrow.down.right" : "minus")
    }
    private func popColor(_ pop: Double) -> Color {
        pop > 80 ? Theme.green : (pop < 30 ? Theme.red : Theme.dim)
    }
}

/// Lightweight detail for a trending/now-playing row (no full credits payload).
struct TitleQuickSheet: View {
    let title: TrendingTitle
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top, spacing: 14) {
                        PosterImage(url: title.poster, width: 110, height: 165)
                        VStack(alignment: .leading, spacing: 8) {
                            Text(title.title).font(.title3.weight(.bold)).foregroundStyle(Theme.text)
                            RatingChip(value: title.voteAverage, count: title.voteCount)
                            if let d = title.date, !d.isEmpty {
                                Label(d, systemImage: "calendar").font(.caption).foregroundStyle(Theme.muted)
                            }
                            if let pop = title.popularity {
                                Label("Popularity \(Int(pop))", systemImage: "flame").font(.caption).foregroundStyle(Theme.muted)
                            }
                        }
                        Spacer()
                    }
                    if let o = title.overview, !o.isEmpty {
                        Text(o).font(.subheadline).foregroundStyle(Theme.text.opacity(0.9))
                    }
                    Link(destination: URL(string: "https://www.themoviedb.org/movie/\(title.id)")!) {
                        Label("Open on TMDB", systemImage: "arrow.up.right.square")
                    }
                    .tint(Theme.gold)
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("Title").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } .tint(Theme.gold) } }
        }
    }
}
