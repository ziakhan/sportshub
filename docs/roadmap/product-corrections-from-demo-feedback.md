---
updated: 2026-08-16
tags: [type/backlog, status/open, area/leagues, area/demos]
---

# Product corrections found while rebuilding the season demo

Owner feedback session, 2026-08-16. Every line below is a place where the DEMO
had to differ from the shipping product, or a gap the session exposed. Nothing
here was fixed in the demo job: this is the product's list.

## Copy the owner rejected, that the product still says

- Home gym card says "You own this one. Its games cost you nothing, so it gets used before anything you rent." Owner's line: "Your home gym. It fills first." (`plan/gyms-weekends-step.tsx`)
- The "Courts left empty" panel and its paragraph ("Games run long and teams turn up late...") is product prose the owner cut from the demo. Decide whether it stays on the step at all, or moves behind Advanced. (`plan/gyms-weekends-step.tsx`, `Season.courtBuffer`)
- The generate preview says "No trade-offs — every rule held". House rule is zero em-dashes user facing. (`manage/components/schedule-tab.tsx`)

## Missing settings

- **No free-entry-until-deadline mode.** Every team entry is approved one by one (`TeamSubmissionStatus` PENDING to APPROVED). There is no setting for "clubs are in until the deadline, the league only intervenes". `Season.registrationDeadline` exists but auto-approves nothing. The owner wants the free-entry mode to be the operating mode.
- **The weekend grid has no session versus finals distinction.** Step 2 only knows on and off; the finals weekends are Season sessions typed PLAYOFF elsewhere, so the grid cannot show a league its own rhythm. (`plan/gyms-weekends-step.tsx`)

## Missing identity

- **The season console header carries no league or organization logo.** `Organization.logoUrl` is seeded and the league page uses it, but `manage?tab=*` shows a bare title. Every console screen in the demo carries the crest because a pitch needs it.

## Naming

- The ⋯ menu on a board gym section has no "add a court" item. Courts are changed with a stepper whose button then reads "We rented 3 courts". It works, but a league looking for "add a court" will not find those words. (`plan/plan-ui.tsx` `GymMenu`)

## From the homepage screenshot round (owner feedback, 2026-08-17)

- **Public league page reads plain white.** The owner, looking at a real capture of it on the
  launch page: "again plain white. If that is a real screen then we need some work on that."
  The standings and score cards sit on an untinted ground with no court system anywhere below
  the hero band. (`app/(public)/league/[id]/page.tsx`)
- **News article header wastes the top of the phone.** Too much white space above the fold: the
  back control, the GAME RECAP pill and the date could be flattened into one lower row so the
  title and score art land higher. (`app/(public)/news/[slug]/page.tsx`)
- **Score art ruling renewed:** the big two-colour team panel on recaps stays for now ("keep it
  till we make a better decision"), so no work on it yet, but it is not considered settled.
- **Player of the Game chip uses a basketball emoji as its icon.** House rule is SVG icons,
  never emoji. (recap article body)
- **Recap footer line** "Recap generated automatically from the official scoring record" is the
  kind of machine confession the copy law now removes; reword to name the source, not the
  automation ("From the official scoring record").
- **Seeded chat copy carries an em-dash on camera**: "Carpool from the west end — two seats,
  message me." in the Lords Grade 9 team chat (seed-nph-demo). Sweep seed strings next reseed.
- **Seeded event time litter**: "NPH Summer Media Day" sits at 2:54 to 6:54 AM on the family
  calendar. Reseed with a sane time.
- **Census city normalization**: the tenant `city` column carries litter that the
  directory chips had to guard against: "Ontario" as a city, "Toronto ON",
  "Markham ON". Normalize at import (strip trailing province codes, reject
  province names as cities) and backfill the existing rows. (`scripts/import-clubs.ts`)
- **POTG share-card art uses a basketball emoji** in the "Player of the Game" chip
  (visible in feed score cards). Same rule as the recap chip fix: hand-drawn SVG
  ball, no emoji-as-icon. (social share card generator)
