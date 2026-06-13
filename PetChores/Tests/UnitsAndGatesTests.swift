import XCTest
@testable import PetChores

/// Verifies PIN hashing, free-tier gates, and mood mapping (Sections 9, 13, 13B).
final class UnitsAndGatesTests: XCTestCase {

    // MARK: - PINManager

    func testPinHashIsDeterministicWithSalt() {
        let salt = "abc123"
        let a = PINManager.hash(pin: "1234", salt: salt)
        let b = PINManager.hash(pin: "1234", salt: salt)
        XCTAssertEqual(a, b)
    }

    func testPinHashChangesWithSalt() {
        let a = PINManager.hash(pin: "1234", salt: "saltA")
        let b = PINManager.hash(pin: "1234", salt: "saltB")
        XCTAssertNotEqual(a, b)
    }

    func testPinVerify() {
        let salt = PINManager.newSalt()
        let hash = PINManager.hash(pin: "4815", salt: salt)
        XCTAssertTrue(PINManager.verify(pin: "4815", salt: salt, expectedHash: hash))
        XCTAssertFalse(PINManager.verify(pin: "0000", salt: salt, expectedHash: hash))
    }

    func testPinFormatValidation() {
        XCTAssertTrue(PINManager.isValidFormat("0000"))
        XCTAssertFalse(PINManager.isValidFormat("123"))
        XCTAssertFalse(PINManager.isValidFormat("12345"))
        XCTAssertFalse(PINManager.isValidFormat("12a4"))
    }

    func testNewSaltIsRandom() {
        XCTAssertNotEqual(PINManager.newSalt(), PINManager.newSalt())
    }

    // MARK: - FreeTier

    func testFreeTierCreateGate() {
        // No subscription / lapsed trial: cannot create a pet (paywall).
        XCTAssertFalse(FreeTier.canCreatePet(maxPets: PetPlan.none.maxPets, activePetCount: 0))
        // One-pet plans (weekly / monthly): exactly one active pet.
        XCTAssertEqual(PetPlan.weekly.maxPets, PetPlan.monthly.maxPets)
        XCTAssertTrue(FreeTier.canCreatePet(maxPets: PetPlan.monthly.maxPets, activePetCount: 0))
        XCTAssertFalse(FreeTier.canCreatePet(maxPets: PetPlan.monthly.maxPets, activePetCount: 1))
        // Unlimited plan: never blocked.
        XCTAssertTrue(FreeTier.canCreatePet(maxPets: PetPlan.unlimited.maxPets, activePetCount: 50))
    }

    func testFreeTierFeatureGates() {
        XCTAssertFalse(FreeTier.photoProofAvailable(isUnlocked: false))
        XCTAssertTrue(FreeTier.photoProofAvailable(isUnlocked: true))
        XCTAssertFalse(FreeTier.exportAvailable(isUnlocked: false))
        XCTAssertTrue(FreeTier.multiPetAvailable(isUnlocked: true))
    }

    // MARK: - Mood mapping

    func testMoodBands() {
        XCTAssertEqual(Mood.from(wellbeing: 100), .happy)
        XCTAssertEqual(Mood.from(wellbeing: 80), .happy)
        XCTAssertEqual(Mood.from(wellbeing: 79), .content)
        XCTAssertEqual(Mood.from(wellbeing: 60), .content)
        XCTAssertEqual(Mood.from(wellbeing: 59), .needsAttention)
        XCTAssertEqual(Mood.from(wellbeing: 40), .needsAttention)
        XCTAssertEqual(Mood.from(wellbeing: 39), .sad)
        XCTAssertEqual(Mood.from(wellbeing: 20), .sad)
        XCTAssertEqual(Mood.from(wellbeing: 19), .pleaseHelp)
        XCTAssertEqual(Mood.from(wellbeing: 0), .pleaseHelp)
    }

    // MARK: - ParentSettings defaults

    func testParentSettingsDefaults() {
        let s = ParentSettings(pinHash: "h", pinSalt: "s")
        XCTAssertTrue(s.verificationRequired)
        XCTAssertFalse(s.photoProofRequired)
        XCTAssertFalse(s.carryOverMissedTasks)   // Section 3.8: default off
        XCTAssertEqual(s.defaultTrainingLengthDays, 21)
        XCTAssertEqual(s.quietHoursStart, "20:30")
        XCTAssertEqual(s.quietHoursEnd, "07:00")
    }

    // MARK: - PetInstance helpers

    func testTrustToLevel() {
        let inst = PetInstance(speciesId: "dog", nickname: "Rex", startDate: Date(),
                               trainingLengthDays: 21, lastSettledDay: Date())
        inst.trust = 0
        XCTAssertEqual(inst.level, 1)
        inst.trust = 40
        XCTAssertEqual(inst.level, 3)
    }
}
