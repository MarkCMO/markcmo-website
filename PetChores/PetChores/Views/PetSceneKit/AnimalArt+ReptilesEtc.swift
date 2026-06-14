import SwiftUI
import Foundation

extension AnimalArt {

    // MARK: - Leopard gecko

    static func gecko(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.58 + bob(t, mood, s, speed: 1.4, amp: 0.02)
        let bodyL = rgb(246, 218, 122)
        let bodyD = rgb(214, 180, 90)
        let spot = rgb(110, 80, 46)

        // Thick banded tail that sways.
        var tc = ctx
        tc.translateBy(x: cx - s * 0.20, y: cy + s * 0.02)
        tc.rotate(by: .degrees(sin(t * 2.2) * (6 + 10 * liveliness(mood))))
        var tail = Path()
        tail.move(to: .zero)
        tail.addQuadCurve(to: CGPoint(x: -s * 0.28, y: s * 0.05), control: CGPoint(x: -s * 0.15, y: -s * 0.11))
        tc.stroke(tail, with: .color(bodyL), style: StrokeStyle(lineWidth: s * 0.12, lineCap: .round))
        for k in 1...3 {
            tc.stroke(Path { p in
                let x = -s * 0.06 * Double(k)
                p.move(to: CGPoint(x: x, y: -s * 0.02)); p.addLine(to: CGPoint(x: x, y: s * 0.05))
            }, with: .color(spot.opacity(0.65)), lineWidth: max(1, s * 0.022))
        }

        // Splayed legs.
        for sx in [-0.16, 0.16] {
            for sy in [-0.04, 0.12] {
                oval(&ctx, cx + CGFloat(sx) * s, cy + CGFloat(sy) * s + s * 0.10, s * 0.11, s * 0.05, bodyD)
            }
        }
        // Low body with leopard spots.
        shadedOval(&ctx, cx, cy, s * 0.54, s * 0.26, bodyL, bodyD)
        for (dx, dy) in [(-0.18, -0.02), (-0.08, 0.04), (0.02, -0.03), (0.10, 0.03), (-0.13, 0.05), (0.0, 0.06)] {
            dot(&ctx, cx + CGFloat(dx) * s, cy + CGFloat(dy) * s, s * 0.028, spot)
        }
        // Big head to the right.
        let hx = cx + s * 0.26, hy = cy - s * 0.02
        shadedOval(&ctx, hx, hy, s * 0.30, s * 0.24, bodyL, bodyD)
        realEye(&ctx, CGPoint(x: hx - s * 0.02, y: hy - s * 0.04), s * 0.045, mood: mood, skin: bodyL, iris: rgb(64, 48, 30))
        realEye(&ctx, CGPoint(x: hx + s * 0.10, y: hy - s * 0.04), s * 0.045, mood: mood, skin: bodyL, iris: rgb(64, 48, 30))
        // Wide gecko grin.
        ctx.stroke(Path { p in
            p.move(to: CGPoint(x: hx - s * 0.06, y: hy + s * 0.07))
            p.addQuadCurve(to: CGPoint(x: hx + s * 0.13, y: hy + s * 0.07), control: CGPoint(x: hx + s * 0.04, y: hy + s * 0.12))
        }, with: .color(rgb(150, 110, 70)), style: StrokeStyle(lineWidth: max(1.4, s * 0.012), lineCap: .round))
        dot(&ctx, hx + s * 0.14, hy - s * 0.005, s * 0.012, spot) // nostril
    }

    // MARK: - Tortoise

    static func tortoise(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.58 + bob(t, mood, s, speed: 0.9, amp: 0.02)
        let shellL = rgb(170, 128, 72)
        let shellD = rgb(118, 84, 44)
        let skin = rgb(178, 158, 118)
        let skinD = rgb(146, 126, 92)

        // Stubby shaded legs.
        for dx in [-0.22, 0.22] {
            shadedOval(&ctx, cx + CGFloat(dx) * s, cy + s * 0.16, s * 0.13, s * 0.11, skin, skinD)
        }
        // High domed shell, shaded.
        shadedOval(&ctx, cx, cy, s * 0.62, s * 0.48, shellL, shellD)
        // Central scute plus a ring of plates (the tortoise scute pattern).
        ctx.stroke(Path(ellipseIn: CGRect(x: cx - s * 0.10, y: cy - s * 0.13, width: s * 0.20, height: s * 0.18)),
                   with: .color(shellD), lineWidth: max(1, s * 0.012))
        for i in 0..<6 {
            let a = Double(i) * 60 * .pi / 180
            let px = cx + CGFloat(cos(a)) * s * 0.22
            let py = cy - s * 0.02 + CGFloat(sin(a)) * s * 0.16
            ctx.stroke(Path(ellipseIn: CGRect(x: px - s * 0.07, y: py - s * 0.06, width: s * 0.14, height: s * 0.12)),
                       with: .color(shellD.opacity(0.8)), lineWidth: max(1, s * 0.01))
        }
        // Bottom rim plates.
        for dx in stride(from: -0.26, through: 0.26, by: 0.13) {
            ctx.stroke(Path { p in
                let x = cx + CGFloat(dx) * s
                p.move(to: CGPoint(x: x, y: cy + s * 0.11)); p.addLine(to: CGPoint(x: x, y: cy + s * 0.21))
            }, with: .color(shellD.opacity(0.55)), lineWidth: max(1, s * 0.008))
        }
        // Head poking out, slowly.
        let poke = CGFloat(sin(t * 0.8)) * s * 0.03 * CGFloat(liveliness(mood))
        let hx = cx + s * 0.32 + poke, hy = cy + s * 0.06
        shadedOval(&ctx, hx, hy, s * 0.26, s * 0.22, skin, skinD)
        realEye(&ctx, CGPoint(x: hx, y: hy - s * 0.03), s * 0.032, mood: mood, skin: skin, iris: rgb(50, 40, 30))
        realEye(&ctx, CGPoint(x: hx + s * 0.08, y: hy - s * 0.03), s * 0.032, mood: mood, skin: skin, iris: rgb(50, 40, 30))
        mouth(&ctx, center: CGPoint(x: hx + s * 0.05, y: hy + s * 0.06), width: s * 0.10, mood: mood, color: rgb(120, 100, 70))
    }

    // MARK: - Chicken

    static func chicken(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.55
        let body = rgb(248, 244, 238)
        let comb = rgb(225, 70, 60)
        let beak = rgb(240, 175, 60)

        // Head bobs as if pecking.
        let peck = abs(sin(t * 2.5)) * s * 0.04 * CGFloat(liveliness(mood))

        // Legs.
        for dx in [-0.08, 0.08] {
            var leg = Path()
            leg.move(to: CGPoint(x: cx + CGFloat(dx) * s, y: cy + s * 0.18))
            leg.addLine(to: CGPoint(x: cx + CGFloat(dx) * s, y: cy + s * 0.30))
            ctx.stroke(leg, with: .color(beak), lineWidth: max(1.5, s * 0.02))
        }
        // Tail feathers.
        for i in 0..<3 {
            var fc = ctx
            fc.translateBy(x: cx - s * 0.22, y: cy - s * 0.04)
            fc.rotate(by: .degrees(Double(i - 1) * 18 + sin(t * 2) * 4 * liveliness(mood)))
            fc.fill(Path(ellipseIn: CGRect(x: -s * 0.20, y: -s * 0.03, width: s * 0.22, height: s * 0.07)),
                    with: .color(rgb(210, 200, 190)))
        }
        // Body.
        shadedOval(&ctx, cx, cy, s * 0.50, s * 0.46, body, rgb(226, 220, 210))
        // Wing.
        oval(&ctx, cx + s * 0.04, cy + s * 0.02, s * 0.26, s * 0.24, rgb(230, 222, 212))
        ctx.stroke(Path { p in
            p.move(to: CGPoint(x: cx - s * 0.04, y: cy + s * 0.02))
            p.addQuadCurve(to: CGPoint(x: cx + s * 0.14, y: cy + s * 0.02), control: CGPoint(x: cx + s * 0.05, y: cy - s * 0.06))
        }, with: .color(rgb(206, 198, 188)), lineWidth: max(1, s * 0.01)) // wing feather line

        // Head.
        let hx = cx + s * 0.16, hy = cy - s * 0.20 + peck
        shadedOval(&ctx, hx, hy, s * 0.26, s * 0.26, body, rgb(226, 220, 210))
        // Comb.
        for dx in [-0.04, 0.0, 0.04] {
            dot(&ctx, hx + CGFloat(dx) * s, hy - s * 0.14, s * 0.035, comb)
        }
        // Beak.
        var bk = Path()
        bk.move(to: CGPoint(x: hx + s * 0.10, y: hy))
        bk.addLine(to: CGPoint(x: hx + s * 0.20, y: hy + s * 0.03))
        bk.addLine(to: CGPoint(x: hx + s * 0.10, y: hy + s * 0.06))
        bk.closeSubpath()
        ctx.fill(bk, with: .color(beak))
        // Wattle.
        dot(&ctx, hx + s * 0.10, hy + s * 0.09, s * 0.03, comb)

        eyes(&ctx, left: CGPoint(x: hx + s * 0.02, y: hy - s * 0.02),
             right: CGPoint(x: hx + s * 0.02, y: hy - s * 0.02), r: s * 0.03, mood: mood, skin: body)
    }

    // MARK: - Tarantula (gentle, never scary)

    static func tarantula(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.56 + bob(t, mood, s, speed: 1.2, amp: 0.02)
        let body = rgb(86, 66, 70)
        let fuzz = rgb(120, 92, 84)

        // Eight legs, four per side, gently flexing.
        for side in [-1.0, 1.0] {
            for i in 0..<4 {
                let baseY = cy - s * 0.10 + CGFloat(i) * s * 0.07
                let flex = sin(t * 3 + Double(i) + (side > 0 ? 0 : 1.5)) * (3 + 6 * liveliness(mood))
                var leg = Path()
                let bx = cx + CGFloat(side) * s * 0.10
                leg.move(to: CGPoint(x: bx, y: baseY))
                leg.addQuadCurve(
                    to: CGPoint(x: bx + CGFloat(side) * s * 0.30, y: baseY + CGFloat(flex)),
                    control: CGPoint(x: bx + CGFloat(side) * s * 0.20, y: baseY - s * 0.10)
                )
                ctx.stroke(leg, with: .color(fuzz), style: StrokeStyle(lineWidth: s * 0.035, lineCap: .round))
            }
        }

        // Abdomen and cephalothorax (shaded, fuzzy).
        shadedOval(&ctx, cx, cy + s * 0.06, s * 0.40, s * 0.34, fuzz, body)
        shadedOval(&ctx, cx, cy - s * 0.14, s * 0.30, s * 0.24, rgb(134, 104, 96), body)
        // A few fuzz hairs on the abdomen.
        for a in stride(from: 0.0, to: 360.0, by: 45.0) {
            let r = a * .pi / 180
            let bx = cx + CGFloat(cos(r)) * s * 0.18
            let by = cy + s * 0.06 + CGFloat(sin(r)) * s * 0.15
            ctx.stroke(Path { p in
                p.move(to: CGPoint(x: bx, y: by))
                p.addLine(to: CGPoint(x: bx + CGFloat(cos(r)) * s * 0.03, y: by + CGFloat(sin(r)) * s * 0.03))
            }, with: .color(fuzz.opacity(0.7)), lineWidth: max(1, s * 0.006))
        }

        // A friendly cluster of small eyes and a soft smile.
        for dx in [-0.06, -0.02, 0.02, 0.06] {
            dot(&ctx, cx + CGFloat(dx) * s, cy - s * 0.18, s * 0.018, .white)
            dot(&ctx, cx + CGFloat(dx) * s, cy - s * 0.18, s * 0.011, rgb(28, 28, 32))
        }
        mouth(&ctx, center: CGPoint(x: cx, y: cy - s * 0.08), width: s * 0.12, mood: mood, color: rgb(50, 38, 40))
    }
}
