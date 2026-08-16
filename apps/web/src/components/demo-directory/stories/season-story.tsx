"use client"

import type { ReactNode } from "react"
import {
  Btn,
  Chip,
  ConsoleTabs,
  CrossPlay,
  Dialog,
  DivisionsBoard,
  FairnessTable,
  FilterRow,
  FridayChoice,
  Grip,
  GymCard,
  GymMenu,
  GymTray,
  NotPlanned,
  Panel,
  PhoneNotice,
  PhoneScreen,
  RequestRow,
  SessionColumn,
  SimulateResult,
  StatusChip,
  StepRail,
  TeamRow,
  Tile,
  WeekendCard,
  WeekendGrid,
  WorkRail,
} from "../scene-kit"
import type { BoardGym } from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * Story 3, rebuilt from the owner's live feedback session (2026-08-16).
 *
 * WHAT THE OWNER WATCHED, AND WHAT HE RULED. He drove the previous cut beat by
 * beat and gave 31 rulings. The five that reshaped the story:
 *
 *   1. THE BOARD IS THE DEMO. Not a screen the story passes through: the heart
 *      of it. So the board here is drawn from the real capture
 *      (`gold-standard/real2/s3-board.png`) rather than sketched: the gym tray
 *      with its six-dot grips, the HIGHLIGHT row, "Not planned" weekends, the
 *      fraction chips in games, the Move button and the ⋯ menu on every gym
 *      section, and the right-hand suggestions drawer. The three moments that
 *      get the screen time are the drawer, the tight-gym adjustment and the
 *      drag.
 *   2. NO AMBUSH. The old cut walked to the Schedule tab and let the commit
 *      FAIL as a surprise. That chapter is gone. The tension lives where a
 *      league really meets it, on the board: one weekend was booked one court
 *      short, the board says so in amber, and the fix happens there.
 *   3. THE REAL CLICK PATH. Teams tab, submission page, plan step 2, divisions,
 *      the board, the requests panel, publish. Scenes the owner did not
 *      recognize are deleted: the court-summaries screen, the 13-court-hours
 *      suggestion panel and the rented-at-Six-Park screen.
 *   4. REGISTRATION ARRIVES NEARLY DONE. 144 of 146 are in and the league is
 *      answering the last four: one through the submission page, where the fee
 *      obligation appears, and the rest from the list, which is what the real
 *      Teams tab's pending rows offer (`teams-tab.tsx`: "the row keeps only
 *      triage, badges plus Approve/Reject for pending teams").
 *   5. PROVE IT OR DROP IT. A claim survives only if the screen shows it. The
 *      four sentences the old cut narrated over a panel are now the product's
 *      own fairness table, worst team first, and the published games land as
 *      same-day pairs because that is the thing being sold: one trip.
 *
 * SOURCE CHECKS THIS CUT RESTED ON (all read out of shipping code, and the
 * misses are written down in `docs/roadmap/product-corrections-from-demo-feedback.md`):
 *   · Fridays: REAL. `gyms-weekends-step.tsx` `friday-declaration`, "Can games
 *     run on Fridays?", left on No here.
 *   · The gym card sentence and the "Courts left empty" panel: the product's
 *     own prose, and the owner rejected both. The card carries his line here
 *     and the panel is gone from the demo; the product keeps its text until
 *     somebody changes it there.
 *   · Divisions: REAL. `manage/components/division-setup.tsx`, drag between
 *     columns and the cross-play question, both mirrored.
 *   · Fairness: REAL. `manage/components/summary-panel.tsx` `FairnessSummaryTable`,
 *     worst first by burden.
 *   · Free entry until the deadline: NOT IN THE PRODUCT. Every entry is
 *     approved one by one, so this demo shows that and the gap is recorded.
 *   · The league logo: REAL, `scripts/demo-assets/nph-logo.dataurl.txt`, seeded
 *     onto the North Pole Hoops organization.
 *
 * Every number still carries a line in `docs/roadmap/season-story-numbers.md`.
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
/** Season start (Nov 1 2026) less the balance rule's 14 days. */
const FEE_DUE = "Oct 18, 2026"

/** The league's buildings, as SeasonVenue holds them, in the board's own hues. */
const PLAYGROUND = { name: "The Playground", short: "Playground", city: "Burlington", dot: "#16a34a" }
const SIX_PARK = { name: "Six Park East", short: "Six Park", city: "Oshawa", dot: "#a855f7" }
const HABER = { name: "Haber Recreation Centre", short: "Haber", city: "Burlington", dot: "#2563eb" }

/**
 * THE CALENDAR (owner ruling: "the real NPH rhythm").
 *
 * Two or three weekends a month from late October to February, thirteen of
 * them, then three finals weekends in March. Seven candidate weekends stay
 * off, and they read off, because a wall of blue tells a league nothing.
 */
const WEEKEND_MONTHS = [
  { month: "Oct", weekends: [{ label: "10–11", on: false }, { label: "24–25", on: true }, { label: "31–1", on: true }] },
  {
    month: "Nov",
    weekends: [
      { label: "7–8", on: false },
      { label: "14–15", on: true },
      { label: "21–22", on: true },
      { label: "28–29", on: true },
    ],
  },
  {
    month: "Dec",
    weekends: [
      { label: "5–6", on: true },
      { label: "12–13", on: true },
      { label: "19–20", on: false },
      { label: "26–27", on: false },
    ],
  },
  {
    month: "Jan",
    weekends: [
      { label: "2–3", on: false },
      { label: "9–10", on: true },
      { label: "16–17", on: true },
      { label: "23–24", on: false },
      { label: "30–31", on: true },
    ],
  },
  {
    month: "Feb",
    weekends: [
      { label: "6–7", on: true },
      { label: "13–14", on: true },
      { label: "20–21", on: true },
      { label: "27–28", on: false },
    ],
  },
  { month: "Mar", weekends: [{ label: "6–7", on: true }, { label: "13–14", on: true }, { label: "20–21", on: true }] },
]
const WEEKENDS_ON = "16 of 23 weekends on"

/**
 * THE BOARD.
 *
 * A weekend's demand is the sum of the team counts of the grades placed on it
 * (a grade of N teams playing twice is N games), and its supply is courts x 8
 * slots a day x 2 days. The Playground is the home gym and fills first; what
 * spills is rented, and a rental the draw took by itself reads assumed until
 * somebody phones the gym.
 *
 * THE ONE PROBLEM: Nov 21 to 22 was booked TWO courts at Six Park East, and
 * Grade 10's 42 games need three. 84 games against 80 slots, ten of them with
 * nowhere to go at that gym. See `docs/roadmap/season-story-numbers.md` D.
 */
type Card = {
  id?: string
  date: string
  fraction: string
  tone: "fits" | "tight" | "over"
  gyms: BoardGym[]
}

function gym(v: { short: string; dot: string }, courts: string, grades: string[], extra?: Partial<BoardGym>): BoardGym {
  return { gym: v.short, dot: v.dot, courts, grades, ...extra }
}

const OCT: Card[] = [
  {
    date: "Oct 24–25",
    fraction: "62/80 games",
    tone: "fits",
    gyms: [
      gym(PLAYGROUND, "3/3 courts", ["Gr 7 (12)", "Gr 11 (24)"]),
      gym(SIX_PARK, "2/6 courts", ["Gr 12 (26)"], { free: "4 free", status: "assumed" }),
    ],
  },
  {
    date: "Oct 31–Nov 1",
    fraction: "33/48 games",
    tone: "fits",
    gyms: [gym(PLAYGROUND, "3/3 courts", ["Gr 9 (25)", "Jr Girls (8)"])],
  },
]

const DEC: Card[] = [
  {
    date: "Dec 5–6",
    fraction: "49/80 games",
    tone: "fits",
    gyms: [
      gym(PLAYGROUND, "3/3 courts", ["Gr 9 (25)"]),
      gym(HABER, "2/6 courts", ["Gr 11 (24)"], { free: "4 free", status: "assumed" }),
    ],
  },
  {
    date: "Dec 12–13",
    fraction: "42/48 games",
    tone: "fits",
    gyms: [gym(PLAYGROUND, "3/3 courts", ["Gr 10 (42)"])],
  },
]

const JAN: Card[] = [
  {
    date: "Jan 9–10",
    fraction: "68/96 games",
    tone: "fits",
    gyms: [
      gym(PLAYGROUND, "3/3 courts", ["Gr 12 (26)"]),
      gym(SIX_PARK, "3/6 courts", ["Gr 10 (42)"], { free: "3 free", status: "assumed" }),
    ],
  },
  {
    date: "Jan 16–17",
    fraction: "45/48 games",
    tone: "fits",
    gyms: [gym(PLAYGROUND, "3/3 courts", ["Gr 7 (12)", "Gr 9 (25)", "Jr Girls (8)"])],
  },
]

/** November, the column the story happens in, in its four states. */
function november(
  moved: boolean,
  court: boolean,
  dragging: boolean,
  menu: ReactNode
): Card[] {
  const spill = gym(SIX_PARK, court ? "3/6 courts" : "2/6 courts", ["Gr 10 (42)"], {
    free: court ? "3 free" : "4 free",
    status: "assumed",
    short: court ? undefined : "10 short",
    id: "block-sixpark",
    menuId: "sixpark-menu",
    dragging,
    menu,
  })
  return [
    {
      id: "card-nov21",
      date: "Nov 21–22",
      fraction: moved ? "42/48 games" : "84/80 games",
      tone: moved ? "fits" : "tight",
      gyms: [
        gym(PLAYGROUND, "3/3 courts", ["Gr 8 (9)", "Gr 9 (25)", "Jr Girls (8)"]),
        ...(moved ? [] : [spill]),
      ],
    },
    {
      id: "card-nov28",
      date: "Nov 28–29",
      fraction: moved ? (court ? "78/96 games" : "78/80 games") : "36/48 games",
      tone: moved && !court ? "tight" : "fits",
      gyms: [gym(PLAYGROUND, "3/3 courts", ["Gr 7 (12)", "Gr 11 (24)"]), ...(moved ? [spill] : [])],
    },
  ]
}

/** The rail's own sentence for the weekend in trouble (`planner-core.ts`). */
const RAIL_PROBLEM = {
  label: "Nov 21–22",
  fraction: "84/80",
  text: "Nov 21–22 needs 84 games and has 80 slots, 4 short. Extend the hours, add a court, or move a grade to a lighter weekend.",
}
const RAIL_IDEA = {
  headline: "Move Six Park East's 42 games",
  detail: "From Nov 21–22 (84 of 80) to Nov 28–29 (78 of 80 after). Six Park East needs a third court there.",
  tag: "clears shortage",
  id: "rail-idea",
}
const RAIL_ASK = "What you need to book: 20 court-days · 200 court-hours"

/* ── The teams table ─────────────────────────────────────────────────────── */

type Entry = {
  club: string
  division: string
  status: "APPROVED" | "PENDING" | "REJECTED"
  payment?: "PAID" | "UNPAID"
  id?: string
}

/** Thirteen of the 146, the way the list opens: every club name is the world's. */
const ENTRIES: Entry[] = [
  { club: "Royal Crown", division: "Grade 10 Boys · Division B", status: "PENDING", id: "row-royal" },
  { club: "Burloak Elite", division: "Grade 9 Boys · Division A", status: "PENDING", id: "row-burloak" },
  { club: "Dragons de Gatineau", division: "Grade 11 Boys · Division A", status: "PENDING", id: "row-dragons" },
  { club: "MBA", division: "Grade 7 Boys", status: "PENDING", id: "row-mba" },
  { club: "PDM Basketball", division: "Grade 7 Boys", status: "APPROVED", payment: "PAID" },
  { club: "City Above Elite", division: "Grade 7 Boys", status: "APPROVED", payment: "PAID" },
  { club: "M and R Basketball", division: "Grade 7 Boys", status: "APPROVED", payment: "PAID" },
  { club: "Ottawa Elite", division: "Grade 10 Boys · Division B", status: "APPROVED", payment: "PAID" },
  { club: "CE23 Academy", division: "Grade 9 Boys · Division A", status: "APPROVED", payment: "PAID" },
  { club: "MBA", division: "Grade 8 Boys", status: "APPROVED", payment: "PAID" },
  { club: "HoopHer", division: "Junior Girls", status: "APPROVED", payment: "UNPAID" },
  { club: "Royal Crown", division: "Grade 12 Boys · Division A", status: "APPROVED", payment: "PAID" },
  { club: "Barrie Buccaneers", division: "Grade 7 Boys", status: "REJECTED" },
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

/* ── Divisions ───────────────────────────────────────────────────────────── */

const G10_POOL = ["Royal Crown", "Ottawa Elite", "City Above Elite", "PDM Basketball", "MBA"]
const G10_DIVISIONS = [
  { name: "Grade 10 · A", dot: "#a855f7", teams: ["Burloak Elite", "CE23 Academy", "M and R"] },
  { name: "Grade 10 · B", dot: "#16a34a", teams: ["Royal Crown", "Ottawa Elite", "Barrie Bucs"] },
  { name: "Grade 10 · C", dot: "#2563eb", teams: ["City Above Elite", "HoopHer 10", "PDM"] },
  { name: "Grade 10 · D", dot: "#b45309", teams: ["MBA", "Dragons", "Six Park Sel."] },
]

/* ── Fairness, worst team first ──────────────────────────────────────────── */

const FAIRNESS = [
  { team: "Dragons de Gatineau", burden: "2", games: "10", short: "0", b2b: "0", waits: "0", twoGyms: "0" },
  { team: "Barrie Buccaneers", burden: "2", games: "10", short: "0", b2b: "0", waits: "0", twoGyms: "0" },
  { team: "HoopHer", burden: "1", games: "10", short: "0", b2b: "0", waits: "0", twoGyms: "0" },
  { team: "Royal Crown", burden: "0", games: "10", short: "0", b2b: "0", waits: "0", twoGyms: "0" },
]

/* ── Requests ────────────────────────────────────────────────────────────── */

const REQ_OTTAWA = "Games every Saturday start no earlier than 12:00"
const REQ_GATINEAU = "Games every Sunday finish no later than 17:00"

/* ── The published weekend, and one family's phone ───────────────────────── */

/**
 * The league's own list, and the thing it proves: every team's two games are
 * on ONE day, at ONE building. That is the trip a family drives.
 */
const PUBLISHED = [
  ["Sat Nov 28 · 10:00 AM", "Royal Crown vs Ottawa Elite", "Division B · Six Park East, Court 3"],
  ["Sat Nov 28 · 10:00 AM", "Burloak Elite vs CE23 Academy", "Division A · Six Park East, Court 1"],
  ["Sat Nov 28 · 10:00 AM", "City Above Elite vs HoopHer 10", "Division C · Six Park East, Court 2"],
  ["Sat Nov 28 · 11:15 AM", "MBA vs Dragons de Gatineau", "Division D · Six Park East, Court 1"],
  ["Sat Nov 28 · 12:30 PM", "Barrie Buccaneers vs Royal Crown", "Division B · Six Park East, Court 3"],
  ["Sat Nov 28 · 12:30 PM", "M and R Basketball vs Burloak Elite", "Division A · Six Park East, Court 1"],
  ["Sat Nov 28 · 12:30 PM", "PDM Basketball vs City Above Elite", "Division C · Six Park East, Court 2"],
  ["Sat Nov 28 · 1:45 PM", "Six Park Selects vs MBA", "Division D · Six Park East, Court 2"],
  ["Sat Nov 28 · 3:00 PM", "Ottawa Elite vs Barrie Buccaneers", "Division B · Six Park East, Court 3"],
  ["Sat Nov 28 · 3:00 PM", "CE23 Academy vs M and R Basketball", "Division A · Six Park East, Court 1"],
  ["Sat Nov 28 · 3:00 PM", "HoopHer 10 vs PDM Basketball", "Division C · Six Park East, Court 2"],
  ["Sat Nov 28 · 4:15 PM", "Dragons de Gatineau vs Six Park Selects", "Division D · Six Park East, Court 3"],
]

/**
 * Jordan's week on his mother's phone, in the real agenda the family calendar
 * draws (`app/(platform)/calendar/my-calendar.tsx` in its agenda view). The
 * practices are already there before the league publishes anything: the games
 * fill in AROUND them.
 */
type AgendaItem = {
  day: string
  weekday: string
  time: string
  title: string
  where: string
  kind: "practice" | "game"
}
const PRACTICES: AgendaItem[] = [
  { day: "19", weekday: "Thu", time: "7:00 PM", title: "Practice", where: "Royal Crown · Main gym", kind: "practice" },
  { day: "24", weekday: "Tue", time: "7:00 PM", title: "Practice", where: "Royal Crown · Main gym", kind: "practice" },
]
const HER_GAMES: AgendaItem[] = [
  {
    day: "28",
    weekday: "Sat",
    time: "10:00 AM",
    title: "vs Ottawa Elite",
    where: "Six Park East, Court 3",
    kind: "game",
  },
  {
    day: "28",
    weekday: "Sat",
    time: "12:30 PM",
    title: "at Barrie Buccaneers",
    where: "Six Park East, Court 3",
    kind: "game",
  },
]

/* ── Pacing ──────────────────────────────────────────────────────────────── */

/**
 * Stop, explain, act. The hand takes its travel time, the balloon lands with
 * it and holds long enough to read at about 180ms a word, and only then does
 * the screen move.
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
    { id: "buildings", title: "The buildings" },
    { id: "divisions", title: "Divisions" },
    { id: "board", title: "The board" },
    { id: "requests", title: "Two requests" },
    { id: "publish", title: "Publish once" },
  ],

  beats: [
    /* ── 1. Teams come in ─────────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "entries",
      caption: "144 of NPH's 146 teams are in, and four entries are waiting on the league.",
      emphasize: "tile-waiting",
      callout: "Clubs entered themselves. The league only answers the last few.",
      set: { screen: "teams" },
    }),
    paced({
      id: "pending",
      chapter: "entries",
      caption: "The league filters down to the four still pending.",
      cursor: "filter-pending",
      press: true,
      set: { filter: "Pending (4)" },
    }),
    paced({
      id: "open-team",
      chapter: "entries",
      caption: "Royal Crown has entered a Grade 10 team.",
      cursor: "row-royal",
      press: true,
      callout: "One entry, one decision, and the club is not in until it is made.",
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
    paced({
      id: "fee",
      chapter: "entries",
      caption: `${FEE}, balance due ${FEE_DUE}.`,
      emphasize: "fee-panel",
      toast: "Royal Crown approved · Grade 10 Boys, Division B",
      callout: `The ${FEE} is raised by the approval itself. Nobody types an invoice.`,
      set: { approved: true, fee: true },
    }),
    paced({
      id: "promise",
      chapter: "entries",
      caption: "And what the club is buying: twelve games guaranteed.",
      emphasize: "promise",
      callout: "Ten regular season and two playoff. The schedule has to keep it.",
      set: { promise: true },
    }),
    paced({
      id: "inline",
      chapter: "entries",
      caption: "The other three are answered from the list.",
      context: CTX_TEAMS,
      cursor: "approve-burloak",
      press: true,
      callout: "A pending row carries the same decision. No page to open.",
      set: { screen: "teams", filter: "Pending (3)" },
    }),
    paced({
      id: "cleared",
      chapter: "entries",
      caption: "146 teams, 145 approved, one rejected. Nothing is waiting.",
      emphasize: "tile-waiting",
      toast: "3 entries approved",
      callout: "Every team is known, and every fee is raised, before a game is drawn.",
      set: { closed: true, filter: "All (146)" },
    }),

    /* ── 2. The buildings ─────────────────────────────────────────────── */
    paced({
      id: "to-plan",
      chapter: "buildings",
      caption: "Step two of planning the season is the buildings.",
      context: CTX_PLAN,
      set: { screen: "plan" },
      emphasize: "rail-2",
      callout: "This is the only screen in the season where hours get typed.",
    }),
    paced({
      id: "weekends",
      chapter: "buildings",
      caption: "Two or three weekends a month, then three finals weekends in March.",
      emphasize: "weekend-grid",
      callout: "Choosing a weekend books nothing. It tells the draw which ones to fill.",
    }),
    paced({
      id: "friday",
      chapter: "buildings",
      caption: "NPH keeps Fridays clear.",
      emphasize: "friday",
      callout: "Leagues that want Friday evenings can have them. This one does not.",
    }),
    paced({
      id: "home",
      chapter: "buildings",
      caption: "The home court: The Playground, in Burlington.",
      cursor: "gym-home",
      hover: "gym-home",
      callout: "They own this one, so its games cost them nothing.",
    }),
    paced({
      id: "floaters",
      chapter: "buildings",
      caption: "Then the floaters: Six Park East and Haber, in the pool.",
      emphasize: "gym-pool",
      callout: "A pool gym is rented by the court, only when a weekend needs the space.",
      set: { pool: true },
    }),
    paced({
      id: "no-bookings",
      chapter: "buildings",
      caption: "And the league does not have to book them first.",
      cursor: "gym-bookings",
      hover: "gym-bookings",
      callout: "One date is booked. For the rest the planner hands back a call list.",
      set: { skip: true },
    }),

    /* ── 3. Divisions ─────────────────────────────────────────────────── */
    paced({
      id: "to-divisions",
      chapter: "divisions",
      caption: "Grade 10 came in 42 teams deep.",
      context: CTX_SCHEDULE,
      set: { screen: "divisions" },
      emphasize: "div-head",
      callout: "Forty two teams in one table is a season nobody can win or read.",
    }),
    paced({
      id: "how-many",
      chapter: "divisions",
      caption: "Four divisions, about eleven teams each.",
      cursor: "div-4",
      press: true,
      callout: "How many is the league's call. The product does not pick it.",
      set: { shape: true },
    }),
    paced({
      id: "deal",
      chapter: "divisions",
      caption: "Dealing them out is a starting point, not a verdict.",
      cursor: "deal",
      press: true,
      set: { dealt: true },
    }),
    paced({
      id: "drag-team",
      chapter: "divisions",
      caption: "So the league moves teams until the four are even.",
      cursor: "div-col-b",
      callout: "Any team, into any division, in either direction.",
      set: { divMoved: true },
    }),
    paced({
      id: "crossplay",
      chapter: "divisions",
      caption: "And says whether the divisions may play each other.",
      cursor: "cross-yes",
      press: true,
      callout: "Divisions that never meet make a thin schedule. These may mix.",
      set: { cross: true },
    }),
    paced({
      id: "create",
      chapter: "divisions",
      caption: "Four divisions, created.",
      cursor: "create-div",
      press: true,
      toast: "Grade 10 · 4 divisions created",
      set: { created: true },
    }),

    /* ── 4. The board ─────────────────────────────────────────────────── */
    paced({
      id: "to-board",
      chapter: "board",
      caption: "Step three puts every grade on a weekend and in a building.",
      context: CTX_PLAN,
      set: { screen: "board" },
      emphasize: "board-grid",
      callout: "The home gym fills first, every weekend. What spills gets rented.",
    }),
    paced({
      id: "tight",
      chapter: "board",
      caption: "One weekend is amber.",
      emphasize: "card-nov21",
      callout: "Amber is not a failure. The games do not fit the courts booked.",
    }),
    paced({
      id: "rail-open",
      chapter: "board",
      caption: "The board keeps its own list of what is left.",
      cursor: "rail-tab",
      press: true,
      set: { rail: true },
    }),
    paced({
      id: "rail-read",
      chapter: "board",
      caption: "It names the weekend, the shortfall, and the move that clears it.",
      emphasize: "rail-idea",
      holdMs: 2600,
      callout: "Nobody hunted for this. The board did the arithmetic and wrote the fix.",
    }),
    paced({
      id: "drag-lift",
      chapter: "board",
      caption: "So the league takes the whole Six Park block off that weekend.",
      cursor: "block-sixpark",
      callout: "One grip, and a building's whole weekend moves together.",
      set: { dragging: true },
    }),
    paced({
      id: "drag-drop",
      chapter: "board",
      caption: "And drops it on the 28th.",
      cursor: "card-nov28",
      press: true,
      callout: "The 21st fits now. The 28th has the games but not the courts.",
      set: { dragging: false, blockMoved: true },
    }),
    paced({
      id: "menu",
      chapter: "board",
      caption: "Six Park East has six courts. This weekend used two.",
      cursor: "sixpark-menu",
      press: true,
      callout: "Renting one more court is a change to one gym on one date.",
      set: { menu: true },
    }),
    paced({
      id: "court",
      chapter: "board",
      caption: "Three courts on the 28th, and only on the 28th.",
      cursor: "court-apply",
      press: true,
      toast: "Six Park East · 3 courts on Nov 28 to 29",
      set: { menu: false, court: true },
    }),
    paced({
      id: "all-clear",
      chapter: "board",
      caption: "Every weekend now fits the gym time this league really has.",
      emphasize: "math-line",
      callout: "Two changes, and the calendar under the season is sound.",
    }),
    paced({
      id: "generate",
      chapter: "board",
      caption: "The calendar goes to the scheduler.",
      context: CTX_SCHEDULE,
      cursor: "generate",
      press: true,
      callout: "One press builds all 730 games on the calendar above.",
      set: { screen: "schedule", run: 1 },
    }),
    paced({
      id: "result",
      chapter: "board",
      caption: "730 games, none of them left over.",
      emphasize: "preview",
      callout: "It fits because the gym time was made to fit first, not after.",
    }),
    paced({
      id: "fairness",
      chapter: "board",
      caption: "And the league reads it worst team first.",
      emphasize: "fairness",
      holdMs: 2400,
      callout: "This is the WORST treated team in the league. The zeros are the point.",
      set: { fairness: true },
    }),

    /* ── 5. Two requests ──────────────────────────────────────────────── */
    paced({
      id: "requests",
      chapter: "requests",
      caption: "Clubs ask for things, and the asks are about the drive.",
      context: CTX_REQUESTS,
      set: { screen: "requests" },
      emphasize: "req-ottawa",
      callout: "Ottawa Elite leave home at six. Nothing before noon on Saturday.",
    }),
    paced({
      id: "honored",
      chapter: "requests",
      caption: "The schedule honored it, and the league can see that it did.",
      emphasize: "req-ottawa-note",
      callout: "A promise the league can check is worth more than one it makes.",
    }),
    paced({
      id: "pending-req",
      chapter: "requests",
      caption: "Gatineau drive further, and asked to be finished by five on Sunday.",
      cursor: "req-dragons",
      hover: "req-dragons",
      callout: "It is a five hour drive home. What would saying yes cost everyone else?",
    }),
    paced({
      id: "simulate",
      chapter: "requests",
      caption: "So the league prices it first.",
      cursor: "simulate",
      press: true,
      callout: "Simulate runs the season with the request and without, then diffs them.",
      set: { sim: true },
    }),
    paced({
      id: "cost",
      chapter: "requests",
      caption: "Nobody else moves.",
      emphasize: "sim-result",
      holdMs: 1600,
      callout: "That is what turns a favour into a decision.",
    }),
    paced({
      id: "approve-req",
      chapter: "requests",
      caption: "The league approves it.",
      emphasize: "req-dragons-note",
      toast: "Request approved · Dragons de Gatineau",
      set: { reqApproved: true },
    }),

    /* ── 6. Publish once ──────────────────────────────────────────────── */
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
      caption: "A draft the league can rebuild as often as it likes.",
      emphasize: "draft-banner",
      toast: "Saved as a draft · 730 games",
      set: { dialog: "", committed: true },
    }),
    paced({
      id: "pairs",
      chapter: "publish",
      caption: "Read down the weekend: every team plays twice on one day.",
      emphasize: "schedule-list",
      holdMs: 2600,
      callout: "Two games, one day, one building. That is one drive, not two.",
    }),
    paced({
      id: "phone-in",
      chapter: "publish",
      caption: "On Priya's phone, Jordan's practices are already there.",
      stage: "split",
      emphasize: "phone-cal",
      callout: "The club's practices have been on this calendar since September.",
    }),
    paced({
      id: "publish",
      chapter: "publish",
      caption: "One press, once, when the league is ready.",
      cursor: "publish",
      press: true,
      callout: "The only irreversible press in the story, and the league picks when.",
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
      caption: "One notice each, pointing at their own team.",
      emphasize: "phone-notice",
      toast: "Schedule published · 730 games are live",
      callout: "Not one notice per game. One, and it knows which team is theirs.",
      set: { dialog: "", published: true, notice: true },
    }),
    paced({
      id: "cal",
      chapter: "publish",
      caption: "And the games fill in around the practices.",
      emphasize: "phone-cal",
      callout: "Both of Saturday's games, at one gym, beside the practices already there.",
      set: { notice: false, calFilled: true },
    }),
    paced({
      id: "everyone",
      chapter: "publish",
      caption: "Every calendar in the league filled at the same moment.",
      emphasize: "phone-cal",
      callout: "Parents, coaches, team managers and club owners each see their own.",
    }),
    paced({
      id: "ics",
      chapter: "publish",
      caption: "And it subscribes to her phone's own calendar.",
      cursor: "ics",
      press: true,
      callout: "One subscription, and every later change follows into it.",
      hold: 5200,
      set: { ics: true },
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

    const desktop = (
      <div className="relative flex h-full flex-col">
        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {screen === "teams" && (
            <TeamsScreen
              closed={closed}
              approved={approved}
              filter={get<string>("filter", "All (146)")}
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
          {screen === "divisions" && (
            <DivisionsScreen
              shape={get("shape", false)}
              dealt={get("dealt", false)}
              moved={get("divMoved", false)}
              cross={get("cross", false)}
              created={get("created", false)}
            />
          )}
          {screen === "board" && (
            <BoardScreen
              rail={get("rail", false)}
              dragging={get("dragging", false)}
              moved={get("blockMoved", false)}
              court={get("court", false)}
              menu={get("menu", false)}
            />
          )}
          {screen === "schedule" && (
            <ScheduleScreen
              run={get("run", 0)}
              fairness={get("fairness", false)}
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
              Everyone gets one notification pointing at their own team calendar.
            </p>
            <p className="text-ink-600 mt-1 text-[15px]">
              Parents, coaches, team managers and club owners. The league page, every club page and
              every team page read these games from this moment.
            </p>
          </div>
        </Dialog>
      </div>
    )

    const phone = (
      <div className="relative h-full">
        <PhoneScreen title="Jordan Reyes · Grade 10" subtitle="Royal Crown · Priya's family" tab="Calendar">
          <CalendarScreen filled={get("calFilled", false)} ics={get("ics", false)} />
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

/**
 * The console, under the season's own header.
 *
 * The crest is the world's real logo: North Pole Hoops' mark, seeded onto the
 * organization and inherited by every NPH league.
 */
function Shell({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-2 px-5 pb-1 pt-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/demo/nph-logo.png" alt="" className="h-7 w-7 shrink-0 rounded-md" />
        <span className="text-ink-900 text-[17px] font-extrabold">{SEASON}</span>
        <span className="text-ink-500 text-[15px] font-semibold">{LEAGUE}</span>
        <StatusChip tone="court">Open for registration</StatusChip>
      </div>
      <ConsoleTabs active={tab} />
      <div className="bg-ink-50/70 flex min-h-0 flex-1 flex-col px-5 py-2.5">{children}</div>
    </>
  )
}

function TeamsScreen({
  closed,
  approved,
  filter,
}: {
  closed: boolean
  approved: boolean
  filter: string
}) {
  /* The counters and the rows are ONE source: whatever is pending is what the
     chips count and what "Waiting on you" says. */
  const rows = ENTRIES.map((r) =>
    r.status === "PENDING" && (closed || (approved && r.id === "row-royal"))
      ? { ...r, status: "APPROVED" as const, payment: "UNPAID" as const }
      : r
  )
  const pending = rows.filter((r) => r.status === "PENDING")
  const shown = filter.startsWith("Pending") ? pending : rows

  return (
    <Shell tab="Teams">
      <div className="grid shrink-0 grid-cols-3 gap-2">
        <Tile
          label="Teams entered"
          value={closed ? "146 of 146" : "144 of 146"}
          note={closed ? "145 approved, 1 rejected" : "Registration open"}
          tone="court"
        />
        <Tile label="Clubs in" value="82" note="Every club in" />
        <Tile
          id="tile-waiting"
          label="Waiting on you"
          value={String(pending.length)}
          note="To approve"
          tone={pending.length > 0 ? "gold" : "court"}
        />
      </div>

      <Panel
        title="Registered teams"
        meta="146 teams across 82 clubs"
        className="mt-2 min-h-0"
        action={
          <div className="flex items-center gap-2">
            <FilterRow
              id="filter-pending"
              items={[
                "All (146)",
                `Pending (${pending.length})`,
                `Approved (${145 - pending.length})`,
                "Rejected (1)",
              ]}
              active={filter}
            />
          </div>
        }
      >
        <div className="space-y-0.5 px-3 py-1.5">
          {shown.map((r) => (
            <TeamRow
              key={r.club + r.division}
              {...r}
              action={
                r.status === "PENDING" ? (
                  <span className="flex items-center gap-1.5">
                    <Btn
                      id={r.id === "row-burloak" ? "approve-burloak" : undefined}
                      tone="court"
                      size="xs"
                    >
                      Approve
                    </Btn>
                    <Btn tone="quiet" size="xs">
                      Reject
                    </Btn>
                    <Chip tone="neutral">Details</Chip>
                  </span>
                ) : (
                  <Chip tone="neutral">Details</Chip>
                )
              }
            />
          ))}
        </div>
      </Panel>
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
      <div className="grid grid-cols-[minmax(0,1fr)_390px] gap-3">
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
            <Row label="Roster submitted" value="12 players · 12 of 12 waivers signed" />
            <Row label="Club agreement" value="Signed by Marcus Dwyer, 12 August" />
            <Row label="Weekend preference" value="One trip: both weekend games on the same day" />
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
            </div>
            {promise && (
              <div
                data-demo-target="promise"
                className="border-court-200 bg-court-50 live-pop rounded-2xl border px-4 py-2.5"
              >
                <p className="text-court-800 text-[16px] font-bold">
                  12 games guaranteed: 10 regular season + minimum 2 playoff
                </p>
              </div>
            )}
          </div>
        </Panel>

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
                Owed by the club to the league. The date is this league&apos;s own rule: 14 days
                before the season starts.
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
 * STEP 2, YOUR BUILDINGS: the weekends, the Friday question, the home gym and
 * the pool. The "Courts left empty" panel the product draws here is not in this
 * demo (owner ruling), and the home card carries his sentence.
 */
function PlanScreen({ pool, skip }: { pool: boolean; skip: boolean }) {
  return (
    <div className="bg-ink-50/70 flex min-h-0 flex-1 flex-col gap-2.5 px-5 py-3">
      <StepRail step={2} />
      <Panel title="When would you like to run sessions?" meta={WEEKENDS_ON}>
        <div className="px-4 py-2.5">
          <WeekendGrid id="weekend-grid" months={WEEKEND_MONTHS} />
        </div>
      </Panel>
      <FridayChoice id="friday" value="No" />
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
              skip={
                skip
                  ? "No bookings yet? Fine. The planner will assume what it needs and give you a call list."
                  : undefined
              }
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
      </div>
    </div>
  )
}

/** The Schedule tab's division setup, drag board and cross-play question. */
function DivisionsScreen({
  shape,
  dealt,
  moved,
  cross,
  created,
}: {
  shape: boolean
  dealt: boolean
  moved: boolean
  cross: boolean
  created: boolean
}) {
  /* The drag: Ottawa Elite starts in D and ends up in B, which is what evens
     the four out. Before the deal every team sits unassigned. */
  const columns = [
    {
      name: "Unassigned",
      pool: true,
      teams: dealt ? [] : G10_POOL,
    },
    ...G10_DIVISIONS.map((d, i) => ({
      name: d.name,
      dot: d.dot,
      id: i === 1 ? "div-col-b" : undefined,
      teams: !dealt
        ? []
        : moved && i === 1
          ? [...d.teams, "City Above Elite"]
          : moved && i === 2
            ? d.teams.filter((t) => t !== "City Above Elite")
            : d.teams,
    })),
  ]

  return (
    <Shell tab="Schedule">
      <Panel
        title="Divisions"
        meta="Grade 10 · 42 teams"
        action={
          created ? (
            <StatusChip tone="court">4 divisions</StatusChip>
          ) : (
            <Btn id="create-div" tone="court" size="sm">
              Create 4 divisions
            </Btn>
          )
        }
      >
        <div className="space-y-2.5 px-4 py-3">
          <p data-demo-target="div-head" className="text-ink-700 text-[15px] font-semibold">
            Big grades can run as divisions. Nothing is created unless you set it up.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-900 text-[15px] font-bold">How many divisions?</span>
            {[2, 3, 4, 5, 6].map((n) => (
              <span
                key={n}
                data-demo-target={n === 4 ? "div-4" : undefined}
                className={
                  shape && n === 4
                    ? "border-court-400 bg-court-50 text-court-800 rounded-lg border px-2.5 py-1 text-[14px] font-bold"
                    : "border-ink-200 text-ink-600 rounded-lg border bg-white px-2.5 py-1 text-[14px] font-bold"
                }
              >
                {n} · ~{Math.round(42 / n)} each
              </span>
            ))}
            <span className="ml-2 flex items-center gap-1.5">
              <Btn id="deal" tone="quiet" size="sm">
                Deal randomly
              </Btn>
              <Btn tone="quiet" size="sm">
                I&apos;ll place them myself
              </Btn>
            </span>
          </div>

          <p className="text-ink-500 text-[14px] font-medium">
            Drag teams between the pool and the divisions, any direction.
          </p>
          <DivisionsBoard columns={columns} />

          <CrossPlay id="cross-yes" chosen={cross ? "yes" : undefined} />
        </div>
      </Panel>
    </Shell>
  )
}

/**
 * STEP 3, YOUR CALENDAR: the board, drawn from the real one.
 *
 * The suggestions drawer sits over the last column when it is open, which is
 * exactly what the real sticky rail does at 1440.
 */
function BoardScreen({
  rail,
  dragging,
  moved,
  court,
  menu,
}: {
  rail: boolean
  dragging: boolean
  moved: boolean
  court: boolean
  menu: boolean
}) {
  const solved = moved && court
  const nov = november(
    moved,
    court,
    dragging,
    menu ? (
      <GymMenu
        id="sixpark-menu-panel"
        gym="Six Park East"
        weekend="Nov 28–29"
        need={3}
        courts={3}
        wired={6}
        apply="We rented 3 courts"
        applyId="court-apply"
      />
    ) : null
  )

  return (
    <div className="bg-ink-50/70 flex min-h-0 flex-1 flex-col gap-1.5 px-5 py-2">
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
          {solved ? (
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
          <span className="bg-court-600 px-2.5 py-1 text-white">Board</span>
          <span className="text-ink-500 px-2.5 py-1">Strip</span>
        </span>
        <Btn id="generate" tone="primary" size="sm">
          Use this calendar and generate the schedule
        </Btn>
      </div>

      <GymTray
        gyms={[
          { name: "The Playground", dot: PLAYGROUND.dot, courts: "3 courts", home: true, weekends: "On 13 weekends" },
          { name: "Six Park East", dot: SIX_PARK.dot, courts: "6 courts", weekends: "On 3 weekends" },
          { name: "Haber Recreation Centre", dot: HABER.dot, courts: "6 courts", weekends: "On 1 weekend" },
        ]}
      />

      <div className="relative min-h-0 flex-1">
        <div data-demo-target="board-grid" className="grid h-full grid-cols-4 gap-1.5">
          <SessionColumn title="Session 1 · Oct">
            <NotPlanned date="Oct 10–11" />
            {OCT.map((c) => (
              <WeekendCard key={c.date} {...c} />
            ))}
          </SessionColumn>
          <SessionColumn title="Session 2 · Nov">
            {nov.map((c) => (
              <WeekendCard key={c.date} {...c} />
            ))}
          </SessionColumn>
          <SessionColumn title="Session 3 · Dec">
            {DEC.map((c) => (
              <WeekendCard key={c.date} {...c} />
            ))}
            <NotPlanned date="Dec 19–20" />
          </SessionColumn>
          <SessionColumn title="Session 4 · Jan">
            <NotPlanned date="Jan 2–3" />
            {JAN.map((c) => (
              <WeekendCard key={c.date} {...c} />
            ))}
          </SessionColumn>
        </div>

        <div className="absolute bottom-0 right-0 top-0 z-20 flex">
          <WorkRail
            id="rail-tab"
            open={rail}
            count={solved ? "all clear" : "1 open"}
            about="this calendar"
            problem={solved ? undefined : RAIL_PROBLEM}
            ideas={[{ ...RAIL_IDEA, applied: solved }]}
            footer={RAIL_ASK}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * The Schedule tab after the board sent it a calendar: the preview, the
 * fairness table, the draft banner and the published list.
 */
function ScheduleScreen({
  run,
  fairness,
  committed,
  published,
}: {
  run: number
  fairness: boolean
  committed: boolean
  published: boolean
}) {
  if (committed) {
    return (
      <Shell tab="Schedule">
        <div
          data-demo-target="draft-banner"
          className={`rounded-xl border px-4 py-2 ${
            published ? "border-court-300 bg-court-50" : "border-gold-400 bg-gold-50"
          }`}
        >
          <p className={`text-[16px] font-bold ${published ? "text-court-800" : "text-gold-600"}`}>
            {published
              ? "730 games are live. Every club and family was notified once."
              : "730 draft games. Visible only to you until you publish."}
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2">
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
            Showing 12 of 730 games · Grade 10, Saturday Nov 28
          </span>
        </div>
        <div data-demo-target="schedule-list" className="mt-2 space-y-1">
          {PUBLISHED.map(([when, teams, meta]) => (
            <div
              key={when + teams}
              className="border-ink-200 flex items-center gap-2.5 rounded-lg border bg-white px-3 py-0.5"
            >
              <span className="text-ink-900 w-[158px] shrink-0 text-[14px] font-bold">{when}</span>
              <span className="text-ink-900 shrink-0 text-[15px] font-semibold">{teams}</span>
              <span className="text-ink-500 ml-auto truncate text-[14px] font-medium">{meta}</span>
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
      <div className="flex flex-wrap items-center gap-2">
        <Btn id="commit" tone="court" size="sm">
          Commit whole season
        </Btn>
        <span className="text-ink-500 text-[14px] font-semibold">
          Built on the calendar from Plan your season, step 3
        </span>
      </div>

      {run > 0 && (
        <div
          data-demo-target="preview"
          className="border-court-300 bg-court-50 live-pop mt-2.5 rounded-2xl border px-4 py-2.5"
        >
          <p className="text-court-800 text-[16px] font-bold">Preview: 730 games · 0 unscheduled</p>
          <p className="text-ink-700 mt-0.5 text-[15px]">
            No trade-offs · every rule held: shares, rest days, rematch spacing, court rotation.
          </p>
          <p className="text-ink-500 mt-0.5 text-[14px] font-medium">Slots used: 730 of 848</p>
        </div>
      )}

      {fairness && (
        <div className="mt-2.5">
          <FairnessTable id="fairness" rows={FAIRNESS} />
        </div>
      )}
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
            sentence={REQ_OTTAWA}
            status="APPROVED"
            requester="Andre Belliveau"
            reason="We drive in from Ottawa on Saturday morning"
          >
            <p
              data-demo-target="req-ottawa-note"
              className="border-court-200 bg-white text-court-800 rounded-xl border px-3 py-2 text-[15px] font-semibold"
            >
              Honored: 10 of 10 Saturday games start at noon or later.
            </p>
          </RequestRow>

          <RequestRow
            id="req-dragons"
            team="Dragons de Gatineau"
            division="Grade 11 Boys · Division A"
            sentence={REQ_GATINEAU}
            status={approved ? "APPROVED" : "PENDING"}
            requester="Isabelle Fortin"
            reason="It is a five hour drive home"
          >
            {approved ? (
              <p
                data-demo-target="req-dragons-note"
                className="border-court-200 bg-white text-court-800 live-pop rounded-xl border px-3 py-2 text-[15px] font-semibold"
              >
                Honored: 10 of 10 Sunday games finish before 5:00 PM. Nobody else moved.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Btn id="simulate" tone="quiet" size="sm">
                    Simulate cost
                  </Btn>
                  <Btn tone="court" size="sm">
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

/* ── Phone: the real family calendar, in its agenda view ─────────────────── */

function CalendarScreen({ filled, ics }: { filled: boolean; ics: boolean }) {
  /* Practices were always there. The games arrive around them, in date order,
     which is what publishing really looks like on a family's phone. */
  const items = filled
    ? [...PRACTICES, ...HER_GAMES].sort((a, b) => Number(a.day) - Number(b.day))
    : PRACTICES

  return (
    <div data-demo-target="phone-cal" className="flex h-full flex-col">
      <p className="text-ink-400 shrink-0 text-[14px] font-bold uppercase tracking-[0.1em]">
        November 2026
      </p>
      <div className="mt-1.5 min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {items.map((i) => (
          <AgendaRow key={i.day + i.title} item={i} fresh={filled && i.kind === "game"} />
        ))}
      </div>
      {filled && (
        <div
          data-demo-target="ics"
          className={`mt-1.5 shrink-0 rounded-2xl border px-3 py-2 ${
            ics ? "border-court-300 bg-court-50" : "border-ink-200 bg-white"
          }`}
        >
          <p className="text-ink-900 text-[15px] font-bold">
            {ics ? "Subscribed" : "Add to your phone's calendar"}
          </p>
          <p className="text-ink-600 mt-0.5 text-[14px] font-medium leading-snug">
            {ics
              ? "Every game is in her own calendar now, and changes follow."
              : "Subscribe once, and the season follows into her own calendar."}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * One agenda row, the way `my-calendar.tsx` draws it: the date rail on the
 * left, then the item on a card whose left edge carries its kind's colour.
 * A practice is brand, a game is energy.
 */
function AgendaRow({ item, fresh }: { item: AgendaItem; fresh?: boolean }) {
  const game = item.kind === "game"
  return (
    <div
      className={`flex gap-2.5 rounded-xl border px-2.5 py-1.5 ${
        game ? "border-ink-100 bg-energy-soft/60" : "border-ink-100 bg-white"
      } ${fresh ? "live-row-in" : ""}`}
      style={{ borderLeft: `4px solid ${game ? "var(--energy, #f24e1e)" : "var(--brand, #4f46e5)"}` }}
    >
      <span className="w-[38px] shrink-0 text-center">
        <span className="text-ink-900 block text-[17px] font-extrabold leading-none tabular-nums">
          {item.day}
        </span>
        <span className="text-ink-400 block text-[14px] font-bold uppercase">{item.weekday}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink-700 block text-[14px] font-bold tabular-nums">{item.time}</span>
        <span className="text-ink-900 block truncate text-[15px] font-bold">{item.title}</span>
        <span className="text-ink-500 block truncate text-[14px] font-medium">{item.where}</span>
      </span>
    </div>
  )
}
