import SwiftUI
import Foundation

/// Animated environment behind a pet. Drawn with plain SwiftUI shapes and gradients,
/// driven by a continuously advancing time value `t` (seconds) for motion and a
/// `skyPhase` value (0 = midnight, 0.5 = noon) so the outdoor habitats follow the real
/// time of day: dawn, daytime, dusk, and a starlit night with a moon.
struct EnvironmentBackdrop: View {
    let habitat: Habitat
    let t: Double
    var skyPhase: Double = 0.5
    var weather: SceneWeather = .clear

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                switch habitat {
                case .backyard:  backyard(w, h)
                case .coop:      coop(w, h)
                case .aquarium:  aquarium(w, h)
                case .terrarium: terrarium(w, h)
                case .birdcage:  birdcage(w, h)
                case .cage:      cage(w, h)
                }
            }
            .frame(width: w, height: h)
        }
    }

    // MARK: - Sky palette (time of day)

    private struct SkyPalette {
        let top: Color
        let bottom: Color
        let isNight: Bool
    }

    private func skyPalette() -> SkyPalette {
        // Keyframes around the 24 hour clock. Each is (phase, topRGB, bottomRGB).
        typealias RGB = (Double, Double, Double)
        let keys: [(p: Double, top: RGB, bot: RGB)] = [
            (0.00, (0.05, 0.06, 0.16), (0.10, 0.12, 0.28)),  // deep night
            (0.24, (0.98, 0.66, 0.52), (1.00, 0.84, 0.70)),  // dawn
            (0.34, (0.55, 0.80, 0.98), (0.85, 0.94, 1.00)),  // morning to day
            (0.72, (0.55, 0.80, 0.98), (0.85, 0.94, 1.00)),  // day
            (0.83, (0.98, 0.60, 0.45), (0.99, 0.78, 0.62)),  // dusk
            (0.93, (0.10, 0.10, 0.26), (0.18, 0.16, 0.34)),  // late dusk
            (1.00, (0.05, 0.06, 0.16), (0.10, 0.12, 0.28))   // wrap to night
        ]
        let phase = max(0.0, min(0.999, skyPhase))
        var i = 0
        while i < keys.count - 1 && !(phase >= keys[i].p && phase <= keys[i + 1].p) { i += 1 }
        let a = keys[i], b = keys[min(i + 1, keys.count - 1)]
        let span = max(0.0001, b.p - a.p)
        let f = (phase - a.p) / span
        func lerp(_ x: RGB, _ y: RGB) -> Color {
            Color(red: x.0 + (y.0 - x.0) * f, green: x.1 + (y.1 - x.1) * f, blue: x.2 + (y.2 - x.2) * f)
        }
        let isNight = phase < 0.20 || phase > 0.88
        return SkyPalette(top: lerp(a.top, b.top), bottom: lerp(a.bot, b.bot), isNight: isNight)
    }

    private func skyGradient(_ top: Color, _ bottom: Color) -> LinearGradient {
        LinearGradient(colors: [top, bottom], startPoint: .top, endPoint: .bottom)
    }

    // MARK: - Backyard (and coop variant)

    private func backyard(_ w: CGFloat, _ h: CGFloat) -> some View {
        let sky = skyPalette()
        let raining = weather == .rain
        return ZStack {
            Rectangle().fill(skyGradient(sky.top, sky.bottom))
            if sky.isNight {
                stars(w: w, h: h)
                moon(w: w, h: h)
            } else if !raining {
                sun(w: w, h: h)
            }
            clouds(w: w, h: h, alpha: raining ? 0.85 : (sky.isNight ? 0.35 : 0.9), grey: raining)
            grass(w: w, h: h)
            fence(w, h)
            if raining {
                Rectangle().fill(Color.black.opacity(0.12))
                rain(w: w, h: h)
            }
        }
    }

    private func rain(w: CGFloat, h: CGFloat) -> some View {
        ZStack {
            ForEach(0..<26, id: \.self) { i in
                let speed = 240.0 + Double(i % 5) * 60
                let range = Double(h) + 30
                let fall = (t * speed + Double(i) * 37).truncatingRemainder(dividingBy: range)
                let x = w * CGFloat((i * 61 + 17) % 100) / 100
                Capsule()
                    .fill(.white.opacity(0.4))
                    .frame(width: 2, height: 12)
                    .position(x: x, y: CGFloat(fall) - 15)
            }
        }
    }

    private func coop(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            backyard(w, h)
            let cw = w * 0.26, ch = h * 0.34
            let x = w * 0.16, y = h * 0.66
            ZStack {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(red: 0.62, green: 0.42, blue: 0.30))
                    .frame(width: cw, height: ch)
                Triangle()
                    .fill(Color(red: 0.48, green: 0.30, blue: 0.22))
                    .frame(width: cw * 1.2, height: ch * 0.5)
                    .offset(y: -ch * 0.62)
                Circle()
                    .fill(Color(red: 0.20, green: 0.12, blue: 0.10))
                    .frame(width: cw * 0.32, height: cw * 0.32)
                    .offset(y: ch * 0.08)
            }
            .position(x: x, y: y)
        }
    }

    private func sun(w: CGFloat, h: CGFloat) -> some View {
        let center = CGPoint(x: w * 0.82, y: h * 0.22)
        let r = min(w, h) * 0.12
        return ZStack {
            ZStack {
                ForEach(0..<12, id: \.self) { i in
                    Capsule()
                        .fill(Color.yellow.opacity(0.45))
                        .frame(width: r * 0.18, height: r * 0.7)
                        .offset(y: -r * 1.25)
                        .rotationEffect(.degrees(Double(i) * 30))
                }
            }
            .rotationEffect(.degrees(t * 6))
            Circle().fill(Color(red: 1.0, green: 0.86, blue: 0.30))
                .frame(width: r * 1.8, height: r * 1.8)
        }
        .position(center)
    }

    private func moon(w: CGFloat, h: CGFloat) -> some View {
        let center = CGPoint(x: w * 0.80, y: h * 0.22)
        let r = min(w, h) * 0.12
        return ZStack {
            Circle().fill(Color.white.opacity(0.10)).frame(width: r * 2.6, height: r * 2.6).blur(radius: 8)
            Circle().fill(Color(red: 0.95, green: 0.95, blue: 0.86)).frame(width: r * 1.7, height: r * 1.7)
            // Carve a crescent with a sky-colored circle offset to the side.
            Circle().fill(skyPalette().top).frame(width: r * 1.5, height: r * 1.5).offset(x: r * 0.6, y: -r * 0.2)
        }
        .position(center)
    }

    private func stars(w: CGFloat, h: CGFloat) -> some View {
        ZStack {
            ForEach(0..<20, id: \.self) { i in
                let fx = Double((i * 97 + 13) % 100) / 100
                let fy = Double((i * 53 + 29) % 100) / 100 * 0.6
                let twinkle = 0.4 + 0.5 * abs(sin(t * 1.5 + Double(i)))
                Circle()
                    .fill(.white.opacity(twinkle))
                    .frame(width: 2 + CGFloat(i % 3), height: 2 + CGFloat(i % 3))
                    .position(x: CGFloat(fx) * w, y: CGFloat(fy) * h)
            }
        }
    }

    private func clouds(w: CGFloat, h: CGFloat, alpha: Double, grey: Bool) -> some View {
        ZStack {
            cloud(baseX: 0.2, y: h * 0.2, scale: 1.0, speed: 8, w: w, alpha: alpha, grey: grey)
            cloud(baseX: 0.6, y: h * 0.12, scale: 0.7, speed: 5, w: w, alpha: alpha, grey: grey)
            cloud(baseX: 0.9, y: h * 0.3, scale: 0.85, speed: 6.5, w: w, alpha: alpha, grey: grey)
        }
    }

    private func cloud(baseX: CGFloat, y: CGFloat, scale: CGFloat, speed: Double, w: CGFloat, alpha: Double, grey: Bool) -> some View {
        let travel = w + 120
        let x = (baseX * travel + CGFloat(t * speed)).truncatingRemainder(dividingBy: travel) - 60
        let tint = grey ? Color(white: 0.6) : Color.white
        return ZStack {
            Capsule().fill(tint.opacity(alpha)).frame(width: 60 * scale, height: 26 * scale)
            Circle().fill(tint.opacity(alpha)).frame(width: 34 * scale, height: 34 * scale).offset(x: -14 * scale, y: -6 * scale)
            Circle().fill(tint.opacity(alpha)).frame(width: 28 * scale, height: 28 * scale).offset(x: 14 * scale, y: -4 * scale)
        }
        .position(x: x, y: y)
    }

    private func grass(w: CGFloat, h: CGFloat) -> some View {
        ZStack(alignment: .bottom) {
            VStack { Spacer(); Rectangle().fill(Color(red: 0.42, green: 0.72, blue: 0.36)).frame(height: h * 0.30) }
            ForEach(0..<14, id: \.self) { i in
                let bx = w * (CGFloat(i) + 0.5) / 14
                let sway = sin(t * 1.6 + Double(i)) * 5
                Capsule()
                    .fill(Color(red: 0.34, green: 0.62, blue: 0.30))
                    .frame(width: 5, height: h * 0.12)
                    .rotationEffect(.degrees(sway), anchor: .bottom)
                    .position(x: bx, y: h * 0.84)
            }
        }
    }

    private func fence(_ w: CGFloat, _ h: CGFloat) -> some View {
        let y = h * 0.66
        return ZStack {
            Rectangle().fill(.white.opacity(0.85)).frame(width: w, height: 5).position(x: w / 2, y: y)
            ForEach(0..<7, id: \.self) { i in
                Rectangle().fill(.white.opacity(0.85))
                    .frame(width: 7, height: h * 0.12)
                    .position(x: w * (CGFloat(i) + 0.5) / 7, y: y + h * 0.04)
            }
        }
    }

    // MARK: - Aquarium

    private func aquarium(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            Rectangle().fill(skyGradient(Color(red: 0.20, green: 0.55, blue: 0.78),
                                         Color(red: 0.06, green: 0.27, blue: 0.48)))
            Ellipse()
                .fill(.white.opacity(0.10))
                .frame(width: w * 0.7, height: h * 0.3)
                .position(x: w * 0.5 + sin(t * 0.6) * w * 0.12, y: h * 0.18)
            plants(w: w, h: h)
            bubbles(w: w, h: h)
            gravel(w: w, h: h)
        }
    }

    private func plants(w: CGFloat, h: CGFloat) -> some View {
        ZStack {
            ForEach(0..<4, id: \.self) { i in
                let px = w * (CGFloat(i) + 0.5) / 4
                let sway = sin(t * 1.1 + Double(i) * 0.8) * 8
                Capsule()
                    .fill(Color(red: 0.20, green: 0.55, blue: 0.32).opacity(0.9))
                    .frame(width: 10, height: h * (0.28 + 0.06 * CGFloat(i % 2)))
                    .rotationEffect(.degrees(sway), anchor: .bottom)
                    .position(x: px, y: h * 0.84)
            }
        }
    }

    private func bubbles(w: CGFloat, h: CGFloat) -> some View {
        ZStack {
            ForEach(0..<8, id: \.self) { i in
                let speed = 18.0 + Double(i % 3) * 8
                let range = Double(h) * 0.9
                let risen = (t * speed + Double(i) * 30).truncatingRemainder(dividingBy: range)
                let yy = h * 0.95 - CGFloat(risen)
                let bx = w * (CGFloat(i) + 0.5) / 8 + CGFloat(sin(t * 2 + Double(i)) * 6)
                Circle().fill(.white.opacity(0.35))
                    .frame(width: 6 + CGFloat(i % 3) * 3, height: 6 + CGFloat(i % 3) * 3)
                    .position(x: bx, y: yy)
            }
        }
    }

    private func gravel(w: CGFloat, h: CGFloat) -> some View {
        VStack { Spacer(); Rectangle().fill(Color(red: 0.30, green: 0.26, blue: 0.22)).frame(height: h * 0.10) }
    }

    // MARK: - Terrarium

    private func terrarium(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            Rectangle().fill(skyGradient(Color(red: 0.86, green: 0.72, blue: 0.50),
                                         Color(red: 0.74, green: 0.56, blue: 0.36)))
            let glow = 0.30 + 0.12 * sin(t * 1.4)
            Circle().fill(Color.orange.opacity(glow))
                .frame(width: min(w, h) * 0.5, height: min(w, h) * 0.5)
                .blur(radius: 18)
                .position(x: w * 0.8, y: h * 0.15)
            VStack { Spacer(); Rectangle().fill(Color(red: 0.78, green: 0.62, blue: 0.40)).frame(height: h * 0.26) }
            Ellipse().fill(Color(red: 0.45, green: 0.42, blue: 0.40))
                .frame(width: w * 0.22, height: h * 0.16)
                .position(x: w * 0.18, y: h * 0.80)
        }
    }

    // MARK: - Birdcage

    private func birdcage(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            Rectangle().fill(skyGradient(Color(red: 0.92, green: 0.95, blue: 1.0),
                                         Color(red: 0.80, green: 0.88, blue: 0.96)))
            Capsule().fill(Color(red: 0.62, green: 0.45, blue: 0.30))
                .frame(width: w * 0.5, height: 8)
                .position(x: w * 0.5, y: h * 0.7)
            ForEach(0..<10, id: \.self) { i in
                Rectangle().fill(Color(white: 0.55).opacity(0.5))
                    .frame(width: 3, height: h)
                    .position(x: w * (CGFloat(i) + 0.5) / 10, y: h / 2)
            }
            Rectangle().fill(Color(white: 0.5).opacity(0.6)).frame(width: w, height: 5).position(x: w / 2, y: 4)
            Rectangle().fill(Color(white: 0.5).opacity(0.6)).frame(width: w, height: 5).position(x: w / 2, y: h - 4)
        }
    }

    // MARK: - Cozy cage

    private func cage(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            Rectangle().fill(skyGradient(Color(red: 0.98, green: 0.93, blue: 0.82),
                                         Color(red: 0.93, green: 0.85, blue: 0.70)))
            ForEach(0..<5, id: \.self) { i in
                Ellipse().fill(Color(red: 0.85, green: 0.74, blue: 0.52))
                    .frame(width: w * 0.32, height: h * 0.16)
                    .position(x: w * (CGFloat(i) + 0.5) / 5, y: h * (0.88 + 0.02 * CGFloat(i % 2)))
            }
            VStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 4).fill(Color.blue.opacity(0.35))
                    .frame(width: w * 0.07, height: h * 0.26)
                Rectangle().fill(Color(white: 0.6)).frame(width: 3, height: h * 0.06)
            }
            .position(x: w * 0.9, y: h * 0.3)
        }
    }
}

/// Simple upward triangle for the coop roof.
struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}
