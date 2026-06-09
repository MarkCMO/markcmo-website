import SwiftUI
import Foundation

extension AnimalArt {

    // MARK: - Fish

    static func fish(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let swim = CGFloat(sin(t * 0.8)) * s * 0.06 * CGFloat(liveliness(mood))
        let cx = size.width / 2 + swim
        let cy = size.height / 2 + CGFloat(sin(t * 1.4)) * s * 0.02
        let body = rgb(255, 150, 70)
        let fin = rgb(255, 190, 120)

        // Tail fin (flaps).
        var tc = ctx
        tc.translateBy(x: cx - s * 0.22, y: cy)
        tc.rotate(by: .degrees(sin(t * 8) * (8 + 12 * liveliness(mood))))
        var tail = Path()
        tail.move(to: .zero)
        tail.addLine(to: CGPoint(x: -s * 0.18, y: -s * 0.14))
        tail.addLine(to: CGPoint(x: -s * 0.18, y: s * 0.14))
        tail.closeSubpath()
        tc.fill(tail, with: .color(fin))

        // Top and bottom fins.
        var topFin = Path()
        topFin.move(to: CGPoint(x: cx - s * 0.06, y: cy - s * 0.14))
        topFin.addQuadCurve(to: CGPoint(x: cx + s * 0.10, y: cy - s * 0.14),
                            control: CGPoint(x: cx + s * 0.02, y: cy - s * 0.28))
        ctx.fill(topFin, with: .color(fin))

        // Body.
        oval(&ctx, cx, cy, s * 0.50, s * 0.34, body)
        // Side fin flutters.
        var sc = ctx
        sc.translateBy(x: cx + s * 0.02, y: cy + s * 0.06)
        sc.rotate(by: .degrees(sin(t * 7) * 12 * liveliness(mood)))
        sc.fill(Path(ellipseIn: CGRect(x: -s * 0.05, y: 0, width: s * 0.10, height: s * 0.14)), with: .color(fin))

        // Face near the front (right side).
        let fx = cx + s * 0.16
        dot(&ctx, fx, cy - s * 0.04, s * 0.05, .white)
        dot(&ctx, fx + s * 0.005, cy - s * 0.04, s * 0.028, rgb(28, 28, 32))
        if mood == .sad || mood == .pleaseHelp {
            ctx.fill(Path(roundedRect: CGRect(x: fx - s * 0.05, y: cy - s * 0.09, width: s * 0.10, height: s * 0.05),
                          cornerRadius: s * 0.02), with: .color(body))
        }
        mouth(&ctx, center: CGPoint(x: fx + s * 0.04, y: cy + s * 0.04), width: s * 0.08, mood: mood, color: rgb(180, 90, 50))
    }

    // MARK: - Betta

    static func betta(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let swim = CGFloat(sin(t * 0.7)) * s * 0.05 * CGFloat(liveliness(mood))
        let cx = size.width / 2 + swim
        let cy = size.height / 2 + CGFloat(sin(t * 1.2)) * s * 0.02
        let body = rgb(120, 90, 220)
        let finC = rgb(200, 70, 150)

        // Flowing fins: several curved shapes behind the body that ripple.
        for i in 0..<3 {
            let ripple = sin(t * 4 + Double(i)) * (6 + 10 * liveliness(mood))
            var fc = ctx
            fc.translateBy(x: cx - s * 0.10, y: cy)
            fc.rotate(by: .degrees(ripple))
            var fin = Path()
            let spread = s * (0.22 + 0.04 * Double(i))
            fin.move(to: .zero)
            fin.addQuadCurve(to: CGPoint(x: -spread, y: 0), control: CGPoint(x: -spread * 0.5, y: -spread * 0.6))
            fin.addQuadCurve(to: .zero, control: CGPoint(x: -spread * 0.5, y: spread * 0.6))
            fin.closeSubpath()
            fc.fill(fin, with: .color(finC.opacity(0.5)))
        }
        // Top and bottom flowing fins.
        for sign in [-1.0, 1.0] {
            var fin = Path()
            fin.move(to: CGPoint(x: cx - s * 0.10, y: cy + CGFloat(sign) * s * 0.06))
            fin.addQuadCurve(to: CGPoint(x: cx + s * 0.12, y: cy + CGFloat(sign) * s * 0.06),
                             control: CGPoint(x: cx, y: cy + CGFloat(sign) * (s * 0.30 + CGFloat(sin(t * 4)) * s * 0.04)))
            ctx.fill(fin, with: .color(finC.opacity(0.45)))
        }

        // Body.
        oval(&ctx, cx, cy, s * 0.42, s * 0.30, body)

        // Face front (right).
        let fx = cx + s * 0.14
        dot(&ctx, fx, cy - s * 0.03, s * 0.045, .white)
        dot(&ctx, fx, cy - s * 0.03, s * 0.026, rgb(28, 28, 32))
        if mood == .sad || mood == .pleaseHelp {
            ctx.fill(Path(roundedRect: CGRect(x: fx - s * 0.05, y: cy - s * 0.08, width: s * 0.10, height: s * 0.05),
                          cornerRadius: s * 0.02), with: .color(body))
        }
        mouth(&ctx, center: CGPoint(x: fx + s * 0.04, y: cy + s * 0.04), width: s * 0.07, mood: mood, color: rgb(90, 60, 160))
    }

    // MARK: - Turtle

    static func turtle(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let swim = CGFloat(sin(t * 0.6)) * s * 0.04 * CGFloat(liveliness(mood))
        let cx = size.width / 2 + swim
        let cy = size.height * 0.55 + bob(t, mood, s, speed: 1.2, amp: 0.03)
        let shell = rgb(90, 150, 80)
        let shellDark = rgb(70, 120, 64)
        let skin = rgb(140, 190, 120)

        // Paddling flippers.
        for side in [-1.0, 1.0] {
            var fc = ctx
            fc.translateBy(x: cx + CGFloat(side) * s * 0.22, y: cy + s * 0.10)
            fc.rotate(by: .degrees(side * sin(t * 4) * (14 + 16 * liveliness(mood))))
            fc.fill(Path(ellipseIn: CGRect(x: -s * 0.06, y: -s * 0.04, width: s * 0.16, height: s * 0.10)),
                    with: .color(skin))
        }
        // Back legs.
        for side in [-1.0, 1.0] {
            oval(&ctx, cx + CGFloat(side) * s * 0.16, cy + s * 0.18, s * 0.10, s * 0.07, skin)
        }

        // Shell (domed) with a simple plate pattern.
        oval(&ctx, cx, cy, s * 0.56, s * 0.40, shell)
        for dx in [-0.14, 0.0, 0.14] {
            oval(&ctx, cx + CGFloat(dx) * s, cy - s * 0.02, s * 0.12, s * 0.16, shellDark.opacity(0.6))
        }

        // Head pokes out to the right.
        let hx = cx + s * 0.30, hy = cy - s * 0.02
        oval(&ctx, hx, hy, s * 0.22, s * 0.20, skin)
        eyes(&ctx, left: CGPoint(x: hx + s * 0.02, y: hy - s * 0.03),
             right: CGPoint(x: hx + s * 0.08, y: hy - s * 0.03), r: s * 0.03, mood: mood, skin: skin)
        mouth(&ctx, center: CGPoint(x: hx + s * 0.05, y: hy + s * 0.05), width: s * 0.09, mood: mood, color: rgb(80, 110, 70))
    }
}
