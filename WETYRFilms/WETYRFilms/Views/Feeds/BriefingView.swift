import SwiftUI

/// "Your morning coffee briefing", industry news plus festival deadlines.
struct BriefingView: View {
    @ObservedObject var feeds: FeedsService

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeader(eyebrow: "Daily Briefing", title: "Industry news and deadlines") {
                    LivePill()
                }

                newsPanel
                festivalsPanel
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("Briefing")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.bg, for: .navigationBar)
        .task {
            feeds.loadFestivals()
            await feeds.loadNews()
        }
        .refreshable { await feeds.loadNews(force: true) }
    }

    private var newsPanel: some View {
        Panel(title: "Industry News, Live Feed",
              tag: feeds.newsFetchedAt.map { _ in "LIVE" } ?? (feeds.newsLoading ? "LOADING" : "")) {
            if feeds.newsLoading && feeds.news.isEmpty {
                CenterMessage(systemImage: "newspaper", text: "Pulling the trades...")
            } else if let error = feeds.newsError, feeds.news.isEmpty {
                ErrorBanner(message: error) { Task { await feeds.loadNews(force: true) } }
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(feeds.news.prefix(40).enumerated()), id: \.element.id) { idx, item in
                        newsRow(item)
                        if idx < min(40, feeds.news.count) - 1 { Divider().overlay(Theme.border) }
                    }
                }
            }
        }
    }

    private func newsRow(_ item: NewsItem) -> some View {
        Link(destination: URL(string: item.link) ?? URL(string: "https://markcmo.com")!) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    if let src = item.src, !src.isEmpty {
                        Text(src.uppercased()).font(.system(size: 11, weight: .bold)).tracking(1).foregroundStyle(Theme.gold)
                    }
                    if !Fmt.timeAgo(item.date).isEmpty {
                        Text(". " + Fmt.timeAgo(item.date)).font(.caption2).foregroundStyle(Theme.dim)
                    }
                }
                Text(item.title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var festivalsPanel: some View {
        Panel(title: "Festival Deadlines", tag: "ROLLING") {
            if feeds.festivals.isEmpty {
                CenterMessage(systemImage: "ticket", text: "No festival deadlines loaded.")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(feeds.festivals.enumerated()), id: \.element.id) { idx, f in
                        festivalRow(f)
                        if idx < feeds.festivals.count - 1 { Divider().overlay(Theme.border) }
                    }
                }
            }
        }
    }

    private func festivalRow(_ f: Festival) -> some View {
        Link(destination: URL(string: f.url ?? "https://filmfreeway.com/festivals")!) {
            HStack(alignment: .top, spacing: 14) {
                VStack(spacing: 2) {
                    Text(f.day).font(.system(size: 22, weight: .heavy)).foregroundStyle(Theme.text)
                    Text(f.month.uppercased()).font(.system(size: 10, weight: .semibold)).tracking(1).foregroundStyle(Theme.gold)
                }
                .frame(width: 56)
                .padding(.vertical, 6)
                .background(Theme.panel2)
                .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 3) {
                    Text(f.name).font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
                    if let info = f.info { Text(info).font(.caption).foregroundStyle(Theme.muted) }
                    HStack(spacing: 8) {
                        tierBadge(f.tier)
                        if let days = f.daysLeft, days > 0 {
                            Text("\(days)d left").font(.caption2.weight(.semibold)).foregroundStyle(Theme.dim)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder private func tierBadge(_ tier: String?) -> some View {
        switch tier {
        case "hot": Pill(text: "Closing soon", color: Theme.red)
        case "soon": Pill(text: "Approaching", color: Color(hex: 0xFBBF24))
        default: Pill(text: "Open", color: Theme.green)
        }
    }
}
