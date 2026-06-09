# Pet Chores (iOS)

A real-life pet care training game for kids, built to the v1.0 handoff specification.
Kids practice the real-world chores of owning an animal on a real schedule, a parent
verifies each one, and after the training window the app produces a Readiness Report.

This folder contains the complete Swift source. It was authored on Windows, so it has
not been compiled. You build, run, and test it on a Mac with Xcode (see below).

## One deliberate deviation from the spec (flagged)

The spec lists iOS 16 minimum and says "SwiftData (preferred for iOS 17+) OR Core Data
if supporting iOS 16. Choose one and stay consistent." This build uses **SwiftData**,
which requires **iOS 17.0**. The deployment target is therefore 17.0, not 16.0.

If you truly need iOS 16, only the persistence layer changes: the `@Model` classes
(`Models/`) and the `DataStore` / `@Query` usage would move to Core Data. All the rules
engines (`ScheduleGenerator`, `ScoringService`, `NotificationService`, `BudgetService`,
`ReadinessService`, `StoreService`) are persistence-agnostic and stay as is.

## Building on a Mac

### Option A: XcodeGen (recommended, reproducible)

```bash
brew install xcodegen
cd PetChores
xcodegen generate          # reads project.yml, writes PetChores.xcodeproj
open PetChores.xcodeproj
```

Then in Xcode:
1. Select the `PetChores` target, Signing & Capabilities, pick your Team.
2. Add the In-App Purchase capability (no entitlement file is needed for a single
   StoreKit purchase).
3. To test the purchase in the simulator, edit the scheme, Run, Options, and set the
   StoreKit Configuration to `PetChores.storekit`.
4. Pick a simulator and Run.

### Option B: Manual Xcode project

1. Xcode, File, New, Project, iOS App. Product Name `PetChores`, Interface SwiftUI,
   Language Swift, Storage None (we add SwiftData in code). Set deployment target 17.0.
2. Delete the auto-generated `ContentView.swift` and the default `App` file.
3. Drag the contents of the `PetChores/PetChores/` folder into the project (Create
   groups, add to the PetChores target). This includes `App/`, `Models/`,
   `ViewModels/`, `Views/`, `Services/`, `Support/`, and `Resources/`.
4. In the target's Build Settings set `INFOPLIST_FILE` to `Resources/Info.plist`, or
   merge the keys from `Resources/Info.plist` into the generated one (the camera and
   photo-add usage strings are required for photo proof).
5. Make sure `Resources/pet_database.json` and `Resources/Assets.xcassets` are members
   of the target (Copy Bundle Resources).
6. Add the In-App Purchase capability and your signing Team.
7. For local purchase testing, set the scheme's StoreKit configuration to
   `PetChores.storekit`.

## Tests

A unit-test suite lives in [Tests/](Tests) and is wired as the `PetChoresTests` target
in `project.yml`. It covers the pure rules engines, which is where the spec's math lives:

- `TimeUtilitiesTests` quiet-hours wrapping, slot spreading
- `ScoringServiceTests` grace windows, points, wellbeing, streak, trust, idempotent settle
- `ScheduleGeneratorTests` daily/weekly/monthly/yearly recurrence and window counts
- `BudgetServiceTests` startup, monthly, first-year projection
- `ReadinessServiceTests` completion/on-time rates and verdict bands
- `UnitsAndGatesTests` PIN hashing, free-tier gates, mood mapping, trust-to-level
- `SeedContentTests` decodes `pet_database.json` and checks ids, ranges, and time formats

Run them in Xcode with Cmd+U, or from the command line:

```bash
cd PetChores
xcodegen generate
xcodebuild test -scheme PetChores -destination 'platform=iOS Simulator,name=iPhone 15'
```

## App Store Connect setup (Phase 9)

- App Privacy: "Data Not Collected". No analytics, ads, or third-party SDKs.
- Consider the Kids Category (ages 6 to 8 or 9 to 11). If you use it, you must not add
  any third-party analytics or advertising.
- Create one non-consumable In-App Purchase with product id `petchores.unlock.full`,
  enable Family Sharing, suggested price tier around 4.99 USD.
- App icon: drop a 1024x1024 PNG into `Resources/Assets.xcassets/AppIcon.appiconset`.

## Architecture (MVVM, Apple frameworks only)

```
App/            App entry, AppDelegate (notification delegate), RootView routing
Models/         SeedModels (Codable value types) + SwiftData @Model classes + Enums
ViewModels/     OnboardingViewModel (others kept lightweight; views use @Query)
Services/       The rules engines and integrations:
                  SeedLoader            first-launch seeding (Section 4)
                  ScheduleGenerator     whole-window schedule build + top-up (Section 6)
                  NotificationService   local notifications, quiet hours, 64-cap (Sec 7)
                  ScoringService        grace windows, points, wellbeing, streak (8, 9)
                  BudgetService         startup/monthly/yearly math (Section 10)
                  ReadinessService      report metrics + verdict + text export (Sec 12)
                  ReadinessExporter     PDF export
                  BadgeService          encouraging-only badges (Section 11)
                  StoreService          StoreKit 2 unlock + restore (Section 13B)
                  PINManager            salted PIN hashing (Section 13)
                  PhotoStore            on-device-only photo proof (Section 8, 13)
                  MaintenanceService    launch/foreground/midnight settle (Sec 6,9,15)
                  PetCreationService    wires instance + schedule + budget
                  DataStore             ModelContext fetch helpers
                  FreeTier              free vs paid gates (Section 13B)
Views/          Onboarding, Home, PetDetail, TaskCompletion, Budget, Rewards,
                ParentMode (gate, hub, verify, settings, manage pets, store),
                Readiness, plus shared Components and Support (Theme, Formatters)
                PetSceneKit/  living animated scenes (Section 14): per-habitat
                  backdrops (backyard, aquarium, terrarium, cage, birdcage, coop) and
                  hand-drawn, mood-reactive Canvas art for all 12 animals. One
                  TimelineView drives motion; Reduce Motion renders a static frame.
Resources/      pet_database.json (the seed), Info.plist, Assets.xcassets, entitlements
```

## How the core loop maps to the spec

- First launch decodes `pet_database.json` and inserts the species once
  (`SeedLoader`, Section 4). A malformed seed shows a friendly error, never a crash.
- Onboarding collects the child, a salted parent PIN, the chosen pet, and (behind the
  parental gate) the training length, then creates the first pet (Section 5).
- Creating a pet builds the whole-window schedule and seeds the budget
  (`PetCreationService`, Sections 6 and 10).
- Notifications fire at each task's due time, shifted out of quiet hours, capped at the
  nearest 64, with Done and Snooze actions (`NotificationService`, Section 7).
- Marking a task Done awards points and nudges wellbeing; the parent verifies later
  (`TaskActions`, `ScoringService`, Sections 8 and 9).
- The maintenance pass flips overdue tasks to missed and settles each elapsed day for
  wellbeing, streak, and trust, so "app killed for days" recomputes correctly
  (`MaintenanceService`, `ScoringService`, Sections 9 and 15).
- The Readiness Report and its export are available in Parent Mode (Section 12). Export
  is gated to the paid unlock.

## Free vs paid (Section 13B)

The free tier gives full access to one pet for one training window: full scheduling,
notifications, scoring, budget, and Readiness Report. The single non-consumable unlock
(`petchores.unlock.full`) adds all pets, multiple pets at once, photo proof, and report
export. All purchasing UI lives only inside the PIN-gated Parent Mode; a child can never
reach a buy button (`FreeTier`, `StoreView`).

## Privacy (Section 13)

No accounts, no network, no analytics, no ads, no third-party SDKs. Photos for photo
proof are written to the app's local Documents directory and never uploaded.

## What still needs a human on a Mac

- Compile and run; resolve any environment-specific signing.
- Add the 1024x1024 app icon. Per-pet mood art and environments are already built as
  live SwiftUI/Canvas scenes (see PetSceneKit below), animating across the five
  wellbeing states; swap in bespoke artwork later only if you want a different look.
- Run the acceptance pass in Section 17 on a device and the simulator.
- Configure the App Store Connect product and App Privacy as above.

## House style

No em-dashes or en-dashes anywhere in this codebase, per the repository convention.
