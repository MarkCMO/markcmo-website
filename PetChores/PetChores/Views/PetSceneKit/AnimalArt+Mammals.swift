import SwiftUI
import Foundation

extension AnimalArt {

    // MARK: - Dog

    static func dog(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.57 + bob(t, mood, s, amp: 0.03)
        let furL = rgb(214, 172, 122)   // light fur (highlight)
        let furD = rgb(150, 108, 70)    // shaded fur
        let saddle = rgb(120, 84, 52)   // darker back coat
        let snoutL = rgb(228, 200, 166) // muzzle / chest
        let earD = rgb(108, 76, 48)

        // Bushy wagging tail (behind the body).
        var tc = ctx
        tc.translateBy(x: cx - s * 0.26, y: cy - s * 0.02)
        let wag = sin(t * 5) * (5 + 12 * liveliness(mood))
        tc.rotate(by: .degrees(wag - 18))
        tc.fill(Path(roundedRect: CGRect(x: -s * 0.24, y: -s * 0.055, width: s * 0.27, height: s * 0.11),
                     cornerRadius: s * 0.055), with: .color(furD))
        tc.fill(Path(ellipseIn: CGRect(x: -s * 0.27, y: -s * 0.05, width: s * 0.10, height: s * 0.10)),
                with: .color(snoutL)) // light tail tip

        // Legs with paws and toe lines.
        for dx in [-0.18, 0.18] {
            shadedOval(&ctx, cx + CGFloat(dx) * s, cy + s * 0.22, s * 0.12, s * 0.18, furL, furD)
            oval(&ctx, cx + CGFloat(dx) * s, cy + s * 0.30, s * 0.13, s * 0.08, snoutL)
            for tdx in [-0.03, 0.0, 0.03] {
                var toe = Path()
                let px = cx + CGFloat(dx) * s + CGFloat(tdx) * s
                toe.move(to: CGPoint(x: px, y: cy + s * 0.27))
                toe.addLine(to: CGPoint(x: px, y: cy + s * 0.32))
                ctx.stroke(toe, with: .color(furD.opacity(0.5)), lineWidth: max(1, s * 0.006))
            }
        }

        // Body with a darker saddle and a lighter chest.
        shadedOval(&ctx, cx, cy, s * 0.52, s * 0.42, furL, furD)
        ctx.fill(Path(ellipseIn: CGRect(x: cx - s * 0.30, y: cy - s * 0.25, width: s * 0.60, height: s * 0.32)),
                 with: .color(saddle.opacity(0.45)))
        oval(&ctx, cx, cy + s * 0.11, s * 0.26, s * 0.22, snoutL.opacity(0.75))

        // Head.
        let hx = cx, hy = cy - s * 0.25
        shadedOval(&ctx, hx, hy, s * 0.40, s * 0.37, furL, furD)

        // Natural floppy ears (teardrop), drooping down the sides in front.
        for side in [-1.0, 1.0] {
            var ec = ctx
            ec.translateBy(x: hx + CGFloat(side) * s * 0.17, y: hy - s * 0.11)
            ec.rotate(by: .degrees(side * (24 + sin(t * 1.8 + side) * 4 * liveliness(mood))))
            var ear = Path()
            ear.move(to: .zero)
            ear.addQuadCurve(to: CGPoint(x: -s * 0.02, y: s * 0.34), control: CGPoint(x: -s * 0.13, y: s * 0.16))
            ear.addQuadCurve(to: CGPoint(x: s * 0.075, y: s * 0.28), control: CGPoint(x: s * 0.07, y: s * 0.32))
            ear.addQuadCurve(to: .zero, control: CGPoint(x: s * 0.09, y: s * 0.10))
            ec.fill(ear, with: .color(earD))
        }

        // Soft saddle patch over one eye.
        oval(&ctx, hx + s * 0.11, hy - s * 0.02, s * 0.18, s * 0.17, saddle.opacity(0.4))
        // Longer muzzle, shaded.
        shadedOval(&ctx, hx, hy + s * 0.11, s * 0.26, s * 0.21, snoutL, furD)

        // Almond eyes with brown irises.
        realEye(&ctx, CGPoint(x: hx - s * 0.105, y: hy - s * 0.02), s * 0.05, mood: mood, skin: furL)
        realEye(&ctx, CGPoint(x: hx + s * 0.105, y: hy - s * 0.02), s * 0.05, mood: mood, skin: furL)
        // Brows.
        for side in [-1.0, 1.0] {
            var brow = Path()
            let bx = hx + CGFloat(side) * s * 0.105
            brow.move(to: CGPoint(x: bx - s * 0.04, y: hy - s * 0.085))
            brow.addQuadCurve(to: CGPoint(x: bx + s * 0.04, y: hy - s * 0.085), control: CGPoint(x: bx, y: hy - s * 0.105))
            ctx.stroke(brow, with: .color(furD.opacity(0.5)), lineWidth: max(1, s * 0.008))
        }

        // Textured nose with nostrils and a catchlight.
        let np = CGPoint(x: hx, y: hy + s * 0.06)
        ctx.fill(Path(ellipseIn: CGRect(x: np.x - s * 0.055, y: np.y - s * 0.042, width: s * 0.11, height: s * 0.088)),
                 with: .color(rgb(34, 26, 28)))
        dot(&ctx, np.x - s * 0.024, np.y + s * 0.006, s * 0.012, rgb(74, 58, 58))
        dot(&ctx, np.x + s * 0.024, np.y + s * 0.006, s * 0.012, rgb(74, 58, 58))
        dot(&ctx, np.x - s * 0.02, np.y - s * 0.022, s * 0.016, .white.opacity(0.55))

        // Philtrum + mouth.
        var phil = Path()
        phil.move(to: CGPoint(x: hx, y: hy + s * 0.105))
        phil.addLine(to: CGPoint(x: hx, y: hy + s * 0.145))
        ctx.stroke(phil, with: .color(rgb(90, 62, 50)), lineWidth: max(1.2, s * 0.01))
        mouth(&ctx, center: CGPoint(x: hx, y: hy + s * 0.155), width: s * 0.17, mood: mood)
        if mood == .happy || mood == .content {
            ctx.fill(Path(roundedRect: CGRect(x: hx - s * 0.032, y: hy + s * 0.16, width: s * 0.064, height: s * 0.095),
                          cornerRadius: s * 0.032), with: .color(rgb(232, 126, 138)))
        }
    }

    // MARK: - Cat

    static func cat(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.57 + bob(t, mood, s, speed: 1.6, amp: 0.03)
        let furL = rgb(172, 176, 186)   // light grey tabby
        let furD = rgb(120, 124, 136)   // shaded
        let stripe = rgb(96, 100, 112)
        let pink = rgb(236, 166, 174)

        // Curled striped tail, swishing.
        var tc = ctx
        tc.translateBy(x: cx + s * 0.22, y: cy + s * 0.05)
        tc.rotate(by: .degrees(sin(t * 2.4) * (7 + 12 * liveliness(mood))))
        var tail = Path()
        tail.move(to: .zero)
        tail.addQuadCurve(to: CGPoint(x: s * 0.20, y: -s * 0.20), control: CGPoint(x: s * 0.26, y: s * 0.04))
        tc.stroke(tail, with: .color(furD), style: StrokeStyle(lineWidth: s * 0.08, lineCap: .round))
        for k in 0..<3 {
            tc.stroke(Path { p in
                let fx = s * (0.04 + 0.06 * Double(k))
                p.move(to: CGPoint(x: fx, y: -s * 0.03 * Double(k)))
                p.addLine(to: CGPoint(x: fx + s * 0.02, y: -s * 0.05 - s * 0.03 * Double(k)))
            }, with: .color(stripe.opacity(0.6)), lineWidth: max(1, s * 0.02))
        }

        // Body with faint stripes.
        shadedOval(&ctx, cx, cy, s * 0.46, s * 0.40, furL, furD)
        for k in [-0.08, 0.04, 0.16] {
            ctx.stroke(Path { p in
                p.move(to: CGPoint(x: cx - s * 0.17, y: cy + CGFloat(k) * s))
                p.addQuadCurve(to: CGPoint(x: cx + s * 0.17, y: cy + CGFloat(k) * s),
                               control: CGPoint(x: cx, y: cy + CGFloat(k) * s - s * 0.03))
            }, with: .color(stripe.opacity(0.35)), lineWidth: max(1, s * 0.018))
        }

        let hx = cx, hy = cy - s * 0.25
        // Pointy ears with pink inner.
        for side in [-1.0, 1.0] {
            let bx = hx + CGFloat(side) * s * 0.15
            var p = Path()
            p.move(to: CGPoint(x: bx - s * 0.08, y: hy - s * 0.07))
            p.addLine(to: CGPoint(x: bx + CGFloat(side) * s * 0.03, y: hy - s * 0.28))
            p.addLine(to: CGPoint(x: bx + s * 0.08, y: hy - s * 0.07))
            p.closeSubpath()
            ctx.fill(p, with: .color(furD))
            var pi = Path()
            pi.move(to: CGPoint(x: bx - s * 0.04, y: hy - s * 0.10))
            pi.addLine(to: CGPoint(x: bx + CGFloat(side) * s * 0.02, y: hy - s * 0.22))
            pi.addLine(to: CGPoint(x: bx + s * 0.04, y: hy - s * 0.10))
            pi.closeSubpath()
            ctx.fill(pi, with: .color(pink))
        }
        shadedOval(&ctx, hx, hy, s * 0.38, s * 0.34, furL, furD)
        // Tabby "M" on the forehead.
        for dx in [-0.05, 0.0, 0.05] {
            ctx.stroke(Path { p in
                p.move(to: CGPoint(x: hx + CGFloat(dx) * s, y: hy - s * 0.16))
                p.addLine(to: CGPoint(x: hx + CGFloat(dx) * s, y: hy - s * 0.08))
            }, with: .color(stripe.opacity(0.5)), lineWidth: max(1, s * 0.016))
        }

        // Slit-pupil cat eyes.
        catEye(&ctx, CGPoint(x: hx - s * 0.105, y: hy - s * 0.02), s * 0.055, mood: mood, skin: furL)
        catEye(&ctx, CGPoint(x: hx + s * 0.105, y: hy - s * 0.02), s * 0.055, mood: mood, skin: furL)

        // Pink triangle nose + mouth.
        var nose = Path()
        nose.move(to: CGPoint(x: hx - s * 0.026, y: hy + s * 0.045))
        nose.addLine(to: CGPoint(x: hx + s * 0.026, y: hy + s * 0.045))
        nose.addLine(to: CGPoint(x: hx, y: hy + s * 0.07))
        nose.closeSubpath()
        ctx.fill(nose, with: .color(pink))
        mouth(&ctx, center: CGPoint(x: hx, y: hy + s * 0.115), width: s * 0.13, mood: mood)

        // Whiskers.
        for side in [-1.0, 1.0] {
            for k in [-1.0, 0.0, 1.0] {
                var w = Path()
                w.move(to: CGPoint(x: hx + CGFloat(side) * s * 0.05, y: hy + s * 0.06))
                w.addLine(to: CGPoint(x: hx + CGFloat(side) * s * 0.24, y: hy + s * 0.06 + CGFloat(k) * s * 0.045))
                ctx.stroke(w, with: .color(.white.opacity(0.75)), lineWidth: max(1, s * 0.008))
            }
        }
    }

    // MARK: - Rabbit

    static func rabbit(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2
        let cy = size.height * 0.58 + bob(t, mood, s, speed: 2.4, amp: 0.05)
        let furL = rgb(238, 232, 226)   // soft white-grey
        let furD = rgb(196, 186, 178)   // shaded
        let inner = rgb(248, 196, 200)
        let pink = rgb(226, 150, 162)

        // Tall ears that twitch (shaded outer, pink inner).
        for side in [-1.0, 1.0] {
            var ec = ctx
            ec.translateBy(x: cx + CGFloat(side) * s * 0.09, y: cy - s * 0.26)
            ec.rotate(by: .degrees(side * (8 + sin(t * 3 + side) * 5 * liveliness(mood))))
            ec.fill(Path(ellipseIn: CGRect(x: -s * 0.055, y: -s * 0.32, width: s * 0.11, height: s * 0.36)),
                    with: .color(furL))
            ec.fill(Path(ellipseIn: CGRect(x: -s * 0.045, y: -s * 0.30, width: s * 0.045, height: s * 0.30)),
                    with: .color(furD.opacity(0.5)))
            ec.fill(Path(ellipseIn: CGRect(x: -s * 0.025, y: -s * 0.27, width: s * 0.05, height: s * 0.25)),
                    with: .color(inner))
        }

        // Cotton tail behind, body, head.
        oval(&ctx, cx - s * 0.30, cy + s * 0.10, s * 0.14, s * 0.13, furL)
        shadedOval(&ctx, cx, cy + s * 0.05, s * 0.42, s * 0.40, furL, furD)
        let hy = cy - s * 0.18
        shadedOval(&ctx, cx, hy, s * 0.34, s * 0.32, furL, furD)

        // Dark round rabbit eyes.
        realEye(&ctx, CGPoint(x: cx - s * 0.085, y: hy - s * 0.01), s * 0.05, mood: mood, skin: furL, iris: rgb(56, 40, 38))
        realEye(&ctx, CGPoint(x: cx + s * 0.085, y: hy - s * 0.01), s * 0.05, mood: mood, skin: furL, iris: rgb(56, 40, 38))

        // Pink Y nose with a cleft.
        var nose = Path()
        nose.move(to: CGPoint(x: cx - s * 0.022, y: hy + s * 0.045))
        nose.addLine(to: CGPoint(x: cx + s * 0.022, y: hy + s * 0.045))
        nose.addLine(to: CGPoint(x: cx, y: hy + s * 0.068))
        nose.closeSubpath()
        ctx.fill(nose, with: .color(pink))
        ctx.stroke(Path { p in
            p.move(to: CGPoint(x: cx, y: hy + s * 0.068))
            p.addLine(to: CGPoint(x: cx, y: hy + s * 0.10))
        }, with: .color(furD), lineWidth: max(1, s * 0.008))

        // Two front teeth.
        ctx.fill(Path(roundedRect: CGRect(x: cx - s * 0.022, y: hy + s * 0.10, width: s * 0.044, height: s * 0.055),
                      cornerRadius: s * 0.01), with: .color(.white))
        ctx.stroke(Path { p in
            p.move(to: CGPoint(x: cx, y: hy + s * 0.10)); p.addLine(to: CGPoint(x: cx, y: hy + s * 0.155))
        }, with: .color(furD.opacity(0.6)), lineWidth: max(1, s * 0.006))

        cheeks(&ctx, left: CGPoint(x: cx - s * 0.13, y: hy + s * 0.06),
               right: CGPoint(x: cx + s * 0.13, y: hy + s * 0.06), r: s * 0.03, mood: mood)
        // Whisker dots.
        for side in [-1.0, 1.0] {
            for ky in [-0.01, 0.02] {
                dot(&ctx, cx + CGFloat(side) * s * 0.07, hy + s * CGFloat(0.07 + ky), s * 0.006, furD.opacity(0.6))
            }
        }
    }
}
