import SwiftUI
import Foundation

extension AnimalArt {

    // MARK: - Hamster

    static func hamster(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.57 + bob(t, mood, s, speed: 2.6, amp: 0.04)
        let furL = rgb(234, 190, 132)
        let furD = rgb(196, 150, 96)
        let belly = rgb(250, 240, 226)
        let pink = rgb(232, 168, 166)

        // Round shaded body with a cream belly.
        shadedOval(&ctx, cx, cy, s * 0.56, s * 0.52, furL, furD)
        oval(&ctx, cx, cy + s * 0.09, s * 0.34, s * 0.30, belly)

        // Rounded ears with pink inner.
        for side in [-1.0, 1.0] {
            oval(&ctx, cx + CGFloat(side) * s * 0.20, cy - s * 0.21, s * 0.12, s * 0.12, furD)
            oval(&ctx, cx + CGFloat(side) * s * 0.20, cy - s * 0.20, s * 0.06, s * 0.06, pink)
        }
        // Chubby cheek pouches (stuffed with food).
        let puff = s * (0.13 + 0.03 * CGFloat(liveliness(mood)))
        shadedOval(&ctx, cx - s * 0.22, cy + s * 0.04, puff, puff, furL, furD)
        shadedOval(&ctx, cx + s * 0.22, cy + s * 0.04, puff, puff, furL, furD)

        realEye(&ctx, CGPoint(x: cx - s * 0.10, y: cy - s * 0.05), s * 0.045, mood: mood, skin: furL, iris: rgb(40, 30, 28))
        realEye(&ctx, CGPoint(x: cx + s * 0.10, y: cy - s * 0.05), s * 0.045, mood: mood, skin: furL, iris: rgb(40, 30, 28))
        dot(&ctx, cx, cy + s * 0.0, s * 0.026, pink) // nose
        mouth(&ctx, center: CGPoint(x: cx, y: cy + s * 0.045), width: s * 0.08, mood: mood)

        // Tiny paws holding a sunflower seed.
        oval(&ctx, cx, cy + s * 0.19, s * 0.11, s * 0.07, belly)
        var seed = Path(ellipseIn: CGRect(x: cx - s * 0.022, y: cy + s * 0.135, width: s * 0.044, height: s * 0.065))
        ctx.fill(seed, with: .color(rgb(58, 48, 40)))
        seed = Path(ellipseIn: CGRect(x: cx - s * 0.012, y: cy + s * 0.145, width: s * 0.024, height: s * 0.04))
        ctx.fill(seed, with: .color(rgb(220, 210, 190)))
        // Whisker dots.
        for side in [-1.0, 1.0] { dot(&ctx, cx + CGFloat(side) * s * 0.06, cy + s * 0.0, s * 0.006, furD) }
    }

    // MARK: - Guinea pig

    static func guineaPig(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.57 + bob(t, mood, s, speed: 1.8, amp: 0.03)
        let furL = rgb(210, 156, 106)
        let furD = rgb(166, 116, 76)
        let patch = rgb(246, 240, 232)
        let pink = rgb(226, 158, 156)

        // Oblong shaded body, no tail.
        shadedOval(&ctx, cx, cy, s * 0.74, s * 0.46, furL, furD)
        // Two-tone (rosette) white patch on the rump.
        oval(&ctx, cx + s * 0.17, cy, s * 0.32, s * 0.42, patch)
        // Cowlick fur tufts along the back.
        for fx in stride(from: -0.26, through: 0.26, by: 0.105) {
            let tx = cx + CGFloat(fx) * s
            var tuft = Path()
            tuft.move(to: CGPoint(x: tx, y: cy - s * 0.21))
            tuft.addLine(to: CGPoint(x: tx + s * 0.028, y: cy - s * 0.27))
            tuft.addLine(to: CGPoint(x: tx + s * 0.056, y: cy - s * 0.21))
            tuft.closeSubpath()
            ctx.fill(tuft, with: .color(fx > 0.03 ? patch : furD))
        }

        let hx = cx - s * 0.24
        // Petal ears.
        for side in [-1.0, 1.0] {
            oval(&ctx, hx + CGFloat(side) * s * 0.08, cy - s * 0.16, s * 0.11, s * 0.085, furD)
        }
        realEye(&ctx, CGPoint(x: hx - s * 0.02, y: cy - s * 0.05), s * 0.045, mood: mood, skin: furL, iris: rgb(44, 32, 30))
        realEye(&ctx, CGPoint(x: hx + s * 0.13, y: cy - s * 0.05), s * 0.045, mood: mood, skin: furL, iris: rgb(44, 32, 30))
        dot(&ctx, hx + s * 0.055, cy + s * 0.02, s * 0.028, pink) // nose
        mouth(&ctx, center: CGPoint(x: hx + s * 0.055, y: cy + s * 0.07), width: s * 0.09, mood: mood)
        // A leaf of veggie to munch.
        ctx.fill(Path(ellipseIn: CGRect(x: hx - s * 0.17, y: cy + s * 0.01, width: s * 0.11, height: s * 0.055)),
                 with: .color(rgb(108, 170, 78)))
        ctx.stroke(Path { p in
            p.move(to: CGPoint(x: hx - s * 0.16, y: cy + s * 0.037)); p.addLine(to: CGPoint(x: hx - s * 0.07, y: cy + s * 0.037))
        }, with: .color(rgb(80, 130, 56)), lineWidth: max(1, s * 0.006))
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
