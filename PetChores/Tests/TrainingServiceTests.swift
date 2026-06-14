import XCTest
@testable import PetChores

/// Verifies the trick-training engine: per-species curricula, session progress, and the
/// trust-earning moment a trick is finished.
final class TrainingServiceTests: XCTestCase {

    typealias T = TrainingService

    func testDogCurriculumStartsWithSit() {
        let tricks = T.tricks(speciesId: "dog", category: "mammal")
        XCTAssertFalse(tricks.isEmpty)
        XCTAssertEqual(tricks.first?.id, "sit")
    }

    func testCatAndDogGetDifferentCurricula() {
        let dog = T.tricks(speciesId: "dog", category: "mammal").map(\.id)
        let cat = T.tricks(speciesId: "cat", category: "mammal").map(\.id)
        XCTAssertNotEqual(dog, cat)
        XCTAssertTrue(cat.contains("highfive"))
        XCTAssertFalse(dog.contains("highfive"))
    }

    func testEveryHabitatHasTricks() {
        for (id, cat) in [("dog", "mammal"), ("cat", "mammal"), ("rabbit", "small_mammal"),
                          ("parakeet", "bird"), ("chicken", "poultry"), ("fish", "aquatic"),
                          ("gecko", "reptile"), ("tarantula", "invertebrate")] {
            XCTAssertFalse(T.tricks(speciesId: id, category: cat).isEmpty, "\(id) should have tricks")
        }
    }

    func testNextTrickSkipsLearned() {
        let next = T.nextTrick(speciesId: "dog", category: "mammal", learned: ["sit"])
        XCTAssertEqual(next?.id, "stay")
    }

    func testNextTrickNilWhenAllLearned() {
        let all = T.tricks(speciesId: "fish", category: "aquatic").map(\.id)
        XCTAssertNil(T.nextTrick(speciesId: "fish", category: "aquatic", learned: all))
    }

    func testPracticeAdvancesProgressWithoutFinishingEarly() {
        let r = T.practice(progress: 0, learned: [], speciesId: "dog", category: "mammal")
        XCTAssertEqual(r.progress, T.progressPerSession, accuracy: 0.0001)
        XCTAssertNil(r.finished)
        XCTAssertEqual(r.learned, [])
    }

    func testThreeSessionsLearnATrick() {
        var progress = 0.0
        var learned: [String] = []
        var finished: Trick?
        for _ in 0..<3 {
            let r = T.practice(progress: progress, learned: learned, speciesId: "dog", category: "mammal")
            progress = r.progress; learned = r.learned
            if let f = r.finished { finished = f }
        }
        XCTAssertEqual(finished?.id, "sit")
        XCTAssertEqual(learned, ["sit"])
    }

    func testProgressCarriesOverToNextTrick() {
        // Start near the end of the first trick so finishing spills into the next.
        let r = T.practice(progress: 0.8, learned: [], speciesId: "dog", category: "mammal")
        XCTAssertEqual(r.finished?.id, "sit")
        XCTAssertEqual(r.learned, ["sit"])
        XCTAssertGreaterThan(r.progress, 0, "overshoot should seed the next trick")
        XCTAssertLessThan(r.progress, 1.0)
    }

    func testPracticeOnFullyTrainedPetIsANoOp() {
        let all = T.tricks(speciesId: "cat", category: "mammal").map(\.id)
        let r = T.practice(progress: 1.0, learned: all, speciesId: "cat", category: "mammal")
        XCTAssertNil(r.finished)
        XCTAssertEqual(r.learned, all)
        XCTAssertEqual(r.progress, 1.0)
    }
}
