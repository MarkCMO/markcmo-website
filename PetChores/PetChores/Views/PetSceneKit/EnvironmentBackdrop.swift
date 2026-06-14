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
    /// 0...1 real-time mess: as it climbs, poop appears in the yard, drifts toward the
    /// fence, and the neighbor shows up annoyed. Drives the backyard care scenario.
    var waste: Double = 0
    /// 0...1 hunger, so the food bowl empties as the pet gets hungry.
    var hunger: Double = 0
    /// 0...1 bladder fullness for yard animals, so a puddle shows when an accident is near.
    var relief: Double = 0
    /// Whether the annoyed neighbor appears at a maxed-out yard (off when the parent has
    /// turned social pressure off).
    var showNeighbor: Bool = true

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
                if habitat == .backyard && relief >= 0.55 { puddle(w: w, h: h) }
                if habitat.hasFoodBowl { foodBowl(w: w, h: h, fill: 1 - hunger) }
            }
            .frame(width: w, height: h)
        }
    }

    // MARK: - Food bowl and accidents (shared across the land habitats)

    /// A food dish on the ground. The kibble mound shrinks as the bowl empties (hunger
    /// climbs); when empty only the dish is left, so "feed me" reads at a glance.
    private func foodBowl(w: CGFloat, h: CGFloat, fill: Double) -> some View {
        let f = max(0.0, min(1.0, fill))
        let bowlW = w * 0.14
        let kibble = Color(red: 0.55, green: 0.36, blue: 0.18)
        return ZStack {
            // Shadow + dish.
            Ellipse().fill(.black.opacity(0.12)).frame(width: bowlW * 1.1, height: bowlW * 0.34).offset(y: bowlW * 0.22)
            Ellipse().fill(Color(red: 0.30, green: 0.55, blue: 0.78)).frame(width: bowlW, height: bowlW * 0.42)
            Ellipse().fill(Color(red: 0.20, green: 0.42, blue: 0.62)).frame(width: bowlW * 0.82, height: bowlW * 0.30)
            // Kibble mound, scaled by how full the bowl is.
            if f > 0.05 {
                ZStack {
                    Ellipse().fill(kibble)
                        .frame(width: bowlW * 0.72 * CGFloat(f), height: bowlW * 0.30 * CGFloat(f))
                        .offset(y: -bowlW * 0.02)
                    ForEach(0..<5, id: \.self) { i in
                        Circle().fill(kibble.opacity(0.95))
                            .frame(width: bowlW * 0.12, height: bowlW * 0.12)
                            .offset(x: CGFloat(i - 2) * bowlW * 0.13 * CGFloat(f),
                                    y: -bowlW * 0.05 * CGFloat(f))
                    }
                }
            }
        }
        .position(x: w * 0.17, y: h * 0.88)
    }

    /// A small yellow puddle that appears when a yard animal needs to go (or just has an
    /// accident), with a couple of faint ripples so it reads as fresh.
    private func puddle(w: CGFloat, h: CGFloat) -> some View {
        let pw = w * 0.16
        let c = Color(red: 0.96, green: 0.86, blue: 0.30)
        return ZStack {
            Ellipse().fill(c.opacity(0.55)).frame(width: pw, height: pw * 0.45)
            Ellipse().fill(c.opacity(0.75)).frame(width: pw * 0.6, height: pw * 0.28)
            Ellipse().strokeBorder(c.opacity(0.5), lineWidth: 1).frame(width: pw * 1.2, height: pw * 0.55)
        }
        .position(x: w * 0.62, y: h * 0.82)
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
            bush(w: w, h: h)
            grass(w: w, h: h)
            flowers(w: w, h: h)
            if waste > 0.15 { poopPiles(w: w, h: h) }
            fence(w, h)
            if waste >= 0.85 && showNeighbor { neighbor(w: w, h: h) }
            if !sky.isNight && !raining { butterflies(w: w, h: h) }
            if raining {
                Rectangle().fill(Color.black.opacity(0.12))
                rain(w: w, h: h)
            }
        }
    }

    // MARK: - Backyard care scenario (poop, drift to the neighbor, the neighbor)

    /// Poop piles in the grass; more of them, and one drifting toward the fence, as the
    /// mess builds. Small stink wisps rise so it reads clearly.
    private func poopPiles(w: CGFloat, h: CGFloat) -> some View {
        let count = waste >= 0.9 ? 3 : (waste >= 0.55 ? 2 : 1)
        // The third pile creeps toward the fence (the neighbor's side) as waste maxes out.
        let creep = CGFloat(min(1.0, max(0.0, (waste - 0.85) / 0.15)))
        let spots: [(CGFloat, CGFloat)] = [
            (0.34, 0.80), (0.54, 0.86), (0.74 + creep * 0.12, 0.70 - creep * 0.08)
        ]
        return ZStack {
            ForEach(0..<count, id: \.self) { i in
                poop(at: CGPoint(x: spots[i].0 * w, y: spots[i].1 * h), s: w * 0.05)
            }
        }
    }

    private func poop(at p: CGPoint, s: CGFloat) -> some View {
        let c1 = Color(red: 0.40, green: 0.27, blue: 0.15)
        let c2 = Color(red: 0.46, green: 0.31, blue: 0.18)
        let c3 = Color(red: 0.52, green: 0.36, blue: 0.21)
        return ZStack {
            Ellipse().fill(.black.opacity(0.12)).frame(width: s * 2.2, height: s * 0.5).offset(y: s * 0.7)
            Ellipse().fill(c1).frame(width: s * 2.0, height: s * 0.85).offset(y: s * 0.45)
            Ellipse().fill(c2).frame(width: s * 1.5, height: s * 0.75).offset(y: s * 0.02)
            Ellipse().fill(c3).frame(width: s * 1.0, height: s * 0.62).offset(y: -s * 0.38)
            Circle().fill(c3).frame(width: s * 0.34, height: s * 0.34).offset(y: -s * 0.7)
            // Stink wisps.
            ForEach(0..<2, id: \.self) { k in
                let kk = Double(k)
                let rise = (t * 0.9 + kk * 0.5).truncatingRemainder(dividingBy: 1.0)
                Path { pp in
                    let bx = CGFloat(-0.3 + 0.6 * kk) * s
                    pp.move(to: CGPoint(x: bx, y: -s * 0.7 - CGFloat(rise) * s * 1.4))
                    pp.addQuadCurve(to: CGPoint(x: bx + s * 0.18, y: -s * 1.1 - CGFloat(rise) * s * 1.4),
                                    control: CGPoint(x: bx - s * 0.2, y: -s * 0.9 - CGFloat(rise) * s * 1.4))
                }
                .stroke(Color(red: 0.55, green: 0.65, blue: 0.45).opacity(0.5 * (1 - rise)),
                        style: StrokeStyle(lineWidth: max(1, s * 0.1), lineCap: .round))
            }
        }
        .position(p)
    }

    /// The neighbor peeks over the fence, annoyed, when the mess reaches their side.
    private func neighbor(w: CGFloat, h: CGFloat) -> some View {
        let skin = Color(red: 0.95, green: 0.80, blue: 0.66)
        let bob = CGFloat(sin(t * 3)) * h * 0.006
        return ZStack {
            // Speech bubble with an angry mark.
            ZStack {
                RoundedRectangle(cornerRadius: 8).fill(.white)
                    .frame(width: w * 0.12, height: w * 0.09)
                Text("!").font(.system(size: w * 0.06, weight: .black, design: .rounded))
                    .foregroundStyle(Color(red: 0.85, green: 0.18, blue: 0.18))
            }
            .offset(x: w * 0.02, y: -h * 0.13)

            // Head and hair peeking over the fence top.
            ZStack {
                Circle().fill(Color(red: 0.45, green: 0.32, blue: 0.22))
                    .frame(width: w * 0.115, height: w * 0.115).offset(y: -w * 0.018) // hair
                Circle().fill(skin).frame(width: w * 0.10, height: w * 0.10)
                // Angry brows.
                ForEach([-1.0, 1.0], id: \.self) { sgn in
                    Capsule().fill(.black.opacity(0.7)).frame(width: w * 0.022, height: 3)
                        .rotationEffect(.degrees(sgn * 18))
                        .offset(x: CGFloat(sgn) * w * 0.020, y: -w * 0.012)
                    Circle().fill(.black.opacity(0.8)).frame(width: w * 0.011, height: w * 0.011)
                        .offset(x: CGFloat(sgn) * w * 0.020, y: -w * 0.002)
                }
                // Frown.
                Path { pp in
                    pp.move(to: CGPoint(x: -w * 0.018, y: w * 0.022))
                    pp.addQuadCurve(to: CGPoint(x: w * 0.018, y: w * 0.022), control: CGPoint(x: 0, y: w * 0.012))
                }
                .stroke(.black.opacity(0.6), style: StrokeStyle(lineWidth: 2, lineCap: .round))
            }
            .offset(y: bob)
        }
        .position(x: w * 0.82, y: h * 0.55)
    }

    /// A leafy bush tucked by the fence.
    private func bush(w: CGFloat, h: CGFloat) -> some View {
        let c = Color(red: 0.26, green: 0.50, blue: 0.27)
        let cd = Color(red: 0.20, green: 0.42, blue: 0.22)
        return ZStack {
            Circle().fill(cd).frame(width: w * 0.17, height: w * 0.17).offset(x: -w * 0.06, y: w * 0.01)
            Circle().fill(c).frame(width: w * 0.22, height: w * 0.22)
            Circle().fill(c).frame(width: w * 0.15, height: w * 0.15).offset(x: w * 0.07, y: w * 0.01)
        }
        .position(x: w * 0.85, y: h * 0.605)
    }

    /// A few simple flowers that sway in the grass.
    private func flowers(w: CGFloat, h: CGFloat) -> some View {
        let spots: [(CGFloat, Color)] = [
            (0.10, Color(red: 0.95, green: 0.45, blue: 0.62)),
            (0.27, Color(red: 0.98, green: 0.80, blue: 0.30)),
            (0.66, Color(red: 0.66, green: 0.50, blue: 0.92)),
            (0.90, Color(red: 0.97, green: 0.58, blue: 0.30))
        ]
        return ZStack {
            ForEach(0..<spots.count, id: \.self) { i in
                let sway = sin(t * 1.8 + Double(i) * 1.3) * 4
                ZStack {
                    Rectangle().fill(Color(red: 0.30, green: 0.55, blue: 0.28))
                        .frame(width: 3, height: h * 0.09)
                    ZStack {
                        ForEach(0..<5, id: \.self) { p in
                            Circle().fill(spots[i].1)
                                .frame(width: w * 0.028, height: w * 0.028)
                                .offset(y: -w * 0.024)
                                .rotationEffect(.degrees(Double(p) * 72))
                        }
                        Circle().fill(Color(red: 1.0, green: 0.86, blue: 0.30))
                            .frame(width: w * 0.02, height: w * 0.02)
                    }
                    .offset(y: -h * 0.045)
                }
                .rotationEffect(.degrees(sway), anchor: .bottom)
                .position(x: spots[i].0 * w, y: h * 0.85)
            }
        }
    }

    /// Two butterflies that flutter across the yard in daylight.
    private func butterflies(w: CGFloat, h: CGFloat) -> some View {
        ZStack {
            ForEach(0..<2, id: \.self) { i in
                let ii = Double(i)
                let px = w * (0.30 + 0.36 * ii) + CGFloat(sin(t * 0.8 + ii * 2)) * w * 0.16
                let py = h * (0.40 + 0.10 * ii) + CGFloat(cos(t * 1.1 + ii)) * h * 0.08
                let flap = CGFloat(abs(sin(t * 8 + ii)) * 0.6 + 0.4)
                let col = i == 0 ? Color(red: 0.97, green: 0.58, blue: 0.30) : Color(red: 0.66, green: 0.50, blue: 0.92)
                ZStack {
                    Ellipse().fill(col.opacity(0.9)).frame(width: w * 0.03 * flap, height: w * 0.045).offset(x: -w * 0.014)
                    Ellipse().fill(col.opacity(0.9)).frame(width: w * 0.03 * flap, height: w * 0.045).offset(x: w * 0.014)
                    Capsule().fill(Color.black.opacity(0.7)).frame(width: 2, height: w * 0.04)
                }
                .position(x: px, y: py)
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
            if waste > 0.2 { tankFouling(w: w, h: h) }
        }
    }

    /// As the tank fouls, the water clouds green and bits of waste drift through it.
    private func tankFouling(w: CGFloat, h: CGFloat) -> some View {
        let murk = min(0.5, (waste - 0.2) * 0.7)
        return ZStack {
            Rectangle().fill(Color(red: 0.34, green: 0.52, blue: 0.28).opacity(murk))
            // Algae creeping up the glass edges.
            ForEach(0..<6, id: \.self) { i in
                let side: CGFloat = i % 2 == 0 ? 0.03 : 0.97
                Circle().fill(Color(red: 0.30, green: 0.50, blue: 0.26).opacity(min(0.7, waste)))
                    .frame(width: w * 0.05, height: w * 0.05)
                    .position(x: w * side, y: h * CGFloat(0.25 + 0.12 * Double(i)))
            }
            // Floating debris specks drifting across.
            ForEach(0..<9, id: \.self) { i in
                let span = Double(w) + 30
                let drift = (t * 6 + Double(i) * 41).truncatingRemainder(dividingBy: span) - 15
                Circle().fill(Color(red: 0.42, green: 0.50, blue: 0.30).opacity(0.55 * min(1.0, waste)))
                    .frame(width: w * 0.014, height: w * 0.014)
                    .position(x: CGFloat(drift),
                              y: h * CGFloat(0.18 + 0.62 * Double((i * 37) % 100) / 100) + CGFloat(sin(t + Double(i)) * 6))
            }
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

    // MARK: - Ground mess for the caged habitats (soiled bedding, droppings, substrate)

    /// Small droppings scattered on the floor that multiply as the cage / cage tray /
    /// terrarium soils. Used by the cage, birdcage, and terrarium so each has a visible
    /// mess to clean, the way the yard and tank already do. Stink wisps rise when bad.
    private func groundMess(w: CGFloat, h: CGFloat, baseline: CGFloat) -> some View {
        let count = waste >= 0.85 ? 6 : (waste >= 0.55 ? 4 : 2)
        let spots: [(CGFloat, CGFloat)] = [
            (0.22, 0.0), (0.42, 0.04), (0.61, -0.02), (0.74, 0.05), (0.34, 0.07), (0.55, 0.09)
        ]
        let c1 = Color(red: 0.36, green: 0.25, blue: 0.15)
        let c2 = Color(red: 0.46, green: 0.32, blue: 0.20)
        return ZStack {
            ForEach(0..<count, id: \.self) { i in
                let s = w * 0.018
                ZStack {
                    Ellipse().fill(.black.opacity(0.12)).frame(width: s * 2.6, height: s * 0.8).offset(y: s * 0.5)
                    Capsule().fill(c1).frame(width: s * 2.2, height: s * 1.1)
                    Capsule().fill(c2).frame(width: s * 1.3, height: s * 0.7).offset(x: s * 0.2, y: -s * 0.1)
                }
                .position(x: w * spots[i].0, y: baseline + h * spots[i].1)
            }
            if waste >= 0.6 {
                ForEach(0..<2, id: \.self) { k in
                    let kk = Double(k)
                    let rise = (t * 0.8 + kk * 0.5).truncatingRemainder(dividingBy: 1.0)
                    Path { pp in
                        let bx = w * (0.40 + 0.18 * kk)
                        pp.move(to: CGPoint(x: bx, y: baseline - CGFloat(rise) * h * 0.18))
                        pp.addQuadCurve(to: CGPoint(x: bx + w * 0.02, y: baseline - h * 0.10 - CGFloat(rise) * h * 0.18),
                                        control: CGPoint(x: bx - w * 0.02, y: baseline - h * 0.05 - CGFloat(rise) * h * 0.18))
                    }
                    .stroke(Color(red: 0.55, green: 0.62, blue: 0.40).opacity(0.45 * (1 - rise)),
                            style: StrokeStyle(lineWidth: 2, lineCap: .round))
                }
            }
        }
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
            if waste > 0.15 { groundMess(w: w, h: h, baseline: h * 0.86) }
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
            if waste > 0.15 { groundMess(w: w, h: h, baseline: h * 0.90) }
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
            if waste > 0.15 { groundMess(w: w, h: h, baseline: h * 0.88) }
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
