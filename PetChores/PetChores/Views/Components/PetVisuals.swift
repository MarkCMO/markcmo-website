import SwiftUI

/// Mood face shown over a pet portrait. A stand-in for real per pet mood art across the
/// five wellbeing states (Section 9, Section 14).
struct MoodBadge: View {
    let mood: Mood
    var size: CGFloat = 28
    var body: some View {
        Image(systemName: mood.symbolName)
            .font(.system(size: size))
            .foregroundStyle(mood.tint)
            .accessibilityLabel("Mood: \(mood.label)")
    }
}

/// Round pet portrait built from the species icon, tinted by mood.
struct PetPortrait: View {
    let species: PetSpecies
    let mood: Mood
    var diameter: CGFloat = 96

    var body: some View {
        ZStack {
            Circle()
                .fill(mood.tint.opacity(0.18))
            Image(systemName: species.iconName)
                .font(.system(size: diameter * 0.42))
                .foregroundStyle(mood.tint)
        }
        .frame(width: diameter, height: diameter)
        .overlay(alignment: .bottomTrailing) {
            MoodBadge(mood: mood, size: diameter * 0.26)
                .padding(diameter * 0.04)
                .background(Circle().fill(Color(.systemBackground)))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(species.name), feeling \(mood.label)")
    }
}

/// Horizontal wellbeing bar (0 to 100), colored by mood. Does not rely on color alone:
/// the numeric value is shown and announced (Section 13).
struct WellbeingBar: View {
    let wellbeing: Int
    var mood: Mood { Mood.from(wellbeing: wellbeing) }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Wellbeing")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(wellbeing)")
                    .font(.caption.weight(.bold).monospacedDigit())
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.secondary.opacity(0.2))
                    Capsule()
                        .fill(mood.tint)
                        .frame(width: max(6, geo.size.width * CGFloat(wellbeing) / 100))
                }
            }
            .frame(height: 12)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Wellbeing \(wellbeing) out of 100, \(mood.label)")
    }
}

/// Streak flame with count.
struct StreakFlame: View {
    let days: Int
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "flame.fill")
                .foregroundStyle(days > 0 ? .orange : .secondary.opacity(0.5))
            Text("\(days)")
                .font(.headline.monospacedDigit())
        }
        .accessibilityLabel("\(days) day streak")
    }
}

/// Status chip for a scheduled task row.
struct StatusChip: View {
    let status: TaskStatus
    var body: some View {
        let (text, color, icon) = style
        return Label(text, systemImage: icon)
            .labelStyle(.titleAndIcon)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }

    private var style: (String, Color, String) {
        switch status {
        case .pending:  return ("To do", .blue, "circle")
        case .done:     return ("Waiting for grown-up", .purple, "clock")
        case .verified: return ("Done", .green, "checkmark.seal.fill")
        case .missed:   return ("Missed", .orange, "exclamationmark.circle")
        case .rejected: return ("Try again", .blue, "arrow.counterclockwise")
        }
    }
}
