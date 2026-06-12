import XCTest

// Captures App Store screenshots on the CI simulator with fastlane snapshot. The app
// is launched with -uitestSeed, which populates a believable multi-pet "happy" state
// (see RootView.seedDemoForScreenshots) and skips onboarding and the parent PIN gate,
// so each screen is deterministic with no fragile navigation.
final class ScreenshotTests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testCaptureScreenshots() throws {
        let app = XCUIApplication()
        setupSnapshot(app)
        app.launchArguments += ["-uitestSeed"]
        app.launch()

        // Give the seed + first render a moment to settle.
        let home = app.tabBars.buttons["Home"]
        XCTAssertTrue(home.waitForExistence(timeout: 30), "Home tab did not appear")
        sleep(2)
        snapshot("01-Home")

        tapTab(app, "Pet")
        snapshot("02-Pet")

        tapTab(app, "Budget")
        snapshot("03-Budget")

        tapTab(app, "Rewards")
        snapshot("04-Rewards")
    }

    private func tapTab(_ app: XCUIApplication, _ label: String) {
        let tab = app.tabBars.buttons[label]
        if tab.waitForExistence(timeout: 10) {
            tab.tap()
            sleep(1)
        }
    }
}
