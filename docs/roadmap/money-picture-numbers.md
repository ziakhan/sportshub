---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# The money picture: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/money-picture`** ("The money picture", rebuilt 2026-08-16 to
the gold standard set by the season story, the schedule-change demo, the waivers demo, game day,
the withdrawal demo, the referees demo and the roster story).

Same two rules as `season-story-numbers.md` and `roster-story-numbers.md`:

1. **No number appears in the demo without a line here.**
2. **Every scene names the route the flow lives on today** (audit D2). Section A is that list.

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database on 2026-08-16 (Toronto Lords, `tenantId dcd497e7-3c59-41ff-9f16-acea5193ffb3`) |
| `PRODUCT` | A constant, label, format or sentence taken from shipping product code (file named) |
| `ARITH` | Arithmetic on rows above it, shown in full |
| `OWNER` | A ruling in the 2026-08-16 scenario audit |

Database access for this build was **read only** (owner constraint, 2026-08-16). Nothing was
seeded, patched or backfilled to make a number work.

---

## 0. The four tiles were not typed, they were computed

The page calls exactly three things (`app/(platform)/clubs/[id]/payments/page.tsx` lines 45 to 51):
`merchantObligations({ tenantId })`, `payerObligations({ tenantId })` and `summarize(incoming)`.

**This build ran the same two functions against the same club** and copied the answer:

```
summarize(merchantObligations({ tenantId: "dcd497e7-…" })) →
  collected 23270 · outstanding 3580 · overdue 3580 · waived 0
  overdueCount 8 · aging { d1to30: 0, d31to60: 0, d60plus: 3580 }
  byType [ ["Offer", 23270] ]
  30 obligation rows, 8 of them open
```

So the demo's tiles are not a dramatization of the product's arithmetic, they **are** the
product's arithmetic, over the real rows.

---

## A. This flow exists today: scene by scene

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 to 4 | `open`, `waived-tile`, `overdue`, `bytype` | `/clubs/[id]/payments` | `clubs/[id]/payments/page.tsx` lines 54 to 116, fed by `lib/payments/queries.ts` `summarize` |
| 5 | `filter`, filtering to Open | same page | `components/payments/obligations-table.tsx` line 103, the five real chips |
| 6 to 8 | `tiers`, `small`, `big` | the club's product surfaces | `OfferTemplate` (`/clubs/[id]/offer-templates`), `HouseLeague`, `Camp`, `Tryout`; composed onto one panel, section H |
| 9 to 12 | `row`, `expand`, `offline`, `left` | same page, the row and its expansion | `obligations-table.tsx` lines 120 to 273 |
| 13 to 14 | `cadence`, `stops` | `GET /api/cron/payment-reminders` | `lib/payments/scheduled.ts` `sendDueReminders` and `sendOverdueReminders` |
| 15 to 16 | `phone`, `late` | the bell and the family's inbox | `notify()` writes the `Notification`; `sendEmail()` sends the mail; both from `scheduled.ts` |
| 17 | `honest` | n/a, the honesty card | Section F punch 1 |
| 18 to 20 | `door`, `modal`, `recorded` | `POST /api/obligations/[id]/payments` | `obligations-table.tsx` `RecordPaymentModal` lines 298 to 394; `recordOfflinePayment` in `lib/payments/obligations.ts` lines 255 to 310 |
| 21 | `tiles-move` | same page | `summarize` recomputes on load |
| 22 | `waive` | `PATCH /api/obligations/[id]` `{action:"waive"}` | `waiveObligation` in `lib/payments/obligations.ts` lines 312 to 346 |
| 23 | `end` | n/a, the end card | |

**Parity note.** `lib/payments/queries.ts` is the one shared query module behind both the web money
screen and the mobile money surface, which is what the platform parity law requires. The demo
mirrors that module's output, not a hand-rolled shape.

---

## B. Chapter 1: where every dollar stands

| On screen | Value | Source |
|---|---|---|
| Tile labels | Collected · Outstanding · Overdue · Waived | `PRODUCT` verbatim, `payments/page.tsx` lines 56 to 79 |
| Collected | **$23,270** | `PRODUCT` `summarize().collected` |
| Outstanding | **$3,580** | `PRODUCT` `summarize().outstanding` |
| Overdue | **$3,580** | `PRODUCT` `summarize().overdue` |
| Waived | **$0** | `PRODUCT` `summarize().waived`; `DB` zero WAIVED obligations exist anywhere in this database |
| Overdue banner | "8 payments overdue · 60+ days: $3,580" | `PRODUCT` the banner's own words; `DB` all eight are 137 days late, so only the `d60plus` bucket has anything in it and the other two clauses do not render |
| Aging buckets | 1–30 · 31–60 · 60+ | `PRODUCT` `summarize()` lines 156 to 161 |
| By-type pill | **Season fee: $23,270** | `PRODUCT` `TYPE_LABEL.Offer` is "Season fee"; `DB` every obligation this club holds is an Offer obligation, so exactly one pill renders |
| Panel title | "Owed to Toronto Lords" | `PRODUCT` verbatim |
| Table columns | From · For · Amount · Paid · Status | `PRODUCT` verbatim, `obligations-table.tsx` lines 120 to 125 |
| Filter chips | All · Open · Paid · Waived · Cancelled | `PRODUCT` verbatim. **There is no Overdue chip**, section F punch 3 |
| Row count | **30**, dropping to **8** on Open | `DB` 22 PAID plus 8 PARTIALLY_PAID |
| Status badges | "Partially paid", "Paid" | `PRODUCT` `OBLIGATION_STATUS_STYLE` in `components/payments/types.ts` |
| Lateness | **Overdue 137d** | `PRODUCT` the row's own badge, `` `Overdue ${daysOverdue(o)}d` ``; `ARITH` due 2026-04-01, read 2026-08-16 |

---

## C. Chapter 2: what the club charges

Every price `DB` except the last, and each line is a real product this club sells.

| Tier | Price | Row |
|---|---|---|
| Tryout | **$25** | `DB` `Tryout 1689307c.fee` |
| House league | **$220** | `DB` `HouseLeague 7d5b9a63.fee`, eight Saturdays, U8 to U12, jersey and medal |
| Skills camp | **$275 a week**, or **$950** full | `DB` `Camp` "Lords Summer Skills Camp", `weeklyFee` and `fullCampFee` |
| Summer program | **$795 to $1,495** | `DB` three `OfferTemplate` rows: Returning Player $795, New Player $895, Elite All-In $1,495 |
| Rep season | **$3,600** | `OWNER` the rep band ruling ($3,000 to $5,000), the same number the roster story's offer carries. Marked on screen as the band rather than as a database row |

> **The audit's "~$500 house" tier is not what this world holds.** `DB` this club's house league is
> **$220**. The demo shows the database's number and this line records the difference, because a
> demo that quietly rounds a real price to a target price is a demo that cannot be trusted about
> the other four.

The chip on each row says which it is: "in the database" or "rep season band".

---

## D. Chapter 3: one family, one plan

The demo did not have to invent a debtor. `DB` **Jordan Reyes**, the guardian this whole demo
directory already follows (schedule-change, game day, waivers, roster story), is one of the eight
families this club is owed money by.

| On screen | Value | Source |
|---|---|---|
| Obligation | `e2f5e46b` | `DB` |
| Description | "Summer 2026 season fee · Toronto Lords Grade 10 Girls" | `DB` verbatim, the row stores an em-dash. That is Danielle's team |
| Amount | **$895** | `DB` `PaymentObligation.amount`, which is the "New Player" template price |
| Paid | **$447.50** | `ARITH` two SUCCEEDED payments of $223.75 |
| Status | Partially paid, **Overdue 137d** | `DB` and `PRODUCT` |
| Instalment size | **$223.75** | `ARITH` $895 / 4. `PRODUCT` `computeDefaultPlan(895)` returns exactly a $223.75 deposit and three $223.75 terms |
| Payment 1 | **Mar 14, Cash, $223.75**, "Summer 2026 deposit" | `DB` `Payment` row, method CASH, status SUCCEEDED |
| Payment 2 | **Apr 13, e-Transfer, $223.75**, "Summer 2026 installment 1/3" | `DB` `Payment` row, method ETRANSFER, status SUCCEEDED |
| Still open | installments 2/3 and 3/3, $223.75 each | `ARITH` the two terms with no payment behind them |
| History line format | "{date} · {method} · {description}" with the amount right-aligned | `PRODUCT` `obligations-table.tsx` lines 229 to 234 |

**Why the money in this world is offline money.** `DB` across the whole database: **424**
e-transfer payments, **185** cash, **170** cheque, and **12** Stripe. The demo's cash-and-e-transfer
history is not a chosen dramatization; it is what this database overwhelmingly contains.

---

## E. Chapter 4: the reminder, exactly as the code schedules it

| On screen | Value | Source |
|---|---|---|
| "3 days before it is due" | **3** | `PRODUCT` `PaymentConfig.reminderLeadDays`, schema default 3; `scheduled.ts` line 104 `?? 3`. `DB` this club has no `PaymentConfig` row, so it inherits the 3 |
| "the day after it is missed" | 1 day | `PRODUCT` `daysLate = Math.max(1, floor((now - due)/DAY))`, so the first overdue nag fires as soon as the job runs on a late row |
| "then every 4 days" | **4** | `PRODUCT` `OVERDUE_NAG_DAYS = 4`, `scheduled.ts` line 21, enforced by a lookback for a `payment_overdue` notification newer than `now - 4d` |
| "after 90 days, nothing" | **90** | `PRODUCT` `OVERDUE_MAX_DAYS = 90`, line 22; the query floor `dueDate >= now - 90d` simply stops selecting the row |
| Notification title, upcoming | **"Payment coming up"** | `PRODUCT` line 113 |
| Notification message, upcoming | "{description}: {money} due {when}." | `PRODUCT` line 114 |
| Email subject, upcoming | "Payment reminder: {money} due {when}" | `PRODUCT` line 136 |
| Email body, upcoming | "It will be charged automatically to your card on file. See your schedule: My payments." | `PRODUCT` line 138 |
| Notification title, late | **"Payment overdue"** | `PRODUCT` line 244 |
| Notification message, late | "{description} · {money} was due {n} days ago." | `PRODUCT` line 236, em-dash to middot |
| Where it lands | the bell, a push where the type allows it, and the inbox | `PRODUCT` `notify()` plus `sendEmail()` in the same loop |
| The job | `GET /api/cron/payment-reminders`, daily | `PRODUCT` `apps/web/vercel.json` `"30 9 * * *"`; the guard is `lib/cron-auth.ts`, which **fails closed** when `CRON_SECRET` is unset |

The one dated example on the phone, "$223.75 due Sep 1", is her next real installment date under
the plan in section D.

---

## F. What the product cannot honestly show, and is therefore declared

### 1. The reminder job is switched off on the box

Runbook #36 records it and the pre-launch ledger repeats it: **payment crons are OFF on the box
today.** The Vercel cron block that schedules them lives in `apps/web/vercel.json`, and Vercel git
deployments are disabled (`git.deploymentEnabled: false`), so that block schedules nothing on the
machine anybody would look at.

So the demo puts the sentence on the screen rather than in a footnote:

> "That is the schedule the code keeps: a daily job reads what is due and what is late and writes
> exactly one message per person per window. It is switched off on this machine, so nothing in this
> demo is claiming mail went out tonight. Turning it on is one environment variable and one
> scheduled job, and the copy above is what families would receive."

**PUNCH: turn the payment crons on at the next box deploy, or the strongest claim in this chapter
is a claim about code rather than about a running system.**

### 2. There is no MISSED payment status, and the old cut invented one

`PaymentStatus` is `PENDING | PROCESSING | SUCCEEDED | FAILED | REFUNDED | DISPUTED`
(`prisma/schema.prisma`). The 2026-08-15 cut of this demo drew a synthetic "Missed, card expired"
chip that corresponds to nothing in the enum and to no copy anywhere in the product. **It is gone.**
An installment past its date is `PENDING` (family side label "Upcoming") or `FAILED` ("Failed,
retrying"), and lateness is expressed the way the product expresses it: on the obligation row, as
"Overdue 137d".

### 3. There is no Overdue filter

The real chips are All, Open, Paid, Waived, Cancelled. The demo filters to **Open** and says why.

### 4. Nothing in this database is waived

`DB` zero obligations are in `WAIVED` status, so the Waived tile honestly reads **$0**. The demo
therefore points at the Waive control and says what it does (keeps what was paid, writes off the
rest, tells the family) without pressing it and without inventing a history of write-offs this club
does not have.

### 5. Two authorization mismatches on this page, worth fixing

- The page's `isAdmin` gate includes **Trainer**, but `POST /api/obligations/[id]/payments`
  defaults to ClubOwner/ClubManager, so a Trainer sees "Record payment" and gets a 403.
- The same page shows **Waive** to a Trainer, and `PATCH /api/obligations/[id]` explicitly narrows
  to ClubOwner/ClubManager ("Waiving money is an owner/manager decision, no Staff").

**PUNCH: align the button visibility with the API's own role list.** Not staged in the demo; the
persona filming it is the club owner.

---

## G. Numbers deliberately NOT shown

| Not shown | Why |
|---|---|
| "Fees Toronto Lords owes" | Real (the outgoing panel, `payerObligations`), and `DB` this club has league team-fee obligations. It is the SEASON story's beat, not this one |
| A card-on-file update | `PRODUCT` real on `/payments` via `payment-methods-manager.tsx`, but `DB` no club here can take card money at all (see `roster-story-numbers.md` §F punch 1), so there is no card to update |
| A refund | Real (`REFUNDED`, with the strikethrough treatment in the history list), `DB` zero rows |
| A tryout or camp obligation on this club | `DB` the only `TryoutSignup` obligations in the database belong to a Phase6 test tenant at $50, and there are no camp or house-league obligations anywhere. So the by-type row honestly shows one pill |
| A dollar figure in the demo card's bullets | Registry law: no volatile numbers in bullets |

---

## H. Composition choices, declared

| Choice | Why |
|---|---|
| The money desk stays DESKTOP | `OWNER` audit section D: the money table is an operator working surface, explicitly on the desktop side of the phone-first chart |
| The family's phone is real | The bell and the inbox are where a reminder actually lands, and `notifications-bell.tsx` renders on phones. The tab strip is the real parent bar: Home, Chat, Calendar, My Kids, Social |
| 4 of 8 open rows, and 1 while the plan is expanded | The scene box is 600 logical tall and never scrolls. Both states carry the true count: "and N more open, every one of them half paid" |
| The price list is a COMPOSITION | Those five prices live on five different product screens. Putting them on one panel is a composition, declared here; every price on it is a database row except the rep band, which is chipped as such |
| The cadence is a COMPOSITION | There is no "here is your reminder schedule" screen in the product. The rows are the code's own constants, and the panel names the file it read them from |
| Chapter titles are short | Long chip labels wrap the player's control row, which steals stage height and drops the render scale under 1.0. Measured: the first cut scaled to 0.96 and failed the 14px gate with 1,026 violations; shortening the five titles put it back to 1.000 |
| En dashes kept in "1–30", "31–60" | `PRODUCT` verbatim from the aging banner. The house rule bans em-dashes, and there are none |

---

## I. Gates, this cut

| Gate | Result |
|---|---|
| `scripts/demo/readability-audit.mjs --routes /demos/money-picture` | **0 violations**, minimum stage scale **1.000**, 23 beats, 28 scenes audited |
| Same, `--viewport 390x844 --floor 11 --scope stage` (keyhole) | **0 violations** |
| Same, `--viewport 390x844 --floor 14 --scope chrome` | **0 violations** |
| Full playback drive, 23 beats stepped twice plus a 2x autoplay pass | **0 console errors**, **0 page errors** |
| Chapter jumps | **5 of 5 exact**: beats 1, 6, 9, 13, 18 |
| Runtime at 1x | **2 min 6 sec** (`data-demo-runtime-ms` = 126140) |
| Scene overflow (any node past the composed box) | **0 px**, all 23 beats |
| 390x844 horizontal overflow | **0 px** |
| `tsc --noEmit` | clean |
| Em-dash sweep | clean |
| Database writes | **none**. The tiles were produced by running the product's own `merchantObligations` and `summarize` read-only |
