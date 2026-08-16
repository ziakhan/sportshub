"use client"

import type { ReactNode } from "react"
import {
  AskSheet,
  Btn,
  Chip,
  ConsoleTabs,
  Dialog,
  Finding,
  FilterRow,
  GymCard,
  Journey,
  Panel,
  PhoneEmpty,
  PhoneGame,
  PhoneMonth,
  PhoneNotice,
  PhoneScreen,
  Promises,
  RequestRow,
  SessionColumn,
  SimulateResult,
  StatusChip,
  StepRail,
  TeamRow,
  Tile,
  WeekendCard,
  WeekendGrid,
} from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * Story 3, rebuilt to the gold standard (2026-08-16).
 *
 * WHAT CHANGED, AND WHY. The 2026-08-15 cut ran a fictional 30-team league
 * through a mock browser window scaled to about 0.85, which put its 9 to 12px
 * labels on the viewer's screen at 8 to 10px, and it moved so fast that the
 * decisions went by unread. Three owner rulings answer that, and all three are
 * law here:
 *
 *   1. PRESENTATION (scenario audit D2). Scenes are focused working REGIONS
 *      composed at 1160 logical and rendered at scale 1.0. No fake browser
 *      chrome, no site header, one slim context strip. When the phone joins in
 *      the last chapter the desktop region is composed NARROWER rather than
 *      scaled down, and the phone arrives life size. The stage that does this
 *      is `SceneStage`; `scripts/demo/readability-audit.mjs` is the gate.
 *   2. PACING ("slow is the point"). Every beat is stop, explain, act: the
 *      cursor arrives, the balloon says WHY, it holds long enough to read
 *      (computed from its own word count), and only then does the screen move.
 *      When a beat carries a balloon the caption bar goes quiet, so the viewer
 *      is never read to twice.
 *   3. THE REAL LEAGUE. Every number comes from the seeded NPH Showcase League,
 *      the pitch run-sheet or an owner ruling, and every one of them is written
 *      down with its source in `docs/roadmap/season-story-numbers.md`. Nothing
 *      on screen is invented, including the refusal: 84 games against 80 slots
 *      is what the real auditor said on the real world.
 *
 * TWO OWNER REJECTIONS, ANSWERED (2026-08-16, second pass). Both were the
 * same failure: a beat borrowed from an OLD flow instead of the shipping one.
 *
 *   DEFECT 1, THE FEE. The first cut put a $987.50 deposit and three
 *   installments under the $3,950 team fee. `computeDefaultPlan`
 *   (`lib/payments/installments.ts`) belongs to the parent-to-club OFFER
 *   flow: its only callers are the offer accept path and the money story.
 *   The league team fee has no installments at all. What really happens is in
 *   `api/seasons/[id]/teams/[teamId]/route.ts`: approving a submission calls
 *   `ensureObligation` ONCE, for the whole fee, dated the season's balance
 *   rule. So this demo shows one obligation, its amount and its date, and
 *   stops there.
 *
 *   DEFECT 2, THE BUILDINGS. The first cut staged an August-1-era ledger of
 *   booked hours: one gym attached, five of six courts booked, more buildings
 *   bought later. That is not the model any more. Owner, verbatim: "The
 *   Burlington playground is their home court. We select a damn home court
 *   then we give you floater gyms and then you don't have to give the booking
 *   of those gyms. We just schedule them and tell you how many you need."
 *   That is exactly what `plan/gyms-weekends-step.tsx` and the board do, and
 *   the seeded season agrees: SeasonVenue has The Playground as `home` and
 *   Six Park East and Haber Recreation Centre in the `pool`. The buildings
 *   chapter is composed on that model now, and it ends on the product's own
 *   ask sheet, which states the hours.
 *
 * TRUTH TO THE PRODUCT. Screen by screen, this mirrors what shipped, and the
 * deviations are written down in the fidelity sheet rather than smuggled:
 *   · the console tab strip (Overview, Clubs, Teams, Plan Your Season,
 *     Schedule, Standings, Playoffs, Referees) and the Teams tab's REGISTERED
 *     TEAMS panel with its All / Pending / Approved / Rejected filters, its
 *     Any payment / Unpaid / Paid row and its APPROVED and PAID chips;
 *   · the team page's Entry fee line, "$3,950.00 · balance due <date> ·
 *     nothing received yet", which is what that panel renders and all it
 *     renders;
 *   · the plan wizard's five steps with their real hints, "When would you like
 *     to run sessions?" with its month-grouped weekend chips, "Courts left
 *     empty", the home-gym and in-the-pool cards with their own sentences, the
 *     optional "Already have dates booked here?" and its skip line;
 *   · the step 3 board with its session columns, its is/of fraction chips, its
 *     per-gym grade chips and the gold "assumed, not booked yet" mark a
 *     floater wears until somebody phones it;
 *   · "What you need to book", the ask sheet, in court-days and court-hours,
 *     month by month;
 *   · the Schedule tab's Plan, Divisions, Generate, Publish strip, "Preview
 *     whole season", "Commit whole season" and "Publish schedule · N new";
 *   · the auditor's own sentence from `lib/scheduler-v2/audit.ts`, finding
 *     `grade-does-not-fit`, with its three options in its own order. It was
 *     re-run against the recomposed weekend to be sure it still refuses, and
 *     that it stops refusing once the court is rented;
 *   · the schedule request row that `describeScheduleRequest` writes, and the
 *     Simulate cost panel with its six delta chips and its "none, everyone else
 *     is unaffected" verdict.
 *
 * WHAT IS DELIBERATELY NOT HERE. The run-sheet pitches a Scenarios button for
 * "distribute by venue". That API exists and returns exactly that card, but no
 * screen calls it yet, so this demo does not draw a scenarios panel it would
 * have to invent, and it does not stage a buy-two-more-buildings beat either:
 * the pool is there from the first screen, and the board's own placement is
 * what proves a grade lands in one building. Push notifications are not
 * claimed anywhere; the phone gets the in-app notice and the calendar
 * subscription, which is what works today.
 */

/* ── Cast, all real ──────────────────────────────────────────────────────── */

const LEAGUE = "NPH Showcase League"
const SEASON = "Fall/Winter 2026-27"
const CTX_TEAMS = `${LEAGUE} · ${SEASON} · Teams`
const CTX_TEAM = `${LEAGUE} · ${SEASON} · Teams · Royal Crown`
const CTX_PLAN = `${LEAGUE} · ${SEASON} · Plan your season`
const CTX_SCHEDULE = `${LEAGUE} · ${SEASON} · Schedule`
const CTX_REQUESTS = `${LEAGUE} · ${SEASON} · Teams · Schedule requests`

const FEE = "$3,950"
/** Season start (Nov 1 2026) less the balance rule's 14 days. One date, one
 *  obligation: the league team fee has no installment plan. */
const FEE_DUE = "Oct 18, 2026"

/**
 * The league's buildings, exactly as SeasonVenue holds them for this season:
 * one HOME gym the league owns, and a POOL of floaters it rents by the court
 * when a weekend needs the space. The pool is ranked, and the planner rents
 * from the top of the list first.
 */
const PLAYGROUND = { name: "The Playground", city: "Burlington", dot: "#16a34a" }
const SIX_PARK = { name: "Six Park East", city: "Oshawa", dot: "#a855f7" }
const HABER = { name: "Haber Recreation Centre", city: "Burlington", dot: "#2563eb" }

/** The 19 candidate weekends. 13 are on: the official calendar, Oct 24 to Feb 20. */
const WEEKEND_MONTHS = [
  { month: "Oct", weekends: [{ label: "10–11", on: false }, { label: "24–25", on: true }, { label: "31–1", on: true }] },
  { month: "Nov", weekends: [{ label: "7–8", on: false }, { label: "14–15", on: true }, { label: "21–22", on: true, id: "wk-nov21" }, { label: "28–29", on: true }] },
  { month: "Dec", weekends: [{ label: "5–6", on: true }, { label: "12–13", on: true }, { label: "19–20", on: false }] },
  { month: "Jan", weekends: [{ label: "9–10", on: true }, { label: "16–17", on: true }, { label: "23–24", on: true }, { label: "30–31", on: true }] },
  { month: "Feb", weekends: [{ label: "6–7", on: true }, { label: "13–14", on: true }, { label: "20–21", on: true }] },
  { month: "Finals", weekends: [{ label: "27–28", on: true }, { label: "Mar 6–7", on: true }, { label: "Mar 13–14", on: true }] },
]

/**
 * THE BOARD, on the current hosting model.
 *
 * The home gym fills FIRST, at full capacity, before anything is rented, and
 * what spills takes as few rented gyms as it can. The Playground runs three
 * courts, and at 8 slots a court a day over two days that is 48 games a
 * weekend; every grade above that line lands on a floater. A rented section
 * the draw took by itself reads ASSUMED until somebody phones the gym.
 *
 * Every fraction is the games placed over the slots held, and both sides are
 * arithmetic on the grade counts and the courts: see
 * `docs/roadmap/season-story-numbers.md` section D.
 */
const BOARD = [
  {
    session: "Session 1 · Oct",
    date: "Oct 24–25",
    fraction: "62/80",
    tone: "fits" as const,
    gyms: [
      { ...gym(PLAYGROUND, "3/3 courts"), grades: ["Gr 7 (12)", "Gr 11 (24)"] },
      { ...gym(SIX_PARK, "2/6 courts"), grades: ["Gr 12 (26)"], status: "assumed" as const },
    ],
  },
  {
    session: "Session 2 · Nov",
    date: "Nov 21–22",
    fraction: "84/80",
    tone: "over" as const,
    id: "board-nov21",
    gyms: [
      { ...gym(PLAYGROUND, "3/3 courts"), grades: ["Gr 8 (9)", "Gr 9 (25)", "Jr Girls (8)"] },
      { ...gym(SIX_PARK, "2/6 courts"), grades: ["Gr 10 (42)"] },
    ],
  },
  {
    session: "Session 3 · Dec",
    date: "Dec 5–6",
    fraction: "49/80",
    tone: "fits" as const,
    gyms: [
      { ...gym(PLAYGROUND, "3/3 courts"), grades: ["Gr 9 (25)"] },
      { ...gym(HABER, "2/6 courts"), grades: ["Gr 11 (24)"], status: "assumed" as const },
    ],
  },
  {
    session: "Session 4 · Jan",
    date: "Jan 9–10",
    fraction: "68/96",
    tone: "fits" as const,
    gyms: [
      { ...gym(PLAYGROUND, "3/3 courts"), grades: ["Gr 12 (26)"] },
      { ...gym(SIX_PARK, "3/6 courts"), grades: ["Gr 10 (42)"], status: "assumed" as const },
    ],
  },
  {
    session: "Session 5 · Feb",
    date: "Feb 6–7",
    fraction: "45/48",
    tone: "fits" as const,
    gyms: [
      {
        ...gym(PLAYGROUND, "3/3 courts"),
        grades: ["Gr 7 (12)", "Gr 9 (25)", "Jr Girls (8)"],
      },
    ],
  },
]

function gym(v: { name: string; dot: string }, courts: string) {
  return { gym: v.name, dot: v.dot, courts }
}

/**
 * WHAT YOU NEED TO BOOK, before the November court is added. Every row is
 * `courts x days x hours` the way `lib/scheduler/planner-core.ts` computes
 * `hoursNeeded`, over the rentals on the board above. February never leaves
 * the building the league owns, so it has no row.
 */
const ASK_SEASON = "18 court-days · 180 court-hours"
const ASK_MONTHS = [
  { label: "Oct 2026", courtDays: "4 court-days", courtHours: "40 court-hours", weekends: "1 weekend needing rent", chunks: "one weekend of 2 courts" },
  { label: "Nov 2026", courtDays: "4 court-days", courtHours: "40 court-hours", weekends: "1 weekend needing rent", chunks: "one weekend of 2 courts" },
  { label: "Dec 2026", courtDays: "4 court-days", courtHours: "40 court-hours", weekends: "1 weekend needing rent", chunks: "one weekend of 2 courts" },
  { label: "Jan 2027", courtDays: "6 court-days", courtHours: "60 court-hours", weekends: "1 weekend needing rent", chunks: "one weekend of 3 courts" },
]

/** The seven grades and their divisions, straight off the Schedule tab. */
const DIVISIONS = [
  { grade: "Grade 7", teams: 12, divisions: "1 division" },
  { grade: "Grade 8", teams: 9, divisions: "1 division" },
  { grade: "Grade 9", teams: 25, divisions: "Division A (13) · B (12)" },
  { grade: "Grade 10", teams: 42, divisions: "Division A to D" },
  { grade: "Grade 11", teams: 24, divisions: "Division A (12) · B (12)" },
  { grade: "Grade 12", teams: 26, divisions: "Division A (13) · B (13)" },
  { grade: "Junior Girls", teams: 8, divisions: "1 division" },
]

/**
 * The auditor's sentence, and it is not a paraphrase: `lib/scheduler-v2/audit.ts`
 * was run against this exact weekend (The Playground holding Grade 8, Grade 9
 * and Junior Girls, Grade 10 at Six Park East on a 2-court booking) and
 * returned finding `grade-does-not-fit` with arithmetic
 * `{demand: 42, supply: 32, short: 10}` and these three options in this order.
 * Renting a third court there clears it. The product's own em-dash is a middot
 * here, per the house copy rule.
 */
const FIT_MESSAGE =
  "Weekend of Nov 21 to 22 · Grade 10: 42 · 42 games need this gym, but the booking holds 32 (16 + 16 slots by day). Short by 10 games."
const FIT_OPTIONS = [
  "Add about 13 court-hours at this gym that weekend.",
  "Move a grade to a gym with more room that weekend.",
  "Lower the weekend target from 2 games per team to 1 in Planning.",
]

const PROMISES = [
  "No team plays two games with no rest between them, all season.",
  "Nobody waits five hours at a gym for their second game.",
  "A grade stays in one building on a weekend, so a family drives to one address.",
  "No court and no team is ever booked twice.",
]

/** The submitted roster. Fictional players by design: real rosters are minors. */
const ROSTER = [
  "J. Reyes #7",
  "A. Osei #4",
  "D. Mensah #12",
  "K. Tremblay #8",
  "M. Rahim #23",
  "T. Boateng #3",
  "L. Nguyen #15",
  "C. Okafor #21",
  "S. Dubois #5",
  "R. Patel #11",
  "N. Achebe #33",
  "B. Laurin #9",
]

const REQUEST_SENTENCE = "Games every Sunday start no later than 12:00"

/** Jordan's games, on the 75-minute slot grid inside the booked day. */
const HER_GAMES = [
  { day: "Sat 21", title: "vs Ottawa Elite", meta: "10:00 AM · Six Park East, Court 3" },
  { day: "Sun 22", title: "at City Above Elite", meta: "11:15 AM · Six Park East, Court 1" },
  { day: "Sat 28", title: "vs CE23 Academy", meta: "1:45 PM · Six Park East, Court 2" },
]
const HER_GAME_DAYS = [21, 22, 28, 29]

/* ── Pacing ──────────────────────────────────────────────────────────────── */

/**
 * Stop, explain, act (owner ruling 2026-08-16: "slow is the point").
 *
 * A beat's dwell is not a guess. The hand takes CURSOR_ARRIVE_MS to reach its
 * target and the balloon lands with it, so the beat has to hold for the travel,
 * plus long enough to READ the balloon at about 180ms a word with a 900ms
 * buffer for the eye to find it, plus a settle so the action does not fire on
 * the last syllable. A beat with nothing to read still holds long enough to see
 * what moved.
 */
function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 500
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 180 + 900 : 2400
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const seasonStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/manage/leagues/nph-showcase/seasons/fall-winter-2026-27/manage?tab=teams",
  context: CTX_TEAMS,
  initialStage: "desktop",
  chapters: [
    { id: "entries", title: "Teams come in" },
    { id: "calendar", title: "The buildings" },
    { id: "generate", title: "The commit that fails" },
    { id: "requests", title: "Two requests" },
    { id: "publish", title: "Publish once" },
  ],

  beats: [
    /* ── 1. Teams come in ─────────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "entries",
      caption:
        "NPH runs 146 teams across 82 clubs. Registration is open and 27 of them are in.",
      emphasize: "tile-teams",
      callout: "146 teams is the whole league. This is mid registration, not the end.",
      set: { screen: "teams" },
    }),
    paced({
      id: "pending",
      chapter: "entries",
      caption: "Three clubs are waiting on the league.",
      cursor: "filter-pending",
      press: true,
      callout: "Three entries are waiting on a decision. Everything else is answered.",
      set: { filter: "Pending (3)" },
    }),
    /* PRESS, THEN RESULT (2026-08-16). State is applied at the TOP of a beat,
       so a beat that both presses a control and sets the state removing that
       control sends the hand to something already gone, and a phone keyhole
       pans to nothing. Every press in this story therefore leaves its own
       state change, and the toast that confirms it, to the beat after it. That
       is also the order the viewer reads: press, then result. */
    paced({
      id: "open-team",
      chapter: "entries",
      caption: "Royal Crown has entered a Grade 10 team.",
      cursor: "team-royal",
      press: true,
      callout: "One team, one decision. The league approves each team on its own.",
    }),
    paced({
      id: "approve",
      chapter: "entries",
      caption: "The league approves it.",
      context: CTX_TEAM,
      cursor: "approve",
      press: true,
      callout: "Approving is when the team is really in, and when it owes money.",
      set: { screen: "team" },
    }),
    /* DEFECT 1, ANSWERED. Approving calls ensureObligation once, for the whole
       fee, dated by the league's balance rule. One line, and it is the line
       the real Entry fee panel renders. No deposit, no installments: that
       engine belongs to the parent-to-club offer flow. */
    paced({
      id: "fee",
      chapter: "entries",
      caption: `The entry fee appears: ${FEE}, balance due ${FEE_DUE}.`,
      emphasize: "fee-panel",
      toast: "Royal Crown approved · Grade 10 Boys, Division B",
      callout: `The ${FEE} obligation is raised by the approval itself. Nobody types an invoice.`,
      set: { approved: true, fee: true },
    }),
    paced({
      id: "promise",
      chapter: "entries",
      caption: "And what the club is buying: twelve games guaranteed.",
      emphasize: "promise",
      callout:
        "Twelve games guaranteed: ten regular season and two playoff. The schedule keeps it.",
      set: { promise: true },
    }),
    paced({
      id: "money",
      chapter: "entries",
      caption: "Back on the list, the league can see who has paid.",
      context: CTX_TEAMS,
      emphasize: "filter-pay",
      callout: "One row of chips answers who owes the league money, across every team.",
      set: { screen: "teams", pay: true },
    }),
    paced({
      id: "lock",
      chapter: "entries",
      caption: "Rosters lock when registration closes, and changes come to the league.",
      context: CTX_TEAMS,
      cursor: "lock-policy",
      press: true,
      callout: "Once rosters lock, changes arrive here as requests, not quiet swaps.",
      set: { screen: "teams", filter: "All (146)", lock: true },
    }),
    paced({
      id: "closed",
      chapter: "entries",
      caption: "Registration closes. 146 teams, 145 approved, one rejected.",
      emphasize: "tile-teams",
      callout: "146 teams, all of them known before a single game is drawn.",
      set: { closed: true },
    }),

    /* ── 2. The buildings ─────────────────────────────────────────────────
       DEFECT 2, ANSWERED. Owner: "We select a damn home court then we give
       you floater gyms and then you don't have to give the booking of those
       gyms. We just schedule them and tell you how many you need." That is
       the shape of this chapter, and every sentence in it is the shipping
       screen's own: the home-gym card, the in-the-pool card, the optional
       bookings control with its skip line, and the ask sheet at the end. */
    paced({
      id: "to-plan",
      chapter: "calendar",
      caption: "Now the buildings. This is the part every league does in a spreadsheet.",
      context: CTX_PLAN,
      set: { screen: "plan" },
      callout: "Five steps: teams, buildings, calendar, publish, schedule. This is buildings.",
      emphasize: "rail-2",
    }),
    paced({
      id: "weekends",
      chapter: "calendar",
      caption: "Thirteen session weekends, Oct 24 to Feb 20.",
      emphasize: "weekend-grid",
      callout:
        "Choosing a weekend books nothing. It tells the draw which ones to fill first.",
    }),
    paced({
      id: "home",
      chapter: "calendar",
      caption: "The home court comes first: The Playground, in Burlington.",
      cursor: "gym-home",
      hover: "gym-home",
      callout:
        "They own this one. Its games cost them nothing, so every weekend fills it before anything is rented.",
    }),
    paced({
      id: "floaters",
      chapter: "calendar",
      caption: "Then the floaters: Six Park East and Haber, in the pool.",
      emphasize: "gym-pool",
      callout:
        "A pool gym is rented by the court, only when a weekend needs the space. The planner rents from the top of this list first.",
      set: { pool: true },
    }),
    paced({
      id: "no-bookings",
      chapter: "calendar",
      caption: "And no, the league does not have to book them.",
      cursor: "gym-bookings",
      hover: "gym-bookings",
      callout:
        "One date is booked at Six Park East. For everything else the planner assumes what it needs and hands back a call list.",
      set: { skip: true },
    }),
    paced({
      id: "to-board",
      chapter: "calendar",
      caption: "Step three draws the calendar.",
      cursor: "rail-3",
      press: true,
      callout: "Step three puts every grade on a weekend and in a building.",
      set: { screen: "board" },
    }),
    paced({
      id: "board",
      chapter: "calendar",
      caption: "The home court fills first. What spills is rented, and marked as assumed.",
      emphasize: "board-nov21",
      callout:
        "Every weekend counts itself: games placed against slots held. One is already red.",
      set: { drawn: true },
    }),
    paced({
      id: "february",
      chapter: "calendar",
      caption: "February never leaves the building they own.",
      emphasize: "board-feb",
      callout: "45 games into 48 slots at their own gym. That weekend costs the league nothing.",
    }),
    paced({
      id: "ask",
      chapter: "calendar",
      caption: "And the system says what is left to book, in hours.",
      cursor: "ask-sheet",
      press: true,
      callout:
        "18 court-days, 180 court-hours, month by month. That is the sheet somebody reads down the phone.",
      set: { ask: true },
    }),

    /* ── 3. The commit that fails ─────────────────────────────────────── */
    paced({
      id: "to-schedule",
      chapter: "generate",
      caption: "The plan goes to the scheduler.",
      context: CTX_SCHEDULE,
      set: { screen: "schedule" },
      callout: "Plan and divisions are done. This builds the real schedule.",
      emphasize: "journey",
    }),
    paced({
      id: "preview",
      chapter: "generate",
      caption: "Preview the whole season.",
      cursor: "preview",
      press: true,
      callout: "One press builds all 730 games and checks every one of them.",
      set: { run: 1 },
    }),
    paced({
      id: "refuse",
      chapter: "generate",
      caption: "And it refuses.",
      emphasize: "finding",
      holdMs: 2400,
      callout:
        "It refuses, and it says why: the weekend, the grades, the arithmetic.",
      set: { fit: "block" },
    }),
    paced({
      id: "arithmetic",
      chapter: "generate",
      caption: "Grade 10 needs 42 games at Six Park East. The booking holds 32.",
      emphasize: "finding",
      callout:
        "The one date they had booked is two courts. Two courts over two days hold 32.",
    }),
    paced({
      id: "options",
      chapter: "generate",
      caption: "Three ways out, priced.",
      cursor: "fix-hours",
      hover: "fix-hours",
      callout: "Thirteen more court-hours. That is a phone call with a number in hand.",
    }),
    paced({
      id: "court6",
      chapter: "generate",
      caption: "So they rent a third court at Six Park East for that weekend.",
      cursor: "fix-hours",
      press: true,
      toast: "Third court rented at Six Park East · 48 slots that weekend",
      callout: "Nobody rents thirteen hours. They take the court, and it holds 48.",
      set: { court6: true },
    }),
    paced({
      id: "preview-2",
      chapter: "generate",
      caption: "Preview again.",
      cursor: "preview",
      press: true,
      callout: "Same press, same 730 games, and now nothing is left unplaced.",
      set: { run: 2, fit: "clear", promises: 0 },
    }),
    paced({
      id: "p1",
      chapter: "generate",
      caption: "No back-to-backs, all season.",
      set: { promises: 1 },
      hold: 2400,
    }),
    paced({
      id: "p2",
      chapter: "generate",
      caption: "No five-hour waits between a team's two games.",
      set: { promises: 2 },
      hold: 2400,
    }),
    paced({
      id: "p3",
      chapter: "generate",
      caption: "A grade stays in one building on a weekend.",
      set: { promises: 3 },
      hold: 2400,
    }),
    paced({
      id: "p4",
      chapter: "generate",
      caption: "And nothing is ever booked twice.",
      set: { promises: 4 },
      hold: 2600,
    }),
    /* The old journey's "distribute by venue" wow, told the way the product
       really tells it: no scenarios panel (no screen calls that API yet), just
       the board, where a grade sits in exactly one building on a weekend. */
    paced({
      id: "one-address",
      chapter: "generate",
      caption: "And on the board, every grade sits in one building that weekend.",
      context: CTX_PLAN,
      emphasize: "board-nov21",
      callout: "One grade, one address. A family drives to a gym, not to two.",
      /* `ask` is still on from chapter 2, and the ask sheet replaces the
         weekend grid this beat is ringing. Put the board back. */
      set: { screen: "board", court6: true, ask: false },
    }),

    /* ── 4. Two requests ──────────────────────────────────────────────── */
    paced({
      id: "requests",
      chapter: "requests",
      caption: "Clubs ask for things. Ottawa Elite asked to be done by noon on Sundays.",
      context: CTX_REQUESTS,
      set: { screen: "requests" },
      emphasize: "req-ottawa",
      callout: "Ottawa Elite drive home after Sunday's game. No start after noon.",
    }),
    paced({
      id: "honored",
      chapter: "requests",
      caption: "The schedule honored it, and the league can see that it did.",
      emphasize: "req-ottawa-note",
      callout: "Ten of ten games landed inside the window, and the league can see it.",
    }),
    paced({
      id: "pending-req",
      chapter: "requests",
      caption: "Dragons de Gatineau have asked for the same thing, and it is still pending.",
      cursor: "req-dragons",
      hover: "req-dragons",
      callout: "The same ask from Gatineau, still waiting. What does approving cost everyone else?",
    }),
    paced({
      id: "simulate",
      chapter: "requests",
      caption: "So the league simulates the cost before deciding.",
      cursor: "simulate",
      press: true,
      callout: "Simulate runs the season twice, with the request and without, and diffs them.",
      set: { sim: true },
    }),
    paced({
      id: "cost",
      chapter: "requests",
      caption: "Nothing. Nobody else moves.",
      emphasize: "sim-result",
      holdMs: 1600,
      callout: "Approving costs nobody anything: no back-to-backs, no two-gym days, no unplaced games.",
    }),
    paced({
      id: "approve-req",
      chapter: "requests",
      caption: "The league approves it.",
      /* The press cannot be shown here: approving replaces the Approve button
         with the honored line, and the next beat leaves this screen, so a
         deferred state change would never be seen. The beat rings the answer
         instead, which is what the caption is about. */
      emphasize: "req-dragons-note",
      toast: "Request approved · Dragons de Gatineau",
      callout: "Now the answer is a decision with arithmetic behind it, not a favour.",
      set: { reqApproved: true },
    }),

    /* ── 5. Publish once ──────────────────────────────────────────────── */
    paced({
      id: "commit",
      chapter: "publish",
      caption: "Committing saves the season. It does not release it.",
      context: CTX_SCHEDULE,
      cursor: "commit",
      press: true,
      callout: "Committing writes the games down. Clubs and families still see nothing.",
      set: { screen: "schedule", dialog: "commit" },
    }),
    paced({
      id: "commit-ok",
      chapter: "publish",
      caption: "730 games, saved as a draft.",
      cursor: "confirm-commit",
      press: true,
    }),
    paced({
      id: "draft",
      chapter: "publish",
      caption: "Draft. Visible only to the league, and regenerable as often as it likes.",
      emphasize: "draft-banner",
      toast: "Saved as a draft · 730 games",
      callout: "A draft can be rebuilt as often as the league wants.",
      set: { dialog: "", committed: true },
    }),
    paced({
      id: "phone-in",
      chapter: "publish",
      caption: "Which is exactly what Jordan's mother sees: a season that has not started.",
      stage: "split",
      emphasize: "phone-empty",
      callout: "Priya has the app. Her son's calendar is empty, because nothing is published yet.",
    }),
    paced({
      id: "publish",
      chapter: "publish",
      caption: "One press, once, when the league is ready.",
      cursor: "publish",
      press: true,
      callout: "The only irreversible press in the story, and the league chooses when.",
      set: { dialog: "publish" },
    }),
    paced({
      id: "publish-ok",
      chapter: "publish",
      caption: "730 games go live.",
      cursor: "confirm-publish",
      press: true,
    }),
    paced({
      id: "notice",
      chapter: "publish",
      caption: "Every club and family gets one notice, not 730.",
      emphasize: "phone-notice",
      toast: "Schedule published · 730 games are live",
      callout: "One notice each, pointing at their own team. Not one per game.",
      set: { dialog: "", published: true, notice: true },
    }),
    paced({
      id: "cal",
      chapter: "publish",
      caption: "Her son's calendar fills with the season.",
      emphasize: "phone-cal",
      callout: "Ten games, each with its gym and court. No PDF, no group chat.",
      set: { notice: false, calFilled: true, rows: true },
    }),
    paced({
      id: "ics",
      chapter: "publish",
      caption: "And it subscribes to her phone's own calendar.",
      cursor: "ics",
      press: true,
      callout:
        "One subscription, and every later change arrives in her phone's calendar too.",
      set: { ics: true },
    }),
    paced({
      id: "end",
      chapter: "publish",
      caption:
        "146 teams entered and billed, a home court that fills first, a refusal that named the weekend, and one publish.",
      hold: 5200,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get }) => {
    const screen = get<string>("screen", "teams")
    const dialog = get<string>("dialog", "")
    const closed = get("closed", false)
    const approved = get("approved", false)
    const committed = get("committed", false)
    const published = get("published", false)
    const fit = get<string>("fit", "")

    const desktop = (
      <div className="relative flex h-full flex-col">
        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {screen === "teams" && (
            <TeamsScreen
              closed={closed}
              approved={approved}
              filter={get<string>("filter", "All (146)")}
              lock={get("lock", false)}
              pay={get("pay", false)}
            />
          )}
          {screen === "team" && (
            <TeamScreen
              approved={approved}
              fee={get("fee", false)}
              promise={get("promise", false)}
            />
          )}
          {screen === "plan" && (
            <PlanScreen pool={get("pool", false)} skip={get("skip", false)} />
          )}
          {screen === "board" && (
            <BoardScreen court6={get("court6", false)} ask={get("ask", false)} />
          )}
          {screen === "schedule" && (
            <ScheduleScreen
              run={get("run", 0)}
              fit={fit}
              court6={get("court6", false)}
              promises={get("promises", 0)}
              committed={committed}
              published={published}
            />
          )}
          {screen === "requests" && (
            <RequestsScreen sim={get("sim", false)} approved={get("reqApproved", false)} />
          )}
        </div>

        <Dialog
          open={dialog === "commit"}
          title="Save the whole season's schedule?"
          subtitle="All existing unplayed games are replaced."
          footer={
            <>
              <Btn tone="quiet" size="sm">
                Cancel
              </Btn>
              <Btn id="confirm-commit" tone="court" size="sm">
                Commit whole season
              </Btn>
            </>
          }
        >
          <div className="border-gold-400 bg-gold-50 rounded-2xl border px-4 py-3">
            <p className="text-gold-600 text-[16px] font-bold">
              Saved as a draft. Clubs and families see nothing until you publish.
            </p>
            <p className="text-ink-700 mt-1 text-[15px]">
              730 games · 16 divisions · 82 clubs. Regenerate as often as you like until the day
              you publish.
            </p>
          </div>
        </Dialog>

        <Dialog
          open={dialog === "publish"}
          title="Publish the schedule?"
          subtitle="730 draft games go live."
          footer={
            <>
              <Btn tone="quiet" size="sm">
                Cancel
              </Btn>
              <Btn id="confirm-publish" size="sm">
                Publish
              </Btn>
            </>
          }
        >
          <div className="border-ink-200 rounded-2xl border px-4 py-3">
            <p className="text-ink-900 text-[16px] font-bold">
              Clubs and families get one notification pointing at their team calendar.
            </p>
            <p className="text-ink-600 mt-1 text-[15px]">
              Not one for each game. The league page, every club page, every team page and every
              family calendar read the same 730 games from this moment.
            </p>
          </div>
        </Dialog>

        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = (
      <div className="relative h-full">
        <PhoneScreen
          title="Jordan Reyes · Grade 10"
          subtitle="Royal Crown · Priya's family"
          tab="Calendar"
        >
          <CalendarScreen
            filled={get("calFilled", false)}
            rows={get("rows", false)}
            ics={get("ics", false)}
          />
        </PhoneScreen>
        {get("notice", false) && (
          <PhoneNotice
            id="phone-notice"
            title={`${LEAGUE}: the ${SEASON} schedule is out`}
            body="Grade 10 Boys, Division B has 10 games. Tap to see them on Jordan's calendar."
          />
        )}
      </div>
    )

    return { desktop, phone }
  },
}

/* ── Screens ─────────────────────────────────────────────────────────────── */

function Shell({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <>
      <ConsoleTabs active={tab} />
      <div className="bg-ink-50/70 min-h-0 flex-1 px-5 py-3.5">{children}</div>
    </>
  )
}

function TeamsScreen({
  closed,
  approved,
  filter,
  lock,
  pay,
}: {
  closed: boolean
  approved: boolean
  filter: string
  lock: boolean
  /** The real Teams tab's SECOND filter row: Any payment / Unpaid / Paid. */
  pay: boolean
}) {
  const rows: {
    club: string
    division: string
    status: "APPROVED" | "PENDING" | "REJECTED"
    payment?: "PAID" | "UNPAID"
    id?: string
  }[] = [
    {
      club: "Royal Crown",
      division: "Grade 10 Boys · Division B",
      status: approved ? "APPROVED" : "PENDING",
      payment: approved ? "UNPAID" : undefined,
      id: "team-royal",
    },
    { club: "Dragons de Gatineau", division: "Grade 11 Boys · Division A", status: "PENDING" },
    { club: "Burloak Elite", division: "Grade 9 Boys · Division A", status: "PENDING" },
    { club: "Ottawa Elite", division: "Grade 10 Boys · Division B", status: "APPROVED", payment: "PAID" },
  ]
  const shown = filter === "Pending (3)" ? rows.filter((r) => r.status === "PENDING") : rows

  return (
    <Shell tab="Teams">
      <div className="grid grid-cols-3 gap-3">
        <Tile
          id="tile-teams"
          label="Teams entered"
          value={closed ? "146 of 146" : "27 of 146"}
          note={closed ? "145 approved · 1 rejected" : "Registration is open"}
          tone="court"
        />
        <Tile label="Clubs in" value={closed ? "82" : "19 of 82"} note="Across the whole league" />
        <Tile
          label="Waiting on you"
          value={closed ? "0" : approved ? "2" : "3"}
          note="Entries to approve"
          tone="gold"
        />
      </div>

      <Panel
        title="Registered teams"
        className="mt-3"
        action={
          /* Both of the real tab's filter rows, kept on ONE line so turning
             the payment row on never grows the header and pushes the panel
             below out of the scene region. */
          <div className="flex items-center gap-2">
            <FilterRow
              id="filter-pending"
              items={
                closed
                  ? ["All (146)", "Pending (0)", "Approved (145)", "Rejected (1)"]
                  : ["All (146)", "Pending (3)", "Approved (24)", "Rejected (0)"]
              }
              active={filter}
            />
            {pay && (
              <>
                <span aria-hidden="true" className="bg-ink-200 h-5 w-px" />
                <FilterRow
                  id="filter-pay"
                  items={
                    closed
                      ? ["Any payment", "Unpaid (1)", "Paid (145)"]
                      : ["Any payment", "Unpaid (3)", "Paid (24)"]
                  }
                  active="Any payment"
                />
              </>
            )}
          </div>
        }
      >
        <div className="space-y-1.5 px-3 py-2.5">
          {shown.map((r) => (
            <TeamRow key={r.club + r.division} {...r} action={<Chip tone="neutral">Details</Chip>} />
          ))}
        </div>
      </Panel>

      {lock && (
        <Panel title="Roster changes" meta="After rosters lock" className="mt-3">
          <div className="flex items-center gap-2 px-4 py-3">
            <Btn id="lock-policy" tone="primary" size="sm">
              Changes need my approval
            </Btn>
            <Btn tone="quiet" size="sm">
              Clubs edit freely until a deadline
            </Btn>
            <Btn tone="quiet" size="sm">
              No changes at all
            </Btn>
          </div>
        </Panel>
      )}
    </Shell>
  )
}

function TeamScreen({
  approved,
  fee,
  promise,
}: {
  approved: boolean
  fee: boolean
  promise: boolean
}) {
  return (
    <Shell tab="Teams">
      <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-3">
        <Panel
          title="Royal Crown"
          meta="Grade 10 Boys · Division B"
          action={
            approved ? (
              <StatusChip tone="court">Approved</StatusChip>
            ) : (
              <span className="flex items-center gap-2">
                <Btn id="approve" tone="court" size="sm">
                  Approve
                </Btn>
                <Btn tone="quiet" size="sm">
                  Reject
                </Btn>
              </span>
            )
          }
        >
          <div className="space-y-2.5 px-4 py-3">
            <Row label="Club" value="Royal Crown · Toronto" />
            <Row label="Roster submitted" value="12 players · locked on close" />
            <Row label="Club agreement" value="Signed by Marcus Dwyer, 12 August" />
            <Row
              label="Weekend preference"
              value="One trip: both weekend games on the same day"
            />
            {/* The submitted roster with its per-player waiver status, which is
                what the real submission page shows under the entry details. */}
            <div>
              <p className="text-ink-500 mb-1.5 text-[14px] font-bold uppercase tracking-[0.06em]">
                Submitted roster
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {ROSTER.map((p) => (
                  <span
                    key={p}
                    className="border-ink-200 flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 text-[14px] font-semibold"
                  >
                    <span aria-hidden="true" className="bg-court-500 h-2 w-2 shrink-0 rounded-full" />
                    <span className="text-ink-800 truncate">{p}</span>
                  </span>
                ))}
              </div>
              <p className="text-ink-500 mt-1.5 text-[14px] font-medium">
                12 of 12 waivers signed
              </p>
            </div>
            {promise && (
              <div
                data-demo-target="promise"
                className="border-court-200 bg-court-50 live-pop rounded-2xl border px-4 py-2.5"
              >
                <p className="text-court-800 text-[16px] font-bold">
                  12 games guaranteed: 10 regular season + minimum 2 playoff
                </p>
                <p className="text-ink-700 mt-0.5 text-[15px]">
                  The promise every club is sold.
                </p>
              </div>
            )}
          </div>
        </Panel>

        {/* THE ENTRY FEE PANEL, AND ALL OF IT. The real page renders
            `money(feeAmount)`, then "· balance due <date>", then either the
            payments received or "· nothing received yet". One obligation, no
            plan: `ensureObligation` is called once, for the whole fee, when
            the submission is approved. */}
        <Panel title="Entry fee" meta={approved ? "Owing" : "On approval"}>
          {fee ? (
            <div data-demo-target="fee-panel" className="live-pop space-y-2.5 px-4 py-3">
              <p className="text-ink-900 text-[20px] font-extrabold">
                {FEE}.00 <span className="text-ink-500 text-[15px] font-semibold">CAD</span>
              </p>
              <p className="text-ink-600 text-[15px] font-medium">
                Balance due {FEE_DUE} · nothing received yet
              </p>
              <p className="text-ink-500 border-ink-100 border-t pt-2 text-[14px] font-medium leading-snug">
                Raised on approval, owed by the club to the league. The balance date is the
                league&apos;s own rule: 14 days before the season starts.
              </p>
              <StatusChip tone="gold">Unpaid</StatusChip>
            </div>
          ) : (
            <p className="text-ink-500 px-4 py-4 text-[15px]">
              The fee is raised the moment the league approves the team.
            </p>
          )}
        </Panel>
      </div>
    </Shell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink-100 flex items-baseline justify-between gap-4 border-b pb-2 last:border-b-0">
      <span className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.06em]">{label}</span>
      <span className="text-ink-900 text-[15px] font-semibold">{value}</span>
    </div>
  )
}

/**
 * STEP 2, YOUR BUILDINGS, on the current model: one home gym, a ranked pool of
 * floaters under it, and the optional bookings control. The head sentence is
 * the real screen's own.
 */
function PlanScreen({ pool, skip }: { pool: boolean; skip: boolean }) {
  return (
    <div className="bg-ink-50/70 flex min-h-0 flex-1 flex-col gap-3 px-5 py-3.5">
      <StepRail step={2} />
      <Panel title="When would you like to run sessions?" meta="13 of 19 weekends on">
        <div className="px-4 py-3">
          <WeekendGrid id="weekend-grid" months={WEEKEND_MONTHS} />
        </div>
      </Panel>
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-3">
        <div className="space-y-2">
          <GymCard
            id="gym-home"
            name={PLAYGROUND.name}
            city={PLAYGROUND.city}
            courts="3 courts"
            hours="Available 10:00 to 22:00, the same hours every weekend"
            home
          />
          {pool && (
            <div data-demo-target="gym-pool" className="space-y-2">
              <GymCard
                id="gym-bookings"
                name={SIX_PARK.name}
                city={SIX_PARK.city}
                courts="6 courts"
                hours="Available 10:00 to 22:00, the same hours every weekend"
                rank={1}
                bookings
                bookingsCount={1}
                skip={skip ? "No bookings yet? Fine. The planner will assume what it needs and give you a call list." : undefined}
                fresh
              />
              <GymCard
                name={HABER.name}
                city={HABER.city}
                courts="6 courts"
                hours="Available 10:00 to 22:00, the same hours every weekend"
                rank={2}
                bookings
                fresh
              />
            </div>
          )}
          <Btn id="add-gym" tone="quiet" size="sm">
            + Add a gym
          </Btn>
        </div>
        <div
          data-demo-target="courts-empty"
          className="border-ink-200 rounded-2xl border bg-white px-4 py-3"
        >
          <p className="text-ink-900 text-[15px] font-bold">Courts left empty: 0</p>
          <p className="text-ink-600 mt-1 text-[14px] font-medium leading-snug">
            At every gym, every day. Games run long and teams turn up late, so a court held back is
            a court you still have. Zero plans to the whole building.
          </p>
          <p className="text-ink-500 border-ink-100 mt-2 border-t pt-2 text-[14px] font-medium leading-snug">
            The home gym fills first, at full capacity, before anything is rented.
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Step 3. Two views, and both are the real screen's: BOARD, the five session
 * columns, and STRIP, the compact row-per-weekend the header toggles to. The
 * ask sheet is read on the strip, because on the real screen it lives in the
 * "What is left" rail and the rail takes the room the board columns want.
 */
function BoardScreen({ court6, ask }: { court6: boolean; ask: boolean }) {
  return (
    <div className="bg-ink-50/70 flex min-h-0 flex-1 flex-col gap-2.5 px-5 py-3">
      <StepRail step={3} />
      <div className="flex items-center gap-2.5">
        <div className="shrink-0">
          <p className="text-ink-900 text-[17px] font-extrabold leading-tight">Your calendar</p>
          <p className="text-ink-500 whitespace-nowrap text-[14px] font-semibold">
            Drag a grade to move it · math updates live
          </p>
        </div>
        <span data-demo-target="math-line" className="ml-auto flex shrink-0 items-center gap-2">
          <Chip tone="neutral" strong>
            146 teams · 730 games
          </Chip>
          {court6 ? (
            <Chip tone="court" strong>
              Every weekend fits
            </Chip>
          ) : (
            <Chip tone="gold" strong>
              1 weekend tight
            </Chip>
          )}
        </span>
        <span className="border-ink-200 flex shrink-0 overflow-hidden rounded-lg border bg-white text-[14px] font-bold">
          <span className={ask ? "text-ink-500 px-2.5 py-1" : "bg-court-600 px-2.5 py-1 text-white"}>
            Board
          </span>
          <span className={ask ? "bg-court-600 px-2.5 py-1 text-white" : "text-ink-500 px-2.5 py-1"}>
            Strip
          </span>
        </span>
        <Btn tone="primary" size="sm">
          Use this calendar and generate the schedule
        </Btn>
      </div>

      {ask ? (
        <>
          <div className="border-ink-200 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-white px-3.5 py-2">
            <span className="text-ink-900 text-[15px] font-bold">4 rental blocks</span>
            <span className="text-ink-500 text-[14px] font-medium">
              behind this calendar. Every rental has a building.
            </span>
            <span className="text-ink-600 ml-auto text-[14px] font-semibold">
              {BOARD.map((c) => `${c.date} ${c.fraction}`).join("  ·  ")}
            </span>
          </div>
          <AskSheet id="ask-sheet" season={ASK_SEASON} months={ASK_MONTHS} />
        </>
      ) : (
        <div className="grid min-h-0 grid-cols-5 gap-2">
          {BOARD.map((c) => {
            const fixed = court6 && c.tone === "over"
            return (
              <SessionColumn key={c.session} title={c.session}>
                <WeekendCard
                  id={c.id ?? (c.date === "Feb 6–7" ? "board-feb" : undefined)}
                  date={c.date}
                  fraction={fixed ? "84/96" : c.fraction}
                  tone={fixed ? "fits" : c.tone}
                  gyms={c.gyms.map((g) =>
                    fixed && g.courts === "2/6 courts" ? { ...g, courts: "3/6 courts" } : g
                  )}
                />
              </SessionColumn>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ScheduleScreen({
  run,
  fit,
  court6,
  promises,
  committed,
  published,
}: {
  run: number
  fit: string
  court6: boolean
  promises: number
  committed: boolean
  published: boolean
}) {
  if (committed) {
    return (
      <Shell tab="Schedule">
        <div
          data-demo-target="draft-banner"
          className={`rounded-2xl border px-4 py-3 ${
            published ? "border-court-300 bg-court-50" : "border-gold-400 bg-gold-50"
          }`}
        >
          <p
            className={`text-[17px] font-bold ${published ? "text-court-800" : "text-gold-600"}`}
          >
            {published
              ? "730 games are live. Every club and family was notified once."
              : "730 draft games. Visible only to you until you publish."}
          </p>
          <p className="text-ink-700 mt-1 text-[15px]">
            {published
              ? "The league page, every club page, every team page and every family calendar read the same games."
              : "Review below, regenerate freely, then publish once."}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {published ? (
            <Chip tone="court" strong>
              Published
            </Chip>
          ) : (
            <Btn id="publish" size="sm">
              Publish schedule · 730 new
            </Btn>
          )}
          <span className="text-ink-500 text-[14px] font-semibold">
            Showing 4 of 730 games · Nov 21 to 22
          </span>
        </div>
        <div className="mt-2.5 space-y-1.5">
          {[
            /* The four rows sit where the board put their grades that weekend:
               Grade 10 at the rented gym, Grade 9 and Junior Girls at home. */
            ["Sat Nov 21 · 10:00 AM", "Grade 10 Boys · Division B", "Royal Crown vs Ottawa Elite", "Six Park East, Court 3"],
            ["Sat Nov 21 · 11:15 AM", "Grade 9 Boys · Division A", "Burloak Elite vs CE23 Academy", "The Playground, Court 2"],
            ["Sun Nov 22 · 10:00 AM", "Junior Girls", "CE23 Academy vs HoopHer", "The Playground, Court 1"],
            ["Sun Nov 22 · 11:15 AM", "Grade 10 Boys · Division B", "Royal Crown at City Above Elite", "Six Park East, Court 1"],
          ].map(([when, division, teams, venue]) => (
            <div
              key={when + teams}
              className="border-ink-200 flex items-center gap-3 rounded-xl border bg-white px-3.5 py-2"
            >
              <span className="text-ink-900 w-[190px] shrink-0 text-[15px] font-bold">{when}</span>
              <span className="min-w-0 flex-1">
                <span className="text-ink-900 block truncate text-[15px] font-semibold">{teams}</span>
                <span className="text-ink-500 block truncate text-[14px] font-medium">
                  {division} · {venue}
                </span>
              </span>
              <StatusChip tone={published ? "court" : "gold"}>
                {published ? "Live" : "Draft"}
              </StatusChip>
            </div>
          ))}
        </div>
      </Shell>
    )
  }

  return (
    <Shell tab="Schedule">
      <div className="flex items-center gap-3">
        <span data-demo-target="journey">
          <Journey at={run > 0 ? 2 : 1} />
        </span>
        <span className="text-ink-500 ml-auto text-[14px] font-semibold">
          Built on plan {SEASON} v3 · change
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[320px_minmax(0,1fr)] gap-3">
        <Panel title="Divisions" meta="16">
          <div className="px-3 py-2">
            {DIVISIONS.map((d) => (
              <div key={d.grade} className="border-ink-100 flex items-center gap-2 border-b py-1.5 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="text-ink-900 block text-[15px] font-bold">{d.grade}</span>
                  <span className="text-ink-500 block truncate text-[14px] font-medium">
                    {d.divisions}
                  </span>
                </span>
                <Chip tone="neutral">{d.teams} teams</Chip>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Btn id="preview" size="sm">
              Preview whole season
            </Btn>
            {fit === "clear" && (
              <Btn id="commit" tone="court" size="sm">
                Commit whole season
              </Btn>
            )}
            {court6 && (
              <Chip tone="court" strong>
                Third court rented at Six Park East · 48 slots on Nov 21 to 22
              </Chip>
            )}
          </div>

          {run === 0 && (
            <div className="border-play-200 bg-play-50 rounded-2xl border px-4 py-3">
              <p className="text-ink-900 text-[16px] font-bold">
                You are about to build the real schedule.
              </p>
              <p className="text-ink-700 mt-1 text-[15px] leading-snug">
                Registration is closed and the team counts are final. You can change divisions and
                regenerate freely until you publish.
              </p>
            </div>
          )}

          {fit === "block" && (
            <Finding
              id="finding"
              severity="block"
              title="Grade 10 does not fit at Six Park East that weekend"
              message={FIT_MESSAGE}
              options={FIT_OPTIONS}
              optionId="fix-hours"
            />
          )}

          {fit === "clear" && (
            <>
              <Finding
                id="finding"
                severity="clear"
                title="Preview: 730 games · 0 unscheduled"
                message="Every rule held: rest days, rematch spacing, court rotation, weekend preferences. Every weekend is inside the gym time this plan holds."
              />
              <Panel title="What the schedule promises" meta="Every team, all season">
                <Promises items={PROMISES} shown={promises} />
              </Panel>
            </>
          )}
        </div>
      </div>
    </Shell>
  )
}

function RequestsScreen({ sim, approved }: { sim: boolean; approved: boolean }) {
  return (
    <Shell tab="Teams">
      <Panel title="Schedule requests" meta="League approved, best effort">
        <div className="space-y-2.5 px-4 py-3">
          <RequestRow
            id="req-ottawa"
            team="Ottawa Elite"
            division="Grade 10 Boys · Division B"
            sentence={REQUEST_SENTENCE}
            status="APPROVED"
            requester="Andre Belliveau"
            reason="We drive back to Ottawa the same day"
          >
            <p
              data-demo-target="req-ottawa-note"
              className="border-court-200 bg-white text-court-800 rounded-xl border px-3 py-2 text-[15px] font-semibold"
            >
              Honored: 10 of 10 Sunday games start before noon.
            </p>
          </RequestRow>

          <RequestRow
            id="req-dragons"
            team="Dragons de Gatineau"
            division="Grade 11 Boys · Division A"
            sentence={REQUEST_SENTENCE}
            status={approved ? "APPROVED" : "PENDING"}
            requester="Isabelle Fortin"
            reason="Same drive, other direction"
          >
            {approved ? (
              <p
                data-demo-target="req-dragons-note"
                className="border-court-200 bg-white text-court-800 live-pop rounded-xl border px-3 py-2 text-[15px] font-semibold"
              >
                Honored: 10 of 10 Sunday games start before noon. Nobody else moved.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Btn id="simulate" tone="quiet" size="sm">
                    Simulate cost
                  </Btn>
                  <Btn id="approve-req" tone="court" size="sm">
                    Approve
                  </Btn>
                  <Btn tone="quiet" size="sm">
                    Decline
                  </Btn>
                </div>
                {sim && (
                  <span data-demo-target="sim-result" className="block">
                    <SimulateResult team="Dragons de Gatineau" ok={10} total={10} />
                  </span>
                )}
              </div>
            )}
          </RequestRow>
        </div>
      </Panel>
    </Shell>
  )
}

/* ── Phone ───────────────────────────────────────────────────────────────── */

function CalendarScreen({
  filled,
  rows,
  ics,
}: {
  filled: boolean
  rows: boolean
  ics: boolean
}) {
  return (
    <div data-demo-target="phone-cal" className="space-y-2">
      <PhoneMonth month="November 2026" days={HER_GAME_DAYS} filled={filled} />
      {filled ? (
        <>
          <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.08em]">
            Grade 10 Boys · 10 games
          </p>
          {(rows ? HER_GAMES.slice(0, 2) : HER_GAMES.slice(0, 1)).map((g, i) => (
            <PhoneGame key={g.day} {...g} fresh delay={i * 110} />
          ))}
          <div
            data-demo-target="ics"
            className={`rounded-2xl border px-3 py-2.5 ${
              ics ? "border-court-300 bg-court-50" : "border-ink-200 bg-white"
            }`}
          >
            <p className="text-ink-900 text-[15px] font-bold">
              {ics ? "Subscribed" : "Add to your phone's calendar"}
            </p>
            <p className="text-ink-600 mt-0.5 text-[14px] font-medium leading-snug">
              {ics
                ? "Every game is in her phone calendar automatically, and changes follow."
                : "Subscribe once and the season appears beside everything else in her week."}
            </p>
          </div>
        </>
      ) : (
        <div data-demo-target="phone-empty">
          <PhoneEmpty
            title="Nothing scheduled yet"
            body={`${LEAGUE} posts the ${SEASON} schedule once it is set. You will get one notification.`}
          />
        </div>
      )}
    </div>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1628] px-12 text-white">
      <div className="live-pop max-w-[760px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          Story 3 of 10
        </p>
        <h3 className="font-display mt-2 text-[34px] font-extrabold leading-tight">
          A season, planned to published
        </h3>
        <p className="mt-3 text-[17px] leading-relaxed text-white/75">
          146 teams entered and billed, a refusal that named the weekend and the four grades, a
          sixth court that fixed it, three buildings so no family drives to one city every weekend,
          and one publish that filled every calendar.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">
          Next: game day, both sides at once
        </p>
      </div>
    </div>
  )
}
