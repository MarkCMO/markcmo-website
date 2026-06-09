import Foundation
import SwiftData

/// A single budget line tied to a pet instance (Section 3.6 and Section 10).
@Model
final class BudgetEntry {
    @Attribute(.unique) var id: UUID
    var instanceId: UUID
    var label: String
    var amount: Double
    var typeRaw: String   // startup | recurring
    var date: Date

    init(
        id: UUID = UUID(),
        instanceId: UUID,
        label: String,
        amount: Double,
        type: BudgetEntryType,
        date: Date
    ) {
        self.id = id
        self.instanceId = instanceId
        self.label = label
        self.amount = amount
        self.typeRaw = type.rawValue
        self.date = date
    }

    var type: BudgetEntryType {
        BudgetEntryType(rawValue: typeRaw) ?? .startup
    }
}
