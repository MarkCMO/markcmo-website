import SwiftUI
import Foundation

extension AnimalArt {

    // MARK: - Leopard gecko

    static func gecko(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.58 + bob(t, mood, s, speed: 1.4, amp: 0.025)
        let body = rgb(240, 210, 110)
        let spot = rgb(120, 90, 50)

        // Curving tail that sways.
        var tc = ctx
        tc.translateBy(x: cx - s * 0.22, y: cy + s * 0.02)
        tc.rotate(by: .degrees(sin(t * 2.2) * (8 + 12 * liveliness(mood))))
        var tail = Path()
        tail.move(to: .zero)
        tail.addQuadCurve(to: CGPoint(x: -s * 0.26, y: s * 0.04), control: CGPoint(x: -s * 0.14, y: -s * 0.10))
        tc.stroke(tail, with: .color(body), style: StrokeStyle(lineWidth: s * 0.10, lineCap: .round))

        // Legs.
        for sx in [-0.14, 0.18] {
            for sy in [-0.06, 0.10] {
                oval(&ctx, cx + CGFloat(sx) * s, cy + CGFloat(sy) * s + s * 0.10, s * 0.10, s * 0.05, body)
            }
        }
        // Body.
        oval(&ctx, cx, cy, s * 0.56, s * 0.26, body)
        // Spots.
        for dx in [-0.18, -0.06, 0.06] {
            dot(&ctx, cx + CGFloat(dx) * s, cy - s * 0.02, s * 0.03, spot)
            dot(&ctx, cx + CGFloat(dx) * s + s * 0.03, cy + s * 0.04, s * 0.022, spot)
        }
        // Head to the right.
        let hx = cx + s * 0.26, hy = cy - s * 0.01
        oval(&ctx, hx, hy, s * 0.26, s * 0.20, body)
        eyes(&ctx, left: CGPoint(x: hx - s * 0.01, y: hy - s * 0.03),
             right: CGPoint(x: hx + s * 0.07, y: hy - s * 0.03), r: s * 0.035, mood: mood, skin: body)
        mouth(&ctx, center: CGPoint(x: hx + s * 0.04, y: hy + s * 0.05), width: s * 0.12, mood: mood, color: rgb(150, 110, 70))
    }

    // MARK: - Tortoise

    static func tortoise(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.58 + bob(t, mood, s, speed: 0.9, amp: 0.02)
        let shell = rgb(150, 110, 60)
        let shellDark = rgb(120, 86, 46)
        let skin = rgb(170, 150, 110)

        // Stubby legs.
        for dx in [-0.20, 0.20] {
            oval(&ctx, cx + CGFloat(dx) * s, cy + s * 0.16, s * 0.12, s * 0.10, skin)
        }
        // High domed shell with plates.
        oval(&ctx, cx, cy, s * 0.62, s * 0.46, shell)
        ctx.fill(Path(ellipseIn: CGRect(x: cx - s * 0.31, y: cy - s * 0.23, width: s * 0.62, height: s * 0.30)),
                 with: .color(shellDark.opacity(0.5)))
        for dx in [-0.18, 0.0, 0.18] {
            ctx.stroke(Path(ellipseIn: CGRect(x: cx + CGFloat(dx) * s - s * 0.07, y: cy - s * 0.16,
                                              width: s * 0.14, height: s * 0.18)),
                       with: .color(shellDark), lineWidth: max(1, s * 0.01))
        }
        // Head to the right, slowly poking in and out.
        let poke = CGFloat(sin(t * 0.8)) * s * 0.03 * CGFloat(liveliness(mood))
        let hx = cx + s * 0.30 + poke, hy = cy + s * 0.04
        oval(&ctx, hx, hy, s * 0.24, s * 0.20, skin)
        eyes(&ctx, left: CGPoint(x: hx, y: hy - s * 0.03),
             right: CGPoint(x: hx + s * 0.07, y: hy - s * 0.03), r: s * 0.03, mood: mood, skin: skin)
        mouth(&ctx, center: CGPoint(x: hx + s * 0.04, y: hy + s * 0.05), width: s * 0.10, mood: mood, color: rgb(120, 100, 70))
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
        oval(&ctx, cx, cy, s * 0.50, s * 0.46, body)
        // Wing.
        oval(&ctx, cx + s * 0.04, cy + s * 0.02, s * 0.26, s * 0.24, rgb(232, 226, 218))

        // Head.
        let hx = cx + s * 0.16, hy = cy - s * 0.20 + peck
        oval(&ctx, hx, hy, s * 0.26, s * 0.26, body)
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

        // Abdomen and cephalothorax.
        oval(&ctx, cx, cy + s * 0.06, s * 0.40, s * 0.34, body)
        oval(&ctx, cx, cy - s * 0.14, s * 0.30, s * 0.24, fuzz)

        // A friendly cluster of small eyes and a soft smile.
        for dx in [-0.06, -0.02, 0.02, 0.06] {
            dot(&ctx, cx + CGFloat(dx) * s, cy - s * 0.18, s * 0.018, .white)
            dot(&ctx, cx + CGFloat(dx) * s, cy - s * 0.18, s * 0.011, rgb(28, 28, 32))
        }
        mouth(&ctx, center: CGPoint(x: cx, y: cy - s * 0.08), width: s * 0.12, mood: mood, color: rgb(50, 38, 40))
    }
}
