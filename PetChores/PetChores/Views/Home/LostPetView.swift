import SwiftUI

/// What the child sees when a pet has been lost to neglect (permanent loss is on and the
/// strike limit was reached). The tone is calm and constructive, never frightening: the pet
/// is safe and cared for at a shelter, the lesson is that pets need us every day, and the
/// way forward is to welcome a new pet and do better. Shown in place of the normal Home card.
struct LostPetView: View {
    let nickname: String
    let species: PetSpecies
    /// Called when the child taps to move on; the caller opens the parent gate.
    let onWelcomeNewPet: () -> Void

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 14) {
                ShelterScene()
                    .frame(height: 150)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.cardCorner, style: .continuous))

                Text("\(nickname) has gone to a shelter")
                    .font(.title2.bold())

                Text("When a pet is not cared for over and over, it has to go somewhere it will be looked after. \(nickname) is safe and the shelter will take good care of them. Pets count on us every single day, in good moods and bad.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Ready to try again and do even better?")
                    .font(.subheadline.bold())

                Button(action: onWelcomeNewPet) {
                    Label("Welcome a new pet", systemImage: "heart.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(BigButtonStyle())
            }
        }
    }
}

/// A gentle, muted scene: an empty collar and bowl left in the yard, a soft paw-print trail
/// leading to a little shelter with a heart, so the pet reads as cared for, not gone forever.
private struct ShelterScene: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            ZStack {
                // Soft dusk sky and grass, deliberately muted.
                Rectangle().fill(LinearGradient(
                    colors: [Color(red: 0.78, green: 0.80, blue: 0.88),
                             Color(red: 0.88, green: 0.86, blue: 0.82)],
                    startPoint: .top, endPoint: .bottom))
                VStack { Spacer(); Rectangle().fill(Color(red: 0.62, green: 0.70, blue: 0.55)).frame(height: h * 0.34) }

                // The shelter: a small home with a heart, on the right.
                shelter(w: w, h: h)

                // A faint trail of paw prints leading from the empty things toward the shelter.
                ForEach(0..<5, id: \.self) { i in
                    let f = Double(i) / 4.0
                    pawPrint(s: w * 0.018)
                        .position(x: w * (0.30 + 0.44 * f), y: h * (0.82 - 0.16 * f))
                        .opacity(0.30)
                }

                // The empty collar and bowl left behind, lower left.
                emptyCollar(w: w, h: h)
                emptyBowl(w: w, h: h)
            }
            .frame(width: w, height: h)
        }
    }

    private func shelter(w: CGFloat, h: CGFloat) -> some View {
        let bw = w * 0.22, bh = h * 0.34
        let x = w * 0.80, y = h * 0.55
        return ZStack {
            Triangle().fill(Color(red: 0.66, green: 0.45, blue: 0.40))
                .frame(width: bw * 1.25, height: bh * 0.55).offset(y: -bh * 0.62)
            RoundedRectangle(cornerRadius: 5).fill(Color(red: 0.86, green: 0.78, blue: 0.70))
                .frame(width: bw, height: bh)
            // Arched doorway.
            RoundedRectangle(cornerRadius: bw * 0.18).fill(Color(red: 0.40, green: 0.32, blue: 0.30))
                .frame(width: bw * 0.42, height: bh * 0.55).offset(y: bh * 0.22)
            // Heart over the door, so the place reads as caring.
            Image(systemName: "heart.fill")
                .resizable().scaledToFit()
                .frame(width: bw * 0.26, height: bw * 0.26)
                .foregroundStyle(Color(red: 0.86, green: 0.42, blue: 0.45))
                .offset(y: -bh * 0.16)
        }
        .position(x: x, y: y)
    }

    private func pawPrint(s: CGFloat) -> some View {
        ZStack {
            Ellipse().fill(Color(red: 0.45, green: 0.40, blue: 0.36)).frame(width: s * 1.4, height: s)
                .offset(y: s * 0.4)
            ForEach(0..<3, id: \.self) { k in
                Circle().fill(Color(red: 0.45, green: 0.40, blue: 0.36))
                    .frame(width: s * 0.4, height: s * 0.4)
                    .offset(x: CGFloat(k - 1) * s * 0.45, y: -s * 0.25)
            }
        }
    }

    private func emptyCollar(w: CGFloat, h: CGFloat) -> some View {
        ZStack {
            Ellipse().strokeBorder(Color(red: 0.30, green: 0.45, blue: 0.70), lineWidth: max(2, w * 0.012))
                .frame(width: w * 0.10, height: w * 0.045)
            // Little name tag.
            Circle().fill(Color(red: 0.92, green: 0.78, blue: 0.36))
                .frame(width: w * 0.022, height: w * 0.022)
                .offset(y: w * 0.02)
        }
        .position(x: w * 0.24, y: h * 0.80)
    }

    private func emptyBowl(w: CGFloat, h: CGFloat) -> some View {
        ZStack {
            Ellipse().fill(.black.opacity(0.10)).frame(width: w * 0.13, height: w * 0.04).offset(y: w * 0.02)
            Ellipse().fill(Color(red: 0.55, green: 0.55, blue: 0.60)).frame(width: w * 0.12, height: w * 0.05)
            Ellipse().fill(Color(red: 0.42, green: 0.42, blue: 0.47)).frame(width: w * 0.095, height: w * 0.035)
        }
        .position(x: w * 0.40, y: h * 0.88)
    }
}
