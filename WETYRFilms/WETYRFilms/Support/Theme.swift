import SwiftUI

/// Shared visual language mirroring the wetyr-films.html dark dashboard:
/// near-black surfaces, hairline borders, gold accent, mono metadata.
enum Theme {
    // Palette (matches the web :root tokens)
    static let bg       = Color(hex: 0x0A0A0A)
    static let panel    = Color(hex: 0x131316)
    static let panel2   = Color(hex: 0x1C1C20)
    static let border   = Color(hex: 0x27272A)
    static let borderHot = Color(hex: 0x3F3F46)
    static let text     = Color(hex: 0xFAFAFA)
    static let muted    = Color(hex: 0xA1A1AA)
    static let dim      = Color(hex: 0x71717A)
    static let gold     = Color(hex: 0xD4AF37)
    static let red      = Color(hex: 0xDC2626)
    static let green    = Color(hex: 0x16A34A)
    static let blue     = Color(hex: 0x2563EB)
    static let purple   = Color(hex: 0x9333EA)

    static let corner: CGFloat = 12
    static let cardCorner: CGFloat = 14
}

/// A dark panel container with a hairline border, the dashboard's core surface.
struct Panel<Content: View>: View {
    var title: String? = nil
    var tag: String? = nil
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if title != nil || tag != nil {
                HStack(alignment: .firstTextBaseline) {
                    if let title {
                        Text(title)
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Theme.text)
                    }
                    Spacer()
                    if let tag {
                        Text(tag)
                            .font(.system(size: 11, weight: .semibold))
                            .tracking(1)
                            .foregroundStyle(Theme.dim)
                    }
                }
                Divider().overlay(Theme.border)
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous)
                .fill(Theme.panel)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous)
                .stroke(Theme.border, lineWidth: 1)
        )
    }
}

/// Small uppercase eyebrow used on section headers.
struct Eyebrow: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 12, weight: .bold))
            .tracking(2)
            .foregroundStyle(Theme.gold)
    }
}

/// A pill badge. Colors map to the web's tag styles.
struct Pill: View {
    let text: String
    var color: Color = Theme.gold
    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .bold))
            .tracking(0.5)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(color)
            .background(color.opacity(0.13))
            .clipShape(Capsule())
    }
}

/// A small green "LIVE" indicator with a pulsing dot.
struct LivePill: View {
    @State private var on = true
    var label: String = "LIVE"
    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(Theme.green)
                .frame(width: 6, height: 6)
                .opacity(on ? 1 : 0.3)
            Text(label)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.green)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(Theme.green.opacity(0.12))
        .clipShape(Capsule())
        .onAppear {
            withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) {
                on = false
            }
        }
    }
}

extension Color {
    /// Build a Color from a 0xRRGGBB hex integer.
    init(hex: UInt32, alpha: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
