import XCTest

// Captures App Store screenshots on the CI simulator with fastlane snapshot. The app is
// launched with -uitestSeed, which seeds four pets in different states (Rex the dog hero,
// Clover the rabbit, Luna the cat, Bubbles the fish that needs attention) and skips
// onboarding, so each screen is deterministic. Element lookups are device-agnostic: iPad
// lays out TabView differently than iPhone, so we gate on the Home header text and address
// tabs / pet pills as plain buttons with firstMatch.
@MainActor
final class ScreenshotTests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = true
    }

    func testCaptureScreenshots() throws {
        let app = XCUIApplication()
        setupSnapshot(app)
        app.launchArguments += ["-uitestSeed"]
        app.launch()

        let today = app.staticTexts["Today"]
        XCTAssertTrue(today.waitForExistence(timeout: 40), "Home did not render")
        sleep(2)

        // Core flow on the hero pet (Rex the dog).
        snapshot("01-Home")
        tapTab(app, "Pet");     snapshot("02-Pet")
        tapTab(app, "Budget");  snapshot("03-Budget")
        tapTab(app, "Rewards"); snapshot("04-Rewards")

        // Variety: show other animals, habitats, and care states via the pet picker.
        tapTab(app, "Home")
        selectPet(app, "Bubbles"); snapshot("05-Home-Fish")   // aquarium, needs attention
        tapTab(app, "Pet");        snapshot("06-Pet-Fish")    // fish care details
        tapTab(app, "Home")
        selectPet(app, "Clover");  snapshot("07-Home-Rabbit")
        selectPet(app, "Luna");    snapshot("08-Home-Cat")
        selectPet(app, "Pepper");  snapshot("09-Home-GuineaPig")   // caged: soiled bedding to clean

        // Parent Mode: the grown-up oversight surface (care alerts about the child).
        openParentMode(app)
        snapshot("10-ParentMode")
    }

    /// Enter Parent Mode through the PIN gate (seed PIN is 1234).
    private func openParentMode(_ app: XCUIApplication) {
        tapTab(app, "Home")
        let lock = app.buttons["Grown-ups"].firstMatch
        guard lock.waitForExistence(timeout: 8) else { return }
        lock.tap()
        sleep(1)
        for digit in ["1", "2", "3", "4"] {
            let key = app.buttons[digit].firstMatch
            if key.waitForExistence(timeout: 4) { key.tap() }
        }
        // Wait for the Parent Mode hub to present.
        _ = app.staticTexts["Parent Mode"].waitForExistence(timeout: 8)
        sleep(1)
    }

    /// Internal: capture the all-animals art gallery for review.
    func testGallery() throws {
        let app = XCUIApplication()
        setupSnapshot(app)
        app.launchArguments += ["-uitestGallery"]
        app.launch()
        sleep(4)
        snapshot("00-Gallery-Top")
        app.swipeUp(); sleep(1)
        app.swipeUp(); sleep(1)
        snapshot("00-Gallery-Bottom")
    }

    private func tapTab(_ app: XCUIApplication, _ label: String) {
        let tab = app.buttons[label].firstMatch
        if tab.waitForExistence(timeout: 10) {
            tab.tap()
            sleep(2)
        }
    }

    /// Tap a pet pill in the selector (labelled with the pet's nickname).
    private func selectPet(_ app: XCUIApplication, _ nickname: String) {
        let pill = app.buttons[nickname].firstMatch
        if pill.waitForExistence(timeout: 8) {
            pill.tap()
            sleep(2)
        }
    }
}
