import SwiftUI

/// Small shared style helpers so screens stay bright, rounded, and friendly with one
/// clear primary action each (Section 14).
enum Theme {
    static let corner: CGFloat = 18
    static let cardCorner: CGFloat = 22
    static let minTap: CGFloat = 44   // accessibility minimum (Section 13)
}

/// A soft card container used across screens.
struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous)
                    .fill(Color(.secondarySystemBackground))
            )
    }
}

/// A large, friendly primary button style.
struct BigButtonStyle: ButtonStyle {
    var tint: Color = .accentColor
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title3.weight(.bold))
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(tint.opacity(configuration.isPressed ? 0.7 : 1))
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .contentShape(Rectangle())
    }
}

extension View {
    /// Difficulty shown as filled paws out of 5 (Section 5, Screen 4).
    func pawMeter(_ level: Int) -> some View {
        HStack(spacing: 3) {
            ForEach(1...5, id: \.self) { i in
                Image(systemName: i <= level ? "pawprint.fill" : "pawprint")
                    .font(.caption2)
                    .foregroundStyle(i <= level ? Color.accentColor : Color.secondary.opacity(0.4))
            }
        }
        .accessibilityLabel("Difficulty \(level) out of 5")
    }
}
