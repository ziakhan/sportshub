---
updated: 2026-08-20
tags: [theme/gtm, type/reference, status/live]
---

# Pitch decks

Full-screen presentations sent as a link to a named prospect. Built in the app,
not in a slide tool, so the screenshots are the real product and the game-day
slide plays the real demo.

## The links

| URL | Send it to |
|---|---|
| `sportshubone.com/deck/leagues-92057948e3` | Anyone. Names nobody. |
| `sportshubone.com/deck/coalition-67acde08df` | The Coalition League |
| `sportshubone.com/deck/hoopcity-137861a86b` | HoopCity Basketball |
| `sportshubone.com/deck/nph-78f51df659` | **North Pole Hoops only.** Never anyone else. |

## Adding a league

One row in `apps/web/src/app/deck/_deck/registry.ts`:

```ts
coalition: { ...NEUTRAL, recipient: "The Coalition League" },
```

Live at `/deck/coalition-67acde08df` on the next deploy. To add their logo beside the name
on the title slide, drop a file in `public/deck/logos/` and add
`logo: "/deck/logos/coalition.png"`. Without a logo it shows the name alone,
which is the current state for all of them.

**Do not fork the deck to add a recipient.** Every slide lives in one file, so a
wording change lands on every league at once. A fork is how two versions of the
same pitch start telling different stories.

Every deck is the same nineteen slides from one file. Only three things vary:
which screenshot set, what the embedded demo calls its league, and the name on
the title slide. **NPH is named nowhere except `/deck/nph-78f51df659`**, verified by
scanning the rendered text of every slide.

All of them are `robots: noindex`. They are for sending, not for finding.

## Using one

Arrow keys or PageUp/PageDown to move, Home/End to jump to the ends, Escape for
the contents list, swipe on a touch screen, and invisible tap zones down the
left and right edges. Every slide fits its screen at 1440, 834 and 390px, so
nothing scrolls.

Slide 9 plays the real game-day demo, all five chapters, about three minutes,
and loops. There is no closing card: the public one links to `/#notify` and
`/demos`, which would walk a prospect out of the presentation mid-pitch.

## Where it lives

- `apps/web/src/app/deck/_deck/league-deck.tsx` — every slide, both variants.
  They differ only by a `brand` prop: which screenshot folder, which league name
  for the demo, and an optional line addressing the recipient.
- `apps/web/src/app/deck/{leagues,nph}/page.tsx` — the two routes.
- `apps/web/src/app/deck/layout.tsx` — no site chrome, the way `/launch` works.
- `apps/web/public/deck/*.webp` — NPH screenshots.
- `apps/web/public/deck/neutral/*.webp` — generic screenshots.
- `/deck` is on the public path allowlist in `lib/public-paths.ts`.

## Adding another audience

A club deck at `/deck/clubs` is the obvious next one and the route prefix is
already public. Reuse `league-deck.tsx`'s primitives and its type scale rather
than starting fresh.

## Re-capturing the screenshots

```bash
npm run deck:shots              # both sets, ~3 min
npm run deck:shots -- --nph     # just the NPH set
```

That is the whole job: it signs in, walks every screen, takes the wide content
band plus a scrolled detail frame where the slide needs one, renames the world
for the neutral set and puts it back, then writes WebP into
`apps/web/public/deck` and `apps/web/public/deck/neutral`.

To add or change a screen, edit the `SHOTS` list at the top of
`scripts/marketing/deck-shots.mjs`. One row per picture. If the number of
frames changes, update `SHOTS` in `league-deck.tsx` so `frames` matches.

The dev server must be running and the demo world seeded.

### Why it looks the way it does

Captures clip to `<main>`, so the sidebar and top bar never appear: they carry
no argument and shrinking them into a slide is what made text render at 7.6px.
The band is cropped to about 2.24:1 because the slide's picture box is about
2.7:1, so a taller crop is height-bound in it and wastes the width. At 2.24:1
the product renders on the slide at roughly 1.09, slightly larger than life.

The neutral set is a rename, not a second world. The league, its organisation
**and the stored recap bodies** carry the league name, so renaming only the
league leaves "NPH" in the news cards on the public hub shot. The rename is
reverted in a `finally` block and the script fails loudly if anything is left
behind.

## Copy rules these are built to

- Never sell the absence of a bug. "Zero double-booked courts" is banned.
- Never headline the fifteen-second scheduler run. The work is the planning.
- No team or game counts for a league prospect. A bigger league reads a printed
  number as a ceiling.
- Fairness is measured per team, not per player.
- No money word for something that is not money.
- Nothing implying a league can sell the analytics. The business model is open.
- The logo is the PNG, never the wordmark SVG, which sets its type in a system
  font stack and moves the badge on every machine.

## Open

An assets directory on the admin dashboard, listing every outward-facing thing
we have built (these decks, the demo directory, ad creatives, the caption doc)
so a link can be found without asking. Owner's idea, 2026-08-20. Not scoped.
