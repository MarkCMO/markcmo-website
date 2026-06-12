import XCTest

// Captures App Store screenshots on the CI simulator with fastlane snapshot. The app
// is launched with -uitestSeed, which populates a believable multi-pet "happy" state
// (see RootView.seedDemoForScreenshots) and skips onboarding and the parent PIN gate,
// so each screen is deterministic with no fragile navigation. Element lookups are
// device-agnostic: iPad lays out TabView differently than iPhone, so we gate on the
// Home header text and address tabs as plain buttons rather than tabBars buttons.
@MainActor
final class ScreenshotTests: XCTestCase {

    override func setUpWithError() throws {
        // Keep capturing the remaining screens even if one tab lookup misbehaves.
        continueAfterFailure = true
    }

    func testCaptureScreenshots() throws {
        let app = XCUIApplication()
        setupSnapshot(app)
        app.launchArguments += ["-uitestSeed"]
        app.launch()

        // The Home tab is selected on launch; its "Today" header is a reliable,
        // device-independent signal that the seeded UI has rendered.
        let today = app.staticTexts["Today"]
        XCTAssertTrue(today.waitForExistence(timeout: 40), "Home did not render")
        sleep(2)
        snapshot("01-Home")

        snapshotTab(app, label: "Pet", name: "02-Pet")
        snapshotTab(app, label: "Budget", name: "03-Budget")
        snapshotTab(app, label: "Rewards", name: "04-Rewards")
    }

    private func snapshotTab(_ app: XCUIApplication, label: String, name: String) {
        // firstMatch avoids "multiple matches" when the label appears more than once
        // in the accessibility tree (e.g. the iPad floating tab bar).
        let tab = app.buttons[label].firstMatch
        if tab.waitForExistence(timeout: 10) {
            tab.tap()
            sleep(2)
        }
        snapshot(name)
    }
}
