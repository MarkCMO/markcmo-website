import SwiftUI

/// "Title intelligence, any film, any TV" module. Shows a full detail card for the
/// selected trending title plus a strip of the top trending titles to switch.
struct TitleIntelView: View {
    @ObservedObject var intel: FilmIntelService
    @State private var selectedID: Int?
    @State private var autoRotate = true
    @State private var rotateTask: Task<Void, Never>?

    private var titles: [TitleDetail] { intel.featuredList }
    private var selected: TitleDetail? {
        titles.first(where: { $0.id == selectedID }) ?? titles.first
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeader(eyebrow: "Title Intelligence", title: "Any film, any TV") {
                    LivePill(label: "TMDB")
                }

                if intel.isLoading && titles.isEmpty {
                    CenterMessage(systemImage: "film", text: "Loading live title intelligence...")
                } else if let error = intel.error, titles.isEmpty {
                    ErrorBanner(message: error) { Task { await intel.load(force: true) } }
                } else if let title = selected {
                    trendingStrip
                    TitleDetailCard(title: title)
                } else {
                    CenterMessage(systemImage: "film", text: "No trending titles available right now.")
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("WETYR Films")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.bg, for: .navigationBar)
        .task { await intel.load() }
        .refreshable { await intel.load(force: true) }
        .onAppear { startRotation() }
        .onDisappear { rotateTask?.cancel() }
    }

    private var trendingStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(titles) { t in
                        Button {
                            selectedID = t.id
                            autoRotate = false
                            rotateTask?.cancel()
                        } label: {
                            PosterImage(url: t.poster, width: 76, height: 114)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(t.id == selected?.id ? Theme.gold : .clear, lineWidth: 2)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 2)
            }
            Text(autoRotate ? "Auto-rotating top trending titles. Tap a poster to hold."
                            : "Holding selection. Pull to refresh for live updates.")
                .font(.caption2).foregroundStyle(Theme.dim)
        }
    }

    private func startRotation() {
        rotateTask?.cancel()
        rotateTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 10_000_000_000)
                guard autoRotate, titles.count > 1 else { continue }
                let ids = titles.map(\.id)
                let current = selected?.id
                if let idx = ids.firstIndex(where: { $0 == current }) {
                    selectedID = ids[(idx + 1) % ids.count]
                } else {
                    selectedID = ids.first
                }
            }
        }
    }
}

/// The detailed title card: poster, meta, stats, cast, crew, providers, links.
struct TitleDetailCard: View {
    let title: TitleDetail

    var body: some View {
        Panel(title: title.title, tag: Fmt.year(title.releaseDate)) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 14) {
                    PosterImage(url: title.poster, width: 110, height: 165)
                    VStack(alignment: .leading, spacing: 8) {
                        if let tagline = title.tagline, !tagline.isEmpty {
                            Text(tagline).font(.subheadline.italic()).foregroundStyle(Theme.muted)
                        }
                        HStack(spacing: 12) {
                            RatingChip(value: title.voteAverage, count: title.voteCount)
                            if !Fmt.runtime(title.runtime).isEmpty {
                                Label(Fmt.runtime(title.runtime), systemImage: "clock")
                                    .font(.caption).foregroundStyle(Theme.muted)
                            }
                        }
                        if let genres = title.genres, !genres.isEmpty {
                            WrapTags(tags: Array(genres.prefix(4)))
                        }
                        linkRow
                    }
                }

                statsRow

                if let overview = title.overview, !overview.isEmpty {
                    Text(overview).font(.subheadline).foregroundStyle(Theme.text.opacity(0.9))
                }

                if let cast = title.cast, !cast.isEmpty {
                    labeled("Top cast") {
                        Text(cast.prefix(6).map { c in
                            c.character.map { "\(c.name) as \($0)" } ?? c.name
                        }.joined(separator: ", "))
                        .font(.footnote).foregroundStyle(Theme.muted)
                    }
                }

                if let crew = title.crew, !crew.isEmpty {
                    labeled("Key crew") {
                        Text(crew.prefix(6).map { "\($0.name) (\($0.job ?? ""))" }.joined(separator: ", "))
                            .font(.footnote).foregroundStyle(Theme.muted)
                    }
                }

                if let companies = title.productionCompanies, !companies.isEmpty {
                    labeled("Production") {
                        Text(companies.joined(separator: ", ")).font(.footnote).foregroundStyle(Theme.muted)
                    }
                }

                providers
            }
        }
    }

    private var statsRow: some View {
        HStack(spacing: 0) {
            stat("Budget", Fmt.money(title.budget))
            divider
            stat("Revenue", Fmt.money(title.revenue))
            divider
            stat("Released", Fmt.year(title.releaseDate).isEmpty ? "-" : Fmt.year(title.releaseDate))
        }
        .padding(.vertical, 10)
        .background(Theme.panel2)
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(value).font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.gold)
            Text(label.uppercased()).font(.system(size: 10, weight: .semibold)).tracking(1).foregroundStyle(Theme.dim)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View { Rectangle().fill(Theme.border).frame(width: 1, height: 30) }

    @ViewBuilder private var linkRow: some View {
        HStack(spacing: 14) {
            if let imdb = title.imdbId, let url = URL(string: "https://www.imdb.com/title/\(imdb)/") {
                Link(destination: url) { Label("IMDb", systemImage: "film").font(.caption.weight(.semibold)) }
            }
            if let trailer = title.videos?.first(where: { $0.youtubeURL != nil })?.youtubeURL {
                Link(destination: trailer) { Label("Trailer", systemImage: "play.circle").font(.caption.weight(.semibold)) }
            }
        }
        .tint(Theme.gold)
    }

    @ViewBuilder private var providers: some View {
        if let p = title.watchProviders {
            let all = (p.flatrate ?? []) + (p.rent ?? []) + (p.buy ?? [])
            if !all.isEmpty {
                labeled("Where to watch (US)") {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(uniqueProviders(all)) { prov in
                                AsyncImage(url: prov.logoURL) { img in
                                    img.resizable().scaledToFit()
                                } placeholder: { Color.clear }
                                .frame(width: 34, height: 34)
                                .clipShape(RoundedRectangle(cornerRadius: 7))
                            }
                        }
                    }
                }
            }
        }
    }

    private func uniqueProviders(_ list: [WatchProvider]) -> [WatchProvider] {
        var seen = Set<Int>(); var out: [WatchProvider] = []
        for p in list where !seen.contains(p.id) { seen.insert(p.id); out.append(p) }
        return out
    }

    private func labeled<Content: View>(_ label: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased()).font(.system(size: 10, weight: .bold)).tracking(1).foregroundStyle(Theme.gold)
            content()
        }
    }
}
