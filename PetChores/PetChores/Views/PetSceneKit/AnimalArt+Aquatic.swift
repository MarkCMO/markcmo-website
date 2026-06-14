import SwiftUI
import Foundation

extension AnimalArt {

    // MARK: - Fish

    static func fish(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let swim = CGFloat(sin(t * 0.8)) * s * 0.06 * CGFloat(liveliness(mood))
        let cx = size.width / 2 + swim
        let cy = size.height / 2 + CGFloat(sin(t * 1.4)) * s * 0.02
        let bodyL = rgb(255, 164, 86)
        let bodyD = rgb(226, 118, 46)
        let fin = rgb(255, 198, 134)

        // Tail fin (flaps).
        var tc = ctx
        tc.translateBy(x: cx - s * 0.22, y: cy)
        tc.rotate(by: .degrees(sin(t * 8) * (8 + 12 * liveliness(mood))))
        var tail = Path()
        tail.move(to: .zero)
        tail.addLine(to: CGPoint(x: -s * 0.18, y: -s * 0.14))
        tail.addLine(to: CGPoint(x: -s * 0.18, y: s * 0.14))
        tail.closeSubpath()
        tc.fill(tail, with: .color(fin.opacity(0.85)))

        // Top fin.
        var topFin = Path()
        topFin.move(to: CGPoint(x: cx - s * 0.06, y: cy - s * 0.14))
        topFin.addQuadCurve(to: CGPoint(x: cx + s * 0.10, y: cy - s * 0.14),
                            control: CGPoint(x: cx + s * 0.02, y: cy - s * 0.28))
        ctx.fill(topFin, with: .color(fin.opacity(0.85)))

        // Shaded body.
        shadedOval(&ctx, cx, cy, s * 0.50, s * 0.34, bodyL, bodyD)
        // Scale arcs.
        for dx in [-0.10, 0.0, 0.10] {
            ctx.stroke(Path { p in
                let x = cx + CGFloat(dx) * s
                p.move(to: CGPoint(x: x, y: cy - s * 0.11))
                p.addQuadCurve(to: CGPoint(x: x, y: cy + s * 0.11), control: CGPoint(x: x - s * 0.05, y: cy))
            }, with: .color(bodyD.opacity(0.3)), lineWidth: max(1, s * 0.01))
        }
        // Gill line.
        ctx.stroke(Path { p in
            p.move(to: CGPoint(x: cx + s * 0.10, y: cy - s * 0.10))
            p.addQuadCurve(to: CGPoint(x: cx + s * 0.10, y: cy + s * 0.10), control: CGPoint(x: cx + s * 0.05, y: cy))
        }, with: .color(bodyD.opacity(0.5)), lineWidth: max(1, s * 0.012))
        // Side fin flutters.
        var sc = ctx
        sc.translateBy(x: cx + s * 0.02, y: cy + s * 0.06)
        sc.rotate(by: .degrees(sin(t * 7) * 12 * liveliness(mood)))
        sc.fill(Path(ellipseIn: CGRect(x: -s * 0.05, y: 0, width: s * 0.10, height: s * 0.14)), with: .color(fin))

        // Big round eye with a catchlight.
        let fx = cx + s * 0.18
        dot(&ctx, fx, cy - s * 0.04, s * 0.055, .white)
        dot(&ctx, fx + s * 0.006, cy - s * 0.04, s * 0.03, rgb(28, 28, 32))
        dot(&ctx, fx - s * 0.014, cy - s * 0.056, s * 0.014, .white.opacity(0.9))
        if mood == .sad || mood == .pleaseHelp {
            ctx.fill(Path(roundedRect: CGRect(x: fx - s * 0.055, y: cy - s * 0.10, width: s * 0.11, height: s * 0.05),
                          cornerRadius: s * 0.02), with: .color(bodyL))
        }
        mouth(&ctx, center: CGPoint(x: fx + s * 0.045, y: cy + s * 0.04), width: s * 0.07, mood: mood, color: rgb(180, 90, 50))
    }

    // MARK: - Betta

    static func betta(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let swim = CGFloat(sin(t * 0.7)) * s * 0.05 * CGFloat(liveliness(mood))
        let cx = size.width / 2 + swim
        let cy = size.height / 2 + CGFloat(sin(t * 1.2)) * s * 0.02
        let bodyL = rgb(140, 108, 234)
        let bodyD = rgb(96, 66, 188)
        let finC = rgb(204, 72, 152)

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

        // Shaded body with an iridescent sheen.
        shadedOval(&ctx, cx, cy, s * 0.42, s * 0.30, bodyL, bodyD)
        oval(&ctx, cx - s * 0.04, cy - s * 0.04, s * 0.20, s * 0.10, Color(red: 0.66, green: 0.86, blue: 0.95).opacity(0.25))
        ctx.stroke(Path { p in
            p.move(to: CGPoint(x: cx + s * 0.06, y: cy - s * 0.10))
            p.addQuadCurve(to: CGPoint(x: cx + s * 0.06, y: cy + s * 0.10), control: CGPoint(x: cx + s * 0.02, y: cy))
        }, with: .color(bodyD.opacity(0.5)), lineWidth: max(1, s * 0.012)) // gill

        // Face front (right).
        let fx = cx + s * 0.14
        dot(&ctx, fx, cy - s * 0.03, s * 0.048, .white)
        dot(&ctx, fx, cy - s * 0.03, s * 0.027, rgb(28, 28, 32))
        dot(&ctx, fx - s * 0.012, cy - s * 0.045, s * 0.013, .white.opacity(0.9))
        if mood == .sad || mood == .pleaseHelp {
            ctx.fill(Path(roundedRect: CGRect(x: fx - s * 0.05, y: cy - s * 0.085, width: s * 0.10, height: s * 0.05),
                          cornerRadius: s * 0.02), with: .color(bodyL))
        }
        mouth(&ctx, center: CGPoint(x: fx + s * 0.04, y: cy + s * 0.04), width: s * 0.06, mood: mood, color: rgb(90, 60, 160))
    }

    // MARK: - Turtle

    static func turtle(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let swim = CGFloat(sin(t * 0.6)) * s * 0.04 * CGFloat(liveliness(mood))
        let cx = size.width / 2 + swim
        let cy = size.height * 0.55 + bob(t, mood, s, speed: 1.2, amp: 0.03)
        let shellL = rgb(98, 158, 86)
        let shellD = rgb(66, 116, 60)
        let skin = rgb(146, 196, 124)
        let skinD = rgb(112, 162, 96)

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
            oval(&ctx, cx + CGFloat(side) * s * 0.16, cy + s * 0.18, s * 0.10, s * 0.07, skinD)
        }

        // Domed shaded shell with a scute pattern.
        shadedOval(&ctx, cx, cy, s * 0.56, s * 0.42, shellL, shellD)
        ctx.stroke(Path(ellipseIn: CGRect(x: cx - s * 0.09, y: cy - s * 0.12, width: s * 0.18, height: s * 0.16)),
                   with: .color(shellD), lineWidth: max(1, s * 0.012))
        for i in 0..<6 {
            let a = Double(i) * 60 * .pi / 180
            let px = cx + CGFloat(cos(a)) * s * 0.20
            let py = cy - s * 0.01 + CGFloat(sin(a)) * s * 0.14
            ctx.stroke(Path(ellipseIn: CGRect(x: px - s * 0.06, y: py - s * 0.055, width: s * 0.12, height: s * 0.11)),
                       with: .color(shellD.opacity(0.8)), lineWidth: max(1, s * 0.009))
        }

        // Head pokes out to the right.
        let hx = cx + s * 0.30, hy = cy - s * 0.02
        shadedOval(&ctx, hx, hy, s * 0.22, s * 0.20, skin, skinD)
        realEye(&ctx, CGPoint(x: hx + s * 0.02, y: hy - s * 0.03), s * 0.03, mood: mood, skin: skin, iris: rgb(46, 60, 34))
        realEye(&ctx, CGPoint(x: hx + s * 0.10, y: hy - s * 0.03), s * 0.03, mood: mood, skin: skin, iris: rgb(46, 60, 34))
        mouth(&ctx, center: CGPoint(x: hx + s * 0.06, y: hy + s * 0.05), width: s * 0.09, mood: mood, color: rgb(80, 110, 70))
    }
}
