# Kai's Features — Branch Worklog (started 2026-08-11)

> Working doc for the `kais-features` branch: my own changes to the website —
> bug fixes and new features — built and tested locally before anything is
> shared. Base: `origin/master` @ `88a2d241` (latest as of 2026-08-11).
>
> **Branch rules:**
> - All work happens on `kais-features`, committed locally.
> - Nothing is pushed anywhere until I (Kai) explicitly say so — pushing to
>   main/master especially requires my go-ahead every single time.
> - Each item gets built → tested on localhost → marked Good here → THEN we
>   talk about sharing.
> - **HANDS OFF THE SCHEDULING PORTION.** No changes on this branch to the
>   scheduling area — the developers are actively rebuilding it. Off-limits:
>   the Plan Your Season wizard (`…/seasons/[seasonId]/plan/**`), the season
>   console's schedule/scheduling/sessions tabs, the scheduler engine
>   (`apps/web/src/lib/scheduler/**`), scheduling/plan/capacity APIs
>   (`api/seasons/[id]/schedule*`, plans, bookings), and the new
>   divisions-at-scheduling / playoffs machinery. If a K-item would need to
>   touch any of these, it stops at Planned and gets flagged instead.

## How entries work

Each change gets a `K-###` number, a type, and a status that moves through:
`Planned` → `Built (local)` → `Tested — good` → `Shared` (only after my say-so).

- **Type:** `FIX` (bug I'm fixing) · `FEATURE` (new functionality) · `UI` (design/layout change)

Template:

```
### K-0XX · <one-line title> · FIX|FEATURE|UI · Planned
- **What/why:**
- **Where in the app:**
- **How it should work when done:**
- **Status notes:** (build date, test results, follow-ups)
```

---

## Changes

### K-001 · Referee booking: show each ref's rate, prefill the offer, warn on lowball · UI · Built (local)
- **What/why:** Leagues set the per-game rate on every shift offer (platform's
  chosen model — correct), but the booking form was blind to the ref's own
  advertised standard rate: no display, no prefill, no signal when offering
  below it. Rates mismatched by accident, not intent. (Counter-offer flow was
  considered and rejected as too much back-and-forth for a ~$135 transaction;
  a decline-with-note may follow as K-002 if needed.)
- **Where in the app:** League season console → Referees tab (booking form +
  pool list). One file: `manage/components/referees-tab.tsx`. UI-only — the
  API already returned each ref's `fee`; the client just never used it.
  No schema, no API, no scheduling-portion changes.
- **How it works when done:**
  1. Pool list + "Send to" dropdown show each ref's rate ("· $50/game").
  2. Picking a targeted ref prefills the $/game field with their standard
     rate — but never overwrites a number the operator typed themselves.
  3. Offering below the target's standard rate shows a warning line
     ("Mike's standard rate is $50/game — your offer is below it") — allowed,
     but done knowingly.
- **Status notes:** built 2026-08-11; type-check pending; awaiting my local
  test on the Referees tab before marking Tested — good.

### K-002 · Capitalization sweep: no standalone lowercase labels · UI · Built (local)
- **What/why:** Lowercase words rendering as standalone labels look unfinished
  (my T-009 finding, now implemented locally where allowed). Audit result:
  the design system already handles most of it — Badge pills render ALL-CAPS
  by CSS, and mid-sentence lowercase ("Offer pending") is correct sentence
  case — so the real offenders were a handful of hand-rolled spots.
- **Where in the app (all outside the scheduling fence):**
  1. Team status pills on browse-leagues, browse-tournaments, and the club's
     tournament manage page — "approved"/"pending" now render "Approved"/
     "Pending" (CSS `capitalize` on the pill).
  2. Tryout check-in list — "• male" → "• Male".
  3. Admin audit trail — action chips/labels "referee assign" → "Referee assign"
     (filter chips + table rows).
  4. Admin SEO panel — entity counters "game recap: 5" → "Game recap: 5".
- **Deliberately NOT touched:** the planner/scheduling screens' lowercase
  ("not planned", "home gym", "backup") — inside the no-touch fence; already
  filed for the developers as T-009.
- **Status notes:** built 2026-08-11; type-check clean; awaiting my local test.

### K-003 · Team suffix: "Custom…" free text instead of preset-only chips · UI · Built (local)
- **What/why:** When a club fields multiple teams in one age group, the suffix
  picker offered only preset filler chips (Blue/White/Black/Red/Gold/Green/2/3).
  Clubs name teams their own way — the operator should be able to type their
  own suffix. (The API always accepted any suffix ≤20 chars; only the chip UI
  restricted it — so this is UI-only.)
- **Where in the app:** Club → Teams → Create team, and the team Edit page.
- **How it works when done:** the preset chips stay (fast path), plus a
  "Custom…" chip that opens a free-text input (max 20 chars) feeding the same
  live team-name preview. A team loaded in Edit whose suffix isn't a preset
  opens in custom mode automatically, so nothing existing breaks.
- **Status notes:** built 2026-08-11; type-check clean; awaiting my local test.

### K-004 · Program schedules: Date and Time are separate fields; Time is a start–finish range (no duration dropdown) · UI · Built (local)
- **What/why:** The combined date+time button hides the time selector below the
  calendar — easy to miss, easy to forget the time entirely. And duration as a
  separate concept is unnecessary: picking a start and finish time says it all.
- **Where in the app:** Tryout create + edit, training program form (one-time
  AND weekly recurring), team calendar add-event + practice reschedule. Camps,
  house leagues, tournaments, and team practice slots already had split
  date/time fields — with this, NO combined date+time button remains outside
  the scheduling fence.
- **How it works:** "Date" opens just a calendar and closes on pick. "Time" is
  one button reading like "6:00 – 7:30 PM" — a panel with Starts and Ends rows
  (12-hour, AM/PM); how long it lasts is derived and shown as a hint ("Lasts
  1 hr 30 min"), never asked as its own dropdown. Saves the same data the
  APIs always stored (start + minutes) — no server changes.
- **Provenance:** designed and built on my earlier practice branch (Aug 4,
  P-001 in `tester-change-proposals-2026-08-04.md`); ported here unchanged —
  the base files hadn't drifted in 224 commits. The league schedule quick-add
  from the original work was deliberately NOT ported (scheduling fence; the
  developers rewrote that area).
- **Status notes:** ported 2026-08-11; type-check clean; awaiting my local test.

<!-- Add changes below. Next ID: K-005 -->
