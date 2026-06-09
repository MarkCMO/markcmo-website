import SwiftUI
import Foundation

extension AnimalArt {

    // MARK: - Hamster

    static func hamster(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.56 + bob(t, mood, s, speed: 2.6, amp: 0.05)
        let body = rgb(226, 178, 120)
        let belly = rgb(248, 236, 220)

        // Round body.
        oval(&ctx, cx, cy, s * 0.56, s * 0.52, body)
        oval(&ctx, cx, cy + s * 0.06, s * 0.34, s * 0.30, belly)

        // Tiny ears.
        for side in [-1.0, 1.0] {
            dot(&ctx, cx + CGFloat(side) * s * 0.20, cy - s * 0.20, s * 0.07, body)
        }
        // Cheek pouches puff on happier moods.
        let puff = s * (0.10 + 0.03 * CGFloat(liveliness(mood)))
        oval(&ctx, cx - s * 0.22, cy + s * 0.02, puff, puff, body)
        oval(&ctx, cx + s * 0.22, cy + s * 0.02, puff, puff, body)

        eyes(&ctx, left: CGPoint(x: cx - s * 0.10, y: cy - s * 0.04),
             right: CGPoint(x: cx + s * 0.10, y: cy - s * 0.04), r: s * 0.05, mood: mood, skin: body)
        dot(&ctx, cx, cy + s * 0.02, s * 0.028, rgb(140, 90, 90)) // nose
        mouth(&ctx, center: CGPoint(x: cx, y: cy + s * 0.07), width: s * 0.10, mood: mood)
        // Little paws.
        for side in [-1.0, 1.0] {
            dot(&ctx, cx + CGFloat(side) * s * 0.08, cy + s * 0.22, s * 0.04, belly)
        }
    }

    // MARK: - Guinea pig

    static func guineaPig(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.56 + bob(t, mood, s, speed: 1.8, amp: 0.035)
        let body = rgb(196, 142, 96)
        let patch = rgb(244, 238, 230)

        // Oblong body, no tail.
        oval(&ctx, cx, cy, s * 0.74, s * 0.46, body)
        // White patch.
        oval(&ctx, cx + s * 0.14, cy, s * 0.34, s * 0.40, patch)

        // Small ears near the head end (left side).
        let hx = cx - s * 0.22
        for side in [-1.0, 1.0] {
            oval(&ctx, hx + CGFloat(side) * s * 0.10, cy - s * 0.18, s * 0.10, s * 0.08, rgb(150, 100, 80))
        }
        eyes(&ctx, left: CGPoint(x: hx - s * 0.02, y: cy - s * 0.05),
             right: CGPoint(x: hx + s * 0.12, y: cy - s * 0.05), r: s * 0.045, mood: mood, skin: body)
        dot(&ctx, hx + s * 0.05, cy + s * 0.02, s * 0.03, rgb(150, 100, 100)) // nose
        mouth(&ctx, center: CGPoint(x: hx + s * 0.05, y: cy + s * 0.07), width: s * 0.10, mood: mood)
    }

    // MARK: - Parakeet

    static func parakeet(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        // Birds hop: a sharper bob.
        let hop = abs(sin(t * 3)) * s * 0.05 * CGFloat(liveliness(mood))
        let cy = size.height * 0.54 - hop
        let body = rgb(120, 200, 110)
        let wing = rgb(90, 170, 90)
        let head = rgb(240, 220, 90)

        // Tail feathers.
        var tc = ctx
        tc.translateBy(x: cx - s * 0.18, y: cy + s * 0.16)
        tc.rotate(by: .degrees(sin(t * 2) * 6 * liveliness(mood)))
        tc.fill(Path(roundedRect: CGRect(x: -s * 0.22, y: -s * 0.03, width: s * 0.24, height: s * 0.06),
                     cornerRadius: s * 0.03), with: .color(wing))

        // Body and head.
        oval(&ctx, cx, cy + s * 0.02, s * 0.40, s * 0.50, body)
        // Wing that flutters slightly.
        var wc = ctx
        wc.translateBy(x: cx + s * 0.04, y: cy + s * 0.04)
        wc.rotate(by: .degrees(sin(t * 5) * 6 * liveliness(mood)))
        wc.fill(Path(ellipseIn: CGRect(x: -s * 0.04, y: -s * 0.12, width: s * 0.18, height: s * 0.26)),
                with: .color(wing))

        let hy = cy - s * 0.20
        oval(&ctx, cx, hy, s * 0.30, s * 0.28, head)

        // Beak.
        var beak = Path()
        beak.move(to: CGPoint(x: cx + s * 0.10, y: hy + s * 0.01))
        beak.addLine(to: CGPoint(x: cx + s * 0.20, y: hy + s * 0.04))
        beak.addLine(to: CGPoint(x: cx + s * 0.10, y: hy + s * 0.07))
        beak.closeSubpath()
        ctx.fill(beak, with: .color(rgb(230, 160, 70)))

        eyes(&ctx, left: CGPoint(x: cx - s * 0.02, y: hy - s * 0.01),
             right: CGPoint(x: cx + s * 0.06, y: hy - s * 0.01), r: s * 0.035, mood: mood, skin: head)
        // Cheek spot, a budgie marking.
        dot(&ctx, cx - s * 0.04, hy + s * 0.07, s * 0.025, rgb(120, 160, 220).opacity(0.7))
    }
}
