import SwiftUI
import Foundation

/// Hand-drawn, mood-reactive animal art rendered into a Canvas GraphicsContext. Each
/// animal is built from primitive shapes and animated analytically from the time value
/// `t`, so motion is smooth and battery-friendly with no per-part view animations.
///
/// All expressions stay gentle: low wellbeing droops the eyes and slows the motion but
/// never depicts anything scary (Section 13).
enum AnimalArt {

    // MARK: - Mood to motion

    /// 0 (barely moving) to 1 (lively), from wellbeing mood.
    static func liveliness(_ m: Mood) -> Double {
        switch m {
        case .happy:          return 1.0
        case .content:        return 0.72
        case .needsAttention: return 0.48
        case .sad:            return 0.28
        case .pleaseHelp:     return 0.12
        }
    }

    /// Vertical idle bob in points.
    static func bob(_ t: Double, _ m: Mood, _ s: CGFloat, speed: Double = 2.0, amp: CGFloat = 0.045) -> CGFloat {
        CGFloat(sin(t * speed)) * s * amp * CGFloat(liveliness(m))
    }

    /// Gentle breathing scale around 1.0.
    static func breathe(_ t: Double, _ m: Mood) -> CGFloat {
        1.0 + CGFloat(sin(t * 1.5)) * 0.025 * CGFloat(liveliness(m))
    }

    // MARK: - Primitive helpers

    static func oval(_ ctx: inout GraphicsContext, _ cx: CGFloat, _ cy: CGFloat, _ w: CGFloat, _ h: CGFloat, _ color: Color) {
        ctx.fill(Path(ellipseIn: CGRect(x: cx - w / 2, y: cy - h / 2, width: w, height: h)), with: .color(color))
    }

    static func dot(_ ctx: inout GraphicsContext, _ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat, _ color: Color) {
        ctx.fill(Path(ellipseIn: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2)), with: .color(color))
    }

    static func rgb(_ r: Double, _ g: Double, _ b: Double) -> Color {
        Color(red: r / 255, green: g / 255, blue: b / 255)
    }

    // MARK: - Face

    /// Two eyes with pupils, highlights, and mood-driven eyelids. `look` shifts pupils.
    static func eyes(_ ctx: inout GraphicsContext, left: CGPoint, right: CGPoint, r: CGFloat,
                     mood: Mood, skin: Color, look: CGFloat = 0) {
        for c in [left, right] {
            dot(&ctx, c.x, c.y, r, .white)
            let pr = r * 0.55
            let px = c.x + look * r * 0.3
            dot(&ctx, px, c.y, pr, rgb(28, 28, 32))
            dot(&ctx, px - pr * 0.3, c.y - pr * 0.3, pr * 0.4, .white.opacity(0.9))

            if mood == .sad || mood == .pleaseHelp {
                // Skin-colored lid covering the upper portion to look sleepy or sad.
                let lidH = r * (mood == .sad ? 0.9 : 0.65)
                ctx.fill(
                    Path(roundedRect: CGRect(x: c.x - r - 1, y: c.y - r - 1, width: r * 2 + 2, height: lidH),
                         cornerRadius: r * 0.4),
                    with: .color(skin)
                )
            }
        }
    }

    /// A gentle mouth curve. Positive curve smiles, negative frowns.
    static func mouth(_ ctx: inout GraphicsContext, center: CGPoint, width: CGFloat, mood: Mood,
                      color: Color = AnimalArt.rgb(60, 40, 40)) {
        let curve: CGFloat
        switch mood {
        case .happy:          curve = 0.85
        case .content:        curve = 0.45
        case .needsAttention: curve = 0.06
        case .sad:            curve = -0.35
        case .pleaseHelp:     curve = -0.22
        }
        var p = Path()
        p.move(to: CGPoint(x: center.x - width / 2, y: center.y))
        p.addQuadCurve(to: CGPoint(x: center.x + width / 2, y: center.y),
                       control: CGPoint(x: center.x, y: center.y + curve * width))
        ctx.stroke(p, with: .color(color), style: StrokeStyle(lineWidth: max(1.4, width * 0.12), lineCap: .round))
    }

    /// A small rosy cheek used on the happier moods.
    static func cheeks(_ ctx: inout GraphicsContext, left: CGPoint, right: CGPoint, r: CGFloat, mood: Mood) {
        guard mood == .happy || mood == .content else { return }
        let c = Color(red: 1.0, green: 0.55, blue: 0.55).opacity(0.5)
        dot(&ctx, left.x, left.y, r, c)
        dot(&ctx, right.x, right.y, r, c)
    }

    // MARK: - Dispatch

    static func draw(_ ctx: inout GraphicsContext, size: CGSize, id: String, category: String,
                     mood: Mood, t: Double, night: Bool = false) {
        switch id {
        case "dog":           dog(&ctx, size, mood, t)
        case "cat":           cat(&ctx, size, mood, t)
        case "rabbit":        rabbit(&ctx, size, mood, t)
        case "hamster":       hamster(&ctx, size, mood, t)
        case "guinea_pig":    guineaPig(&ctx, size, mood, t)
        case "fish":          fish(&ctx, size, mood, t)
        case "betta":         betta(&ctx, size, mood, t)
        case "parakeet":      parakeet(&ctx, size, mood, t)
        case "turtle":        turtle(&ctx, size, mood, t)
        case "leopard_gecko": gecko(&ctx, size, mood, t)
        case "tortoise":      tortoise(&ctx, size, mood, t)
        case "chicken":       chicken(&ctx, size, mood, t)
        case "tarantula":     tarantula(&ctx, size, mood, t)
        default:              blob(&ctx, size, mood, t)
        }

        // At night the pet rests with a gentle "z z z". Otherwise a thriving pet gets
        // twinkling sparkles, and a happy one gets floating hearts.
        if night {
            zzz(&ctx, size, t)
        } else if mood == .happy || mood == .content {
            sparkles(&ctx, size, mood, t)
        }
    }

    /// Sleepy "z z z" rising near the pet's head at night.
    static func zzz(_ ctx: inout GraphicsContext, _ size: CGSize, _ t: Double) {
        let s = min(size.width, size.height)
        let base = CGPoint(x: size.width * 0.66, y: size.height * 0.32)
        for k in 0..<3 {
            let kk = Double(k)
            let pulse = 0.6 + 0.4 * sin(t * 1.6 + kk)
            let p = CGPoint(x: base.x + CGFloat(kk) * s * 0.09, y: base.y - CGFloat(kk) * s * 0.11)
            let z = Text("z")
                .font(.system(size: s * (0.10 + 0.03 * kk), weight: .heavy, design: .rounded))
                .foregroundStyle(.white.opacity(0.45 + 0.45 * pulse))
            ctx.draw(z, at: p)
        }
    }

    // MARK: - Reward effects

    /// Twinkling sparkles around the pet for the happier moods, plus rising hearts when
    /// fully happy.
    static func sparkles(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let spots: [(CGFloat, CGFloat, Double)] = [
            (0.16, 0.18, 0.0), (0.84, 0.16, 1.1), (0.74, 0.34, 2.0), (0.24, 0.40, 0.6)
        ]
        for (fx, fy, ph) in spots {
            let tw = 0.5 + 0.5 * sin(t * 3 + ph)
            let r = s * 0.05 * CGFloat(0.5 + tw)
            sparkle(&ctx, center: CGPoint(x: size.width * fx, y: size.height * fy),
                    r: r, color: .white.opacity(0.4 + 0.4 * tw))
        }
        if mood == .happy { hearts(&ctx, size, t) }
    }

    /// A four-point sparkle made from two crossed soft ovals.
    static func sparkle(_ ctx: inout GraphicsContext, center: CGPoint, r: CGFloat, color: Color) {
        oval(&ctx, center.x, center.y, r * 0.35, r * 1.6, color)
        oval(&ctx, center.x, center.y, r * 1.6, r * 0.35, color)
    }

    /// Two gentle hearts that rise and fade.
    static func hearts(_ ctx: inout GraphicsContext, _ size: CGSize, _ t: Double) {
        let s = min(size.width, size.height)
        let range = Double(size.height) * 0.6
        for k in 0..<2 {
            let prog = (t * 22 + Double(k) * 45).truncatingRemainder(dividingBy: range)
            let y = size.height * 0.5 - CGFloat(prog)
            let x = size.width * (0.4 + 0.2 * Double(k)) + CGFloat(sin(t * 2 + Double(k)) * 8)
            let alpha = max(0.0, 1.0 - prog / range)
            heart(&ctx, center: CGPoint(x: x, y: y), r: s * 0.05,
                  color: Color(red: 1.0, green: 0.42, blue: 0.52).opacity(alpha * 0.8))
        }
    }

    /// A simple heart from two lobes and a point.
    static func heart(_ ctx: inout GraphicsContext, center c: CGPoint, r: CGFloat, color: Color) {
        dot(&ctx, c.x - r * 0.45, c.y - r * 0.30, r * 0.5, color)
        dot(&ctx, c.x + r * 0.45, c.y - r * 0.30, r * 0.5, color)
        var tri = Path()
        tri.move(to: CGPoint(x: c.x - r * 0.92, y: c.y - r * 0.05))
        tri.addLine(to: CGPoint(x: c.x + r * 0.92, y: c.y - r * 0.05))
        tri.addLine(to: CGPoint(x: c.x, y: c.y + r))
        tri.closeSubpath()
        ctx.fill(tri, with: .color(color))
    }

    /// Fallback creature if a species id is ever unknown.
    static func blob(_ ctx: inout GraphicsContext, _ size: CGSize, _ mood: Mood, _ t: Double) {
        let s = min(size.width, size.height)
        let cx = size.width / 2, cy = size.height / 2 + bob(t, mood, s)
        oval(&ctx, cx, cy, s * 0.6, s * 0.55, rgb(150, 160, 180))
        eyes(&ctx, left: CGPoint(x: cx - s * 0.12, y: cy - s * 0.05),
             right: CGPoint(x: cx + s * 0.12, y: cy - s * 0.05), r: s * 0.06, mood: mood, skin: rgb(150, 160, 180))
        mouth(&ctx, center: CGPoint(x: cx, y: cy + s * 0.12), width: s * 0.22, mood: mood)
    }
}
