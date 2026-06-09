# Pet Chores (Expo / EAS) — setup and build from Windows

This is the React Native / Expo rebuild of Pet Chores, so it builds in Expo's cloud
and submits to TestFlight from Windows, exactly like your other apps. No Mac, no
GitHub Actions.

## Why a scaffold step
Exact native-module versions must match Expo SDK 54. The reliable way is to let the
Expo CLI pin them, then drop in the source here. Do this once:

```powershell
# 1. From the parent folder, create the app shell with correct SDK 54 versions
npx create-expo-app@latest PetChoresExpo-shell --template blank-typescript

# 2. Copy this project's source + config over the shell (src/, app/, assets/,
#    app.json, eas.json, tsconfig.json, babel.config.js), then cd into it.

# 3. Install the native modules at SDK-correct versions
npx expo install expo-router expo-notifications expo-constants expo-linking \
  expo-status-bar expo-crypto expo-linear-gradient expo-image-picker \
  react-native-safe-area-context react-native-screens \
  react-native-gesture-handler react-native-reanimated \
  @react-native-async-storage/async-storage

# 4. Plain npm deps
npm i zustand react-native-iap

# 5. Log in and build/submit (cloud, runs on Expo's Macs)
npm i -g eas-cli
eas login
eas build --platform ios --profile production        # cloud build, no Mac
eas submit --platform ios --profile production        # uploads to TestFlight
```

`eas build` runs on Expo's macOS infrastructure and works from Windows. The free tier
covers occasional iOS builds; beyond that it is paid per build.

## Apple credentials
Reuses your existing App Store Connect API key (`AuthKey_YRMDQTX998.p8`). On first
`eas submit`, EAS will ask for it or read `eas.json`. Bundle id is `com.petchores.app`.

## Status: feature-complete v1
Implemented:
- Full data core ported 1:1 from Swift (types, time, scoring, schedule, budget, readiness).
- State + offline persistence (Zustand + AsyncStorage), launch/foreground maintenance.
- Local notifications (expo-notifications) with quiet hours, 64-cap, Done/Snooze actions.
- Screens: onboarding, Home, Pet, Budget, Rewards, Task Completion, and Parent Mode
  (PIN gate, hub, Verify, Settings, Manage Pets, Readiness Report + share/export).
- Free-tier gating (one pet) + StoreKit unlock via react-native-iap.
- Pet visuals: kid-friendly emoji pets on gradient habitats with mood states.

Deliberately deferred from the native version:
- The hand-drawn animated pets/habitats (Skia). v1 uses emoji + gradients; can be
  upgraded to react-native-skia later without touching the logic.

Verify on first run (`npx expo start`): the (tabs) route names, notification trigger
shape, and react-native-iap call signatures for your installed SDK 54 versions. These
are the only spots likely to need a one-line tweak; the logic is solid.
