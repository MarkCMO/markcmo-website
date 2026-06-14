import SwiftUI
import Foundation

extension AnimalArt {

    // MARK: - Dog

    static func dog(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.56 + bob(t, mood, s)
        let body = rgb(206, 158, 108)
        let dark = rgb(150, 110, 70)
        let snout = rgb(236, 212, 178)
        let ear = rgb(128, 92, 60)
        let earIn = rgb(170, 126, 98)

        // Wagging tail (behind the body).
        var tc = ctx
        tc.translateBy(x: cx - s * 0.24, y: cy)
        let wag = sin(t * 6) * (6 + 16 * liveliness(mood))
        tc.rotate(by: .degrees(wag))
        tc.fill(Path(roundedRect: CGRect(x: -s * 0.22, y: -s * 0.04, width: s * 0.22, height: s * 0.08),
                     cornerRadius: s * 0.04), with: .color(dark))

        // Legs with paws.
        for dx in [-0.17, 0.17] {
            oval(&ctx, cx + CGFloat(dx) * s, cy + s * 0.20, s * 0.11, s * 0.17, dark)
            oval(&ctx, cx + CGFloat(dx) * s, cy + s * 0.27, s * 0.12, s * 0.07, body)
        }
        // Body with a lighter belly.
        oval(&ctx, cx, cy, s * 0.50, s * 0.42, body)
        oval(&ctx, cx, cy + s * 0.07, s * 0.30, s * 0.24, snout)

        // Head.
        let hx = cx, hy = cy - s * 0.25
        oval(&ctx, hx, hy, s * 0.40, s * 0.38, body)

        // Big floppy ears IN FRONT of the head, hanging from the sides, with inner ear.
        for side in [-1.0, 1.0] {
            var ec = ctx
            ec.translateBy(x: hx + CGFloat(side) * s * 0.19, y: hy - s * 0.12)
            ec.rotate(by: .degrees(side * (16 + sin(t * 2 + side) * 5 * liveliness(mood))))
            ec.fill(Path(ellipseIn: CGRect(x: -s * 0.085, y: 0, width: s * 0.17, height: s * 0.36)),
                    with: .color(ear))
            ec.fill(Path(ellipseIn: CGRect(x: -s * 0.045, y: s * 0.05, width: s * 0.09, height: s * 0.24)),
                    with: .color(earIn))
        }

        // Soft brown patch around one eye for character.
        oval(&ctx, hx + s * 0.10, hy - s * 0.02, s * 0.17, s * 0.17, dark.opacity(0.5))
        // Muzzle.
        oval(&ctx, hx, hy + s * 0.10, s * 0.28, s * 0.22, snout)

        eyes(&ctx, left: CGPoint(x: hx - s * 0.10, y: hy - s * 0.03),
             right: CGPoint(x: hx + s * 0.10, y: hy - s * 0.03), r: s * 0.05, mood: mood, skin: body)
        // Big shiny nose.
        dot(&ctx, hx, hy + s * 0.06, s * 0.05, rgb(40, 28, 28))
        dot(&ctx, hx - s * 0.018, hy + s * 0.045, s * 0.018, .white.opacity(0.7))
        // Philtrum line from nose to mouth.
        var phil = Path()
        phil.move(to: CGPoint(x: hx, y: hy + s * 0.10))
        phil.addLine(to: CGPoint(x: hx, y: hy + s * 0.14))
        ctx.stroke(phil, with: .color(rgb(90, 62, 50)), lineWidth: max(1.2, s * 0.01))
        mouth(&ctx, center: CGPoint(x: hx, y: hy + s * 0.15), width: s * 0.18, mood: mood)
        // Lolling tongue when happy.
        if mood == .happy || mood == .content {
            ctx.fill(Path(roundedRect: CGRect(x: hx - s * 0.035, y: hy + s * 0.155, width: s * 0.07, height: s * 0.10),
                          cornerRadius: s * 0.035), with: .color(rgb(238, 132, 142)))
        }
        cheeks(&ctx, left: CGPoint(x: hx - s * 0.16, y: hy + s * 0.07),
               right: CGPoint(x: hx + s * 0.16, y: hy + s * 0.07), r: s * 0.035, mood: mood)
    }

    // MARK: - Cat

    static func cat(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.56 + bob(t, mood, s, speed: 1.6)
        let body = rgb(140, 146, 156)
        let dark = rgb(108, 114, 126)

        // Curled tail swishing.
        var tc = ctx
        tc.translateBy(x: cx + s * 0.22, y: cy + s * 0.04)
        tc.rotate(by: .degrees(sin(t * 2.4) * (8 + 14 * liveliness(mood))))
        var tail = Path()
        tail.move(to: .zero)
        tail.addQuadCurve(to: CGPoint(x: s * 0.18, y: -s * 0.18), control: CGPoint(x: s * 0.22, y: s * 0.02))
        tc.stroke(tail, with: .color(dark), style: StrokeStyle(lineWidth: s * 0.07, lineCap: .round))

        // Body and head.
        oval(&ctx, cx, cy, s * 0.46, s * 0.40, body)
        let hx = cx, hy = cy - s * 0.24

        // Pointy ears.
        for side in [-1.0, 1.0] {
            var p = Path()
            let bx = hx + CGFloat(side) * s * 0.14
            p.move(to: CGPoint(x: bx - s * 0.07, y: hy - s * 0.10))
            p.addLine(to: CGPoint(x: bx + CGFloat(side) * s * 0.02, y: hy - s * 0.26))
            p.addLine(to: CGPoint(x: bx + s * 0.07, y: hy - s * 0.10))
            p.closeSubpath()
            ctx.fill(p, with: .color(body))
        }
        oval(&ctx, hx, hy, s * 0.38, s * 0.34, body)

        eyes(&ctx, left: CGPoint(x: hx - s * 0.09, y: hy - s * 0.02),
             right: CGPoint(x: hx + s * 0.09, y: hy - s * 0.02), r: s * 0.05, mood: mood, skin: body)
        dot(&ctx, hx, hy + s * 0.05, s * 0.03, rgb(220, 130, 140)) // nose
        mouth(&ctx, center: CGPoint(x: hx, y: hy + s * 0.10), width: s * 0.14, mood: mood)

        // Whiskers.
        for side in [-1.0, 1.0] {
            for k in [-1.0, 0.0, 1.0] {
                var w = Path()
                w.move(to: CGPoint(x: hx + CGFloat(side) * s * 0.05, y: hy + s * 0.06))
                w.addLine(to: CGPoint(x: hx + CGFloat(side) * s * 0.22, y: hy + s * 0.06 + CGFloat(k) * s * 0.04))
                ctx.stroke(w, with: .color(.white.opacity(0.7)), lineWidth: max(1, s * 0.008))
            }
        }
    }

    // MARK: - Rabbit

    static func rabbit(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.58 + bob(t, mood, s, speed: 2.4, amp: 0.06)
        let body = rgb(232, 226, 220)
        let inner = rgb(248, 196, 200)

        // Tall ears that twitch.
        for side in [-1.0, 1.0] {
            var ec = ctx
            ec.translateBy(x: cx + CGFloat(side) * s * 0.09, y: cy - s * 0.26)
            ec.rotate(by: .degrees(side * (8 + sin(t * 3 + side) * 5 * liveliness(mood))))
            ec.fill(Path(ellipseIn: CGRect(x: -s * 0.05, y: -s * 0.30, width: s * 0.10, height: s * 0.34)),
                    with: .color(body))
            ec.fill(Path(ellipseIn: CGRect(x: -s * 0.025, y: -s * 0.26, width: s * 0.05, height: s * 0.24)),
                    with: .color(inner))
        }

        // Body and head.
        oval(&ctx, cx, cy + s * 0.05, s * 0.42, s * 0.40, body)
        let hy = cy - s * 0.18
        oval(&ctx, cx, hy, s * 0.34, s * 0.32, body)
        oval(&ctx, cx, cy + s * 0.22, s * 0.12, s * 0.10, .white) // tail puff hint at front base

        eyes(&ctx, left: CGPoint(x: cx - s * 0.08, y: hy - s * 0.01),
             right: CGPoint(x: cx + s * 0.08, y: hy - s * 0.01), r: s * 0.05, mood: mood, skin: body)
        dot(&ctx, cx, hy + s * 0.06, s * 0.028, rgb(220, 150, 160)) // nose
        mouth(&ctx, center: CGPoint(x: cx, y: hy + s * 0.10), width: s * 0.12, mood: mood)
        cheeks(&ctx, left: CGPoint(x: cx - s * 0.13, y: hy + s * 0.05),
               right: CGPoint(x: cx + s * 0.13, y: hy + s * 0.05), r: s * 0.03, mood: mood)
    }
}
