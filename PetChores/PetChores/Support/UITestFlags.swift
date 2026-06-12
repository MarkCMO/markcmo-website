import Foundation

/// Flags derived from launch arguments for UI-test screenshot capture.
enum UITestFlags {
    /// True when launched with `-uitestSeed` (the App Store screenshot run). Perpetually
    /// animating scenes (the pet TimelineView, confetti) render a single static frame in
    /// this mode so XCUITest can reach an idle state instead of waiting out every
    /// synchronization timeout, which otherwise makes the snapshot run crawl.
    static let staticScenes = ProcessInfo.processInfo.arguments.contains("-uitestSeed")
}
