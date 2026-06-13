import SwiftUI
import StoreKit

/// The plan picker, shown only inside PIN-gated Parent Mode (Section 13B). A child can
/// never reach this screen. One pet is free; monthly plans add more pets at once. Includes
/// the required Restore Purchases button and subscription disclosure.
struct StoreView: View {
    @EnvironmentObject private var store: StoreService

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: "pawprint.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(Color.accentColor)

                Text(store.isUnlocked ? "\(store.activePlan.title) plan active" : "Start your free trial")
                    .font(.largeTitle.bold())
                    .multilineTextAlignment(.center)

                Text("Try Pet Chores free for 3 days, then keep training with the plan that fits. Cancel anytime.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                if store.products.isEmpty {
                    ProgressView("Loading plans...")
                        .padding(.vertical, 8)
                } else {
                    ForEach(store.products, id: \.id) { product in
                        planCard(product)
                    }
                }

                Button("Restore Purchases") {
                    Task { await store.restore() }
                }
                .font(.subheadline.weight(.semibold))

                Text("Plans renew monthly until cancelled in your Apple ID settings. Payment is charged to your Apple ID. One pet is always free with no subscription.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                phaseMessage
            }
            .padding()
        }
        .navigationTitle("Pet Plans")
        .navigationBarTitleDisplayMode(.inline)
        .task { if store.products.isEmpty { await store.loadProducts() } }
    }

    @ViewBuilder
    private func planCard(_ product: Product) -> some View {
        let plan = store.plan(for: product)
        let isActive = store.activePlan == plan
        Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    Text(plan.title).font(.headline)
                    Spacer()
                    Text("\(product.displayPrice)/\(periodLabel(product))")
                        .font(.headline)
                        .foregroundStyle(Color.accentColor)
                }
                Text(plan.blurb)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if hasFreeTrial(product) {
                    Label("3-day free trial", systemImage: "gift.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                }

                if isActive {
                    Label("Current plan", systemImage: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                        .font(.subheadline.weight(.semibold))
                } else {
                    Button {
                        Task { await store.purchase(product) }
                    } label: {
                        Text(hasFreeTrial(product) ? "Start free trial" : "Choose \(plan.title)")
                    }
                    .buttonStyle(BigButtonStyle())
                }
            }
        }
    }

    /// "week" / "month" from the product's subscription period.
    private func periodLabel(_ product: Product) -> String {
        guard let unit = product.subscription?.subscriptionPeriod.unit else { return "month" }
        switch unit {
        case .day:   return "day"
        case .week:  return "week"
        case .month: return "month"
        case .year:  return "year"
        @unknown default: return "month"
        }
    }

    private func hasFreeTrial(_ product: Product) -> Bool {
        product.subscription?.introductoryOffer?.paymentMode == .freeTrial
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
