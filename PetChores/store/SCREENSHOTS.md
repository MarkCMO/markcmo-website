# 10 App Store screenshots: kid-friendly, pet-packed, framed

The goal is the polished App Store style: the real app screen in a device frame, a bold
caption, on a cheerful paw-print background, as a 10-shot story. Captions, background,
and framing are already configured for `fastlane frameit`; you only capture the 10 raw
screens. The app's demo seed populates a varied, happy, multi-pet state so every shot is
full of animals.

## Required sizes
- iPhone 6.7"/6.9": 1290 x 2796 (iPhone 15/16 Pro Max simulator)
- iPad 13": 2048 x 2732 (iPad Pro 13-inch simulator)
Capture the 10 on the iPhone size first; repeat key shots for iPad.

## Turn on the demo seed
Xcode -> Product -> Scheme -> Edit Scheme -> Run -> Arguments -> add `-uitestSeed`.
This seeds four pets: Rex the dog (happy hero), Luna the cat, Clover the rabbit, and
Bubbles the fish (needs attention), plus earned badges and a chore waiting to verify.
Parent PIN is `1234`.

## The 10 shots (capture, name exactly, drop in fastlane/screenshots/en-US/)
The filename drives the caption (see fastlane/screenshots/en-US/title.strings).

| File | Screen / how to reach it | Caption |
|---|---|---|
| `01_home.png` | Home tab (Rex shows by default, happy, animated backyard) | Care for a real pet, for real |
| `02_pickpet.png` | Start a new pet flow (Parent Mode -> Manage Pets -> Start a new pet) or the onboarding "Pick your pet" grid | Pick the pet you dream of |
| `03_pet.png` | Pet tab (large animated pet + habitat; pick Bubbles or Rex) | Your pet reacts to your care |
| `04_task.png` | Home -> tap a task -> Task Completion screen (checklist + Done) | Do the chore, then tap Done |
| `05_multipet.png` | Home with the pet picker bar showing all four pets | Raise a whole menagerie |
| `06_budget.png` | Budget tab | See what a pet really costs |
| `07_rewards.png` | Rewards tab (points, streaks, earned badges) | Earn points, streaks and badges |
| `08_mood.png` | Home or Pet tab with Bubbles selected (needs-attention mood) | Your pet's mood follows your care |
| `09_verify.png` | Parent Mode (PIN 1234) -> Verify Tasks (two chores waiting) | Parents check every chore |
| `10_readiness.png` | Parent Mode -> Readiness Report | Know if they are ready, before you buy |

Tip: in the Simulator press Cmd+S to save each screenshot, then rename to the names above.

## Frame + caption them automatically
From `PetChores/`:
```
fastlane frames
```
This reads each raw `NN_name.png`, adds the iPhone/iPad device frame, the caption from
title.strings, the orange keyword from keyword.strings, and the paw background
(background.png), writing `NN_name_framed.png`. fastlane `deliver` (the `meta` and
`release` lanes, and the CI workflow) uploads the framed versions.

## Or do it all in CI
After committing the 10 raw PNGs to `fastlane/screenshots/en-US/`, run the GitHub
Actions workflow with lane `meta` to push just the framed screenshots + listing text,
or `release` to do everything and submit.

## Notes
- Keep the same 10 filenames for iPad; put iPad shots in the same en-US folder (frameit
  detects device by resolution).
- Want different captions or colors? Edit title.strings / keyword.strings /
  Framefile.json. Want a different background? Replace background.png (any size).
