import SwiftUI

/// "Open casting calls, feature and commercial" from the public-RSS aggregator.
struct CastingView: View {
    @ObservedObject var feeds: FeedsService
    @State private var tab = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                SectionHeader(eyebrow: "Casting", title: "Open casting calls",
                              subtitle: stamp) {
                    LivePill()
                }

                Picker("", selection: $tab) {
                    Text("Scripted (\(feeds.castingScripted.count))").tag(0)
                    Text("Commercial (\(feeds.castingCommercial.count))").tag(1)
                }
                .pickerStyle(.segmented)

                if feeds.castingLoading && current.isEmpty {
                    CenterMessage(systemImage: "megaphone", text: "Aggregating public casting feeds...")
                } else if let error = feeds.castingError, current.isEmpty {
                    ErrorBanner(message: error) { Task { await feeds.loadCasting(force: true) } }
                } else if current.isEmpty {
                    CenterMessage(systemImage: "megaphone", text: "No new roles hit the public feeds in the last day. The full WETYR Casting Aggregator ships ~200-400 fresh roles per day.")
                } else {
                    VStack(spacing: 12) {
                        ForEach(current) { call in CastingCard(call: call) }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("Casting")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.bg, for: .navigationBar)
        .task { await feeds.loadCasting() }
        .refreshable { await feeds.loadCasting(force: true) }
    }

    private var current: [CastingCall] { tab == 0 ? feeds.castingScripted : feeds.castingCommercial }

    private var stamp: String? {
        guard let ok = feeds.castingSourcesOk, let total = feeds.castingSourceCount else { return nil }
        return "\(ok)/\(total) public sources OK"
    }
}

private struct CastingCard: View {
    let call: CastingCall

    var body: some View {
        Link(destination: URL(string: call.link) ?? URL(string: "https://markcmo.com")!) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text((call.source ?? "Casting").uppercased())
                        .font(.system(size: 11, weight: .bold)).tracking(1).foregroundStyle(Theme.gold)
                    if !Fmt.timeAgo(call.date).isEmpty {
                        Text(". " + Fmt.timeAgo(call.date)).font(.caption2).foregroundStyle(Theme.dim)
                    }
                    Spacer()
                    Image(systemName: "arrow.up.right").font(.caption2).foregroundStyle(Theme.dim)
                }
                Text(call.title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                    .fixedSize(horizontal: false, vertical: true)
                if let s = cleanSummary { Text(s).font(.caption).foregroundStyle(Theme.muted).lineLimit(3) }
                tagRow
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.panel)
            .overlay(RoundedRectangle(cornerRadius: Theme.cardCorner).stroke(Theme.border, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: Theme.cardCorner))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var cleanSummary: String? {
        guard var s = call.summary?.trimmingCharacters(in: .whitespacesAndNewlines), s.count >= 25 else { return nil }
        if s.hasPrefix("http") { return nil }
        if s.count > 200 { s = String(s.prefix(200)) + "..." }
        return s
    }

    private var tagRow: some View {
        FlowLayout(spacing: 6) {
            if call.union == true { Pill(text: "SAG-AFTRA", color: Theme.purple) }
            if let loc = call.location, !loc.isEmpty { Pill(text: loc, color: Theme.blue) }
            if let role = call.role, !role.isEmpty { Pill(text: role.capitalized) }
            if let rate = call.rate, !rate.isEmpty { Pill(text: rate, color: Theme.green) }
        }
    }
}
