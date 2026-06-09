# App Store screenshots, WETYR Film Intel

App Store Connect requires screenshots for the **6.9" iPhone** size
(1290 x 2796, iPhone 16 Pro Max class). A 6.5" set is also recommended. The iPad
13" set is optional but nice since the app is universal.

## Fastest path (capture on the simulator)

On the Mac, after `xcodegen generate` and a successful build:

1. Run the app on an **iPhone 16 Pro Max** simulator.
2. For each screen below, press **Cmd+S** in the simulator (saves a PNG to the
   Desktop at the exact required resolution).
3. Drop the 6 PNGs into `fastlane/screenshots/en-US/` named `01_...png` ... `06_...png`.
4. Optional polish: `fastlane frames` adds device frames + captions.
5. `fastlane meta` uploads them with the listing text.

## The 6 shots to capture (in order)

| # | Screen | Caption idea |
|---|--------|--------------|
| 1 | Titles tab, a title detail card open | "Full intel on any title" |
| 2 | Box Office tab, in-theaters + trending | "What is winning this weekend" |
| 3 | Briefing tab, news feed visible | "Your morning trade briefing" |
| 4 | Briefing tab, festival deadlines visible | "Never miss a festival deadline" |
| 5 | Casting tab, scripted roles | "Open roles, scripted and commercial" |
| 6 | Rolodex tab, list of contacts | "Your industry rolodex, in your pocket" |

## Captions file (used by `fastlane frames`)

If you run the `frames` lane, put a `Framefile.json` or per-image `.strings`
captions next to the screenshots. See docs.fastlane.tools/actions/frameit.

## Required sizes reference

- 6.9" iPhone: 1290 x 2796 (portrait) - REQUIRED
- 6.5" iPhone: 1242 x 2688 - recommended
- 13" iPad: 2064 x 2752 - optional (universal app)

App icon (1024 x 1024) is already in the asset catalog; replace the placeholder
gold mark with final branding before submission.
