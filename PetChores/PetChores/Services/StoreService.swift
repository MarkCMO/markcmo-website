import Foundation
import StoreKit

/// StoreKit 2 wrapper for the single non consumable unlock (Section 13B). StoreKit is
/// the source of truth for entitlement; `isUnlocked` is a cached mirror for snappy UI,
/// refreshed from current entitlements on launch and on every transaction update.
@MainActor
final class StoreService: ObservableObject {

    static let productId = "petchores.unlock.full"

    enum PurchasePhase: Equatable {
        case idle
        case purchasing
        case purchased
        case restored
        case pending     // Ask to Buy / Family Sharing approval needed
        case failed(String)
        case cancelled
    }

    @Published private(set) var product: Product?
    @Published private(set) var isUnlocked: Bool = false
    @Published var phase: PurchasePhase = .idle

    private var updatesTask: Task<Void, Never>?

    init() {
        // Listen for transactions that arrive outside of an explicit purchase call
        // (Ask to Buy approvals, purchases on other devices, Family Sharing).
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                await self?.handle(transactionResult: result)
            }
        }
    }

    deinit { updatesTask?.cancel() }

    /// Load the product and resolve the current entitlement. Call at launch.
    func start() async {
        await loadProduct()
        await refreshEntitlement()
    }

    func loadProduct() async {
        do {
            let products = try await Product.products(for: [Self.productId])
            product = products.first
        } catch {
            // Non-fatal: the paywall will show a friendly retry state.
            product = nil
        }
    }

    /// Read live entitlements; the truth for whether the app is unlocked.
    func refreshEntitlement() async {
        var unlocked = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == Self.productId,
               transaction.revocationDate == nil {
                unlocked = true
            }
        }
        isUnlocked = unlocked
    }

    /// Begin a purchase. The caller must already be behind the parental gate.
    func purchase() async {
        guard let product else {
            phase = .failed("The unlock is not available right now. Please try again.")
            return
        }
        phase = .purchasing
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                await handle(transactionResult: verification)
                phase = .purchased
            case .pending:
                phase = .pending
            case .userCancelled:
                phase = .cancelled
            @unknown default:
                phase = .failed("Something unexpected happened. Please try again.")
            }
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    /// Restore Purchases button (required by App Review, Section 13B).
    func restore() async {
        phase = .purchasing
        do {
            try await AppStore.sync()
            await refreshEntitlement()
            phase = isUnlocked ? .restored : .failed("No previous purchase was found for this Apple ID.")
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    private func handle(transactionResult: VerificationResult<Transaction>) async {
        guard case .verified(let transaction) = transactionResult else { return }
        if transaction.productID == Self.productId, transaction.revocationDate == nil {
            isUnlocked = true
        }
        await transaction.finish()
        await refreshEntitlement()
    }

    var displayPrice: String {
        product?.displayPrice ?? "$4.99"
    }
}
