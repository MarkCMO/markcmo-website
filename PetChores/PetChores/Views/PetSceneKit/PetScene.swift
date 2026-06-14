import SwiftUI

/// Weather shown in the outdoor habitats. Chosen per calendar day so it is stable
/// through the day but varies day to day.
enum SceneWeather {
    case clear
    case rain
}

/// A living pet scene: an animated habitat backdrop with a mood-reactive animal drawn
/// on top. One TimelineView drives both so everything animates in sync. The outdoor
/// habitats follow the real time of day and a per-day weather pick, and the pet sleeps
/// with a gentle "z z z" at night. Honors Reduce Motion by rendering a single static
/// frame (Section 13 accessibility).
struct PetScene: View {
    let species: PetSpecies
    let mood: Mood
    var showEnvironment: Bool = true
    /// 0...1 real-time mess (yard waste / tank fouling), passed to the backdrop so the
    /// care scenario (poop in the yard, the neighbor) shows.
    var waste: Double = 0
    /// 0...1 hunger, so the food bowl in the scene empties as the pet gets hungry.
    var hunger: Double = 0
    /// 0...1 bladder fullness for yard animals, so a puddle shows when an accident is near.
    var relief: Double = 0
    /// 0...1 growth, so a young pet is drawn smaller than a full-grown adult.
    var growth: Double = 1

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var habitat: Habitat { Habitat(category: species.category, id: species.id) }

    var body: some View {
        GeometryReader { geo in
            Group {
                if reduceMotion || UITestFlags.staticScenes {
                    frame(t: 0, date: Date(), size: geo.size)
                } else {
                    TimelineView(.animation) { timeline in
                        frame(t: timeline.date.timeIntervalSinceReferenceDate,
                              date: timeline.date,
                              size: geo.size)
                    }
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(species.name) \(habitat.label), feeling \(mood.label)")
    }

    private func frame(t: Double, date: Date, size: CGSize) -> some View {
        // For App Store screenshots, force a bright clear midday so the scene looks its
        // best regardless of the capture machine's clock.
        let phase = UITestFlags.staticScenes ? 0.5 : Self.skyPhase(date)
        let night = phase < 0.20 || phase > 0.88
        let weather = UITestFlags.staticScenes ? SceneWeather.clear : Self.weather(date)
        return ZStack {
            if showEnvironment {
                EnvironmentBackdrop(habitat: habitat, t: t, skyPhase: phase, weather: weather,
                                    waste: waste, hunger: hunger, relief: relief)
            } else {
                Color(.secondarySystemBackground)
            }
            Canvas { ctx, canvasSize in
                AnimalArt.draw(&ctx, size: canvasSize, id: species.id,
                               category: species.category, mood: mood, t: t, night: night)
            }
            .frame(width: size.height * 0.95 * CGFloat(GrowthService.scale(growth)),
                   height: size.height * 0.95 * CGFloat(GrowthService.scale(growth)))
        }
    }

    /// Fraction of the day (0 = midnight, 0.5 = noon) from a date in the local calendar.
    static func skyPhase(_ date: Date) -> Double {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        let minutes = Double((c.hour ?? 12) * 60 + (c.minute ?? 0))
        return minutes / (24 * 60)
    }

    /// Stable per-day weather: roughly three days in ten are rainy.
    static func weather(_ date: Date) -> SceneWeather {
        let day = Calendar.current.ordinality(of: .day, in: .year, for: date) ?? 0
        return (day * 7 + 3) % 10 < 3 ? .rain : .clear
    }
}
