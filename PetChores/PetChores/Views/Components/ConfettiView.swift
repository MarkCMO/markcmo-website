import SwiftUI
import Foundation

/// A brief, joyful confetti burst drawn in a Canvas. Shown for a moment when a chore is
/// completed or verified. Decorative only, so it ignores hits and is hidden from
/// VoiceOver.
struct ConfettiView: View {
    private let colors: [Color] = [.red, .orange, .yellow, .green, .blue, .purple, .pink]

    var body: some View {
        GeometryReader { geo in
            TimelineView(.animation) { timeline in
                let t = timeline.date.timeIntervalSinceReferenceDate
                Canvas { ctx, size in
                    for i in 0..<44 {
                        let speed = 120.0 + Double(i % 6) * 45
                        let range = Double(size.height) + 60
                        let fall = (t * speed + Double(i) * 53).truncatingRemainder(dividingBy: range)
                        let x = size.width * Double((i * 73 + 11) % 100) / 100
                        let drift = sin(t * 2 + Double(i)) * 10
                        var piece = ctx
                        piece.translateBy(x: CGFloat(x) + CGFloat(drift), y: CGFloat(fall) - 30)
                        piece.rotate(by: .degrees(t * 200 + Double(i) * 40))
                        let color = colors[i % colors.count]
                        piece.fill(
                            Path(roundedRect: CGRect(x: -4, y: -6, width: 8, height: 12), cornerRadius: 2),
                            with: .color(color)
                        )
                    }
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
