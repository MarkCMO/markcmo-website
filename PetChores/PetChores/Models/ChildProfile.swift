import Foundation
import SwiftData

/// The single child profile in v1 (Section 3.7). Kept as its own model so adding more
/// children later is possible without reshaping the schema (Section 15).
@Model
final class ChildProfile {
    @Attribute(.unique) var id: UUID
    var name: String
    var age: Int
    var avatar: String   // asset name or SF Symbol name

    init(id: UUID = UUID(), name: String, age: Int, avatar: String) {
        self.id = id
        self.name = name
        self.age = age
        self.avatar = avatar
    }
}
