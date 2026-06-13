import Foundation
import StoreKit

/// StoreKit 2 wrapper for the subscription plans: a 3-day free trial, then One Pet weekly
/// or monthly, or an Unlimited plan. StoreKit is the source of truth for entitlement;
/// `activePlan` is a cached mirror refreshed from current entitlements on launch and on
/// every transaction update. The highest active plan wins; `.none` shows the paywall.
@MainActor
final class StoreService: ObservableObject {

    enum PurchasePhase: Equatable {
        case idle
        case purchasing
        case purchased
        case restored
        case pending     // Ask to Buy / Family Sharing approval needed
        case failed(String)
        case cancelled
    }

    /// Loaded subscription products, sorted by plan rank (One Pet plans, then Unlimited).
    @Published private(set) var products: [Product] = []
    /// The highest currently-active plan. `.none` when no subscription/trial is active.
    @Published private(set) var activePlan: PetPlan = .none
    @Published var phase: PurchasePhase = .idle

    /// How many pets may be active at once on the current plan.
    var maxPets: Int { activePlan.maxPets }
    /// Whether any paid plan is active (gates photo proof, report export, etc.).
    var isUnlocked: Bool { activePlan != .none }

    private var updatesTask: Task<Void, Never>?

    init() {
        // Listen for transactions that arrive outside of an explicit purchase call
        // (Ask to Buy approvals, renewals, purchases on other devices, Family Sharing).
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                await self?.handle(result)
            }
        }
    }

    deinit { updatesTask?.cancel() }

    /// Load products and resolve the current entitlement. Call at launch.
    func start() async {
        await loadProducts()
        await refreshEntitlement()
    }

    func loadProducts() async {
        do {
            let loaded = try await Product.products(for: PetPlan.productIds)
            products = loaded.sorted {
                (PetPlan.plan(forProductId: $0.id)?.rank ?? 0) < (PetPlan.plan(forProductId: $1.id)?.rank ?? 0)
            }
        } catch {
            // Non-fatal: the paywall shows a friendly retry state.
            products = []
        }
    }

    /// Read live entitlements; the truth for the active plan.
    func refreshEntitlement() async {
        var best = PetPlan.none
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.revocationDate == nil,
               (transaction.expirationDate ?? .distantFuture) > Date(),
               let plan = PetPlan.plan(forProductId: transaction.productID),
               plan.rank > best.rank {
                best = plan
            }
        }
        activePlan = best
    }

    /// Begin a subscription purchase. The caller must already be behind the parental gate.
    func purchase(_ product: Product) async {
        phase = .purchasing
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                await handle(verification)
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

    /// Restore Purchases button (required by App Review).
    func restore() async {
        phase = .purchasing
        do {
            try await AppStore.sync()
            await refreshEntitlement()
            phase = isUnlocked ? .restored : .failed("No active subscription was found for this Apple ID.")
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    /// The plan a given product represents.
    func plan(for product: Product) -> PetPlan {
        PetPlan.plan(forProductId: product.id) ?? .none
    }

    private func handle(_ result: VerificationResult<Transaction>) async {
        guard case .verified(let transaction) = result else { return }
        await transaction.finish()
        await refreshEntitlement()
    }
}
