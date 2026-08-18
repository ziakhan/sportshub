---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# Build a team, fill the roster: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/roster-story`** ("Build a team, fill the roster", rebuilt
2026-08-16 to the gold standard set by the season story, the schedule-change demo, the waivers
demo, game day, the withdrawal demo and the referees demo).

Same two rules as `season-story-numbers.md` and `the-referees-numbers.md`:

1. **No number appears in the demo without a line here.**
2. **Every scene names the route the flow lives on today** (audit D2). Section A is that list.

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database on 2026-08-16 (NPH Summer world, Toronto Lords `tenantId dcd497e7-3c59-41ff-9f16-acea5193ffb3`) |
| `PRODUCT` | A constant, label, format or sentence taken from shipping product code (file named) |
| `ARITH` | Arithmetic on rows above it, shown in full |
| `OWNER` | A ruling in the 2026-08-16 scenario audit or the phone-first chart |

Database access for this build was **read only** (owner constraint, 2026-08-16). Nothing was
seeded, patched or backfilled to make a number work; where the world is thin, the demo says so.

---

## 0. Why this runs on Toronto Lords, and why it is one connected story

The cross-demo continuity asset: **the Jordan Reyes family already stars in the schedule-change,
game-day and waivers demos.** This demo is the beginning of the same family's story, on the same
club, in the same database.

`DB`, the family:

| Row | Value |
|---|---|
| Guardian | **Jordan Reyes**, `User 2a6333d5`, `summer-parent-lords@sportshub.demo` |
| Child 1 | **Darius Reyes**, `Player a18c732d`, born 2011-12-20, MALE, **#37** on Toronto Lords Grade 9 |
| Child 2 | **Danielle Reyes**, `Player 729b0d07`, born 2010-01-11, FEMALE, **#20** on Toronto Lords Grade 10 Girls |
| Club | **Toronto Lords**, `Tenant dcd497e7`, shortName **Lords**, Toronto, ACTIVE, 8 teams |

And the reason this world can carry a roster-build story at all: **the club is genuinely mid-build
of a fall roster in this database right now.**

`DB`, the three rows that make the spine real:

| Row | Value |
|---|---|
| `Team d430fbd8` | "Toronto Lords Grade 10 (Fall/Winter 2026-27)", Grade 10, MALE, **0 players** |
| `Tryout 1689307c` | "Toronto Lords Fall Tryouts [em-dash] Grade 9 & 10", 2026-08-20, The Playground, **fee 25**, cap 30, published, public |
| `Offer bb219828` | **PENDING**, to Darius Reyes, on that empty fall team, `installments: 4`, message "Darius had a strong summer [em-dash] we'd love to have him back for the fall/winter season. Offer expires in 10 days." |

Five `TryoutSignup` rows sit on that tryout, all PENDING, and Darius is one of them
(`TryoutSignup 768f6d41`). The demo films the flow that turns those three rows into a full roster.

---

## A. This flow exists today: scene by scene

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 | `open`, the club's team list | `/clubs/[id]/teams` | `app/(platform)/clubs/[id]/teams/page.tsx` |
| 2 to 7 | `new`, `age`, `suffix`, `name`, `staff`, `create` | `/clubs/[id]/teams/create` → `POST /api/teams` | `clubs/[id]/teams/create/page.tsx`; the name preview is `composeTeamName` in `lib/teams/naming.ts` |
| 8 to 12 | `tryout-open`, `tryout-where`, `tryout-when`, `tryout-fee`, `tryout-publish` | `/clubs/[id]/tryouts/create` → `POST /api/tryouts` | `clubs/[id]/tryouts/create/page.tsx`, `VenueSelector`, `DateTimePicker`, `TimeRangePicker` |
| 13 to 17 | `phone-in`, `who`, `eligible`, `register`, `offline` | `/tryouts/[id]` → `POST /api/tryouts/[id]/signup` | `app/(platform)/tryouts/[id]/page.tsx` with `components/registration/program-signup-form.tsx` |
| 18 | `signups`, the tryout's signup list | `/clubs/[id]/tryouts/[tryoutId]/signups` | the signups page and its row status chips |
| 19 to 22 | `bulk`, `package`, `auto`, `send` | same page → `POST /api/offers/bulk` | `signups/bulk-offer-button.tsx` wrapping `components/offers/offer-composer.tsx`; `api/offers/bulk/route.ts` |
| 23 to 27 | `arrive`, `sizes`, `jersey`, `plan`, `accept` | `/offers` → `PATCH /api/offers/[id]` `{action:"accept"}` | `app/(platform)/offers/offer-response-form.tsx`; the plan copy is fed by `GET /api/offers/[id]/payment-info`; the accept writes through `lib/offers/respond-to-offer.ts` and `scheduleInstallments` in `lib/payments/installments.ts` |
| 28 to 30 | `roster`, `roster-sizes`, `roster-status` | `/clubs/[id]/teams/[teamId]/roster` | `clubs/[id]/teams/[teamId]/roster/page.tsx` |
| 31 | `house`, the club's other product | `/clubs/[id]/house-leagues` and the public club page | `HouseLeague` model; `DB` row `7d5b9a63` |
| 32 | `end` | n/a, the end card | |

---

## B. Chapter 1: the team

| On screen | Value | Source |
|---|---|---|
| Club | Toronto Lords | `DB` Tenant.name |
| Existing Grade 10 | "Toronto Lords Grade 10", 10 players | `DB` Team e7454de6 |
| Age group picked | **Grade 10** | `PRODUCT` `AGE_GROUPS` in `lib/teams/naming.ts` includes "Grade 10" |
| Suffix hint | "Only needed when you field more than one team in the same age group." | `PRODUCT` verbatim, `teams/create/page.tsx` |
| Suffix typed | **Fall/Winter 2026-27** | 19 characters, inside the real custom-suffix cap of 20 |
| Name preview label | "Team name (written for you)" | `PRODUCT` verbatim |
| Composed name | **Lords Grade 10 Fall/Winter 2026-27** | `PRODUCT` `composeTeamName({shortName:"Lords", ageGroup:"Grade 10", suffix:"Fall/Winter 2026-27"})` |
| Success copy | "Team Created!" / "{name} ({ageGroup}) has been created. 1 staff member assigned." | `PRODUCT` verbatim |

> **The seeded team's name could not be typed today, and that is the point of the beat.**
> `DB` the real empty fall team is called "Toronto Lords Grade 10 (Fall/Winter 2026-27)", with the
> club's FULL name and parentheses. `PRODUCT` the create screen composes from the club's SHORT
> name and never emits parentheses, so that row was written straight into the database by
> `scripts/seed-nph-demo.ts`, not through the picker. The demo shows what the **shipping** picker
> writes. Same team, same season, current naming.

The head coach shown, "Marcus Bell", is a composition: `DB` **the `UserRole` table currently holds
exactly one row**, a `PlatformAdmin`, so there is no staff row on any club to read a real coach
name off. Recorded again in section F, punch 4, because it is the same live-world defect the
schedule-change and referees sheets already carry.

---

## C. Chapter 2: the tryout

Every value `DB` from `Tryout 1689307c` unless marked.

| On screen | Value | Source |
|---|---|---|
| Title | "Toronto Lords Fall Tryouts · Grade 9 & 10" | `DB` verbatim. The row stores an em-dash; the house copy rule renders the middot |
| Venue | **The Playground · Burlington** | `DB` `Venue c805d634`, 952 Century Dr |
| Date | **Thu, Aug 20** | `DB` `scheduledAt` 2026-08-20T22:30:00Z, which is 6:30 PM America/Toronto |
| Time | **6:30 – 8:30 PM** | `ARITH` `duration: 120` minutes from the tip above |
| Fee | **$25** | `DB` `Tryout.fee`. Also the owner's tryout tier in the audit (B) |
| Max participants | **30** | `DB` `maxParticipants` |
| Draft note | "Tryouts are saved as drafts. You can publish them to the marketplace from the tryouts list." | `PRODUCT` verbatim |
| Buttons | "Save draft" / "Create & publish" | `PRODUCT` verbatim |

---

## D. Chapter 3: the family signs up

| On screen | Value | Source |
|---|---|---|
| Question | "Who's playing?" | `PRODUCT` verbatim, `program-signup-form.tsx` |
| Child 1 | **Darius Reyes**, b. 2011, 15 | `DB` Player a18c732d and `TryoutSignup.playerAge` |
| Child 2 | **Danielle Reyes**, chip "Outside age group" | `PRODUCT` the warn chip; `DB` she is a Grade 10 GIRLS player and the tryout is Grade 9 to 10 boys |
| Register button | **"Register · $25.00"** | `PRODUCT` line 455, `` `Register · ${formatCurrency(total, currency)}` `` |
| Success | "Registered!" / "{name} is registered for {programName}." | `PRODUCT` verbatim |
| Payment sentence | "This organizer accepts cash, e-Transfer · pay them directly after registering. Offline payments are arranged directly with the organizer, the platform can't refund them." | `PRODUCT` line 464, with `methodsText(["CASH","ETRANSFER"])`. Em-dash to middot, and the trailing clause de-dashed |

**Why the OFFLINE branch is the honest one here.** `DB` this club has **no `PaymentConfig` row**,
so `getPaymentConfig` resolves `offlineEnabled: true` and `offlineMethods: ["CASH","ETRANSFER"]`
from the defaults in `lib/payments/config.ts` lines 105 to 106, and `onlineMode` falls to the
platform default, which `DB` `PlatformSettings.payDefaultOnlineMode` says is **NONE**. So the
$25 tryout fee really is arranged with the club, and the demo shows the sentence the product
would actually render. It is also the same truth the money-picture demo's cash-at-the-door beat
rests on.

---

## E. Chapter 4: the offer, and the plan

### The package

| On screen | Value | Source |
|---|---|---|
| Modal title / subtitle | "Send Offers" / "Compose the packages once; everyone you tick gets the same offer." | `PRODUCT` verbatim, `bulk-offer-button.tsx` |
| Recipients | **5 of 5 eligible selected**, button "Send to 5 players" | `DB` five `TryoutSignup` rows on this tryout; `PRODUCT` the button's own plural |
| Season fee | **$3,600** | `OWNER`, see the box below |
| Installments field | 4 installments | `DB` `Offer bb219828.installments = 4`, which is deposit plus three |
| Kit | Uniform, Tracksuit, Shoes, Basketball ticked; Bag not | `PRODUCT` `ITEM_FIELDS` in `offer-composer.tsx`. `DB` the club's own "Elite All-In" template ticks the same four plus Bag, so the shape is the club's, not invented |
| Plan control | **"Auto: 25% + 3 monthly"** | `PRODUCT` verbatim, `offer-composer.tsx` line 287 |
| Expiry | **10 days** | `DB` the offer's own message says ten days; `PRODUCT` 10 is one of the real expiry chips (3, 5, 7, 10, 14) |

> **The fee is an OWNER number, not a DB number, and here is the whole picture.**
> `DB` the live pending offer carries **$1,250**, and the club's three saved `OfferTemplate` rows
> are its SUMMER prices: "Returning Player" **$795**, "New Player" **$895**, "Elite All-In"
> **$1,495**, every one of them describing itself as "Toronto Lords summer program".
> `OWNER` the 2026-08-16 ruling puts a REP season in the **$3,000 to $5,000** band, and this demo
> is a rep fall season, not the summer program. **$3,600** was chosen inside that band because the
> product's own arithmetic divides it into four clean equal parts, and deliberately NOT $3,950,
> which is the league's team ENTRY fee in the season story and would read as the same money twice.
> Nothing was written to the database.

### The plan, computed by the product

`PRODUCT` two implementations of the same owner spec exist, and **both were run for this cut**:

| Where | Function | Result for $3,600 |
|---|---|---|
| Server | `computeDefaultPlan` in `lib/payments/installments.ts` lines 34 to 54 | deposit **$900**, then $900 on **Sep 1**, $900 on **Oct 1**, $900 on **Nov 1**, at 09:00 |
| Client | `autofillPlan` in `components/offers/offer-composer.tsx` lines 110 to 123 | identical, to the cent |

Run for real on 2026-08-16 with `firstOfMonthFrom = 2026-08-24`:

```
computeDefaultPlan(3600) → deposit 900 |
  Installment 1 $900 due Tue Sep 01 2026 |
  Installment 2 $900 due Thu Oct 01 2026 |
  Installment 3 $900 due Sun Nov 01 2026 | sum 3600
```

`ARITH` the arithmetic the screen prints back at the club: `900 + 2,700 = 3,600 ✓`, which is the
composer's own balance-check line.

The dates are not a choice. `PRODUCT` the loop does `d.setMonth(d.getMonth() + i, 1)`, so the
installments land on the **1st of each of the next three months** whatever day the offer is sent.

### What the family sees, word for word

| On screen | Value | Source |
|---|---|---|
| Header | "Accept Offer" | `PRODUCT` `offer-response-form.tsx` line 304 |
| The coach's words | "Darius had a strong summer · we'd love to have him back for the fall/winter season." | `DB` `Offer bb219828.message`, em-dash to middot |
| Uniform Size | **YL** | `DB` Darius's accepted summer offer `6a179f47` recorded YL |
| Tracksuit Size | **AM** | `DB` same row |
| Shoe Size | **9** | `DB` same row |
| Jersey preferences | **#37, #1, #7** | `DB` same row: `jerseyPref1 37`, `jerseyPref2 1`, `jerseyPref3 7`. 37 is the number he already wears |
| Size option lists | YS/YM/YL/AS/AM/AL/AXL, and 4 to 13 in halves | `PRODUCT` `CLOTHING_SIZES` and the shoe list |
| Plan card | "$900 deposit now, then $900 on Sep 1, $900 on Oct 1, $900 on Nov 1" then "Auto-charged to your card on file." | `PRODUCT` the exact shape of the plan description and its helper line |
| Due now | **$900** | `PRODUCT` "Due now: {amountDue}" |
| Accept button | **"Pay $900.00 & Accept"** | `PRODUCT` the `needsPayment && cardReady` branch |
| After accepting | "Deposit / Paid at signup", then Installment 1 to 3 with dates | `PRODUCT` `app/(platform)/payments/page.tsx` lines 72 to 115, including "Scheduled payments charge automatically to your default card. Update it any time under Manage cards." |

---

## F. What the product cannot honestly show, and is therefore declared

### 1. No club in this database can take online money

`DB` there is exactly **one** `PaymentConfig` row in the whole database. It is on a **different**
tenant ("Toronto Lords Basketball", `660fedfb`, not the NPH Toronto Lords), its
`stripeAccountStatus` is **"pending"**, and `PlatformSettings.payDefaultOnlineMode` is **NONE**.
`PRODUCT` `resolveChargeContext` returns null unless `stripeAccountStatus === "active"`, and the
accept form's whole payment section is gated on `online && fee > 0`.

**So today, every seeded club would render the OFFLINE sentence instead of a payment plan.** The
demo films the ONLINE branch because that is the code path a club takes the day it finishes
Connect onboarding, and because the owner ruled this the flow where installments live. The demo
does not hide the other branch: the tryout chapter shows the offline sentence in full, on the same
club, four beats earlier.

**PUNCH: seed one club with an active Connect account**, or the payment half of the product is
undemoable on a real machine.

### 2. There are zero `OfferOption` and zero `OfferInstallmentTerm` rows

`DB` both tables are **empty**. The 227 `ACCEPTED` offers in this database are legacy single
package rows carrying `Offer.seasonFee` and `Offer.installments` and nothing else, so there is no
real plan ladder anywhere to read. The plan on screen is therefore **computed** by the product's
own arithmetic (section E) rather than read off a row, and that is stated rather than implied.

**PUNCH: the seeder should write at least one multi-option offer with terms**, so the accept
form's package chooser has a real fixture.

### 3. `computeDefaultPlan` has no production caller

Grepped repo-wide: the server function in `lib/payments/installments.ts` is referenced only by its
own unit test and by narrative comments in two demo scripts. The shipping path is `autofillPlan`
in `offer-composer.tsx`, the identical arithmetic reimplemented client side. Two copies of an
owner-spec formula is one copy too many.

**PUNCH: delete one of them**, or have the client call the server helper through the composer's
own route.

### 4. The `UserRole` table holds one row

`DB` exactly one row, a `PlatformAdmin`. Every coach, club owner and manager either seeder wrote
has been wiped from this database at some point after seeding. So the demo's head coach name is a
composition, and no operator account on this box can sign into a workspace at all. Same defect
already recorded in `schedule-change-numbers.md` §C and `the-referees-numbers.md` §G.

### 5. The roster board has no fee column

`PRODUCT` the real roster table's columns are `#`, Player, Position, Height / Weight, Uniform,
Tracksuit, Shoes, **Status** (Finalized / Pending finalization, keyed off the jersey number) and
**Waivers** (Signed / N unsigned). There is no payment state on it; money lives on
`/clubs/[id]/payments`. The demo shows exactly those chips and claims nothing about fees on that
screen.

---

## G. Numbers deliberately NOT shown

| Not shown | Why |
|---|---|
| A house-league fee near $500 | The audit's club tiers say "~$500 house". `DB` this club's real `HouseLeague 7d5b9a63` charges **$220** for eight Saturdays, and the demo shows the database's number. The audit tier is a pricing intent, not this world |
| The club's three real `OfferTemplate` prices | $795 / $895 / $1,495, all SUMMER program prices (section E). Showing them beside a $3,600 rep package would read as a contradiction rather than a season change |
| A tryout check-in / roll call | Real (`TryoutSignup.checkedInAt`) and `DB` **zero** rows are checked in. The roll-call beat already belongs to the game-day demo |
| A roster cap warning | `PRODUCT` `MakeOfferButton` shows "Committed n / cap n · n offers out" when a cap exists. `DB` no cap is set on this team, so the panel would not render |
| Payment method entry (Stripe Elements) | Section F punch 1. No club here can reach it |
| The declined and rescinded offer states | Real (`OfferStatus`), and `DB` three DECLINED plus two EXPIRED rows exist, but the story is the accept |

---

## H. Composition choices, declared

| Choice | Why |
|---|---|
| **Two handsets, no desktop anywhere** | `OWNER` the 2026-08-16 phone-first chart puts team creation, tryout posting and offer SEND on the phone with fabrication allowed, and offer ACCEPT on a real phone surface. So the stage is the club's handset and Jordan Reyes's, at 390 logical and scale 1.0 |
| The club's five screens are PHONE COMPOSITIONS | `/clubs/[id]/teams`, `/clubs/[id]/teams/create`, `/clubs/[id]/tryouts/create`, the tryout signups page with its bulk modal, and the roster board all ship wide today. Each is composed at 390 keeping its real fields, labels and buttons; the roster's ten-column table becomes one card per player carrying the same columns |
| The parent's two screens are NOT compositions | `/tryouts/[id]` and `/offers` are responsive pages a guardian reaches from the app's own mobile bottom bar. The tab strip drawn under her handset is the real parent bar: Home, Chat, Calendar, **My Kids**, Social (`bottom-tabs.tsx`, the `hasKids` context slot) |
| The club handset's tab strip says "My Club" | `PRODUCT` `contextTab()` resolves the operator slot to `operatorTabLabel(shape)` for a club owner. Composition, same as the screens it sits under |
| 5 of 10 roster rows, 5 of 5 signups | The handset screen is 390 by 508 in this stage and the scene never scrolls. The roster carries its true count in the header chip, "10 of 10", and "and 5 more, all finalised" under the list, and the sweep tightened the rows until the fifth row AND that line are both fully on screen |
| The tryout form drops the venue helper line and folds Max into the date row | Height only: the full-length form ran 88px past the composed box, which the scene-overflow gate caught. Every field it asks for is still on screen |
| The date reads "Thu, Aug 20" rather than a year | `PRODUCT` the real date pickers and list rows format without the year inside a season |
| En dashes kept in "6:30 – 8:30 PM" | A time range is an en dash, not an em dash. The house rule bans em-dashes, and there are none in this file or the demo |

---

## I. Gates, this cut

| Gate | Result |
|---|---|
| `scripts/demo/readability-audit.mjs --routes /demos/roster-story` | **0 violations**, minimum stage scale **1.000**, 32 beats, 37 scenes audited (sweep re-run 2026-08-16) |
| Same, `--viewport 390x844 --floor 11 --scope stage` (keyhole) | **0 violations** |
| Same, `--viewport 390x844 --floor 14 --scope chrome` | **0 violations** |
| Full playback drive, 32 beats stepped twice plus a 2x autoplay pass | **0 console errors**, **0 page errors** |
| Chapter jumps | **5 of 5 exact**: beats 1, 8, 13, 18, 28 |
| Runtime at 1x | **2 min 23 sec** (sweep cut, shorter balloons) |
| Scene overflow (any node past the composed box) | **0 px**, all 32 beats, both handsets |
| 390x844 horizontal overflow | **0 px** |
| `tsc --noEmit` | clean |
| Em-dash sweep | clean |
| Database writes | **none**. Every derivation ran over read-only queries, and the plan was produced by running the product's own functions |

---

## J. The 2026-08-19 realism conversion (mock-ui.tsx R1–R8)

The 08-16 cut was written to the scene kit. This one is written to the REAL
components, screen by screen, on the owner's ruling that every remaining demo
is held to R1–R8. What changed, and what it changed to:

| Screen | Was (08-16) | Is now, and its source |
|---|---|---|
| Club team list | List rows with a "10 players" chip | `clubs/[id]/teams/page.tsx`: brand-bar condensed h2 with its count, the TeamsFilter row, team CARDS with the league chip and the four-tile stat grid (Players / Record / Tryouts / Offers) |
| Create team | One text field for the suffix | `teams/create/page.tsx`: the real suffix CHIPS (`TEAM_NAME_SUFFIXES`) plus "Custom…", which is the only way a season-shaped suffix gets typed, the dashed name preview, and both halves of Staff Assignment (assign + invite by email). Ends on the page's own "Team Created!" card |
| Create tryout | Compressed field stack | `tryouts/create/page.tsx`: SmartBack, condensed h2, the three `PanelHeader` sections, the age/gender Badges the team fills in, the ink-50 draft note, the real three-button footer. Ends on the page's own created card |
| Tryout signups | Invented rows + a "Send Offers" button | The page's OWN phone shape (`sm:hidden` card list): player, guardian under it, `Badge tone={toneForStatus()}` gold lower-case "pending", the row chevron, inside the rounded-[28px] panel with its band `PanelHeader` |
| Send offers | A summarised composer | `bulk-offer-button.tsx` + `offer-composer.tsx`: the black/50 modal, the scrollable recipient box, "5 of 5 eligible selected", the Option 1 card with Fee / Installments / Practices and the five item checkboxes, the "Payment plan (deposit + installments)" tick that autofills through `autofillPlan`, the `#N amount + due date` rows, the live `PlanSum` line, the Expires-in chips. Ends on the modal's own "5 offers sent" result |
| Parent, before the tryout | Nothing (an empty handset) | `/events` (`events-browser.tsx`): the filter pills and the program card with its stage-gradient cover, crest watermark, type pill, by-type lead line, crest row and hoop-600 condensed fee. The published tryout DROPS IN at the top, which is what "published to the marketplace" means |
| Parent, the listing | A summarised card | `/tryouts/[id]`: the brand band, the Open badge, condensed h1, InfoTiles, then `program-signup-form.tsx` with "Who's playing?", the KidRow chips and the fee on the button. Registering swaps only the sidebar card for the form's own green "Registered!" panel, exactly as the real page does |
| Parent, the offer | Two invented compositions | `/offers`: Offers eyebrow chip, condensed "My offers", gold-bar "Pending (1)", the play-200 card with the condensed fee, the play-50 "What's included" chips, the ink-50 italic message, Accept / Decline; then `offer-response-form.tsx` in the court-50 panel, filmed in its two scroll positions |
| Parent, after accepting | An invented "On the roster" panel | The REAL end state: the offer moves into "Past Offers (1)" as an ACCEPTED court-tinted row carrying `Uniform: YL \| Tracksuit: AM \| Shoes: 9 \| Jersey prefs: #37, #1, #7` |
| Roster | Cards with a number chip | `roster/page.tsx`: the condensed "{team} - Roster", the collapsed `roster-manager.tsx` bar, and the real table (ink-50 uppercase head, `PlayerMug` per row, size cells, `Badge tone="court"` Finalized) |
| The offer arriving | Nothing | R8: the notification `lib/offers/create-offer.ts` really sends ("New Team Offer", `{club} has sent an offer for {player} to join {team}.`), as an iOS-style banner with the approved app icon |
| Club "Programs" screen | Rep team + house league + tryout | **Cut.** There is no such page in the product; it was the one invented screen in the story. The house league keeps its place in the money-picture demo |

### Balloons

Twenty-four callouts became eleven. A callout now exists only where the screen
cannot say the thing: why Grade 10, why the product writes the name, what the
cap does, what publishing means, why the offline sentence exists, what one
composition sends, what happens when nobody answers, why three jersey numbers,
when the later charges run, what one press does, where the sizes came from, and
what Finalized does not mean. Everything else moved into the caption bar.

### Engine law learned in this drive

**A beat's `set` is applied the moment the beat starts, so a beat must never
remove its OWN cursor target.** Every press that replaces the screen (create,
publish, register, send, tap the push, accept) presses on one beat and lands on
the next. Before the fix the cursor drifted to nothing, the balloon was skipped
because it had no anchor, AND the caption bar was silenced by the one-voice
rule, so those beats narrated nothing at all. The pattern predates this story
and is worth checking in the other converted demos.

### Long forms are filmed in two scroll positions

Create-team (naming, then staffing with the buttons), create-tryout (details
and schedule, then schedule and money with the buttons), the compose modal, and
the accept form. A phone scrolls these; squeezing them was what pushed the
Register button and the Create Team button under the tab bar in the first pass.

### Gates, this cut

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `drive-demo-beats.mjs roster-story` | 41 beats, every frame read; no overflow, no unanchored cursor, no flow ending before its real end state |
| `readability-audit.mjs --scope chrome` | **0 violations**, minimum stage scale 1.15 |
| `readability-audit.mjs --scope stage` (14px floor) | 2,356 violations, all of them the real product's own handset type (8 to 13px checkboxes, eyebrows, table heads, badges). The exemplar `your-week` fails the same gate with 216. **The 14px stage floor and the realism standard are now in conflict** and the owner has to rule: R1 says copy the real component's classes, and a real phone screen is 10 to 13px type. Nothing here is smaller than the product it mirrors |
| Runtime at 1x | **1 min 46 sec** (was 2 min 23 sec) |
| Database writes | **none** |
