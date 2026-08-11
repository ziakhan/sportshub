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

### K-004 · Program schedules: Date and Time are separate fields; Time is a start–finish range (no duration dropdown) · UI · Tested — good
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
- **Status notes:** ported 2026-08-11; type-check clean. Polish round iterated
  live with me same day: panel widened 288→316px so hour/minute boxes clear
  their chevrons, time-button icon spacing fixed, footer readout renamed
  "Lasts" → "Duration" (my wording call). Signed off: perfect.

### K-005 · Onboarding is unskippable: direct navigation can no longer bypass the wizard · FIX · Built (local)
- **What/why:** The role/handle/profile wizard fires right after signup on the
  designed paths (signup form → /onboarding; SSO → /post-login → 307). But
  E2E-testing a fresh account proved DIRECT navigation skipped it: a role-less,
  un-onboarded account could open /dashboard, /calendar, /feed, /messages and
  browse a bare app. The project docs describe a dashboard-layout onboarding
  guard — it no longer existed on current master (regression).
- **Where in the app:** new `lib/onboarding/guard.ts` (`requireOnboarded()` —
  DB-checked so completing onboarding takes effect instantly; PlatformAdmin
  exempt) applied to the dashboard layout + calendar, feed, and messages pages.
  Deliberately NOT in the platform layout (it wraps /onboarding — would loop).
- **Verified:** fresh-signup E2E before: /dashboard + /calendar rendered 200 for
  a role-less account. After: both 307 → /onboarding. /post-login funnel
  unchanged.
- **Context:** investigated after my "onboarding should be richer" suggestion —
  the 3-step wizard + /welcome checklist already exist on this build (role
  cards, handle pick, per-role profile, role-aware setup checklist), so the
  real gap was enforcement, not content.
- **Status notes:** built + E2E-verified 2026-08-11; type-check clean.

### K-006 · Add-a-player: inline "give them their own login" invite for 13+ kids · FEATURE · Built (local)
- **What/why:** The child-login email invite existed (family-invitations API,
  accept page, signup hook) but only on the kid's profile page — invisible at
  the moment a parent adds the kid. Now the "Player Added!" success screen
  offers it inline when the new player is 13+: enter their email → invite
  sent. Under-13 never sees it (COPPA — they stay parent-managed; and the
  child record itself still requires name + DOB from the parent, which is why
  "add purely by email" is not a thing).
- **Where:** `players/add/page.tsx` success card. Existing API, no backend.

### K-007 · Onboarding: handle merged into the profile step (3 steps → 2) and made REQUIRED · UI · Built (local)
- **What/why:** The @handle screen was prefilled and skippable — a field's
  profile, not a step's. Merged into "Complete your profile" as an input at
  the top. Then upgraded per my ruling: the handle is REQUIRED — empty or
  unavailable handles block submission with a clear error, saved before the
  role is created. Wizard is now: Who are you? → Your info.
- **OWNER-RULING FLAG:** QA-209 documented the handle as never-blocking;
  making it required amends that rule — owner sign-off needed when shared.
- **Where:** `onboarding/onboarding-flow.tsx` (HandleStep removed, required
  HandleField embedded, save-then-create ordering, back-targets rewired).

### K-008 · Onboarding: 13+ players invite their parent via an email field ON the profile step · FEATURE · Built (local)
- **What/why:** Discoverability — a teen shouldn't have to discover later that
  a parent link exists ("get it done with it"). The Player profile step (step
  2) now carries an optional "Parent or guardian's email" field; the invite
  fires automatically right after the profile saves (the Player record must
  exist first — that's why it sends post-save under the hood). Happy path adds
  ZERO screens; a failed send opens a recovery screen with retry/skip. Uses
  the existing GUARDIAN invite API; deep links preserved.
- **OWNER-RULING FLAG:** the standing rule says parent↔child linking is
  event-driven, not at onboarding. This is the player-initiated direction
  surfaced early, always optional — but it amends the documented rule, so it
  needs the owner's sign-off when this branch is shared.
- **Where:** `onboarding-flow.tsx` new "family" step, Player role only.

<!-- Add changes below. Next ID: K-009 -->
