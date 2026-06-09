# Shipping WETYR Film Intel to TestFlight and the App Store

This must be done on a **Mac with Xcode** (iOS cannot be built or uploaded from
Windows). Everything below is already scaffolded; you mostly run commands.

## 0. Prerequisites (one time)

- Apple Developer Program membership ($99/year) on the WETYR Apple ID.
- A Mac with Xcode 15+ installed and opened once.
- Homebrew tools:
  ```bash
  brew install xcodegen fastlane
  ```
- An **App Store Connect API key**:
  App Store Connect -> Users and Access -> Integrations -> App Store Connect API
  -> generate a key with "App Manager" access. Download the `AuthKey_XXXX.p8`
  (you can only download it once). Note the Key ID and Issuer ID.

## 1. Fill in your IDs

- Edit `fastlane/Appfile`: set `team_id` (10-char Developer Team ID) and
  `itc_team_id` (App Store Connect team id).
- Export the API key env vars in your shell (or a local, git-ignored `.env`):
  ```bash
  export ASC_KEY_ID=XXXXXXXXXX
  export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  export ASC_KEY_PATH=/absolute/path/AuthKey_XXXXXXXXXX.p8
  export TEAM_ID=YOURTEAMID         # optional but recommended
  ```

## 2. Generate the Xcode project and set signing

```bash
cd WETYRFilms
xcodegen generate
open WETYRFilms.xcodeproj
```
In Xcode: select the WETYRFilms target -> Signing & Capabilities -> check
"Automatically manage signing" and pick your Team. Close Xcode.

## 3. Create the app record on App Store Connect (one time)

```bash
fastlane setup_app
```
This reserves the bundle id `com.wetyr.films` and creates the app listing shell.

## 4. Set up the review sign-in (one time, important)

The Rolodex tab needs a login, so App Review needs a demo account. Do NOT give
Apple your real admin password. On Netlify, add a throwaway reviewer to the
`ADMIN_USERS` env var, for example:
```json
[{"user":"mark","pass":"<real>"},{"user":"appreview","pass":"<throwaway>"}]
```
Then put that throwaway password in
`fastlane/metadata/review_information/demo_password.txt`
(the username `appreview` is already set in `demo_user.txt`).

## 5. Push the first build to TestFlight

```bash
fastlane beta
```
This regenerates the project, builds and signs an `.ipa`, and uploads it to
TestFlight. After ~5-15 minutes of Apple processing the build appears under
TestFlight in App Store Connect. Add yourself as an internal tester to install it
via the TestFlight app on your iPhone.

## 6. Screenshots and listing

- Capture the 6 screenshots per `store/SCREENSHOTS.md` and drop them in
  `fastlane/screenshots/en-US/`.
- Push listing text + screenshots without a new build:
  ```bash
  fastlane meta
  ```

## 7. Submit for App Review

When the build is on TestFlight and the listing is complete:
```bash
fastlane release
```
This uploads a build (if needed), attaches the metadata, and submits for review.

## Before you submit, confirm these exist

- A reachable privacy policy at the URL in
  `fastlane/metadata/en-US/privacy_url.txt`
  (currently `https://markcmo.com/wetyr-films-privacy`). Create that page or
  change the URL. Apple WILL reject without a working privacy policy.
- The support URL resolves (`https://markcmo.com/contact`).
- Final 1024 app icon (replace the placeholder in the asset catalog).
- App Privacy answers in App Store Connect: the app sends search text and contact
  data to your own backend; declare accordingly (no third-party tracking, no IDFA).

## Heads-up on App Review fit (read this)

The four public tabs are a clean consumer/pro utility and review normally. The
**Rolodex** is an internal, login-gated contact database of your own business
contacts. Two things to be ready for:

1. Apple guideline 4.2 (minimum functionality) and 5.2 (intellectual property /
   data): be ready to explain in Review Notes that the contacts are the
   developer's own first-party business data, access-controlled, not scraped PII
   resold to users. The notes file already says this.
2. If Apple pushes back that it is "for internal/company use," the cleaner
   distribution channel for an internal tool is **Apple Business Manager ->
   Custom Apps** (unlisted, private to your org) rather than the public store. You
   can switch to that without code changes. Decide which you want before submit.

Bundle id, scheme, and all metadata are wired for the public-store path by
default; the same binary works for the Custom App path too.
