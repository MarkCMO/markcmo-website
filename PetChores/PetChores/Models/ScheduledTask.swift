import Foundation
import SwiftData

/// A concrete task occurrence generated from a CareTaskTemplate for a given pet
/// instance (Section 3.5). We snapshot the display fields from the template onto the
/// row so the Home screen and notifications never need to re-look-up the species, and
/// so history stays readable even if the catalog changes in a future update.
@Model
final class ScheduledTask {
    @Attribute(.unique) var scheduledId: UUID
    var instanceId: UUID
    var templateId: String
    var dueAt: Date
    var statusRaw: String
    var completedAt: Date?
    var verifiedAt: Date?

    // Snapshotted template fields.
    var label: String
    var difficulty: Int
    var frequencyRaw: String
    var realAction: String
    var consequence: String

    // Notification + completion bookkeeping.
    var snoozeCount: Int
    var photoFileName: String?   // local file name only; photos never leave the device
    var onTime: Bool             // recorded when completed: within the grace window

    init(
        scheduledId: UUID = UUID(),
        instanceId: UUID,
        templateId: String,
        dueAt: Date,
        status: TaskStatus = .pending,
        label: String,
        difficulty: Int,
        frequency: TaskFrequency,
        realAction: String,
        consequence: String,
        snoozeCount: Int = 0,
        photoFileName: String? = nil,
        onTime: Bool = false,
        completedAt: Date? = nil,
        verifiedAt: Date? = nil
    ) {
        self.scheduledId = scheduledId
        self.instanceId = instanceId
        self.templateId = templateId
        self.dueAt = dueAt
        self.statusRaw = status.rawValue
        self.label = label
        self.difficulty = difficulty
        self.frequencyRaw = frequency.rawValue
        self.realAction = realAction
        self.consequence = consequence
        self.snoozeCount = snoozeCount
        self.photoFileName = photoFileName
        self.onTime = onTime
        self.completedAt = completedAt
        self.verifiedAt = verifiedAt
    }

    var status: TaskStatus {
        get { TaskStatus(rawValue: statusRaw) ?? .pending }
        set { statusRaw = newValue.rawValue }
    }

    var frequency: TaskFrequency {
        TaskFrequency(rawValue: frequencyRaw) ?? .daily
    }

    /// A daily task counts toward the daily requirement and streak math.
    var isDaily: Bool { frequency == .daily }

    /// Counts as handled for completion-rate purposes.
    var isHandled: Bool { status == .done || status == .verified }

    /// Waiting for a grown-up to verify.
    var isAwaitingVerification: Bool { status == .done }
}
