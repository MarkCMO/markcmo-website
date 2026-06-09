# Pet Chores: App Store deployment checklist

The Swift source, tests, seed data, privacy manifest, **app icon**, listing metadata,
and release automation are already in this repo. There are two ways to ship.

## Option A (recommended): no personal Mac, via GitHub Actions

A macOS CI runner does the build/sign/upload for you ([.github/workflows/petchores-ios.yml](../.github/workflows/petchores-ios.yml)).

1. Apple Developer Program: enroll, sign agreements (incl. Paid Apps, so IAP works).
2. Create an App Store Connect API key (Users and Access -> Integrations) with
   "App Manager" access. Add these GitHub repo secrets:
   `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_BASE64` (the `.p8` base64-encoded),
   `APPLE_TEAM_ID`.
3. Actions tab -> "Pet Chores iOS Release" -> Run workflow, in this order:
   - `setup_app`   creates the app record on App Store Connect.
   - `create_iap`  best-effort creates the `petchores.unlock.full` IAP (if it errors,
     make it manually: Non-Consumable, Family Sharing ON, price ~4.99, add a review
     screenshot).
   - `beta`        builds, signs, uploads to TestFlight (no screenshots needed).
   - capture screenshots (see store/SCREENSHOTS.md) and commit them to
     `PetChores/fastlane/screenshots/en-US/`.
   - `release`     builds, uploads, sets metadata, submits for review.
4. Apple review (~1-3 days) -> live.

First run of `beta`/`release` may need one signing tweak; automatic provisioning
creates the distribution cert on first use. Everything else is wired.

## Option B: from a Mac (manual)

Everything below happens on a **Mac with Xcode**. Work top to bottom.

## 0. Prerequisites
- [ ] A Mac with the latest Xcode installed.
- [ ] Apple Developer Program membership (enrolled, agreements signed in App Store
      Connect, including the Paid Apps / free-apps agreement so IAP works).
- [ ] Install XcodeGen: `brew install xcodegen`.

## 1. Generate and open the project
```bash
cd PetChores
xcodegen generate
open PetChores.xcodeproj
```

## 2. Signing and bundle identity
- [ ] In Xcode, select the `PetChores` target → Signing & Capabilities.
- [ ] Set your Team. Leave "Automatically manage signing" on.
- [ ] Confirm Bundle Identifier: `com.petchores.app` (change if you own a different
      identifier; keep it consistent everywhere below).
- [ ] Add the **In-App Purchase** capability (no entitlement file needed).
- [ ] Confirm deployment target is iOS 17.0 (set by project.yml; see README for the
      SwiftData/iOS17 note).

## 3. App icon (included)
- [x] A 1024x1024 icon (`Icon-1024.png`, no alpha) is already in
      `PetChores/Resources/Assets.xcassets/AppIcon.appiconset` and wired in Contents.json.
      Replace it with bespoke artwork later if you want; nothing else is required.

## 4. Build, run, and self-test
- [ ] Run on a simulator and a real device. Walk the acceptance criteria in
      manual Section 17.
- [ ] Cmd+U to run the unit tests (`PetChoresTests`).
- [ ] Verify notifications fire (real device is best), quiet hours hold, the parent PIN
      gate works, and the Readiness Report renders and exports.

## 5. StoreKit / in-app purchase
- [ ] Local test first: edit the Run scheme → Options → StoreKit Configuration →
      `PetChores.storekit`. Confirm purchase, restore, and the locked-feature gates.
- [ ] In App Store Connect → your app → Monetization → In-App Purchases, create a
      **Non-Consumable**:
        - Product ID: `petchores.unlock.full` (must match exactly)
        - Reference name: e.g. "Full Unlock"
        - Price: tier ~ $4.99
        - Enable **Family Sharing**
        - Add a localized display name + description, and a review screenshot.
- [ ] Submit the IAP for review together with the app build (first time, they review
      both).

## 6. App Store Connect: create the app record
- [ ] App Store Connect → Apps → New App. Platform iOS, your bundle id, primary
      language English, SKU (any unique string).
- [ ] App Privacy section: choose **Data Not Collected** (this app collects nothing).
      This must match the bundled `PrivacyInfo.xcprivacy`.
- [ ] Age rating questionnaire: built for kids, no objectionable content → expect 4+.
- [ ] Category: Education (or Lifestyle). Decide on the **Kids Category**:
        - Pros: discoverability with the target audience.
        - Rules if you opt in: no third-party analytics/ads (already true), the single
          IAP and all purchase UI must sit behind the parental gate (already true),
          and you must follow Apple's Kids Category guidelines. The build already
          complies; just confirm during submission.

## 7. Store listing assets
- [ ] App name (e.g. "Pet Chores: Pet Care Practice") and subtitle.
- [ ] Description: lead with the real differentiator from manual Section 1 (real
      species-specific care protocols, real cost of ownership, a pre-purchase
      readiness verdict). Do NOT claim "most advanced"; that framing is called out as
      a losing position.
- [ ] Keywords, support URL, marketing URL (optional), privacy policy URL (required
      for kids apps even though no data is collected; a simple page stating "no data
      collected, all on device" is fine).
- [ ] Screenshots: required sizes are 6.7" iPhone and (since the app is universal)
      13" iPad. Capture Home with an animated pet, Task Completion, Budget, Readiness
      Report, and the Pick-a-Pet grid.
- [ ] App preview video is optional.

## 8. Export compliance
- [ ] `Info.plist` already sets `ITSAppUsesNonExemptEncryption = false` (no custom
      crypto beyond Apple's), so the encryption question auto-answers. Confirm at
      submission.

## 9. Archive and upload
- [ ] In Xcode, set the run destination to "Any iOS Device (arm64)".
- [ ] Product → Archive.
- [ ] In the Organizer, Distribute App → App Store Connect → Upload.
- [ ] Wait for processing, then the build appears under TestFlight.

## 10. TestFlight (recommended before public release)
- [ ] Internal testing: add yourself, install via TestFlight, run the full loop on a
      real device for a day or two (notifications, day rollover, missed-task settle).
- [ ] Optional external testing with a small group (requires a brief Beta App Review).

## 11. Submit for review
- [ ] Attach the processed build to the app version.
- [ ] Fill "App Review Information": demo notes telling the reviewer the parent PIN
      flow (they set the PIN during onboarding), how to reach Parent Mode (Grown-ups
      button on Home), and where the IAP/Restore live (inside Parent Mode → Unlock).
- [ ] Submit. First reviews typically take a day or two.

## Common rejection causes to pre-empt
- Missing/!1024 app icon → handled in step 3.
- Privacy manifest mismatch → `PrivacyInfo.xcprivacy` declares no data + UserDefaults
  reason CA92.1; keep App Privacy set to "Data Not Collected".
- IAP not reachable or no Restore button → both live in PIN-gated Parent Mode (built).
- Kids Category violations → no ads/analytics/3rd-party SDKs, purchase behind the gate
  (all already true).
- Crash on launch → run on device first; the seed loader fails gracefully by design.

## Notes specific to this project
- Deployment target is iOS 17 because the persistence layer uses SwiftData (manual
  allows SwiftData; see README for the iOS 16 / Core Data alternative).
- Bundle id, StoreKit product id, and the App Store Connect IAP product id must all
  agree: `com.petchores.app` and `petchores.unlock.full`.
- No backend, no accounts, no network calls. Everything is on-device and offline.
