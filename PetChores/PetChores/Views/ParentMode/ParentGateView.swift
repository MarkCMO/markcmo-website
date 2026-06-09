import SwiftUI
import SwiftData

/// PIN gate that a young child cannot trivially pass (Section 13). Used before entering
/// Parent Mode and before any purchase or export. Calls onSuccess when the correct PIN
/// is entered.
struct ParentGateView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    let title: String

    /// Optional in-memory check used during onboarding before ParentSettings is saved.
    /// When nil, the gate verifies against the stored salted PIN hash. Declared before
    /// onSuccess so trailing-closure call sites bind the closure to onSuccess.
    var verifyOverride: ((String) -> Bool)? = nil

    let onSuccess: () -> Void

    @State private var entry: String = ""
    @State private var error: String?
    @State private var shake = false

    private let pinLength = 4

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()
                Image(systemName: "lock.fill")
                    .font(.system(size: 44))
                    .foregroundStyle(.secondary)
                Text(title)
                    .font(.title2.bold())
                    .multilineTextAlignment(.center)
                Text("Ask a grown up to enter the PIN.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                dots
                    .modifier(ShakeEffect(animatableData: shake ? 1 : 0))

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }

                pad
                Spacer()
            }
            .padding()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var dots: some View {
        HStack(spacing: 16) {
            ForEach(0..<pinLength, id: \.self) { i in
                Circle()
                    .strokeBorder(Color.secondary, lineWidth: 1.5)
                    .background(Circle().fill(i < entry.count ? Color.accentColor : Color.clear))
                    .frame(width: 18, height: 18)
            }
        }
        .accessibilityLabel("\(entry.count) of \(pinLength) digits entered")
    }

    private var pad: some View {
        let keys = ["1","2","3","4","5","6","7","8","9","","0","del"]
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 14) {
            ForEach(keys, id: \.self) { key in
                if key.isEmpty {
                    Color.clear.frame(height: 64)
                } else if key == "del" {
                    Button {
                        if !entry.isEmpty { entry.removeLast() }
                    } label: {
                        Image(systemName: "delete.left")
                            .font(.title2)
                            .frame(maxWidth: .infinity, minHeight: 64)
                    }
                    .accessibilityLabel("Delete")
                } else {
                    Button {
                        tap(key)
                    } label: {
                        Text(key)
                            .font(.title.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 64)
                            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
            }
        }
        .frame(maxWidth: 320)
    }

    private func tap(_ digit: String) {
        guard entry.count < pinLength else { return }
        entry += digit
        if entry.count == pinLength { verify() }
    }

    private func verify() {
        let ok: Bool
        if let verifyOverride {
            ok = verifyOverride(entry)
        } else if let settings = DataStore.parentSettings(context) {
            ok = PINManager.verify(pin: entry, salt: settings.pinSalt, expectedHash: settings.pinHash)
        } else {
            error = "No parent PIN is set up yet."
            return
        }

        if ok {
            onSuccess()
            dismiss()
        } else {
            error = "That PIN was not right. Try again."
            entry = ""
            withAnimation(.default) { shake.toggle() }
        }
    }
}

/// Simple horizontal shake for a wrong PIN.
struct ShakeEffect: GeometryEffect {
    var animatableData: CGFloat
    func effectValue(size: CGSize) -> ProjectionTransform {
        let translation = 10 * sin(animatableData * .pi * 4)
        return ProjectionTransform(CGAffineTransform(translationX: translation, y: 0))
    }
}
