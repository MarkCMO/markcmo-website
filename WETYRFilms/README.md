# WETYR Films, iOS app

Native SwiftUI companion to the WETYR Film Intel dashboard at
`markcmo.com/wetyr-films`. It reads the same live data from the existing Netlify
Functions, so there is no new backend to deploy.

## What it does

Five tabs, full parity with the web dashboard:

| Tab | Source function | Auth |
|---|---|---|
| Titles | `film-intel` (TMDB proxy) | none |
| Box Office | `film-intel` | none |
| Briefing (news + festivals) | `news-feed` + bundled `festivals.json` | none |
| Casting | `casting-calls` | none |
| Rolodex | `film-rolodex` (+ `-cron`, `-deep-cron`) | admin cookie |

The Rolodex signs in against `admin-auth` (same credentials as the markcmo.com
admin console). The HttpOnly `mcadmin_session` cookie is stored by URLSession and
replayed automatically on every request, so the session persists for 7 days.

## Build (must be a Mac, like PetChores)

iOS cannot be compiled on Windows. Move this `WETYRFilms/` folder to a Mac with
Xcode 15+ and:

```bash
brew install xcodegen          # once
cd WETYRFilms
xcodegen generate              # produces WETYRFilms.xcodeproj
open WETYRFilms.xcodeproj
```

Then in Xcode: set your Team under Signing & Capabilities and run on a simulator
or device. Deployment target is iOS 17.

If you prefer not to use XcodeGen, create a new iOS App project named
`WETYRFilms`, drag the `WETYRFilms/` sources in, point INFOPLIST_FILE at
`Resources/Info.plist`, and set the bundle id to `com.wetyr.films`.

## Configuration

The app targets `https://markcmo.com` by default. To point it at a local Netlify
dev server, set the `api_base` key in UserDefaults (for example
`http://localhost:8888`) before launch.

## Notes

- All title/box-office data is read-only (TMDB via the server proxy).
- The Rolodex supports search, type/tag/dept filters, paging, add/edit/delete,
  per-contact enrichment (Find email, Find newest email, Find company emails),
  and the bulk tools (Sync now, Deep crawl, Freshen stale).
- No emails are ever sent from the app; the bulk tools only trigger the existing
  server cron endpoints, which already gate their own email sending.
- The app icon at `Resources/Assets.xcassets/AppIcon.appiconset/Icon-1024.png` is
  a placeholder gold mark. Swap in final branding before App Store submission.
