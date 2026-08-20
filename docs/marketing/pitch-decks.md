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
| `sportshubone.com/deck/leagues` | Anyone. Names nobody. |
| `sportshubone.com/deck/coalition` | The Coalition League |
| `sportshubone.com/deck/hoopcity` | HoopCity Basketball |
| `sportshubone.com/deck/nph` | **North Pole Hoops only.** Never anyone else. |

## Adding a league

One row in `apps/web/src/app/deck/_deck/registry.ts`:

```ts
coalition: { ...NEUTRAL, recipient: "The Coalition League" },
```

Live at `/deck/coalition` on the next deploy. To add their logo beside the name
on the title slide, drop a file in `public/deck/logos/` and add
`logo: "/deck/logos/coalition.png"`. Without a logo it shows the name alone,
which is the current state for all of them.

**Do not fork the deck to add a recipient.** Every slide lives in one file, so a
wording change lands on every league at once. A fork is how two versions of the
same pitch start telling different stories.

`/deck/leagues` is the general cut. **NPH is not named anywhere in it**, in the
copy, in the screenshots, or in the embedded demo. `/deck/nph` is the same
twenty slides with NPH's league in every screenshot and in the live demo, and
"Prepared for North Pole Hoops" on the title slide.

Both are `robots: noindex`. They are for sending, not for finding.

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

## Re-capturing the neutral screenshots

They come from the same seeded season as the NPH set. The league, its
organisation and the stored recap bodies are renamed in the **local** database,
the screens are captured with Playwright, and everything is restored afterwards.
Recap text matters: the league name is written into the body of each post, so
renaming only the league leaves "NPH" sitting in the news cards on the public
hub screenshot.

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
