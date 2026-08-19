"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import type { DemoBeat, DemoScript } from "../types"
import { AppIcon } from "./your-week-story"

/**
 * "Planning a full league season", rebuilt to the realism standard
 * (mock-ui.tsx R1–R8) on 2026-08-19, over the cut the owner drove beat by beat
 * on 2026-08-16.
 *
 * WHAT THE OWNER RULED, AND WHAT SURVIVED IT. His 2026-08-16 round reshaped the
 * story, and none of that is touched here: the board is still the heart of it,
 * there is still no ambush, the click path is still Teams, the submission page,
 * plan step 2, divisions, the board, the requests, publish, and every claim
 * still has to be on screen to be made. What changed is FIDELITY: every screen
 * below is now the real component's markup, and every flow runs to its real
 * end state.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited).
 * All paths are under `app/(platform)/manage/leagues/[id]/seasons/[seasonId]`:
 *
 *   · the console shell is `manage/page.tsx`: SmartBack, the condensed
 *     uppercase h1 that carries the SEASON label, the league name under it,
 *     the status Badge, then the flat tab row (nine tabs, `-mb-px`, the
 *     play-600 underline on the selected one);
 *   · the opening screen is `manage/components/needs-attention.tsx`: four
 *     StatTiles (`components/ui/stat-tile.tsx`, rounded-3xl, condensed 4xl
 *     number) and the gold attention rows with their "Review →" verbs. This
 *     replaces three invented summary tiles the 08-16 cut carried;
 *   · the Teams tab is `manage/components/teams-tab.tsx`: PanelHeader, the
 *     TWO filter rows (status in play tones, payment in hoop), and the row the
 *     file describes as "triage only" — court-tinted, team name as a link, club
 *     and division beside it, LOWERCASE Badges, Approve/Reject only while
 *     pending, "Details →" always;
 *   · the application page is `teams/[submissionId]/page.tsx`: the h1 with its
 *     status and payment Badges, the club · division · applied line with
 *     "public page →", `submission-actions.tsx` (Approve, Reject, Withdraw,
 *     the weekend-preference ChipGroup, the schedule-requests gate, Mark paid,
 *     Waive fee), then the Entry fee panel's ONE sentence and the roster table
 *     with its waiver column;
 *   · plan step 2 is `plan/gyms-weekends-step.tsx`: the weekends table with
 *     month colgroups and 62px on/off buttons, `friday-declaration` verbatim,
 *     and the gym card with its role chip, its rental-order stepper, its
 *     courts pill, its hours line and the collapsed "Already have dates booked
 *     here?" control with the skip line under it;
 *   · the wizard rail is `plan/page.tsx`'s own `<ol>`, including the compact
 *     one-line form it takes on the board step;
 *   · divisions are `manage/components/division-setup.tsx`, and they are a
 *     MODAL reached from the Schedule tab (schedule-tab.tsx:637), not a panel:
 *     the resting Divisions card, then the overlay with "How many divisions?",
 *     the named list, "Who goes where?", the drag board with its dashed
 *     Unassigned pool, and the cross-play question;
 *   · the board is `plan/board-chrome.tsx` (the header bar, Undo, Redraw ▾,
 *     the Board/Strip Segmented, the verdict pill, the one loud verb),
 *     `plan/plan-ui.tsx` GymList (the tray) and GymMenu (the ⋯), and
 *     `plan/weekend-card.tsx` for the cards. Every gym is painted out of
 *     `plan/plan-shared.ts` VENUE_HUES — the home gym is court, Six Park is
 *     fuchsia, Haber is blue — so a gym is the same colour here as the product
 *     gives it. The grade chips are `plan/grade-chip.tsx` (six-dot grip, short
 *     label, team count in brackets);
 *   · the rail is `plan/work-rail.tsx`: the ink-100 head with its open count,
 *     the hoop problem row, and the idea row that reads
 *     from → to with a CountChip at each end and its cost line under it;
 *   · the Schedule tab is `manage/components/schedule-tab.tsx`: the gate card,
 *     the Preview panel in play tones with its When/Home/Away table, the gold
 *     draft banner with Publish beside it, and the games list rows with their
 *     Draft and status Badges;
 *   · fairness is `manage/components/summary-panel.tsx` FairnessSummaryTable,
 *     worst first by burden, zeros in court green, any flagged row gold;
 *   · schedule requests live on the APPLICATION page and nowhere else
 *     (`describeScheduleRequest` has exactly one caller), so the story now
 *     opens two application pages rather than a season-level list that does
 *     not exist. The pending row's three verbs and the Simulate panel are
 *     `teams/[submissionId]/schedule-request-actions.tsx` verbatim;
 *   · the phone is `/teams/[teamId]/calendar` — the page the publish
 *     notification actually links to — drawn as `team-calendar.tsx` renders it
 *     for a family: the practice-days line, `components/calendar/add-to-phone.tsx`,
 *     and the agenda through `components/calendar/agenda-list.tsx` (sticky
 *     month header, 60px date tile, practices white, games play-tinted);
 *   · the push is `api/seasons/[id]/schedule/publish/route.ts` word for word
 *     ("Game schedule published" / "{team}: {n} games scheduled in {season}.
 *     See them on your team calendar."), delivered as an iOS banner from the
 *     top of the handset with the approved app mark on it (R8).
 *
 * DELIBERATE DEPARTURES, ALL DECLARED:
 *   · THE LEAGUE CREST IS GONE from the console header. The 08-16 cut put the
 *     seeded NPH mark beside the season name; `manage/page.tsx` draws no crest
 *     there, and R1 outranks a decoration.
 *   · AMBER, NOT RED, on Nov 21 to 22. 84 games against 80 slots is `over` in
 *     `plan-shared.ts`, which paints hoop red. The owner ruled this weekend
 *     amber ("the board says so in amber", 2026-08-16 ruling #2) so the tension
 *     reads as a full house rather than a failure, and his ruling stands.
 *   · COMPOSITION, not invention: the pane is 1160x600 and the real pages are
 *     taller, so long screens scroll inside it exactly as they do in a browser
 *     (`Pane`), the teams list shows five of its 146 rows and says so, the
 *     weekend chooser wraps its sideways scroller into two half-year rows, and
 *     the board draws three of the season's month columns.
 *   · The "12 games guaranteed" panel the 08-16 cut drew on the application
 *     page is deleted: the product raises no such panel there. The guarantee is
 *     proved where the product really proves it, in the fairness table's Games
 *     and Games short columns.
 *
 * INVENTED-CONTENT LEDGER (everything not read from the seeded world):
 *   · the roster names on the application page are invented on purpose: real
 *     rosters are minors;
 *   · "Waivers outstanding 0" on the overview tiles, and the two league notes
 *     typed back to the clubs when their requests are approved;
 *   · the fairness table shows seven of its sixteen real columns, the four
 *     worst teams of 146;
 *   · every number still carries a line in `docs/roadmap/season-story-numbers.md`.
 */

/* ── Cast, all real ──────────────────────────────────────────────────────── */

const LEAGUE = "NPH Showcase League"
const SEASON = "Fall/Winter 2026-27"
const CTX_OVERVIEW = `${LEAGUE} · ${SEASON} · Overview`
const CTX_TEAMS = `${LEAGUE} · ${SEASON} · Teams`
const CTX_TEAM = `${LEAGUE} · ${SEASON} · Teams · Royal Crown Grade 10`
const CTX_PLAN = `${LEAGUE} · ${SEASON} · Plan your season`
const CTX_SCHEDULE = `${LEAGUE} · ${SEASON} · Schedule`
const CTX_OTTAWA = `${LEAGUE} · ${SEASON} · Teams · Ottawa Elite Grade 10`
const CTX_DRAGONS = `${LEAGUE} · ${SEASON} · Teams · Dragons de Gatineau`

const FEE = "$3,950.00"
/** Season start (Nov 1 2026) less the balance rule's 14 days. */
const FEE_DUE = "Oct 18, 2026"

/**
 * The league's buildings, in the product's own colour families
 * (`plan/plan-shared.ts` VENUE_HUES): slot 0 court for the gym they own, then
 * fuchsia and blue for the pool, in season order.
 */
const HUES = [
  {
    swatch: "bg-court-500",
    name: "text-court-700",
    chip: "border-court-200 bg-court-50 text-court-800",
    quiet: "text-court-600",
    box: "border-court-300",
    action: "border-court-300 text-court-700 bg-white",
  },
  {
    swatch: "bg-fuchsia-600",
    name: "text-fuchsia-700",
    chip: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
    quiet: "text-fuchsia-600",
    box: "border-fuchsia-300",
    action: "border-fuchsia-300 text-fuchsia-700 bg-white",
  },
  {
    swatch: "bg-blue-600",
    name: "text-blue-700",
    chip: "border-blue-200 bg-blue-50 text-blue-800",
    quiet: "text-blue-600",
    box: "border-blue-300",
    action: "border-blue-300 text-blue-700 bg-white",
  },
]
const PLAYGROUND = { name: "The Playground", short: "Playground", city: "Burlington", hue: 0 }
const SIX_PARK = { name: "Six Park East", short: "Six Park", city: "Oshawa", hue: 1 }
const HABER = { name: "Haber Recreation Centre", short: "Haber", city: "Burlington", hue: 2 }

/** `division-setup.tsx` DIV_COLORS: one colour word per division. */
const DIV_COLORS = [
  { dot: "bg-fuchsia-600", head: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200" },
  { dot: "bg-court-500", head: "bg-court-50 text-court-800 border-court-200" },
  { dot: "bg-blue-600", head: "bg-blue-50 text-blue-800 border-blue-200" },
  { dot: "bg-clay-500", head: "bg-clay-50 text-clay-800 border-clay-200" },
]

/**
 * THE CALENDAR (owner ruling: "the real NPH rhythm").
 *
 * Two or three weekends a month from late October to February, thirteen of
 * them, then three finals weekends in March. Seven candidate weekends stay off,
 * and they read off, because a wall of blue tells a league nothing.
 */
const WEEKEND_MONTHS = [
  {
    month: "Oct",
    weekends: [
      { label: "10–11", on: false },
      { label: "24–25", on: true },
      { label: "31–1", on: true },
    ],
  },
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
  {
    month: "Mar",
    weekends: [
      { label: "6–7", on: true },
      { label: "13–14", on: true },
      { label: "20–21", on: true },
    ],
  },
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
interface Section {
  gym: { short: string; hue: number }
  /** Courts the section uses, of the courts the plan holds there. */
  used: number
  courts: number
  free?: number
  grades: Array<{ label: string; teams: number }>
  assumed?: boolean
  id?: string
  menuId?: string
  dragging?: boolean
}
interface Card {
  id?: string
  date: string
  is: number
  of: number
  tone: "fits" | "tight"
  sections: Section[]
}

const OCT: Card[] = [
  {
    date: "Oct 24–25",
    is: 62,
    of: 80,
    tone: "fits",
    sections: [
      {
        gym: PLAYGROUND,
        used: 3,
        courts: 3,
        grades: [
          { label: "Gr 7", teams: 12 },
          { label: "Gr 11", teams: 24 },
        ],
      },
      {
        gym: SIX_PARK,
        used: 2,
        courts: 6,
        free: 4,
        assumed: true,
        grades: [{ label: "Gr 12", teams: 26 }],
      },
    ],
  },
  {
    date: "Oct 31–Nov 1",
    is: 33,
    of: 48,
    tone: "fits",
    sections: [
      {
        gym: PLAYGROUND,
        used: 3,
        courts: 3,
        grades: [
          { label: "Gr 9", teams: 25 },
          { label: "Jr Girls", teams: 8 },
        ],
      },
    ],
  },
]

const DEC: Card[] = [
  {
    date: "Dec 5–6",
    is: 49,
    of: 80,
    tone: "fits",
    sections: [
      { gym: PLAYGROUND, used: 3, courts: 3, grades: [{ label: "Gr 9", teams: 25 }] },
      {
        gym: HABER,
        used: 2,
        courts: 6,
        free: 4,
        assumed: true,
        grades: [{ label: "Gr 11", teams: 24 }],
      },
    ],
  },
  {
    date: "Dec 12–13",
    is: 42,
    of: 48,
    tone: "fits",
    sections: [{ gym: PLAYGROUND, used: 3, courts: 3, grades: [{ label: "Gr 10", teams: 42 }] }],
  },
]

/** November, the column the story happens in, in its four states. */
function november(moved: boolean, court: boolean, dragging: boolean): Card[] {
  const spill: Section = {
    gym: SIX_PARK,
    used: court ? 3 : 2,
    courts: 6,
    free: court ? 3 : 4,
    assumed: true,
    grades: [{ label: "Gr 10", teams: 42 }],
    id: "block-sixpark",
    menuId: "sixpark-menu",
    dragging,
  }
  return [
    {
      id: "card-nov21",
      date: "Nov 21–22",
      is: moved ? 42 : 84,
      of: moved ? 48 : 80,
      tone: moved ? "fits" : "tight",
      sections: [
        {
          gym: PLAYGROUND,
          used: 3,
          courts: 3,
          grades: [
            { label: "Gr 8", teams: 9 },
            { label: "Gr 9", teams: 25 },
            { label: "Jr Girls", teams: 8 },
          ],
        },
        ...(moved ? [] : [spill]),
      ],
    },
    {
      id: "card-nov28",
      date: "Nov 28–29",
      is: moved ? 78 : 36,
      of: moved ? (court ? 96 : 80) : 48,
      tone: "fits",
      sections: [
        {
          gym: PLAYGROUND,
          used: 3,
          courts: 3,
          grades: [
            { label: "Gr 7", teams: 12 },
            { label: "Gr 11", teams: 24 },
          ],
        },
        ...(moved ? [spill] : []),
      ],
    },
  ]
}

/** The rail's own sentences (`work-rail.tsx` + `planner-core.ts`). */
const RAIL_PROBLEM = { label: "Nov 21–22", is: 84, of: 80 }
const RAIL_IDEA = {
  lead: "Move Six Park East's 42 games",
  from: "Nov 21–22",
  to: "Nov 28–29",
  over: 4,
  left: 2,
  cost: "Six Park East needs a third court on Nov 28–29. Grade 10 plays at Six Park that weekend.",
}
const RAIL_ASK = "This calendar rents 20 court-days · 200 court-hours"

/* ── The teams list ──────────────────────────────────────────────────────── */

interface Entry {
  team: string
  club: string
  division: string
  status: "APPROVED" | "PENDING" | "REJECTED"
  payment: "paid" | "unpaid" | "overdue"
  id?: string
}

/** Eight of the 146, the way the list opens: every club name is the world's. */
const ENTRIES: Entry[] = [
  {
    team: "Royal Crown Grade 10",
    club: "Royal Crown",
    division: "Grade 10 Boys · Division B",
    status: "PENDING",
    payment: "unpaid",
    id: "row-royal",
  },
  {
    team: "Burloak Elite Grade 9",
    club: "Burloak Elite",
    division: "Grade 9 Boys · Division A",
    status: "PENDING",
    payment: "unpaid",
    id: "row-burloak",
  },
  {
    team: "Dragons de Gatineau U17",
    club: "Dragons de Gatineau",
    division: "Grade 11 Boys · Division A",
    status: "PENDING",
    payment: "unpaid",
  },
  {
    team: "MBA Grade 7",
    club: "MBA",
    division: "Grade 7 Boys",
    status: "PENDING",
    payment: "unpaid",
  },
  {
    team: "PDM Basketball Grade 7",
    club: "PDM Basketball",
    division: "Grade 7 Boys",
    status: "APPROVED",
    payment: "paid",
  },
  {
    team: "City Above Elite Grade 7",
    club: "City Above Elite",
    division: "Grade 7 Boys",
    status: "APPROVED",
    payment: "paid",
  },
  {
    team: "Ottawa Elite Grade 10",
    club: "Ottawa Elite",
    division: "Grade 10 Boys · Division B",
    status: "APPROVED",
    payment: "paid",
  },
  {
    team: "HoopHer Junior Girls",
    club: "HoopHer",
    division: "Junior Girls",
    status: "APPROVED",
    payment: "unpaid",
  },
]

/** The submitted roster. Fictional players by design: real rosters are minors. */
const ROSTER = [
  { n: 7, name: "J. Reyes", age: 15, pos: "Guard" },
  { n: 4, name: "A. Osei", age: 16, pos: "Guard" },
  { n: 12, name: "D. Mensah", age: 15, pos: "Forward" },
  { n: 8, name: "K. Tremblay", age: 16, pos: "Forward" },
  { n: 23, name: "M. Rahim", age: 15, pos: "Centre" },
]

/* ── Divisions ───────────────────────────────────────────────────────────── */

const G10_POOL = [
  "Royal Crown",
  "Ottawa Elite",
  "City Above Elite",
  "PDM Basketball",
  "MBA",
  "Burloak Elite",
]
const G10_DIVISIONS = [
  { name: "Grade 10 · A", teams: ["Burloak Elite", "CE23 Academy", "M and R"] },
  { name: "Grade 10 · B", teams: ["Royal Crown", "Ottawa Elite", "Barrie Bucs"] },
  { name: "Grade 10 · C", teams: ["City Above Elite", "HoopHer 10", "PDM"] },
  { name: "Grade 10 · D", teams: ["MBA", "Dragons", "Six Park Sel."] },
]

/* ── Fairness, worst team first ──────────────────────────────────────────── */

const FAIRNESS = [
  { team: "Dragons de Gatineau", burden: 2, games: 10, short: 0, b2b: 0, waits: 0, twoGyms: 0 },
  { team: "Barrie Buccaneers", burden: 2, games: 10, short: 0, b2b: 0, waits: 0, twoGyms: 0 },
  { team: "HoopHer 10", burden: 1, games: 10, short: 0, b2b: 0, waits: 0, twoGyms: 0 },
  { team: "Royal Crown Grade 10", burden: 0, games: 10, short: 0, b2b: 0, waits: 0, twoGyms: 0 },
]

/* ── Requests ────────────────────────────────────────────────────────────── */

const REQ_OTTAWA = "Games every Saturday start no earlier than 12:00"
const REQ_GATINEAU = "Games every Sunday finish no later than 17:00"

/* ── The published weekend, and one family's phone ───────────────────────── */

/**
 * The league's own list, and the thing it proves: every team's two games are on
 * ONE day, at ONE building. That is the trip a family drives.
 */
const PUBLISHED: Array<[string, string, string, string]> = [
  ["Sat Nov 28 · 10:00 AM", "Royal Crown Grade 10", "Ottawa Elite Grade 10", "Six Park East · Court 3"],
  ["Sat Nov 28 · 10:00 AM", "Burloak Elite Grade 10", "CE23 Academy", "Six Park East · Court 1"],
  ["Sat Nov 28 · 10:00 AM", "City Above Elite", "HoopHer 10", "Six Park East · Court 2"],
  ["Sat Nov 28 · 11:15 AM", "MBA Grade 10", "Dragons de Gatineau", "Six Park East · Court 1"],
  ["Sat Nov 28 · 12:30 PM", "Barrie Buccaneers", "Royal Crown Grade 10", "Six Park East · Court 3"],
  ["Sat Nov 28 · 12:30 PM", "M and R Basketball", "Burloak Elite Grade 10", "Six Park East · Court 1"],
  ["Sat Nov 28 · 12:30 PM", "PDM Basketball", "City Above Elite", "Six Park East · Court 2"],
  ["Sat Nov 28 · 1:45 PM", "Six Park Selects", "MBA Grade 10", "Six Park East · Court 2"],
]

/**
 * Jordan's team calendar on his mother's phone. The practices are already there
 * before the league publishes anything; the games fill in AROUND them.
 */
interface AgendaItem {
  day: string
  weekday: string
  kind: "practice" | "game"
  time: string
  detail: string
}
const PRACTICES: AgendaItem[] = [
  { day: "19", weekday: "Thu", kind: "practice", time: "7:00 PM", detail: "90 min · The Playground" },
  { day: "24", weekday: "Tue", kind: "practice", time: "7:00 PM", detail: "90 min · The Playground" },
]
const HER_GAMES: AgendaItem[] = [
  {
    day: "28",
    weekday: "Sat",
    kind: "game",
    time: "10:00 AM vs Ottawa Elite Grade 10",
    detail: "Six Park East · Court 3",
  },
  {
    day: "28",
    weekday: "Sat",
    kind: "game",
    time: "12:30 PM at Barrie Buccaneers",
    detail: "Six Park East · Court 3",
  },
]

/** `api/seasons/[id]/schedule/publish/route.ts` lines 105 to 106, verbatim. */
const PUSH_TITLE = "Game schedule published"
const PUSH_BODY = `Royal Crown Grade 10: 10 games scheduled in ${LEAGUE} ${SEASON}. See them on your team calendar.`

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  /* Human pace (owner 2026-08-19): people click, then click again. Long reads
     only where a balloon earns one. */
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const seasonStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/manage/leagues/nph-showcase/seasons/fall-winter-2026-27/manage?tab=overview",
  context: CTX_OVERVIEW,
  initialStage: "desktop",
  roles: {
    desktop: { label: "League", tone: "league" },
    phone: { label: "Parent", tone: "parent" },
  },
  chapters: [
    { id: "entries", title: "Teams come in" },
    { id: "buildings", title: "The buildings" },
    { id: "divisions", title: "Divisions" },
    { id: "board", title: "The board" },
    { id: "requests", title: "Two requests" },
    { id: "publish", title: "Publish once" },
  ],

  /* ENGINE LAW, obeyed everywhere below: a beat's `set` applies at its START,
     so a press whose own patch removes its target deletes the thing the cursor
     is flying at. Every press is its own beat; the landing is the next one. */
  beats: [
    /* ── 1. Teams come in ─────────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "entries",
      caption: "146 teams entered themselves, and four applications are waiting on the league.",
      emphasize: "attn-pending",
      callout: "Clubs enter their own teams. The league only answers the last few.",
      set: { screen: "overview" },
    }),
    paced({
      id: "review",
      chapter: "entries",
      caption: "The season's own summary points at them.",
      cursor: "attn-review",
      press: true,
    }),
    paced({
      id: "teams-land",
      chapter: "entries",
      caption: "Every team in the season, in one list.",
      context: CTX_TEAMS,
      set: { screen: "teams" },
      emphasize: "filters",
    }),
    paced({
      id: "pending",
      chapter: "entries",
      caption: "The league filters down to the four still pending.",
      cursor: "filter-pending",
      press: true,
    }),
    paced({
      id: "pending-land",
      chapter: "entries",
      caption: "Four rows, each with the same two verbs on it.",
      set: { filter: "PENDING" },
    }),
    paced({
      id: "open-team",
      chapter: "entries",
      caption: "Royal Crown entered a Grade 10 team.",
      cursor: "row-royal",
      press: true,
      callout: "One application, one decision, and the club is not in until it is made.",
    }),
    paced({
      id: "team-land",
      chapter: "entries",
      caption: "The whole application on one page: roster, waivers, fee.",
      context: CTX_TEAM,
      set: { screen: "team" },
    }),
    paced({
      id: "one-trip",
      chapter: "entries",
      caption: "The club asked for both weekend games on the same day.",
      emphasize: "weekend-pref",
      callout: "The schedule has to keep this, and later in the story it is checked.",
    }),
    paced({
      id: "approve",
      chapter: "entries",
      caption: "The league approves it.",
      cursor: "approve",
      press: true,
    }),
    paced({
      id: "approved",
      chapter: "entries",
      caption: `${FEE}, balance due ${FEE_DUE}.`,
      set: { approved: true },
      emphasize: "fee-panel",
      toast: "Royal Crown Grade 10 approved",
      callout: "The fee is raised by the approval itself. Nobody types an invoice.",
    }),
    paced({
      id: "inline",
      chapter: "entries",
      caption: "The other three are answered from the list.",
      context: CTX_TEAMS,
      set: { screen: "teams", filter: "PENDING" },
      cursor: "approve-burloak",
      press: true,
    }),
    paced({
      id: "cleared",
      chapter: "entries",
      caption: "146 teams, 145 approved, one rejected. Nothing is waiting.",
      set: { closed: true, filter: "ALL" },
      emphasize: "filters",
      toast: "3 applications approved",
      callout: "Every team is known, and every fee is raised, before a game is drawn.",
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
      callout: "Choosing a weekend books nothing. It tells the draw which ones to fill first.",
    }),
    paced({
      id: "friday",
      chapter: "buildings",
      caption: "NPH keeps Fridays clear.",
      emphasize: "friday",
    }),
    paced({
      id: "home",
      chapter: "buildings",
      caption: "The home court: The Playground, in Burlington.",
      emphasize: "gym-home",
      set: { scroll: 1 },
    }),
    paced({
      id: "floaters",
      chapter: "buildings",
      caption: "Then the floaters: Six Park East and Haber, both in the pool.",
      set: { scroll: 2 },
      emphasize: "gym-sixpark",
      callout: "Neither is on the calendar yet. The draw decides which weekends need them.",
    }),
    paced({
      id: "bookings",
      chapter: "buildings",
      caption: "One date is booked at Six Park East.",
      cursor: "gym-bookings",
      press: true,
    }),
    paced({
      id: "bookings-land",
      chapter: "buildings",
      caption: "And the league does not have to book the rest first.",
      set: { skip: true, scroll: 3 },
      emphasize: "bookings-skip",
    }),

    /* ── 3. Divisions ─────────────────────────────────────────────────── */
    paced({
      id: "to-schedule",
      chapter: "divisions",
      caption: "The Schedule tab, before anything has been built.",
      context: CTX_SCHEDULE,
      set: { screen: "schedule", scroll: 0 },
      emphasize: "gate",
    }),
    paced({
      id: "open-div",
      chapter: "divisions",
      caption: "Grade 10 came in 42 teams deep.",
      cursor: "setup-divisions",
      press: true,
      callout: "Forty two teams in one table is a season nobody can win or read.",
    }),
    paced({
      id: "div-land",
      chapter: "divisions",
      caption: "Nothing is created unless the league sets it up.",
      set: { dialog: "divisions" },
    }),
    paced({
      id: "how-many",
      chapter: "divisions",
      caption: "Four divisions, about eleven teams each.",
      cursor: "div-4",
      press: true,
    }),
    paced({
      id: "how-many-land",
      chapter: "divisions",
      caption: "Named, and each one keeps its colour for the rest of the season.",
      set: { shape: true },
    }),
    paced({
      id: "deal",
      chapter: "divisions",
      caption: "Dealing them out is a starting point, not a verdict.",
      cursor: "deal",
      press: true,
    }),
    paced({
      id: "deal-land",
      chapter: "divisions",
      caption: "An even split to start from.",
      set: { dealt: true },
    }),
    paced({
      id: "drag-team",
      chapter: "divisions",
      caption: "The league picks a team up.",
      cursor: "chip-city",
    }),
    paced({
      id: "drag-drop",
      chapter: "divisions",
      caption: "And drops it in the division it belongs in.",
      cursor: "div-col-b",
      press: true,
    }),
    paced({
      id: "crossplay",
      chapter: "divisions",
      caption: "Then whether the divisions may play each other.",
      set: { divMoved: true },
      cursor: "cross-yes",
      press: true,
    }),
    paced({
      id: "crossplay-land",
      chapter: "divisions",
      caption: "Divisions that never meet make a thin schedule. These may mix.",
      set: { cross: true },
    }),
    paced({
      id: "create",
      chapter: "divisions",
      caption: "Four divisions, created.",
      cursor: "create-div",
      press: true,
    }),
    paced({
      id: "created",
      chapter: "divisions",
      caption: "Grade 10 runs as four from here on.",
      set: { created: true, dialog: "" },
      toast: "Grade 10 · 4 divisions created",
      emphasize: "div-card",
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
    }),
    paced({
      id: "rail-land",
      chapter: "board",
      caption: "It names the weekend, the shortfall, and the move that clears it.",
      set: { rail: true },
      emphasize: "rail-idea",
      holdMs: 2200,
      callout: "Nobody hunted for this. The board did the arithmetic and wrote the fix.",
    }),
    paced({
      id: "drag-lift",
      chapter: "board",
      caption: "The league takes the whole Six Park block off that weekend.",
      cursor: "block-sixpark",
      callout: "One grip, and a building's whole weekend moves together.",
    }),
    paced({
      id: "drag-drop",
      chapter: "board",
      caption: "And drops it on the 28th.",
      set: { dragging: true },
      cursor: "card-nov28",
      press: true,
    }),
    paced({
      id: "drop-land",
      chapter: "board",
      caption: "The 21st fits now. The 28th has the games but not the courts.",
      set: { dragging: false, blockMoved: true },
      emphasize: "card-nov28",
    }),
    paced({
      id: "menu",
      chapter: "board",
      caption: "Six Park East has six courts. This weekend used two.",
      cursor: "sixpark-menu",
      press: true,
    }),
    paced({
      id: "menu-land",
      chapter: "board",
      caption: "The gym's own menu, for this gym on this date.",
      set: { menu: true },
      emphasize: "sixpark-menu-panel",
      callout: "One phone call to the gym, and the league records what it got.",
    }),
    paced({
      id: "court",
      chapter: "board",
      caption: "Three courts on the 28th, and only on the 28th.",
      cursor: "court-apply",
      press: true,
    }),
    paced({
      id: "court-land",
      chapter: "board",
      caption: "Every weekend now fits the gym time this league really has.",
      set: { menu: false, court: true },
      emphasize: "verdict",
      toast: "Six Park East · 3 courts on Nov 28–29",
    }),
    paced({
      id: "generate",
      chapter: "board",
      caption: "The calendar goes to the scheduler.",
      cursor: "generate",
      press: true,
      callout: "One press builds all 730 games on the calendar above.",
    }),
    paced({
      id: "result",
      chapter: "board",
      caption: "730 games, none of them left over.",
      context: CTX_SCHEDULE,
      set: { screen: "schedule", run: 1, scroll: 1 },
      emphasize: "preview",
      callout: "It fits because the gym time was made to fit first, not after.",
    }),
    paced({
      id: "fairness",
      chapter: "board",
      caption: "And the league reads it worst team first.",
      set: { fairness: true, scroll: 2 },
      emphasize: "fairness",
      holdMs: 2200,
      callout: "This is the worst treated team in the league. The zeros are the point.",
    }),
    paced({
      id: "guarantee",
      chapter: "board",
      caption: "Ten games each, nobody short of what the league promised.",
      emphasize: "fair-short",
    }),

    /* ── 5. Two requests ──────────────────────────────────────────────── */
    paced({
      id: "requests",
      chapter: "requests",
      caption: "Clubs ask for things, and the asks are about the drive.",
      context: CTX_OTTAWA,
      set: { screen: "req-ottawa", scroll: 0 },
      emphasize: "req-ottawa",
      callout: "Ottawa Elite leave home at six. Nothing before noon on Saturday.",
    }),
    paced({
      id: "honored",
      chapter: "requests",
      caption: "Approved, with the league's own note back to the club.",
      emphasize: "req-ottawa-note",
    }),
    paced({
      id: "pending-req",
      chapter: "requests",
      caption: "Gatineau drive further, and asked to be finished by five on Sunday.",
      context: CTX_DRAGONS,
      set: { screen: "req-dragons" },
      emphasize: "req-dragons",
      callout: "It is a five hour drive home. What would saying yes cost everyone else?",
    }),
    paced({
      id: "simulate",
      chapter: "requests",
      caption: "So the league prices it first.",
      cursor: "simulate",
      press: true,
    }),
    paced({
      id: "cost",
      chapter: "requests",
      caption: "Nobody else moves.",
      set: { sim: true },
      emphasize: "sim-result",
      holdMs: 1600,
      callout: "Simulate runs the season with the request and without, then diffs them.",
    }),
    paced({
      id: "approve-req",
      chapter: "requests",
      caption: "The league approves it.",
      cursor: "approve-req",
      press: true,
    }),
    paced({
      id: "approved-req",
      chapter: "requests",
      caption: "And the club is told, in the league's own words.",
      set: { reqApproved: true },
      emphasize: "req-dragons-note",
      toast: "Request approved · Dragons de Gatineau",
    }),

    /* ── 6. Publish once ──────────────────────────────────────────────── */
    paced({
      id: "commit",
      chapter: "publish",
      caption: "Committing saves the season. It does not release it.",
      context: CTX_SCHEDULE,
      set: { screen: "schedule", scroll: 0 },
      cursor: "commit",
      press: true,
    }),
    paced({
      id: "commit-dialog",
      chapter: "publish",
      caption: "Saved as a draft, and clubs and families see nothing yet.",
      set: { dialog: "commit" },
      callout: "The league can rebuild this as often as it likes until the day it publishes.",
    }),
    paced({
      id: "commit-ok",
      chapter: "publish",
      caption: "Commit the whole season.",
      cursor: "confirm-commit",
      press: true,
    }),
    paced({
      id: "draft",
      chapter: "publish",
      caption: "730 draft games, visible only to the league.",
      set: { dialog: "", committed: true },
      emphasize: "draft-banner",
      toast: "Saved as a draft · 730 games",
    }),
    paced({
      id: "pairs",
      chapter: "publish",
      caption: "Read down the weekend: every team plays twice on one day.",
      emphasize: "schedule-list",
      holdMs: 2400,
      callout: "Two games, one day, one building. That is one drive, not two.",
    }),
    paced({
      id: "phone-in",
      actor: "phone", // her phone, before the publish
      chapter: "publish",
      caption: "On Priya's phone, Jordan's practices are already there.",
      stage: "split",
      emphasize: "phone-cal",
      callout: "The club's practices have been on this calendar since September.",
    }),
    paced({
      id: "publish",
      actor: "desktop", // the league presses publish
      chapter: "publish",
      caption: "One press, once, when the league is ready.",
      cursor: "publish",
      press: true,
    }),
    paced({
      id: "publish-dialog",
      chapter: "publish",
      caption: "730 draft games go live.",
      set: { dialog: "publish" },
      callout: "The only irreversible press in the story, and the league picks when.",
    }),
    paced({
      id: "publish-ok",
      chapter: "publish",
      caption: "Publish.",
      cursor: "confirm-publish",
      press: true,
    }),
    paced({
      id: "published",
      chapter: "publish",
      caption: "One notice each, and it knows which team is theirs.",
      set: { dialog: "", published: true, banner: true },
      emphasize: "push",
      toast: "Schedule published · 730 games are live",
      callout: "Not one notice per game. One, naming the team and how many games it has.",
    }),
    paced({
      id: "tap-push",
      actor: "phone", // her calendar fills
      chapter: "publish",
      caption: "It opens the team's own calendar.",
      cursor: "push-open",
      press: true,
    }),
    paced({
      id: "cal",
      chapter: "publish",
      caption: "And the games fill in around the practices.",
      set: { banner: false, calFilled: true },
      emphasize: "phone-cal",
      callout: "Both of Saturday's games, at one gym, beside the practices already there.",
    }),
    paced({
      id: "everyone",
      chapter: "publish",
      caption: "Every calendar in the league filled at the same moment.",
      emphasize: "schedule-list",
      callout: "Parents, coaches, team managers and club owners each see their own.",
    }),
    paced({
      id: "ics",
      chapter: "publish",
      caption: "And she can subscribe her own calendar to it.",
      cursor: "add-phone",
      press: true,
    }),
    paced({
      id: "ics-land",
      chapter: "publish",
      caption: "Subscribe once, and every later change follows into it.",
      set: { ics: true },
      emphasize: "ics-panel",
    }),
    paced({
      id: "subscribed",
      chapter: "publish",
      caption: "Her phone's own calendar takes it from here.",
      set: { sheet: true },
      hold: 3400,
    }),
    paced({
      id: "end",
      chapter: "publish",
      caption:
        "146 teams answered, three buildings, one weekend fixed on the board, 730 games drawn and published once.",
      stage: "desktop",
      hold: 4600,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get }) => {
    const screen = get<string>("screen", "overview")
    const dialog = get<string>("dialog", "")
    const closed = get("closed", false)
    const approved = get("approved", false)
    const committed = get("committed", false)
    const published = get("published", false)
    const scroll = get("scroll", 0)

    const desktop = (
      /* `globals.css` body: white, lit by two faint corner radials. */
      <div
        className="relative flex h-full flex-col bg-white"
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, rgba(99, 102, 241, 0.05), transparent 22%), radial-gradient(circle at top right, rgba(242, 78, 30, 0.04), transparent 18%)",
        }}
      >
        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {screen === "overview" && <OverviewScreen />}
          {screen === "teams" && (
            <TeamsScreen closed={closed} approved={approved} filter={get<string>("filter", "ALL")} />
          )}
          {screen === "team" && <SubmissionScreen approved={approved} />}
          {screen === "plan" && <PlanScreen skip={get("skip", false)} scroll={scroll} />}
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
              created={get("created", false)}
              run={get("run", 0)}
              fairness={get("fairness", false)}
              committed={committed}
              published={published}
              scroll={scroll}
            />
          )}
          {screen === "req-ottawa" && <RequestScreen team="ottawa" />}
          {screen === "req-dragons" && (
            <RequestScreen
              team="dragons"
              sim={get("sim", false)}
              approved={get("reqApproved", false)}
            />
          )}
        </div>

        {dialog === "divisions" && (
          <DivisionsDialog
            shape={get("shape", false)}
            dealt={get("dealt", false)}
            moved={get("divMoved", false)}
            cross={get("cross", false)}
          />
        )}

        {/* `schedule-tab.tsx` guards both of these with window.confirm; the
            scene has no browser chrome to hang a native sheet on, so they are
            drawn as the product's own dialog with the confirm's exact words. */}
        <ConfirmDialog
          open={dialog === "commit"}
          title="Save the whole season's schedule?"
          lines={[
            "All existing un-played games are replaced.",
            "Saved as a DRAFT. Clubs and families see nothing until you publish.",
          ]}
          confirmId="confirm-commit"
          confirmLabel="Commit whole season"
        />
        <ConfirmDialog
          open={dialog === "publish"}
          title="Publish the schedule?"
          lines={[
            "730 draft games go live.",
            "Clubs and families get ONE notification pointing at their team calendar.",
          ]}
          confirmId="confirm-publish"
          confirmLabel="Publish"
        />

        {get("endCard", false) && <EndCard />}
      </div>
    )

    const phone = (
      <Phone
        filled={get("calFilled", false)}
        banner={get("banner", false)}
        ics={get("ics", false)}
        sheet={get("sheet", false)}
      />
    )

    return { desktop, phone }
  },
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SHARED PRIMITIVES, copied from the product's own kit
 * ═══════════════════════════════════════════════════════════════════════════ */

/** `components/ui/badge.tsx`, tones and shape verbatim. */
const BADGE_TONES = {
  neutral: "bg-ink-50 text-ink-600 ring-ink-200",
  play: "bg-play-50 text-play-700 ring-play-100",
  hoop: "bg-hoop-50 text-hoop-600 ring-hoop-100",
  court: "bg-court-50 text-court-700 ring-court-100",
  gold: "bg-gold-50 text-gold-600 ring-gold-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  danger: "bg-red-50 text-red-600 ring-red-100",
} as const

function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode
  tone?: keyof typeof BADGE_TONES
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ring-1 ring-inset",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/** `components/ui/panel-header.tsx`: brand accent bar, condensed uppercase. */
function PanelHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1",
        Boolean(action) && "justify-between",
        className
      )}
    >
      <span className="flex items-center gap-2.5">
        <span className="h-5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
        <span className="font-condensed text-ink-950 text-lg font-bold uppercase leading-none tracking-wide">
          {title}
        </span>
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  )
}

/** `manage/components/types.ts` panelClass. */
const PANEL =
  "rounded-3xl border border-ink-100 bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"

/** `components/ui/button.tsx` at the sizes and tones these screens use. */
function Button({
  children,
  id,
  tone = "play",
  variant = "solid",
  className,
}: {
  children: ReactNode
  id?: string
  tone?: "play" | "court" | "hoop"
  variant?: "solid" | "secondary" | "subtle"
  className?: string
}) {
  const solid =
    tone === "court" ? "bg-court-600 text-white" : tone === "hoop" ? "bg-hoop-600 text-white" : "bg-play-600 text-white"
  const secondary =
    tone === "court"
      ? "border-court-300 text-court-700 bg-white"
      : tone === "hoop"
        ? "border-hoop-300 text-hoop-700 bg-white"
        : "border-play-300 text-play-700 bg-white"
  return (
    <span
      data-demo-target={id}
      className={cn(
        "inline-flex shrink-0 cursor-default items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-shadow duration-150 data-[demo-press=true]:shadow-inner data-[demo-press=true]:brightness-95 motion-reduce:transition-none",
        variant === "solid" && solid,
        variant === "secondary" && cn("border", secondary),
        variant === "subtle" && "border-ink-200 text-ink-700 border bg-white",
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * A real page is taller than the 600 the stage gives it, so the pane scrolls
 * exactly as a browser would. Nothing is hidden; the column moves.
 */
function Pane({ offset, children }: { offset: number; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <div
        className="transition-transform duration-500 ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(${-offset}px)` }}
      >
        {children}
      </div>
    </div>
  )
}

/* ── The season console shell (`manage/page.tsx`) ────────────────────────── */

const TABS = [
  "Overview",
  "Clubs",
  "Teams",
  "Plan Your Season",
  "Schedule",
  "Standings",
  "Playoffs",
  "Referees",
  "⚙ Settings",
]

function Console({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl min-h-0 flex-col px-6 py-3">
      <p className="text-ink-500 shrink-0 text-sm font-medium">&larr; {LEAGUE}</p>
      <div className="mt-1 shrink-0">
        <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase leading-none tracking-wide">
          {SEASON}
        </h1>
        <p className="text-ink-500 mt-1 text-sm">{LEAGUE}</p>
        <Badge className="mt-2" tone="play">
          Open for Registration
        </Badge>
      </div>
      <div className="border-ink-100 mt-3 flex shrink-0 flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <span
            key={t}
            className={cn(
              "relative -mb-px whitespace-nowrap px-3 py-2.5 text-sm font-semibold",
              t === tab ? "text-play-600" : "text-ink-500"
            )}
          >
            {t}
            {t === tab && (
              <span className="bg-play-600 absolute inset-x-2 -bottom-px h-0.5 rounded-full" />
            )}
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1 pt-4">{children}</div>
    </div>
  )
}

/* ── Overview: needs-attention.tsx ───────────────────────────────────────── */

const TILE_TONES = {
  brand: { num: "text-[color:var(--brand-ink)]" },
  court: { num: "text-court-700" },
  gold: { num: "text-gold-600" },
  hoop: { num: "text-hoop-600" },
} as const

function StatTile({
  value,
  label,
  tone,
  sub,
}: {
  value: number
  label: string
  tone: keyof typeof TILE_TONES
  sub?: string
}) {
  return (
    <div className="border-ink-100 relative overflow-hidden rounded-3xl border bg-white p-4 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span />
        {sub && (
          <span className="text-ink-500 bg-ink-50 rounded-full px-2 py-0.5 text-[11px] font-semibold">
            {sub}
          </span>
        )}
      </div>
      <div className={cn("font-condensed text-4xl font-bold leading-none", TILE_TONES[tone].num)}>
        {value}
      </div>
      <div className="text-ink-500 mt-1.5 text-sm font-medium">{label}</div>
    </div>
  )
}

function OverviewScreen() {
  return (
    <Console tab="Overview">
      <div className={PANEL}>
        <div className="mb-4 grid grid-cols-4 gap-3">
          <StatTile value={82} label="Clubs entered" tone="brand" />
          <StatTile value={141} label="Teams approved" tone="court" sub="of 146" />
          <StatTile value={4} label="Applications pending" tone="gold" />
          <StatTile value={0} label="Waivers outstanding" tone="hoop" />
        </div>
        <div className="grid gap-1.5">
          <div
            data-demo-target="attn-pending"
            className="bg-gold-50 border-gold-100 flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
          >
            <span className="text-ink-800 text-sm">4 team applications waiting for review</span>
            <span
              data-demo-target="attn-review"
              className="text-play-600 shrink-0 text-xs font-semibold"
            >
              Review &rarr;
            </span>
          </div>
          <div className="bg-gold-50 border-gold-100 flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
            <span className="text-ink-800 text-sm">
              5 approved teams with entry fee owing
            </span>
            <span className="text-play-600 shrink-0 text-xs font-semibold">See clubs &rarr;</span>
          </div>
        </div>
      </div>
    </Console>
  )
}

/* ── Teams tab (`manage/components/teams-tab.tsx`) ───────────────────────── */

function TeamsScreen({
  closed,
  approved,
  filter,
}: {
  closed: boolean
  approved: boolean
  filter: string
}) {
  /* One source for the rows and for every count on the screen. */
  const rows = ENTRIES.map((r) =>
    r.status === "PENDING" && (closed || (approved && r.id === "row-royal"))
      ? { ...r, status: "APPROVED" as const }
      : r
  )
  const pending = rows.filter((r) => r.status === "PENDING")
  /* The 146-row list, counted whole; the pane shows the first eight. */
  const pendingAll = closed ? 0 : approved ? 3 : 4
  const shown = filter === "PENDING" ? pending : rows.slice(0, 5)

  const statusFilters = [
    { key: "ALL", label: "All (146)" },
    { key: "PENDING", label: `Pending (${pendingAll})` },
    { key: "APPROVED", label: `Approved (${145 - pendingAll})` },
    { key: "REJECTED", label: "Rejected (1)" },
  ]

  return (
    <Console tab="Teams">
      <div className={cn(PANEL, "flex h-full min-h-0 flex-col p-5")}>
        <PanelHeader
          className="mb-3 shrink-0"
          title="Registered teams"
          action={
            <span data-demo-target="filters" className="flex flex-col items-end gap-1">
              <span className="flex flex-wrap items-center justify-end gap-1">
                {statusFilters.map((o) => (
                  <span
                    key={o.key}
                    data-demo-target={o.key === "PENDING" ? "filter-pending" : undefined}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium",
                      filter === o.key ? "bg-play-100 text-play-700" : "bg-ink-50 text-ink-500"
                    )}
                  >
                    {o.label}
                  </span>
                ))}
              </span>
              <span className="flex flex-wrap items-center justify-end gap-1">
                {["Any payment", `Unpaid (${18 - (closed ? 0 : 4)})`, "Paid (128)"].map((l, i) => (
                  <span
                    key={l}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-medium",
                      i === 0 ? "bg-hoop-100 text-hoop-700" : "bg-ink-50 text-ink-500"
                    )}
                  >
                    {l}
                  </span>
                ))}
              </span>
            </span>
          }
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          {shown.map((r) => (
            <div
              key={r.team}
              data-demo-target={r.id}
              className="border-court-100 bg-court-50 mb-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
            >
              <div className="min-w-0 flex-1 truncate">
                <span className="text-ink-900 font-medium">{r.team}</span>
                <span className="text-ink-500 ml-2 text-xs">{r.club}</span>
                <span className="text-play-700 ml-2 text-xs">{r.division}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  tone={
                    r.status === "APPROVED" ? "court" : r.status === "PENDING" ? "gold" : "hoop"
                  }
                >
                  {r.status.toLowerCase()}
                </Badge>
                <Badge tone={r.payment === "paid" ? "court" : "warning"}>{r.payment}</Badge>
                {r.status === "PENDING" && (
                  <>
                    <Button
                      id={r.id === "row-burloak" ? "approve-burloak" : undefined}
                      tone="court"
                      className="px-2.5 py-1"
                    >
                      Approve
                    </Button>
                    <Button tone="hoop" variant="secondary" className="px-2.5 py-1">
                      Reject
                    </Button>
                  </>
                )}
                <span className="text-play-600 whitespace-nowrap text-xs font-semibold">
                  Details &rarr;
                </span>
              </div>
            </div>
          ))}
          {filter !== "PENDING" && (
            <p className="text-ink-400 px-1 pt-1 text-xs">and 141 more teams, in club order</p>
          )}
        </div>
      </div>
    </Console>
  )
}

/* ── The application page (`teams/[submissionId]/page.tsx`) ──────────────── */

const SUB_PANEL = "border-ink-100 shadow-soft rounded-2xl border bg-white p-4"
const SUB_H2 = "text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide"

/** The application page is its own ROUTE, not a console tab: it wears the page
 *  wrapper `teams/[submissionId]/page.tsx` gives it and nothing else. */
function SubmissionPage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full w-full min-h-0 max-w-5xl flex-col gap-4 p-6">{children}</div>
  )
}

function SubmissionHeader({
  team,
  club,
  division,
  status,
  payment,
  paymentTone,
}: {
  team: string
  club: string
  division: string
  status: string
  payment: string
  paymentTone: keyof typeof BADGE_TONES
}) {
  return (
    <div className="shrink-0">
      <p className="text-ink-500 text-sm font-medium">
        &larr; {LEAGUE} · {SEASON}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h1 className="text-ink-900 text-2xl font-bold">{team}</h1>
        <Badge tone={status === "approved" ? "court" : "gold"}>{status}</Badge>
        <Badge tone={paymentTone}>{payment}</Badge>
      </div>
      <p className="text-ink-500 mt-1 text-sm">
        {club} · {division} · applied Aug 12, 2026 ·{" "}
        <span className="text-play-600">public page &rarr;</span>
      </p>
    </div>
  )
}

/** `submission-actions.tsx`: the whole verb row, in its real order. */
function SubmissionActions({ approved }: { approved: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!approved && (
        <>
          <Button id="approve" tone="court">
            Approve
          </Button>
          <Button tone="hoop" variant="secondary">
            Reject
          </Button>
        </>
      )}
      <Button variant="subtle">Withdraw</Button>
      <span className="text-ink-600 flex items-center gap-1.5 text-xs">
        Weekend preference
        <span data-demo-target="weekend-pref" className="flex items-center gap-1">
          {[
            { l: "League default", on: false },
            { l: "One trip (both games same day)", on: true },
            { l: "Split days (Sat + Sun)", on: false },
          ].map((o) => (
            <span
              key={o.l}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                o.on ? "border-play-500 bg-play-600 text-white" : "border-ink-200 bg-white text-ink-600"
              )}
            >
              {o.l}
            </span>
          ))}
        </span>
      </span>
      {approved && (
        <>
          <Button tone="court" variant="secondary">
            Mark paid
          </Button>
          <Button variant="subtle">Waive fee</Button>
        </>
      )}
    </div>
  )
}

function SubmissionScreen({ approved }: { approved: boolean }) {
  return (
    <SubmissionPage>
        <SubmissionHeader
          team="Royal Crown Grade 10"
          club="Royal Crown"
          division="Grade 10 Boys · Division B"
          status={approved ? "approved" : "pending"}
          payment={approved ? "unpaid" : "no fee yet"}
          paymentTone={approved ? "warning" : "neutral"}
        />
        <SubmissionActions approved={approved} />

        <div className={cn(SUB_PANEL, "shrink-0")} data-demo-target="fee-panel">
          <h2 className={SUB_H2}>Entry fee</h2>
          <p className="text-ink-700 text-sm">
            {FEE}
            {approved ? ` · balance due ${FEE_DUE}` : ""} · nothing received yet
          </p>
          {!approved && (
            <p className="text-ink-500 mt-1 text-xs">
              The obligation is raised the moment the league approves the team. The date is this
              league&apos;s own rule: 14 days before the season starts.
            </p>
          )}
        </div>

        <div className={cn(SUB_PANEL, "min-h-0 flex-1 overflow-hidden")}>
          <h2 className={cn(SUB_H2, "mb-1")}>Roster (12)</h2>
          <p className="text-ink-500 mb-2 text-xs">Submitted Aug 12, 2026 · locked</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-400 border-ink-100 border-b text-left text-xs uppercase">
                <th className="py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Player</th>
                <th className="py-1.5 pr-2">Age</th>
                <th className="py-1.5 pr-2">Position</th>
                <th className="py-1.5 pr-2">GP</th>
                <th className="py-1.5 pr-2">Concussion Code of Conduct</th>
              </tr>
            </thead>
            <tbody>
              {ROSTER.map((p) => (
                <tr key={p.n} className="border-ink-50 border-b last:border-0">
                  <td className="text-ink-500 py-1 pr-2">{p.n}</td>
                  <td className="text-ink-900 py-1 pr-2 font-medium">{p.name}</td>
                  <td className="text-ink-700 py-1 pr-2">{p.age}</td>
                  <td className="text-ink-700 py-1 pr-2">{p.pos}</td>
                  <td className="text-ink-700 py-1 pr-2">0</td>
                  <td className="py-1 pr-2">
                    <Badge tone="court">signed</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-ink-400 mt-1.5 text-xs">and 7 more players, all signed</p>
        </div>
    </SubmissionPage>
  )
}

/* ── Schedule requests, on the application page ──────────────────────────── */

function RequestRow({
  id,
  sentence,
  status,
  requester,
  reason,
  note,
  children,
}: {
  id?: string
  sentence: string
  status: "PENDING" | "APPROVED"
  requester: string
  reason: string
  note?: string
  children?: ReactNode
}) {
  return (
    <div data-demo-target={id} className="border-ink-100 rounded-lg border p-2.5">
      <p className="text-ink-800 text-sm">
        {sentence}
        <span
          className={cn(
            "ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            status === "PENDING" ? "bg-gold-100 text-gold-800" : "bg-court-100 text-court-800"
          )}
        >
          {status}
        </span>
      </p>
      <p className="text-ink-500 mt-0.5 text-xs">
        {requester} · &ldquo;{reason}&rdquo;
        {note ? ` · league note: ${note}` : ""}
      </p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}

/** `schedule-request-actions.tsx`, delta chips and copy verbatim. */
function SimulateResult() {
  const deltas: Array<[string, number]> = [
    ["unplaced games", 0],
    ["back-to-backs", 0],
    ["weekend-preference misses", 0],
    ["request misses", -1],
    ["two-gym days", 0],
    ["big gaps", 0],
  ]
  return (
    <div
      data-demo-target="sim-result"
      className="border-ink-100 bg-ink-50/60 live-pop mt-2 rounded-lg border p-2 text-xs"
    >
      <p className="text-ink-800 font-medium">
        Cost of approving <span className="text-court-700">none, everyone else is unaffected.</span>
      </p>
      <div className="text-ink-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {deltas.map(([label, v]) => (
          <span key={label} className={v === 0 ? "text-ink-500" : "text-court-700"}>
            {label} {v > 0 ? `+${v}` : v}
          </span>
        ))}
      </div>
      <p className="text-ink-600 mt-1">
        Dragons de Gatineau would have 10 of 10 affected games inside the requested window.
      </p>
      <p className="text-ink-400 mt-1">
        Best effort. Approving does not guarantee the scheduler can always honor it.
      </p>
    </div>
  )
}

function RequestScreen({
  team,
  sim = false,
  approved = false,
}: {
  team: "ottawa" | "dragons"
  sim?: boolean
  approved?: boolean
}) {
  const ottawa = team === "ottawa"
  return (
    <SubmissionPage>
        <SubmissionHeader
          team={ottawa ? "Ottawa Elite Grade 10" : "Dragons de Gatineau U17"}
          club={ottawa ? "Ottawa Elite" : "Dragons de Gatineau"}
          division={ottawa ? "Grade 10 Boys · Division B" : "Grade 11 Boys · Division A"}
          status="approved"
          payment="paid"
          paymentTone="court"
        />
        <SubmissionActions approved />
        <div className={cn(SUB_PANEL, "shrink-0")}>
          <h2 className={SUB_H2}>Schedule requests</h2>
          <div className="space-y-3">
            {ottawa ? (
              <RequestRow
                id="req-ottawa"
                sentence={REQ_OTTAWA}
                status="APPROVED"
                requester="Andre Belliveau"
                reason="We drive in from Ottawa on Saturday morning"
              >
                <p
                  data-demo-target="req-ottawa-note"
                  className="border-court-200 bg-court-50 text-court-800 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                >
                  League note: every one of your ten Saturday games starts at noon or later.
                </p>
              </RequestRow>
            ) : (
              <RequestRow
                id="req-dragons"
                sentence={REQ_GATINEAU}
                status={approved ? "APPROVED" : "PENDING"}
                requester="Isabelle Fortin"
                reason="It is a five hour drive home"
              >
                {approved ? (
                  <p
                    data-demo-target="req-dragons-note"
                    className="border-court-200 bg-court-50 text-court-800 live-pop rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                  >
                    League note: all ten Sunday games finish before 5:00 PM, and nobody else moved.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button id="simulate" variant="secondary">
                        Simulate cost
                      </Button>
                      <Button id="approve-req" tone="court">
                        Approve
                      </Button>
                      <Button variant="subtle">Decline</Button>
                    </div>
                    {sim && <SimulateResult />}
                  </>
                )}
              </RequestRow>
            )}
          </div>
        </div>
        <div className={cn(SUB_PANEL, "shrink-0")}>
          <h2 className={SUB_H2}>Entry fee</h2>
          <p className="text-ink-700 text-sm">{FEE} · paid Aug 20, 2026 · nothing outstanding</p>
        </div>
    </SubmissionPage>
  )
}

/* ── Plan your season, step 2 (`plan/page.tsx` + `gyms-weekends-step.tsx`) ─ */

const PLAN_STEPS = [
  { label: "Teams", hint: "who's coming" },
  { label: "Your buildings", hint: "gyms, courts, hours" },
  { label: "Your calendar", hint: "we compute it" },
  { label: "Publish", hint: "post the card" },
  { label: "Schedule", hint: "when you're ready" },
]

/** The wizard rail, in the tall form (step 2) or the one-line board form. */
function StepRail({ step, wide = false }: { step: number; wide?: boolean }) {
  return (
    <ol
      className={cn(
        "border-ink-100 shadow-soft flex shrink-0 items-center gap-0 overflow-hidden rounded-2xl border bg-white",
        wide ? "px-3 py-1.5" : "w-full px-5 py-3"
      )}
    >
      {PLAN_STEPS.map((s, i) => {
        const n = i + 1
        const current = n === step
        return (
          <li key={s.label} className="flex flex-none items-center">
            <span
              data-demo-target={`rail-${n}`}
              className="flex items-center gap-2.5 whitespace-nowrap rounded-xl px-1 py-1"
            >
              <span
                className={cn(
                  "flex flex-none items-center justify-center rounded-full font-bold",
                  wide ? "h-[22px] w-[22px] text-[11px]" : "h-[26px] w-[26px] text-xs",
                  current ? "bg-court-600 text-white" : "bg-court-100 text-court-700"
                )}
              >
                {n}
              </span>
              <span className="text-left">
                <span
                  className={cn(
                    "block font-semibold",
                    wide ? "text-[12.5px]" : "text-sm",
                    current ? "text-ink-900" : "text-ink-600"
                  )}
                >
                  {s.label}
                </span>
                {!wide && <span className="text-ink-400 block text-[11.5px]">{s.hint}</span>}
              </span>
            </span>
            {i < PLAN_STEPS.length - 1 && (
              <span
                className={cn("bg-ink-200 h-px flex-none", wide ? "mx-2 w-4" : "mx-3 w-6")}
                aria-hidden="true"
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

const BTN_PRIMARY =
  "inline-flex cursor-default items-center justify-center gap-1.5 rounded-lg border border-play-700 bg-play-600 font-bold text-white shadow-sm"
const BTN_SECONDARY =
  "inline-flex cursor-default items-center justify-center gap-1.5 rounded-lg border border-play-300 bg-white font-bold text-play-700 shadow-sm"

function GymCard({
  gym,
  home,
  rank,
  bookings,
  bookingsCount,
  skip,
  id,
  fresh,
}: {
  gym: { name: string; city: string; hue: number }
  courts?: number
  home?: boolean
  rank?: number
  bookings?: boolean
  bookingsCount?: number
  skip?: boolean
  id?: string
  fresh?: boolean
}) {
  const courts = home ? 3 : 6
  return (
    <div
      data-demo-target={id}
      className={cn(
        "border-ink-300 mb-2.5 rounded-2xl border bg-white p-3 shadow-sm",
        fresh && "live-row-in"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-ink-900 text-[16px] font-bold">
          {gym.name} · {gym.city}
        </span>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
            home
              ? "border-court-200 bg-court-50 text-court-800"
              : "border-ink-200 bg-ink-50 text-ink-500"
          )}
        >
          {home ? "Home gym" : "In the pool"}
        </span>
        {rank != null && (
          <span className="border-ink-300 inline-flex h-8 items-center rounded-lg border bg-white shadow-sm">
            <span className="text-play-700 px-2 text-base font-bold">&uarr;</span>
            <span className="text-ink-500 min-w-[26px] text-center text-[11px] font-bold tabular-nums">
              {rank}
            </span>
            <span className="text-play-700 px-2 text-base font-bold">&darr;</span>
          </span>
        )}
      </div>
      <p className="text-ink-400 mt-1 text-[11.5px]">
        {home
          ? "You own this one. Its games cost you nothing, so it gets used before anything you rent."
          : "In the pool. You rent it by the court when a weekend needs the space."}
      </p>
      {rank != null && (
        <p className="text-ink-400 mt-0.5 text-[11.5px]">
          The planner rents from the top of this list first.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="border-ink-100 bg-ink-50 text-ink-700 rounded-lg border px-2.5 py-1 text-xs">
          <b className="text-ink-900">{courts}</b> courts
        </span>
        <span className="text-ink-700 text-xs font-semibold">Available</span>
        <span className="border-ink-200 text-ink-900 rounded-lg border px-2 py-1 text-sm tabular-nums">
          10:00
        </span>
        <span className="text-ink-400 text-xs">to</span>
        <span className="border-ink-200 text-ink-900 rounded-lg border px-2 py-1 text-sm tabular-nums">
          22:00
        </span>
      </div>
      <p className="text-ink-400 mt-1.5 text-[11.5px]">
        The same hours every weekend. A single date that runs different hours is set on the board.
      </p>
      {bookings && (
        <div className="border-ink-100 mt-2 border-t pt-2">
          <span
            data-demo-target={id === "gym-sixpark" ? "gym-bookings" : undefined}
            className={cn(BTN_SECONDARY, "min-h-[36px] px-3 text-[12.5px]")}
          >
            Already have dates booked here?
            {bookingsCount != null && bookingsCount > 0 && (
              <span className="border-court-200 bg-court-50 text-court-800 rounded-full border px-1.5 text-[10.5px]">
                {bookingsCount}
              </span>
            )}
          </span>
          {skip && (
            <div className="live-pop mt-2">
              <p className="text-ink-500 mb-1.5 text-[11.5px]">
                Tick the weekends you have already booked at {gym.name}. Each one is the full day
                and every court. These count as confirmed bookings.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Oct 24–25", "Nov 21–22", "Nov 28–29", "Dec 5–6", "Jan 9–10"].map((w, i) => (
                  <span
                    key={w}
                    className={cn(
                      "min-h-[32px] px-2.5 text-[11.5px]",
                      i === 4 ? BTN_PRIMARY : BTN_SECONDARY
                    )}
                  >
                    {w}
                  </span>
                ))}
              </div>
              <p data-demo-target="bookings-skip" className="text-ink-400 mt-2 text-[11.5px]">
                No bookings yet? Fine. The planner will assume what it needs and give you a call
                list.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PlanScreen({ skip, scroll }: { skip: boolean; scroll: number }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl min-h-0 flex-col px-6 py-3">
      <p className="text-ink-500 shrink-0 text-sm font-medium">&larr; Back to the season</p>
      <div className="mt-2 shrink-0">
        <h1 className="text-ink-900 text-2xl font-bold">Plan your season</h1>
        <p className="text-ink-500 text-sm">
          {LEAGUE} · {SEASON} · Nov 1 to Mar 21
        </p>
      </div>
      <div className="mt-3 shrink-0">
        <StepRail step={2} />
      </div>
      {/* The scroll stops this step reads at: the weekends, the home gym, the
          pool, and the booked-dates picker once it is open. */}
      <Pane offset={[0, 262, 450, 565][scroll] ?? 0}>
        <div className="pt-3">
          {/* WHEN WOULD YOU LIKE TO RUN SESSIONS (gyms-weekends-step.tsx:706) */}
          <div className="border-ink-300 mb-3 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-ink-900 text-[14px] font-bold">
                When would you like to run sessions?
              </p>
              <span className="text-ink-500 text-[11.5px] font-bold tabular-nums">
                {WEEKENDS_ON}
              </span>
            </div>
            <p className="text-ink-500 mt-0.5 text-[11.5px]">
              The draw fills these first. You can place gyms and games on any date on the board.
            </p>
            {/* COMPOSITION: the real row is one table inside `overflow-x-auto`
                and 23 weekends wide. The pane is not a scroller the viewer can
                drag, so the season is drawn as two half-year rows of the same
                table. Nothing is hidden. */}
            <div data-demo-target="weekend-grid" className="mt-2.5 space-y-1.5 pb-1">
              {[WEEKEND_MONTHS.slice(0, 3), WEEKEND_MONTHS.slice(3)].map((half) => (
                <table key={half[0].month} className="border-separate border-spacing-1">
                  <thead>
                    <tr>
                      {half.map((m, i) => (
                        <th
                          key={m.month}
                          colSpan={m.weekends.length}
                          className={cn(
                            "text-ink-500 px-1 pb-0.5 text-left text-[10px] font-bold uppercase tracking-[0.08em]",
                            i > 0 && "border-ink-200 border-l pl-2"
                          )}
                        >
                          {m.month}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {half
                        .flatMap((m) => m.weekends)
                        .map((w) => (
                          <td key={w.label} className="p-0 align-top">
                            <span
                              className={cn(
                                "flex min-h-[40px] w-[62px] flex-col justify-center gap-0 px-1 text-[10.5px]",
                                w.on ? BTN_PRIMARY : BTN_SECONDARY
                              )}
                            >
                              <span className="block leading-tight">{w.label}</span>
                              <span className="block text-[9.5px] font-semibold">
                                {w.on ? "on" : "off"}
                              </span>
                            </span>
                          </td>
                        ))}
                    </tr>
                  </tbody>
                </table>
              ))}
            </div>
          </div>

          {/* THE FRIDAYS QUESTION (gyms-weekends-step.tsx:798) */}
          <div
            data-demo-target="friday"
            className="border-ink-100 bg-ink-50/50 mb-3 rounded-2xl border px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <div>
                <p className="text-ink-900 text-[13px] font-bold">Can games run on Fridays?</p>
                <p className="text-ink-500 mt-0.5 text-[11.5px]">
                  Saturday and Sunday fill first either way. This tells the draw whether Friday
                  evenings may hold games at all.
                </p>
              </div>
              <span className="border-ink-200 inline-flex overflow-hidden rounded-lg border bg-white text-xs">
                <span className="bg-play-600 px-3 py-1.5 font-semibold text-white">No</span>
                <span className="text-ink-600 bg-white px-3 py-1.5 font-semibold">Yes</span>
              </span>
            </div>
          </div>

          {/* Every building is on this page at once, home gym first and the
              pool under it, exactly as the step renders them. */}
          <GymCard id="gym-home" gym={PLAYGROUND} home />
          <GymCard id="gym-sixpark" gym={SIX_PARK} rank={1} bookings bookingsCount={1} skip={skip} />
          <GymCard gym={HABER} rank={2} bookings />
        </div>
      </Pane>
      {/* The wizard's own footer, always in reach (`plan/page.tsx`). */}
      <div className="border-ink-200 mt-2 flex shrink-0 items-center justify-between gap-3 rounded-t-2xl border bg-white/95 px-3 py-2 shadow-lg">
        <span className={cn(BTN_SECONDARY, "min-h-[40px] px-4 text-[13.5px]")}>
          &larr; Back: Teams
        </span>
        <span className={cn(BTN_PRIMARY, "min-h-[40px] px-4 text-[13.5px]")}>
          Next: Your calendar &rarr;
        </span>
      </div>
    </div>
  )
}

/* ── Divisions (`manage/components/division-setup.tsx`) ──────────────────── */

function TeamChip({ name, id }: { name: string; id?: string }) {
  return (
    <div
      data-demo-target={id}
      className="border-ink-200 text-ink-800 truncate rounded-lg border bg-white px-2 py-1 text-xs shadow-sm"
    >
      {name}
    </div>
  )
}

function DivisionsDialog({
  shape,
  dealt,
  moved,
  cross,
}: {
  shape: boolean
  dealt: boolean
  moved: boolean
  cross: boolean
}) {
  const pool = dealt ? [] : G10_POOL
  const columns = G10_DIVISIONS.map((d, i) => ({
    ...d,
    id: i === 1 ? "div-col-b" : undefined,
    teams: !dealt
      ? []
      : moved && i === 1
        ? [...d.teams, "City Above Elite"]
        : moved && i === 2
          ? d.teams.filter((t) => t !== "City Above Elite")
          : d.teams,
  }))

  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-black/40">
      <div className="flex min-h-full items-start justify-center p-4 pt-[5vh]">
        <div className="live-pop w-full max-w-5xl rounded-2xl bg-white p-5 shadow-xl">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-ink-900 text-sm font-semibold">
              Grade 10 Boys <span className="text-ink-500 font-normal">· 42 teams</span>
            </p>
            <p className="text-ink-400 text-xs">grade 1 of 1</p>
          </div>

          <p data-demo-target="div-shape" className="text-ink-800 mt-3 text-sm font-semibold">
            How many divisions?
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[2, 3, 4, 5, 6].map((n) => (
              <span
                key={n}
                data-demo-target={n === 4 ? "div-4" : undefined}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-semibold",
                  shape && n === 4
                    ? "border-play-600 bg-play-600 text-white"
                    : "border-ink-200 text-ink-700 bg-ink-50"
                )}
              >
                {n} <span className="font-normal">· ~{Math.ceil(42 / n)} each</span>
              </span>
            ))}
          </div>

          {shape && !dealt && (
            <>
              <p className="text-ink-800 mt-3 text-sm font-semibold">Named</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {G10_DIVISIONS.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DIV_COLORS[i].dot)} />
                    <span className="border-ink-200 bg-ink-50 w-full rounded-lg border px-2 py-1 text-sm">
                      {d.name}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-ink-800 mt-3 text-sm font-semibold">Who goes where?</p>
              <div className="mt-1.5 space-y-1.5">
                <span
                  data-demo-target="deal"
                  className="border-ink-200 bg-ink-50 block w-full rounded-xl border px-3 py-2 text-left text-sm"
                >
                  <span className="text-ink-900 font-semibold">Deal randomly</span>
                  <span className="text-ink-500 block text-xs">
                    An even split to start from. You can still drag anyone anywhere.
                  </span>
                </span>
                <span className="border-ink-200 bg-ink-50 block w-full rounded-xl border px-3 py-2 text-left text-sm">
                  <span className="text-ink-900 font-semibold">I&apos;ll place them myself</span>
                  <span className="text-ink-500 block text-xs">
                    Everyone starts unassigned; drag each team into a division.
                  </span>
                </span>
              </div>
            </>
          )}

          {!shape && (
            <p className="text-ink-500 mt-3 text-xs">
              Choose the shape first. Nothing is created until you finish the grade.
            </p>
          )}

          {dealt && (
            <>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-ink-500 text-xs">
                  Drag teams between the pool and the divisions, any direction.
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary">Deal randomly</Button>
                  <Button variant="secondary">Clear all</Button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-5 gap-2">
                <div className="border-ink-300 min-h-[7rem] rounded-xl border border-dashed bg-ink-50">
                  <div className="p-2">
                    <p className="text-ink-700 mb-1.5 text-xs font-bold">
                      Unassigned <span className="text-ink-400 font-normal">· {pool.length}</span>
                    </p>
                    <p className="text-ink-400 text-[11px]">Drag a team here to take it out.</p>
                  </div>
                </div>
                {columns.map((c, i) => (
                  <div
                    key={c.name}
                    data-demo-target={c.id}
                    className="border-ink-200 bg-ink-50 min-h-[7rem] rounded-xl border"
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-t-xl border-b px-2 py-1.5",
                        DIV_COLORS[i].head
                      )}
                    >
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DIV_COLORS[i].dot)} />
                      <span className="truncate text-xs font-bold">{c.name}</span>
                      <span className="ml-auto text-[11px] font-semibold opacity-70">
                        {c.teams.length}
                      </span>
                    </div>
                    <div className="space-y-1 p-2">
                      {c.teams.map((t) => (
                        <TeamChip
                          key={t}
                          name={t}
                          id={t === "City Above Elite" && !moved ? "chip-city" : undefined}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-ink-800 mt-4 text-sm font-semibold">
                In the regular season, do divisions play each other?
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {[
                  {
                    key: "no",
                    label: "No, they keep to themselves",
                    hint: "Each division gets its own schedule.",
                  },
                  {
                    key: "yes",
                    label: "Yes, they can mix",
                    hint: "Same-division games lean first; crossing fills the rest (how NPH runs it).",
                  },
                ].map((o) => (
                  <span
                    key={o.key}
                    data-demo-target={o.key === "yes" ? "cross-yes" : undefined}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left",
                      cross && o.key === "yes"
                        ? "border-play-600 bg-play-50"
                        : "border-ink-200 bg-ink-50"
                    )}
                  >
                    <span className="text-ink-900 block text-xs font-semibold">{o.label}</span>
                    <span className="text-ink-500 block text-[11px]">{o.hint}</span>
                  </span>
                ))}
              </div>

              <div className="mt-4 flex justify-between">
                <Button variant="secondary">Back</Button>
                <Button id="create-div">Create 4 divisions</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── The board (`plan/board-chrome.tsx`, `weekend-card.tsx`, `plan-ui.tsx`) ─ */

/** `plan/plan-ui.tsx` Fraction, with its overage mark. */
function Fraction({
  is,
  of,
  label,
  tone,
}: {
  is: number
  of: number
  label?: string
  tone: "fits" | "tight" | "over" | "quiet"
}) {
  const over = Math.max(0, is - of)
  const TONE = {
    fits: "border-court-200 bg-court-50 text-court-800",
    tight: "border-gold-400 bg-gold-50 text-gold-600",
    over: "border-hoop-300 bg-hoop-50 text-hoop-800",
    quiet: "border-ink-200 bg-ink-50 text-ink-500",
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[1.5px] text-[12px] font-bold tabular-nums",
        TONE[tone]
      )}
    >
      <span>
        {is}/{of}
        {label && <span className="pl-1 font-semibold opacity-75">{label}</span>}
      </span>
      {over > 0 && (
        <span className="inline-flex items-center gap-[1px] font-extrabold">
          <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2 w-2 shrink-0">
            <path d="M5 1 9.5 9h-9z" fill="currentColor" />
          </svg>
          {over}
        </span>
      )}
    </span>
  )
}

/** `plan/plan-ui.tsx` CountChip. */
function CountChip({ words, tone }: { words: string; tone: "fits" | "over" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-[1.5px] text-[12px] font-bold tabular-nums",
        tone === "over"
          ? "border-hoop-300 bg-hoop-50 text-hoop-800"
          : "border-court-200 bg-court-50 text-court-800"
      )}
    >
      {words}
    </span>
  )
}

/** The product's own six-dot section grip (`weekend-card.tsx`:958). */
function Grip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 16" aria-hidden="true" className={cn("h-3.5 w-2", className)}>
      {[4, 8, 12].map((cy) => (
        <g key={cy}>
          <circle cx="3" cy={cy} r="1.1" fill="currentColor" />
          <circle cx="7" cy={cy} r="1.1" fill="currentColor" />
        </g>
      ))}
    </svg>
  )
}

/** `plan/grade-chip.tsx`: the approved pill, grip always visible. */
function GradeChip({ label, teams, hue }: { label: string; teams: number; hue: number }) {
  const paint = HUES[hue]
  return (
    <span
      className={cn(
        "relative inline-flex min-h-[24px] items-center gap-[5px] rounded-[7px] border py-[3px] pl-1.5 pr-2 text-[11.5px] font-bold leading-snug shadow-sm",
        paint.chip
      )}
    >
      <span aria-hidden="true" className="grid shrink-0 grid-cols-2 gap-[2px] opacity-55">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="h-[2px] w-[2px] rounded-full bg-current" />
        ))}
      </span>
      <span className="whitespace-nowrap">
        {label}
        <span className={cn("font-semibold tabular-nums", paint.quiet)}> ({teams})</span>
      </span>
    </span>
  )
}

/**
 * `plan/plan-ui.tsx` GymMenu, open on its "Courts this date" group.
 *
 * The real panel is `ActionPopover`, which renders FIXED in viewport
 * coordinates and measures itself back inside the window, so it is never
 * clipped by the card it belongs to. Here it is an absolute panel over the
 * board for the same reason.
 */
function GymMenu() {
  return (
    <div
      data-demo-target="sixpark-menu-panel"
      className="border-ink-200 live-pop absolute left-[556px] top-[186px] z-40 w-[284px] rounded-xl border bg-white p-3 shadow-lg"
    >
      <p className="text-ink-400 mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em]">
        This gym, this date
      </p>
      <p className="text-ink-900 text-[12.5px] font-bold">Six Park on Nov 28–29</p>
      <p className="text-ink-500 mt-0.5 text-[11.5px]">This date only. Nothing else moves.</p>

      <p className="text-ink-400 mt-2.5 text-[11px] font-bold uppercase tracking-[0.06em]">
        Hours this date
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="border-ink-200 text-ink-900 rounded-lg border px-2 py-1 text-sm tabular-nums">
          10:00
        </span>
        <span className="text-ink-400 text-[11.5px] font-semibold">to</span>
        <span className="border-ink-200 text-ink-900 rounded-lg border px-2 py-1 text-sm tabular-nums">
          22:00
        </span>
      </div>

      <p className="text-ink-400 mt-2.5 text-[11px] font-bold uppercase tracking-[0.06em]">
        Courts this date
      </p>
      <p className="text-ink-500 mt-0.5 text-[11.5px]">
        The games here need 3 courts. Fewer if the gym could not give them all, more if you rented
        more of the building.
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="border-ink-200 text-ink-700 flex h-9 w-9 items-center justify-center rounded-lg border text-lg font-bold">
          &minus;
        </span>
        <span className="text-ink-900 min-w-[2.5rem] text-center text-[20px] font-bold tabular-nums">
          3
        </span>
        <span className="border-ink-200 text-ink-700 flex h-9 w-9 items-center justify-center rounded-lg border text-lg font-bold">
          +
        </span>
        <span className="text-ink-400 text-[11.5px] font-semibold tabular-nums">
          of 6 courts on the floor
        </span>
      </div>
      <span
        data-demo-target="court-apply"
        className="border-court-300 bg-court-50 text-court-800 mt-2 inline-flex min-h-[36px] items-center rounded-lg border px-3 text-[12px] font-bold"
      >
        We rented 3 courts
      </span>
    </div>
  )
}

const CARD_TONE = {
  fits: "border-ink-300 bg-white",
  tight: "border-gold-500 bg-gold-50",
}

function WeekendCard({ card }: { card: Card }) {
  return (
    <div
      data-demo-target={card.id}
      className={cn(
        "mb-2 rounded-xl border px-2.5 py-1.5 shadow-sm transition-colors duration-300 motion-reduce:transition-none",
        CARD_TONE[card.tone]
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-ink-900 -ml-1 inline-flex min-h-[26px] items-center gap-1 whitespace-nowrap rounded-md px-1 text-[13px] font-bold underline decoration-dotted underline-offset-[3px]">
          {card.date}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-ink-400 h-3 w-3"
          >
            <path d="M6.4 3.4 11 8l-4.6 4.6" />
          </svg>
        </span>
        <Fraction is={card.is} of={card.of} label="games" tone={card.tone} />
      </div>

      <div className="mt-1.5 space-y-1.5">
        {card.sections.map((s) => {
          const paint = HUES[s.gym.hue]
          return (
            <div
              key={s.gym.short}
              data-demo-target={s.id}
              className={cn(
                "relative rounded-lg border bg-white/70 px-1.5 py-1 transition-shadow duration-200 motion-reduce:transition-none",
                paint.box,
                s.assumed && "border-dashed",
                s.dragging && "ring-play-500 shadow-[0_18px_40px_-16px_rgba(15,23,42,0.55)] ring-2"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-ink-400 -ml-0.5 inline-flex min-h-[22px] items-center px-0.5">
                  <Grip />
                </span>
                <i
                  aria-hidden="true"
                  className={cn("h-2.5 w-2.5 flex-none rounded-full", paint.swatch)}
                />
                <span
                  className={cn("min-w-[36px] flex-1 truncate text-[12.5px] font-bold", paint.name)}
                >
                  {s.gym.short}
                </span>
                <span
                  className={cn(
                    "min-h-[26px] rounded-md border px-2 text-[10.5px] font-bold leading-[24px]",
                    paint.action
                  )}
                >
                  Move
                </span>
                <span
                  data-demo-target={s.menuId}
                  className={cn(
                    "inline-flex min-h-[26px] items-center rounded-md border px-2 text-[10.5px] font-bold",
                    paint.action
                  )}
                >
                  &#8943;
                </span>
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 pl-3.5">
                <span className="text-ink-600 text-[11px] font-bold tabular-nums">
                  {s.used}/{s.courts} courts
                  {s.free != null && s.free > 0 && (
                    <span className="text-court-700 font-bold"> · {s.free} free</span>
                  )}
                </span>
                {s.assumed && (
                  <span className="border-gold-400 bg-gold-50 text-gold-600 inline-flex shrink-0 items-center rounded-md border px-1.5 text-[10px] font-bold">
                    assumed, not booked yet
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-start gap-1">
                {s.grades.map((g) => (
                  <GradeChip key={g.label} label={g.label} teams={g.teams} hue={s.gym.hue} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** `plan/board-view.tsx` GhostDate: a weekend the plan skipped. */
function GhostDate({ date }: { date: string }) {
  return (
    <div className="border-ink-200 mb-1.5 flex min-h-[28px] items-center gap-2 rounded-lg border border-dashed px-2 py-0.5">
      <span className="text-ink-500 text-[11.5px] font-semibold">{date}</span>
      <span className="text-ink-300 ml-auto text-[10.5px]">Not planned</span>
    </div>
  )
}

/** `plan/work-rail.tsx`, head and rows. */
function WorkRail({ open, solved }: { open: boolean; solved: boolean }) {
  if (!open) {
    return (
      <div
        data-demo-target="rail-tab"
        className="border-ink-300 bg-ink-50 text-ink-500 flex w-[36px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border py-3"
      >
        <span className="bg-gold-400 h-2 w-2 rounded-full" aria-hidden="true" />
        <span
          className="text-[12px] font-bold uppercase tracking-[0.1em]"
          style={{ writingMode: "vertical-rl" }}
        >
          What is left
        </span>
      </div>
    )
  }
  return (
    <section
      data-demo-target="rail-tab"
      className="border-ink-300 bg-ink-50 live-pop flex w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border"
    >
      <div className="border-ink-300 bg-ink-100 flex items-baseline gap-2 border-b px-3 py-2.5">
        <h2 className="text-ink-900 text-[14px] font-bold uppercase tracking-[0.05em]">
          What is left
        </h2>
        <span
          className={cn(
            "ml-auto rounded-full border px-2 py-[1px] text-[11px] font-bold tabular-nums",
            solved
              ? "border-court-200 bg-court-50 text-court-800"
              : "border-hoop-200 bg-hoop-50 text-hoop-800"
          )}
        >
          {solved ? "all clear" : "1 open"}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 p-2.5">
        <p className="text-ink-500 px-1 text-[11.5px] font-semibold">Ideas for this calendar</p>

        {!solved && (
          <div className="border-hoop-300 bg-hoop-50 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 shadow-sm">
            <span className="text-hoop-800 text-[12.5px] font-bold underline decoration-dotted underline-offset-2">
              {RAIL_PROBLEM.label}
            </span>
            <Fraction is={RAIL_PROBLEM.is} of={RAIL_PROBLEM.of} tone="over" />
          </div>
        )}

        <div
          data-demo-target="rail-idea"
          className={cn(
            "rounded-xl border bg-white px-3 py-2 shadow-sm transition-colors duration-300 motion-reduce:transition-none",
            solved ? "border-court-300" : "border-ink-200"
          )}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <i aria-hidden="true" className={cn("h-2.5 w-2.5 flex-none rounded-full", HUES[1].swatch)} />
            <span className="text-ink-900 text-[12.5px] font-bold">{RAIL_IDEA.lead}</span>
            <span className="text-ink-900 text-[12.5px] font-bold underline decoration-dotted underline-offset-2">
              {RAIL_IDEA.from}
            </span>
            <CountChip words={`${RAIL_IDEA.over} games over`} tone="over" />
            <span aria-hidden="true" className="text-ink-300 font-bold">
              &rarr;
            </span>
            <span className="text-ink-900 text-[12.5px] font-bold underline decoration-dotted underline-offset-2">
              {RAIL_IDEA.to}
            </span>
            <CountChip words={`fits, ${RAIL_IDEA.left} slots left`} tone="fits" />
            <span
              className={cn(
                "ml-auto inline-flex min-h-[34px] shrink-0 items-center rounded-lg border px-3 text-[12px] font-bold",
                solved
                  ? "border-court-300 bg-court-50 text-court-800"
                  : "border-play-300 bg-play-50 text-play-700"
              )}
            >
              {solved ? "Done" : "Move"}
            </span>
          </div>
          <p className="text-ink-500 mt-1 px-0.5 text-[11.5px]">{RAIL_IDEA.cost}</p>
        </div>

        <p className="text-ink-500 border-ink-200 mt-auto border-t pt-2 text-[11.5px] font-medium">
          {RAIL_ASK}
        </p>
      </div>
    </section>
  )
}

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
  const nov = november(moved, court, dragging)
  /* COMPOSITION: the real board is one column per month of the season inside a
     sideways scroller. The pane shows the three the story acts in, and the
     month it acts in scrolls its moved weekend into view the way the real
     board does when the rail jumps to one. */
  const columns: Array<{ title: string; cards: Card[]; tail?: string; offset?: number }> = [
    { title: "Session 1 · Oct", cards: OCT },
    { title: "Session 2 · Nov", cards: nov, offset: moved ? 128 : 0 },
    { title: "Session 3 · Dec", cards: DEC, tail: "Dec 19–20" },
  ]

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col px-3 py-1.5">
      {/* board-chrome.tsx:144 — the header bar over the board. */}
      <div className="border-ink-200 bg-ink-50/60 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b px-4 py-2">
        <div className="flex items-center gap-5">
          <div>
            <p className="text-ink-900 text-[15px] font-bold">Your calendar</p>
            <p className="text-ink-500 text-xs">Drag a grade to move it · math updates live</p>
          </div>
          <StepRail step={3} wide />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <span className={cn(BTN_SECONDARY, "min-h-[34px] px-3 text-[12.5px]")}>Redraw &#9662;</span>
          <span className="border-ink-300 inline-flex rounded-lg border bg-white p-0.5">
            <span className="bg-court-600 min-h-[30px] rounded-md px-2.5 text-[11.5px] font-bold leading-[30px] text-white">
              Board
            </span>
            <span className="text-ink-600 min-h-[30px] rounded-md px-2.5 text-[11.5px] font-bold leading-[30px]">
              Strip
            </span>
          </span>
          <span
            data-demo-target="verdict"
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
              solved
                ? "border-court-200 bg-court-50 text-court-800"
                : "border-gold-400 bg-gold-50 text-gold-600"
            )}
          >
            {solved ? "All grades fit" : "1 weekend tight"}
          </span>
          <span
            data-demo-target="generate"
            className={cn(BTN_PRIMARY, "min-h-[34px] px-3 text-[12.5px]")}
          >
            Use this calendar and generate the schedule
          </span>
        </div>
      </div>

      {/* plan-ui.tsx GymList — the tray over the board. */}
      <div className="border-ink-200 bg-ink-50/70 mt-1.5 shrink-0 rounded-xl border p-1.5">
        <p className="text-ink-500 px-0.5 text-[11px] font-bold uppercase tracking-[0.06em]">
          Your gyms · drag one onto a weekend · tap one to spotlight it
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {[
            { gym: PLAYGROUND, courts: 3, weekends: 13, home: true },
            { gym: SIX_PARK, courts: 6, weekends: 3 },
            { gym: HABER, courts: 6, weekends: 1 },
          ].map((g) => (
            <span
              key={g.gym.name}
              className="border-ink-300 inline-flex min-h-[34px] items-center gap-1 rounded-lg border bg-white pr-2 shadow-sm"
            >
              <span className="text-ink-400 inline-flex min-h-[34px] items-center px-1.5">
                <Grip className="h-4 w-2.5" />
              </span>
              <i
                aria-hidden="true"
                className={cn("h-2.5 w-2.5 flex-none rounded-full", HUES[g.gym.hue].swatch)}
              />
              <span className={cn("text-[13px] font-bold", HUES[g.gym.hue].name)}>{g.gym.name}</span>
              <span className="text-ink-400 text-[11px] font-semibold tabular-nums">
                {g.courts} courts
              </span>
              {g.home && (
                <span className="border-ink-300 text-ink-600 rounded-md border px-1 text-[10.5px] font-bold">
                  Home gym
                </span>
              )}
              <span className="text-ink-400 text-[11px] font-semibold tabular-nums">
                On {g.weekends} weekend{g.weekends === 1 ? "" : "s"}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* board-view.tsx:255 — the tinted board surface, one column per month. */}
      <div className="mt-1.5 flex min-h-0 flex-1 gap-2">
        <div
          data-demo-target="board-grid"
          className="bg-ink-50/60 grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-hidden rounded-2xl p-1.5"
        >
          {columns.map((col) => (
            <section
              key={col.title}
              className="border-ink-200 bg-ink-50 min-h-0 min-w-0 overflow-hidden rounded-2xl border p-2 shadow-sm"
            >
              <h3 className="text-ink-600 border-ink-200 mb-1.5 flex items-center justify-between gap-2 border-b pb-1 pl-1 text-[11.5px] font-bold uppercase tracking-[0.08em]">
                {col.title}
              </h3>
              <div
                className="transition-transform duration-500 ease-out motion-reduce:transition-none"
                style={{ transform: `translateY(${-(col.offset ?? 0)}px)` }}
              >
                {col.cards.map((c) => (
                  <WeekendCard key={c.date} card={c} />
                ))}
                {col.tail && <GhostDate date={col.tail} />}
              </div>
            </section>
          ))}
        </div>
        <WorkRail open={rail} solved={solved} />
      </div>
      {menu && <GymMenu />}
    </div>
  )
}

/* ── Schedule tab (`manage/components/schedule-tab.tsx`) ─────────────────── */

function FairnessTable() {
  const cols = [
    "Team",
    "Burden",
    "Games",
    "Games short",
    "Back-to-backs",
    "5hr+ waits",
    "Same day, 2 gyms",
  ]
  return (
    <div data-demo-target="fairness">
      <PanelHeader className="mb-2" title="Fairness by team" />
      <p className="text-ink-500 -mt-1 mb-2 text-xs">
        Worst first by burden. Click a column to sort, click a team to check its full schedule.
      </p>
      <div className="border-ink-100 overflow-hidden rounded-xl border">
        <table className="text-ink-700 w-full text-xs">
          <thead className="bg-ink-50 text-[10px] uppercase tracking-wide">
            <tr>
              {cols.map((c, i) => (
                <th
                  key={c}
                  className={cn(
                    "text-ink-500 whitespace-nowrap px-2 py-1.5",
                    i === 0 ? "text-left" : "text-right"
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FAIRNESS.map((r) => (
              <tr
                key={r.team}
                className={cn("border-ink-100 border-t", r.burden > 0 && "bg-gold-50/40")}
              >
                <td className="text-ink-900 px-2 py-2 font-medium">{r.team}</td>
                <td
                  className={cn(
                    "px-2 py-2 text-right tabular-nums",
                    r.burden === 0 ? "text-court-600" : "text-gold-700 font-semibold"
                  )}
                >
                  {r.burden}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{r.games}</td>
                <td
                  data-demo-target={r.team === "Dragons de Gatineau" ? "fair-short" : undefined}
                  className="text-court-600 px-2 py-2 text-right tabular-nums"
                >
                  {r.short}
                </td>
                <td className="text-court-600 px-2 py-2 text-right tabular-nums">{r.b2b}</td>
                <td className="text-court-600 px-2 py-2 text-right tabular-nums">{r.waits}</td>
                <td className="text-court-600 px-2 py-2 text-right tabular-nums">{r.twoGyms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ScheduleScreen({
  created,
  run,
  fairness,
  committed,
  published,
  scroll,
}: {
  created: boolean
  run: number
  fairness: boolean
  committed: boolean
  published: boolean
  scroll: number
}) {
  if (committed) {
    return (
      <Console tab="Schedule">
        <div className={cn(PANEL, "flex h-full min-h-0 flex-col p-5")}>
          <div
            data-demo-target="draft-banner"
            className={cn(
              "mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2",
              published ? "border-court-200 bg-court-50" : "border-gold-200 bg-gold-50"
            )}
          >
            <p
              className={cn(
                "text-xs font-semibold",
                published ? "text-court-800" : "text-gold-700"
              )}
            >
              {published
                ? "730 games are live. Every club and family was notified once."
                : "730 draft games, visible only to you until you publish. Review below, re-run sessions freely, then publish once."}
            </p>
            {published ? (
              <Badge tone="court">Published</Badge>
            ) : (
              <Button id="publish">Publish schedule · 730 new</Button>
            )}
          </div>
          <PanelHeader
            className="mb-2 shrink-0"
            title="Grade 10 · Saturday Nov 28"
            action={
              <span className="flex items-center gap-2">
                <span className="border-ink-200 flex overflow-hidden rounded-lg border">
                  <span className="bg-ink-950 px-2.5 py-1 text-[11px] font-semibold text-white">
                    List
                  </span>
                  <span className="text-ink-600 bg-white px-2.5 py-1 text-[11px] font-semibold">
                    Board
                  </span>
                </span>
                <span className="bg-ink-100 text-ink-600 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  8 of 730
                </span>
              </span>
            }
          />
          <div
            data-demo-target="schedule-list"
            className="min-h-0 flex-1 space-y-2 overflow-hidden"
          >
            {PUBLISHED.map(([when, home, away, where]) => (
              <div
                key={when + home}
                className="border-ink-100 rounded-xl border bg-white transition-colors"
              >
                <div className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs">
                  <div className="flex flex-1 flex-wrap items-center gap-3">
                    <span className="text-ink-700 whitespace-nowrap">{when}</span>
                    <span className="text-ink-900 font-medium">
                      {home} <span className="text-ink-400">vs</span> {away}
                    </span>
                    <span className="text-ink-500">{where}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!published && <Badge tone="gold">Draft</Badge>}
                    <Badge tone="play">scheduled</Badge>
                    <span className="text-ink-400 text-[10px]">&#9662;</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Console>
    )
  }

  return (
    <Console tab="Schedule">
      <div className={cn(PANEL, "flex h-full min-h-0 flex-col p-5")}>
        <PanelHeader className="mb-2 shrink-0" title="Generate the schedule" />
        <p className="text-ink-500 mb-3 shrink-0 text-xs">
          Built on plan <span className="text-ink-800 font-semibold">Fall/Winter working plan</span>{" "}
          · <span className="text-play-600 font-semibold">change</span>
        </p>
        {/* Stops: the controls, the preview the run just wrote, the verdict. */}
        <Pane offset={[0, 178, 462][scroll] ?? 0}>
          {run === 0 && (
            <div
              data-demo-target="gate"
              className="border-play-200 bg-play-50 mb-3 rounded-2xl border p-4"
            >
              <p className="text-ink-900 text-sm font-semibold">
                You&apos;re about to build the real schedule.
              </p>
              <p className="text-ink-700 mt-1 text-xs">
                Make sure registration is closed and team counts are final. Big grades can run as
                divisions: set them up below first, then generate. You can change divisions and
                regenerate freely until you publish.
              </p>
            </div>
          )}

          <div
            data-demo-target="div-card"
            className="border-ink-100 bg-ink-50/60 mb-3 rounded-2xl border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <PanelHeader className="mb-0" title="Divisions" />
                <p className="text-ink-500 mt-1 text-xs">
                  {created
                    ? "Manage a grade's divisions below, any time before the schedule is published."
                    : "Big grades can run as divisions. Nothing is created unless you set it up."}
                </p>
              </div>
              {!created && (
                <Button id="setup-divisions" variant="secondary">
                  Set up divisions
                </Button>
              )}
            </div>
            {created && (
              <div className="live-pop border-ink-100 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2">
                <p className="text-ink-700 min-w-0 text-xs">
                  <span className="text-ink-900 text-sm font-semibold">Grade 10 Boys</span>{" "}
                  <span className="whitespace-nowrap">· 42 teams:</span>{" "}
                  {G10_DIVISIONS.map((d, i) => (
                    <span key={d.name} className="mr-2 inline-flex items-center gap-1">
                      <span
                        className={cn("inline-block h-2 w-2 rounded-full", DIV_COLORS[i].dot)}
                      />
                      {d.name.replace("Grade 10 · ", "")} (11)
                    </span>
                  ))}
                </p>
              </div>
            )}
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button>Preview whole season</Button>
            <Button id="commit" tone="court">
              Commit whole season
            </Button>
            <Button tone="hoop" variant="secondary">
              Delete all
            </Button>
          </div>

          {run > 0 && (
            <div
              data-demo-target="preview"
              className="border-play-200 bg-play-50 live-pop mb-3 rounded-2xl border p-4"
            >
              <p className="text-play-800 mb-2 text-sm font-semibold">Preview: 730 games</p>
              <p className="text-court-700 mb-2 text-xs font-semibold">
                ✓ No trade-offs. Every rule held: shares, rest days, rematch spacing, court
                rotation.
              </p>
              <p className="text-ink-500 mb-2 text-xs">Slots used: 730 / 848</p>
              <div className="overflow-hidden rounded-xl bg-white">
                <table className="text-ink-700 w-full text-xs">
                  <thead className="bg-ink-50 text-ink-500 text-[10px] uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-1.5 text-left">When</th>
                      <th className="px-3 py-1.5 text-left">Home</th>
                      <th className="px-3 py-1.5 text-left">Away</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PUBLISHED.slice(0, 4).map(([when, home, away]) => (
                      <tr key={when + home} className="border-ink-100 border-t">
                        <td className="px-3 py-1.5">{when}</td>
                        <td className="px-3 py-1.5">{home}</td>
                        <td className="px-3 py-1.5">{away}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {fairness && <FairnessTable />}
        </Pane>
      </div>
    </Console>
  )
}

/* ── The confirm dialogs ─────────────────────────────────────────────────── */

function ConfirmDialog({
  open,
  title,
  lines,
  confirmId,
  confirmLabel,
}: {
  open: boolean
  title: string
  lines: string[]
  confirmId: string
  confirmLabel: string
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1628]/45 px-8">
      <div className="live-pop w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-[0_40px_90px_-40px_rgba(15,23,42,0.7)]">
        <h4 className="font-condensed text-ink-950 text-xl font-bold uppercase tracking-wide">
          {title}
        </h4>
        {lines.map((l) => (
          <p key={l} className="text-ink-600 mt-1.5 text-sm">
            {l}
          </p>
        ))}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="subtle">Cancel</Button>
          <Button id={confirmId} tone="court">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── The phone: /teams/[teamId]/calendar ─────────────────────────────────── */

function Phone({
  filled,
  banner,
  ics,
  sheet,
}: {
  filled: boolean
  banner: boolean
  ics: boolean
  sheet: boolean
}) {
  const items = filled
    ? [...PRACTICES, ...HER_GAMES].sort((a, b) => Number(a.day) - Number(b.day))
    : PRACTICES

  return (
    <div className="relative flex h-full flex-col bg-[#f6f7f9]">
      <div className="flex items-baseline gap-2 bg-[#0b1628] px-4 pb-2.5 pt-2 text-white">
        <p className="text-[15px] font-bold leading-tight">Priya Reyes</p>
        <p className="text-[14px] font-medium text-white/60">Parent · Royal Crown</p>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-2.5">
        {/* `teams/[teamId]/calendar/page.tsx` heading */}
        <p className="text-ink-900 truncate text-[17px] font-bold">Royal Crown Grade 10</p>
        <p className="text-ink-500 truncate text-[13px]">Royal Crown • Calendar</p>

        {/* team-calendar.tsx:370 — practice days, then Add to phone */}
        <div className="border-ink-100 shadow-soft mt-2 rounded-2xl border bg-white px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-ink-800 text-[13px] font-semibold">Tue & Thu · 7:00 PM</p>
              <p className="text-ink-400 mt-0.5 text-[11.5px]">Schedule announced Sep 2</p>
            </div>
            <span
              data-demo-target="add-phone"
              className="border-ink-200 text-ink-700 shrink-0 rounded-xl border px-3 py-1.5 text-[11.5px] font-semibold"
            >
              📅 Add to phone
            </span>
          </div>
          {ics && (
            <div
              data-demo-target="ics-panel"
              className="border-ink-200 live-pop mt-2 rounded-2xl border bg-white p-3"
            >
              <p className="text-ink-800 text-[13px] font-semibold">Opening Apple Calendar…</p>
              <p className="text-ink-500 mt-0.5 text-[11.5px]">
                Confirm the subscription there and every practice, game and event stays in sync.
              </p>
              <span className="bg-play-600 mt-2 block rounded-xl px-3 py-2 text-center text-[11.5px] font-semibold text-white">
                iPhone / Apple Calendar
              </span>
              <span className="border-ink-200 text-ink-700 mt-1.5 block rounded-xl border px-3 py-2 text-center text-[11.5px] font-semibold">
                Google Calendar (Android)
              </span>
            </div>
          )}
        </div>

        {/* agenda-list.tsx — sticky month, date tile, one card per item */}
        <div data-demo-target="phone-cal" className="mt-2">
          <p className="text-ink-500 text-xs font-bold uppercase tracking-widest">November 2026</p>
          <div className="mt-1.5 space-y-2.5">
            {items.map((i, idx) => (
              <div key={`${i.day}-${i.time}`} className="flex items-start gap-2.5">
                <div className="bg-ink-100/70 text-ink-700 flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-2xl">
                  <span className="text-xl font-extrabold leading-none">{i.day}</span>
                  <span className="text-ink-400 mt-0.5 text-[10px] font-semibold uppercase">
                    {i.weekday}
                  </span>
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-xl border px-3 py-2",
                    i.kind === "game"
                      ? "border-play-200 bg-play-50/50"
                      : "border-ink-100 bg-white",
                    filled && i.kind === "game" && "live-row-in"
                  )}
                  style={
                    filled && i.kind === "game" ? { animationDelay: `${idx * 90}ms` } : undefined
                  }
                >
                  <p className="text-ink-800 text-[13px] font-semibold">
                    {i.kind === "game" ? "Game · " : "Practice · "}
                    {i.time}
                  </p>
                  <p className="text-ink-400 text-[11.5px]">{i.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {banner && <PushBanner />}
      {sheet && <SubscribeSheet />}

      <div className="border-ink-200 flex shrink-0 items-center justify-around border-t bg-white px-1.5 pb-4 pt-2">
        {["Home", "Chat", "Calendar", "My Kids", "Social"].map((t) => (
          <span
            key={t}
            className={cn("text-[14px] font-bold", t === "Calendar" ? "text-play-700" : "text-ink-400")}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

/** An iOS-style push dropping from the top of the handset (R8). */
function PushBanner() {
  return (
    <div data-demo-target="push" className="demo-banner-in absolute left-1.5 right-1.5 top-1.5 z-30">
      <div
        data-demo-target="push-open"
        className="rounded-[18px] border border-black/5 bg-white/95 p-2.5 shadow-[0_10px_30px_rgba(11,22,40,0.28)] backdrop-blur"
      >
        <div className="flex items-start gap-2.5">
          <AppIcon className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-ink-400 text-[10px] font-semibold uppercase tracking-[0.06em]">
                SportsHub One
              </p>
              <p className="text-ink-400 text-[10px]">now</p>
            </div>
            <p className="text-ink-950 text-[13px] font-semibold leading-tight">{PUSH_TITLE}</p>
            <p className="text-ink-600 line-clamp-2 text-[12px] leading-snug">{PUSH_BODY}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Apple Calendar's own subscribe sheet: OS chrome, never product UI (R8). */
function SubscribeSheet() {
  return (
    <div className="demo-fade-in absolute inset-0 z-30 flex flex-col justify-end bg-black/35">
      <div className="rounded-t-[18px] bg-[#f6f7f9] px-4 pb-6 pt-2.5 shadow-[0_-8px_24px_rgba(11,22,40,0.24)]">
        <div className="bg-ink-200 mx-auto h-1 w-9 rounded-full" />
        <p className="text-ink-950 mt-3 text-center text-[15px] font-bold">Subscribe to Calendar</p>
        <p className="text-ink-500 mt-1 text-center text-[12.5px] leading-snug">
          Subscribing to “Royal Crown Grade 10” will add its events to your calendar and keep them
          up to date.
        </p>
        <div className="mt-3 flex gap-2">
          <span className="border-ink-200 text-ink-700 flex-1 rounded-xl border bg-white py-2.5 text-center text-[13.5px] font-semibold">
            Cancel
          </span>
          <span className="flex-1 rounded-xl bg-[#2f7cf6] py-2.5 text-center text-[13.5px] font-bold text-white">
            Subscribe
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b1628] px-10 text-white">
      <div className="live-pop max-w-[560px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A league chapter
        </p>
        <h3 className="font-display mt-2 text-[30px] font-extrabold leading-tight">
          Planning a full league season
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          146 teams answered one by one with their fees raised, a home court that fills first and
          two gyms nobody had to book, a weekend caught one court short and fixed on the board, 730
          games drawn with none left over, and one press that put them on every calendar in the
          league.
        </p>
        <p className="mt-4 text-[14px] font-semibold text-white/50">Next: a schedule change</p>
      </div>
    </div>
  )
}
