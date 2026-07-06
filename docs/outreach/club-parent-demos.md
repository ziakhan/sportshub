# Club & Parent demos — feature audit + storyboards (2026-07-06)

Grounding the demo content in what's actually shipped, from the owner's
feature braindump. Real = in the product now; Gap = not built (or only the
data exists, not the feature).

## Audit — the club pipeline the owner described

| Feature (owner's words) | State | Evidence |
|---|---|---|
| Advertise tryouts / sign-ups | ✅ Real | `Tryout` + `TryoutSignup` models; public marketplace listing |
| No print/spreadsheets — offers sent in-app | ✅ Real | `Offer` model, in-app offer flow |
| Tailored offers + reusable templates | ✅ Real | `OfferTemplate` (per-team, `isActive`), `Offer.templateId` |
| Packages: ball / bag / shoes / uniform / tracksuit | ✅ Real | `includesBall/Bag/Shoes/Uniform/Tracksuit` on template + offer |
| Returning players pick cheaper package (fewer items) | ✅ Real | Multiple templates per team, each with its own item set + `seasonFee` |
| Sizes captured on acceptance (uniform / shoe / tracksuit) | ✅ Real | `uniformSize`, `shoeSize`, `tracksuitSize` on `Offer` |
| Jersey number preferences (1st/2nd/3rd) | ✅ Real | `jerseyPref1/2/3` on `Offer` |
| Payment plans / installments | ✅ Real | `installments` on template+offer; `Payment.installmentNumber`; obligations |
| Accept / decline / auto-expire offers | ✅ Real | `OfferStatus` PENDING/ACCEPTED/DECLINED/EXPIRED; `respond-to-offer` |
| Auto-form roster from accepted offers | ✅ Real | `teams/[id]/finalize` — reads accepted offers, assigns jerseys FCFS respecting prefs, notifies parents, expires stragglers |
| Submit roster to league in ONE click | ✅ Real | `seasons/[id]/submit`; `TeamSubmission` |
| Lock roster (no changes without league permission) | ✅ Real | `SeasonRoster.isLocked` + `lockedAt` |
| Reviews / ratings of clubs | ✅ Real (unhidden 2026-07-06) | Reviews + avg stars live on `/club/[slug]` with write-review form; ratings on browse cards |
| Public club browse / discovery | ✅ Real (basic) | public `/club` browse page |
| **Tryout check-in on mobile** ("who's supposed to be at the sign-up") | ✅ Real (2026-07-06) | Roll-call page `/clubs/[id]/tryouts/[tryoutId]/check-in` — tap to check in, live X/N progress, search; `TryoutSignup.checkedInAt` |
| **Inventory / order summary** (what to order per team, totals by size) | ✅ Real (2026-07-06) | Order Sheet at `/clubs/[id]/offers/summary` — per-team + club totals by size, Size-TBD flags, jersey #s, CSV export (`lib/offers/order-rollup.ts`) |
| **Team ↔ family chat** | ✅ Real (2026-07-06) | `TeamMessage` + `/teams/[teamId]/chat` — staff + rostered families, polling chat w/ moderation; doors from team dashboard, parent dashboard, public team hub |
| **Sponsored / featured club listings** | ✅ Real (2026-07-06) | `Tenant.isFeatured` + admin toggle; gold spotlight section on `/club` browse |
| **Parent discovery: clubs near me, ranked by rating** | ✅ Real (2026-07-06) | `/club` browse: city pills + filter, star ratings, rated-first sort, featured spotlight |

**Takeaway:** the tryout → offer → accept → roster → submit-to-league → lock
spine is 100% real and genuinely impressive — that IS the club demo. Four gaps
sit around the edges; two are cheap (inventory roll-up, tryout check-in), two
are real builds (chat, sponsored/discovery).

## Club demo — storyboard (correct lifecycle order)

The story: a club runs its whole season setup without a single spreadsheet.

1. **Post a tryout** — club creates a tryout; it appears on the public
   marketplace where parents find it. *(real)*
2. **Sign-ups roll in** — parents register their kids from their phones; the
   club sees the list build live, and takes roll call on a phone on tryout
   day. *(real — check-in shipped 2026-07-06)*
3. **Send tailored offers** — pick a template (Standard / Premium / Returning),
   which auto-fills the package (ball, bag, shoes, uniform…) and fee + payment
   plan. One tap per player. *(real)*
4. **Parent accepts on their phone** — picks their package, enters sizes, ranks
   jersey numbers, chooses a payment plan, pays. *(real)*
5. **Roster forms itself** — accepted offers become the roster; jerseys assigned
   automatically respecting preferences; parents notified. *(real)*
6. **Order sheet, automatically** — the club sees totals by size/item across the
   team: "8 uniforms (3 YL, 5 AM), 5 pairs shoes, 4 backpacks." No manager
   forms. *(real — shipped 2026-07-06)*
7. **Submit to the league in one click** — roster goes to the league; locks so
   nobody can change it mid-season without league permission. *(real)*

## Parent demo — storyboard (discovery + the season)

The story: a parent finds the right club and never misses a moment.

1. **Find clubs near you** — list of clubs by city, each with a rating from
   real families and current tryouts. *(real — shipped 2026-07-06)*
2. **See who's good** — star ratings, reviews, age groups, open tryouts, and a
   featured spotlight. *(real — shipped 2026-07-06)*
3. **Register for a tryout** in a few taps. *(real)*
4. **Get the offer, accept on your phone** — package, sizes, jersey, payment
   plan. *(real)*
5. **Follow your kid all season** — live scores, box score with your kid's line,
   game-cancelled/reminder notifications, recaps + photos, season stat page.
   *(real — this is the P1 content + cascade work)*

## Gaps to close so the demos are 100% honest (recommended order)

1. **Inventory / order roll-up** — ✅ SHIPPED 2026-07-06 (Order Sheet page,
   per-team size/item totals, CSV export).
2. **Tryout mobile check-in** — ✅ SHIPPED 2026-07-06 (phone roll-call page,
   tap to check in, live progress).
3. **Parent discovery surface** — ✅ SHIPPED 2026-07-06 (city pills, ratings,
   reviews unhidden, rated-first sort).
4. **Sponsored/featured listings** — ✅ SHIPPED 2026-07-06 (isFeatured +
   admin toggle + gold spotlight on browse).
5. **Team ↔ family chat** — ✅ SHIPPED 2026-07-06 (TeamMessage, polling chat
   page, staff moderation, three entry doors).

**All five closed 2026-07-06 — both demo storyboards are 100% real product.**

## Strategic note (owner, 2026-07-06)

Promote to BOTH clubs and leagues, but **clubs are the easier sell** — "makes
your life simple, all in one place." Leagues may be less inclined to switch;
the club pipeline above is the wedge. Parent discovery + ratings is how clubs
get *found*, which is the club's incentive to be on the platform.
