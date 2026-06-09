import SwiftUI

/// The paywall, shown only inside PIN-gated Parent Mode (Section 13B). A child can
/// never reach this screen. Includes the required Restore Purchases button.
struct StoreView: View {
    @EnvironmentObject private var store: StoreService

    private let benefits: [(String, String)] = [
        ("pawprint.fill", "Unlock every pet in the catalog"),
        ("square.stack.3d.up.fill", "Train several pets at the same time"),
        ("camera.fill", "Turn on photo proof for chores"),
        ("square.and.arrow.up", "Export the Readiness Report"),
        ("sparkles", "All future pets added in updates")
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Image(systemName: "lock.open.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(Color.accentColor)

                Text(store.isUnlocked ? "Full version unlocked" : "Unlock the full app")
                    .font(.largeTitle.bold())
                    .multilineTextAlignment(.center)

                if !store.isUnlocked {
                    Text("One simple purchase. No subscriptions, no ads.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }

                Card {
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(benefits, id: \.1) { benefit in
                            Label(benefit.1, systemImage: benefit.0)
                                .font(.body)
                        }
                    }
                }

                if store.isUnlocked {
                    Label("Thank you. Everything is unlocked.", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                        .font(.headline)
                } else {
                    Button {
                        Task { await store.purchase() }
                    } label: {
                        Text("Unlock for \(store.displayPrice)")
                    }
                    .buttonStyle(BigButtonStyle())

                    Button("Restore Purchases") {
                        Task { await store.restore() }
                    }
                    .font(.subheadline.weight(.semibold))
                }

                phaseMessage
            }
            .padding()
        }
        .navigationTitle("Unlock")
        .navigationBarTitleDisplayMode(.inline)
        .task { if store.product == nil { await store.loadProduct() } }
    }

    @ViewBuilder
    private var phaseMessage: some View {
        switch store.phase {
        case .purchasing:
            ProgressView("Working...")
        case .pending:
            Text("Waiting for approval. You can finish this in your family's account.")
                .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
        case .failed(let message):
            Text(message).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center)
        case .cancelled:
            EmptyView()
        case .purchased, .restored, .idle:
            EmptyView()
        }
    }
}
