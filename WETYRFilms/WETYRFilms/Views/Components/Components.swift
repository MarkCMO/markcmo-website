import SwiftUI

/// Remote poster/backdrop image with a dark placeholder that matches the panels.
struct PosterImage: View {
    let url: String?
    var width: CGFloat = 92
    var height: CGFloat = 138
    var corner: CGFloat = 8

    var body: some View {
        AsyncImage(url: url.flatMap(URL.init(string:))) { phase in
            switch phase {
            case .success(let img):
                img.resizable().scaledToFill()
            case .failure:
                placeholder(icon: "film")
            case .empty:
                ZStack { Theme.panel2; ProgressView().tint(Theme.gold) }
            @unknown default:
                placeholder(icon: "film")
            }
        }
        .frame(width: width, height: height)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: corner, style: .continuous).stroke(Theme.border, lineWidth: 1))
    }

    private func placeholder(icon: String) -> some View {
        ZStack {
            Theme.panel2
            Image(systemName: icon).foregroundStyle(Theme.dim)
        }
    }
}

/// Small TMDB-style rating chip (gold star + value).
struct RatingChip: View {
    let value: Double?
    let count: Int?
    var body: some View {
        if let value, value > 0 {
            HStack(spacing: 4) {
                Image(systemName: "star.fill").font(.caption2).foregroundStyle(Theme.gold)
                Text(String(format: "%.1f", value)).font(.caption.weight(.semibold)).foregroundStyle(Theme.text)
                if let count, count > 0 {
                    Text("(\(count))").font(.caption2).foregroundStyle(Theme.dim)
                }
            }
        }
    }
}

/// A consistent section header with an eyebrow, title, optional subtitle and trailing.
struct SectionHeader<Trailing: View>: View {
    let eyebrow: String
    let title: String
    var subtitle: String? = nil
    @ViewBuilder var trailing: Trailing

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center) {
                Eyebrow(text: eyebrow)
                Spacer()
                trailing
            }
            Text(title)
                .font(.system(size: 24, weight: .heavy))
                .foregroundStyle(Theme.text)
            if let subtitle {
                Text(subtitle).font(.subheadline).foregroundStyle(Theme.muted)
            }
        }
    }
}

extension SectionHeader where Trailing == EmptyView {
    init(eyebrow: String, title: String, subtitle: String? = nil) {
        self.init(eyebrow: eyebrow, title: title, subtitle: subtitle) { EmptyView() }
    }
}

/// Inline error banner.
struct ErrorBanner: View {
    let message: String
    var retry: (() -> Void)? = nil
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.red)
            Text(message).font(.footnote).foregroundStyle(Theme.muted)
            Spacer()
            if let retry {
                Button("Retry", action: retry).font(.footnote.weight(.semibold)).tint(Theme.gold)
            }
        }
        .padding(12)
        .background(Theme.red.opacity(0.10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.red.opacity(0.4), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

/// Centered empty / loading state.
struct CenterMessage: View {
    let systemImage: String
    let text: String
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage).font(.largeTitle).foregroundStyle(Theme.dim)
            Text(text).font(.subheadline).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

/// Simple wrapping tag row.
struct WrapTags: View {
    let tags: [String]
    var color: Color = Theme.gold
    var body: some View {
        FlexibleHStack(data: tags, spacing: 6) { t in
            Pill(text: t, color: color)
        }
    }
}

/// A minimal flow layout (wraps children to the next line).
struct FlexibleHStack<Data: RandomAccessCollection, Content: View>: View where Data.Element: Hashable {
    let data: Data
    var spacing: CGFloat = 6
    @ViewBuilder var content: (Data.Element) -> Content

    var body: some View {
        FlowLayout(spacing: spacing) {
            ForEach(Array(data), id: \.self) { content($0) }
        }
    }
}

/// iOS 16+ Layout that flows items left-to-right, wrapping as needed.
struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for v in subviews {
            let size = v.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0; y += rowHeight + spacing; rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: maxWidth == .infinity ? x : maxWidth, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for v in subviews {
            let size = v.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX; y += rowHeight + spacing; rowHeight = 0
            }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

/// A tappable card line with a leading SF Symbol, used in contact detail rows.
struct DetailRow: View {
    let icon: String
    let text: String
    var url: URL? = nil
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon).frame(width: 20).foregroundStyle(Theme.gold)
            if let url {
                Link(text, destination: url).foregroundStyle(Theme.blue)
            } else {
                Text(text).foregroundStyle(Theme.text)
            }
            Spacer(minLength: 0)
        }
        .font(.subheadline)
    }
}
