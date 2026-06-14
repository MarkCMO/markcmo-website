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
