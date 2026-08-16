"use client"

import {
  ConsoleActionPad,
  ConsoleAttendance,
  ConsoleChecklist,
  ConsoleChips,
  ConsoleHeader,
  ConsoleLineup,
  ConsoleReview,
  ConsoleScoresheet,
  ConsoleSubsSheet,
  LiveBoxScore,
  LiveHero,
  LivePlays,
  LivePotgCard,
  LiveRecapCard,
  LiveScoreChip,
  LiveStandings,
  LiveTabs,
  LiveTeamStats,
  MockEndCard,
  PhoneBody,
  type MockLine,
  type MockPlayer,
  type PhonePlayRow,
  type PhoneTeam,
  type PulseTone,
} from "../mock-scoring"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Game day, both phones" (owner ruling 2026-08-16).
 *
 * THE ARGUMENT. A youth game is scored by a parent volunteer on a folding
 * table, and everyone who could not be in the gym finds out the score by text
 * message an hour later. This story puts both ends of that on one stage, and
 * both of them are PHONES: the scorer's phone on the left, the phone of a
 * father who is not in the building on the right, and one game running through
 * both.
 *
 * THE PHONE RULING, AND THE AUTHORIZATION IT CARRIES. The owner: "I want to
 * show them the capability of how easy it is to keep the scoring from the
 * phone... that scorekeeper app should be both mobile", and, for screens the
 * product composes wide today, "even if it doesn't exist on the phone right
 * now, can we still fabricate some of those screens on the phones... two big
 * phone screens side by side". Every screen here is checked against what ships:
 * the console, the checklist, the attendance roll call and the live page are
 * REAL phone surfaces; the review screen and the scoresheet are the two
 * OWNER-AUTHORIZED phone compositions, and both are marked as such in
 * `docs/roadmap/game-day-numbers.md` §C.
 *
 * THE OWNER'S SYNC LAWS, and where each one lives:
 *   1. ONE CLOCK, BOTH PHONES. There is a single clock value in scene state and
 *      a single ticker behind it (`useDemoClock`, mock-scoring.tsx). The two
 *      handsets do not each run a clock that happens to agree: they render the
 *      same number from the same store, so they cannot drift. The playback
 *      drive asserts the two rendered strings are identical on every beat that
 *      shows both.
 *   2. THE PARENT'S PHONE FLASHES WHAT CHANGED. Every value that can move is
 *      wrapped in `Pulse`: green for a made shot or a score, red for a foul,
 *      amber for everything else the table does. The flash is on the element
 *      itself, so a score digit, a linescore cell, a box-score cell and a play
 *      row each announce their own change.
 *   3. THE FULL ACTION SET, MISSES INCLUDED: +2, +3, FT ✓, 2 ✗, 3 ✗, FT ✗, REB,
 *      AST, FOUL. That is exactly what a STANDARD stat-depth league's console
 *      renders, and the NPH Summer League is STANDARD. Steals, blocks and
 *      turnovers are FULL-depth only, so the phone box score carries them as
 *      zeros rather than pretending the table recorded them.
 *   4. SCORE AND QUARTER TRAVEL TOGETHER, on the hero and on the score chip
 *      every other view keeps.
 *   5. ONE PLAY, ONE MOMENT. The play-by-play line pops in on the same beat the
 *      score flashes, and the assist play carries its attribution the way the
 *      product writes it: "#37 Darius R. scores 2, assisted by #18 Isaiah C."
 *
 * THE STATE MODEL. Everything both phones show is FOLDED from one event
 * stream, exactly like the product: `EVENTS` is the game, a beat says how many
 * of them have happened, and the fold derives the score, the linescore, both
 * box scores, team fouls, who is on the floor, the shooting lines and the
 * play-by-play. That is what makes the undo beat honest: the mistaken three is
 * not deleted, it is VOIDED, and every number built on it walks back on its
 * own.
 *
 * EVERY NUMBER DERIVED. The league, the season, the weekend, the game, both
 * rosters with their real jersey numbers, the referee, the parent, the division
 * table and the recap sentences are read out of the seeded NPH Summer League,
 * and the whole staged game is reconciled event by event in
 * `docs/roadmap/game-day-numbers.md`.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

const LEAGUE = "NPH Summer League"
const SEASON = "Summer 2026"
const DIVISION = "Grade 9 Boys · Tier 1"
const SESSION = "Weekend 11 · Aug 22"
const VENUE = "The Playground · Court 1"
const TIPOFF = "Sat Aug 22 · 12:00 PM"

/** `DB` Game 7e467b44, published, SCHEDULED. The game the schedule-change
 *  demo moved to noon: this is the afternoon it gets played. */
const HOME: PhoneTeam = {
  name: "Oakville Panthers Grade 9",
  short: "OP · G9",
  record: "3-6 · Grade 9 Boys",
  color: "#be123c", // DB: the Panthers' club colour
}
const AWAY: PhoneTeam = {
  name: "Toronto Lords Grade 9",
  short: "TL · G9",
  record: "4-6 · Grade 9 Boys",
  color: "#1e40af", // DB: the Lords' club colour
}

/** `DB` LeagueReferee + RefereeProfile, summer-ref-mike@sportshub.demo. */
const REFEREE = "Mike Ferreira"
/** `DB` User summer-parent-lords@, guardian of record for Darius Reyes. */
const PARENT = "Jordan Reyes"
const SCOREKEEPER = "Priya Anderson"

const HOME_PLAYERS: MockPlayer[] = [
  { jersey: 11, name: "Jayden Anderson", short: "Jayden A." },
  { jersey: 12, name: "Ravi Baker", short: "Ravi B." },
  { jersey: 16, name: "Kai Green", short: "Kai G." },
  { jersey: 29, name: "Daniel Osei", short: "Daniel O." },
  { jersey: 32, name: "Liam Silva", short: "Liam S." },
  { jersey: 33, name: "Felix Robinson", short: "Felix R." },
  { jersey: 34, name: "Kevin Wilson", short: "Kevin W." },
  { jersey: 35, name: "Yusuf Mensah", short: "Yusuf M." },
  { jersey: 39, name: "Andre Nguyen", short: "Andre N." },
  { jersey: 42, name: "Mateo Campbell", short: "Mateo C." },
]
const AWAY_PLAYERS: MockPlayer[] = [
  { jersey: 4, name: "Daniel Grant", short: "Daniel G." },
  { jersey: 15, name: "Ethan Lee", short: "Ethan L." },
  { jersey: 17, name: "Cameron Baptiste", short: "Cameron B." },
  { jersey: 18, name: "Isaiah Clarke", short: "Isaiah C." },
  { jersey: 21, name: "Zion Nguyen", short: "Zion N." },
  { jersey: 28, name: "Ibrahim White", short: "Ibrahim W." },
  { jersey: 29, name: "Isaiah Boateng", short: "Isaiah B." },
  { jersey: 34, name: "Cole Campbell", short: "Cole C." },
  { jersey: 37, name: "Darius Reyes", short: "Darius R." },
  { jersey: 38, name: "Owen Lee", short: "Owen L." },
]

const HOME_STARTERS = [11, 39, 16, 34, 32]
const AWAY_STARTERS = [37, 28, 18, 29, 34]
/** Marked at the door: one on each side. */
const HOME_ABSENT = [29]
const AWAY_ABSENT = [15]

const URL_SCORE = "/games/7e467b44/score"

/* ── The game, as an event stream ────────────────────────────────────────── */

type Kind = "PSTART" | "PEND" | "S2" | "S3" | "FT" | "M2" | "M3" | "MFT" | "REB" | "AST" | "FOUL" | "SUB"

interface Ev {
  k: Kind
  side?: "home" | "away"
  j?: number
  period: number
  in?: number
  out?: number
  /** Offensive rebound, which is how the play line words itself. */
  off?: boolean
}

const E: Ev[] = []
const P = (period: number) => E.push({ k: "PSTART", period })
const X = (period: number) => E.push({ k: "PEND", period })
const h = (k: Kind, j: number, period: number, off?: boolean) =>
  E.push({ k, side: "home", j, period, off })
const a = (k: Kind, j: number, period: number, off?: boolean) =>
  E.push({ k, side: "away", j, period, off })
const sub = (side: "home" | "away", inJ: number, outJ: number, period: number) =>
  E.push({ k: "SUB", side, in: inJ, out: outJ, period })

/* Q1 — the nine events the camera watches, then the rest of the quarter. */
P(1) //                                   0  tip-off
a("S2", 37, 1) //                         1  Darius, two
a("AST", 18, 1) //                        2  assisted by Isaiah C.
a("M3", 37, 1) //                         3  the miss
a("REB", 28, 1, true) //                  4  offensive board
/* The foul the camera watches has to be on a player the table can TAP, which
   means one of the five on the floor. #33 Felix Robinson starts on the bench
   and only comes on in Q2, so his chip does not exist yet: the beat pointed at
   a jersey that was never rendered. #32 Liam Silva is a starter, and picking up
   an early foul is also why he comes off for Felix in Q2. */
h("FOUL", 32, 1) //                       5  the foul, red on the phone
sub("away", 21, 34, 1) //                 6  the substitution, amber
h("S2", 11, 1) //                         7  Panthers answer
a("S3", 37, 1) //                         8  THE WRONG ENTRY, voided by UNDO

a("M2", 28, 1)
h("REB", 34, 1)
h("S2", 16, 1)
h("AST", 11, 1)
a("S2", 28, 1)
h("M3", 39, 1)
a("REB", 18, 1)
a("S2", 37, 1)
a("AST", 18, 1)
h("FOUL", 34, 1)
a("M2", 18, 1)
a("REB", 28, 1, true)
a("S2", 28, 1)
h("S3", 39, 1)
a("M3", 37, 1)
h("REB", 32, 1)
h("M2", 16, 1)
h("REB", 11, 1, true)
h("S2", 11, 1)
a("M2", 29, 1)
h("REB", 39, 1)
h("S2", 34, 1)
a("FOUL", 21, 1)
h("FT", 34, 1)
a("S2", 18, 1)
h("M2", 16, 1)
a("REB", 29, 1)
h("FOUL", 11, 1)
a("FT", 37, 1)
a("FT", 37, 1)
a("S2", 37, 1)
h("M2", 39, 1)
a("REB", 18, 1)
a("M3", 18, 1)
h("REB", 34, 1)
h("M3", 11, 1)
a("REB", 29, 1)
a("M2", 37, 1)
a("REB", 28, 1, true)
h("M2", 34, 1)
h("REB", 16, 1, true)
a("M2", 28, 1)
h("REB", 32, 1)
X(1)

/* Q2 */
P(2)
sub("away", 4, 29, 2)
sub("home", 33, 32, 2)
a("S3", 28, 2)
h("S2", 11, 2)
h("AST", 16, 2)
a("M3", 37, 2)
h("REB", 33, 2)
h("S3", 39, 2)
a("S2", 37, 2)
a("AST", 28, 2)
h("FOUL", 16, 2)
a("M2", 21, 2)
a("REB", 4, 2, true)
a("S2", 21, 2)
h("M2", 33, 2)
a("REB", 18, 2)
h("S2", 16, 2)
a("FOUL", 18, 2)
h("FT", 39, 2)
h("FT", 39, 2)
a("S2", 28, 2)
h("M3", 39, 2)
a("REB", 37, 2)
a("M2", 4, 2)
h("REB", 11, 2)
h("FOUL", 11, 2)
a("FT", 18, 2)
a("FT", 18, 2)
a("S2", 37, 2)
a("AST", 18, 2)
h("S2", 11, 2)
a("FOUL", 21, 2)
h("MFT", 34, 2)
a("REB", 18, 2)
h("M2", 16, 2)
a("REB", 37, 2)
a("M3", 21, 2)
h("REB", 11, 2)
h("M3", 39, 2)
h("REB", 33, 2, true)
a("M2", 18, 2)
h("REB", 32, 2)
h("M2", 11, 2)
a("REB", 4, 2)
X(2)

/* Q3 */
P(3)
sub("home", 32, 33, 3)
sub("away", 34, 4, 3)
h("S2", 11, 3)
a("S2", 37, 3)
h("S3", 39, 3)
h("AST", 11, 3)
a("M2", 28, 3)
h("REB", 32, 3)
h("S2", 34, 3)
a("S3", 18, 3)
h("FOUL", 39, 3)
a("FT", 28, 3)
h("S2", 16, 3)
a("M3", 37, 3)
a("REB", 34, 3, true)
a("S2", 34, 3)
h("M2", 11, 3)
a("REB", 18, 3)
h("FOUL", 11, 3)
h("M2", 39, 3)
a("REB", 18, 3)
a("S2", 37, 3)
h("S2", 11, 3)
a("FOUL", 37, 3)
h("FT", 16, 3)
h("FT", 16, 3)
h("M2", 34, 3)
a("REB", 28, 3)
a("S2", 28, 3)
h("FOUL", 34, 3)
a("MFT", 28, 3)
h("REB", 39, 3)
h("M3", 16, 3)
a("REB", 18, 3)
a("M2", 34, 3)
a("REB", 37, 3, true)
h("M2", 11, 3)
h("REB", 34, 3, true)
a("M3", 18, 3)
h("REB", 32, 3)
h("M2", 39, 3)
a("REB", 28, 3)
X(3)

/* Q4 — off camera until the last minute, then the camera comes back. */
P(4)
h("S2", 11, 4)
a("S2", 28, 4)
a("AST", 37, 4)
h("FOUL", 34, 4)
a("FT", 28, 4)
a("FT", 28, 4)
h("S3", 39, 4)
a("M2", 18, 4)
h("REB", 11, 4)
h("S2", 16, 4)
a("S3", 18, 4)
a("FOUL", 34, 4)
h("FT", 11, 4)
h("M3", 39, 4)
a("REB", 37, 4)
a("S2", 37, 4)
h("S2", 34, 4)
h("M2", 16, 4)
a("REB", 28, 4)
a("S2", 18, 4)
h("M2", 16, 4)
a("REB", 34, 4)
a("M3", 37, 4)
h("REB", 11, 4)
h("M2", 11, 4)
h("REB", 39, 4, true)
a("M2", 28, 4)
h("REB", 34, 4)
h("M3", 39, 4)
h("REB", 34, 4, true)
a("S2", 37, 4) //  the basket she watches from the box score
a("AST", 18, 4)
h("S2", 39, 4) //  Panthers cut it to two
a("S2", 37, 4) //  Darius seals it
X(4)

const EVENTS = E

/** Beat checkpoints, counted rather than typed, so an edit cannot desync them. */
const AT = {
  tip: 1,
  dariusTwo: 2,
  assist: 3,
  miss: 4,
  rebound: 5,
  foul: 6,
  substitution: 7,
  panthersTwo: 8,
  wrongThree: 9,
  /** The mistaken three, voided rather than deleted. */
  voidIndex: 8,
  /** Where the camera rejoins: everything before the basket she watches. */
  cut: EVENTS.length - 5,
  tour: EVENTS.length - 3,
  cut2: EVENTS.length - 2,
  seal: EVENTS.length - 1,
  buzzer: EVENTS.length,
}

/* ── The fold ────────────────────────────────────────────────────────────── */

const emptyLine = (jersey: number): MockLine => ({
  jersey,
  pts: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  to: 0,
  pf: 0,
})

interface Shooting {
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  reb: number
  ast: number
  pf: number
}

const emptyShooting = (): Shooting => ({
  fgm: 0,
  fga: 0,
  tpm: 0,
  tpa: 0,
  ftm: 0,
  fta: 0,
  reb: 0,
  ast: 0,
  pf: 0,
})

interface Folded {
  home: number
  away: number
  periodPts: { home: Record<number, number>; away: Record<number, number> }
  lines: { home: Record<number, MockLine>; away: Record<number, MockLine> }
  fouls: { home: Record<number, number>; away: Record<number, number> }
  teamFouls: { home: number; away: number }
  onFloor: { home: number[]; away: number[] }
  shooting: { home: Shooting; away: Shooting }
  period: number
  periodOpen: boolean
  rows: PhonePlayRow[]
  ticker: string[]
  freshKey: string
  tone: PulseTone
}

const short = (side: "home" | "away", j: number) =>
  (side === "home" ? HOME_PLAYERS : AWAY_PLAYERS).find((p) => p.jersey === j)?.short ?? ""

const who = (side: "home" | "away", j: number) => `#${j} ${short(side, j)}`

/** Points a scoring event is worth, or 0. */
const points = (k: Kind) => (k === "S2" ? 2 : k === "S3" ? 3 : k === "FT" ? 1 : 0)

/**
 * Everything both phones render, derived from the first `count` events with
 * `voided` skipped. Same shape as lib/scoring/fold: the demo does not keep a
 * second copy of the truth anywhere.
 */
function fold(count: number, voided: number | null): Folded {
  const applied = EVENTS.slice(0, count).filter((_, i) => i !== voided)
  const state: Folded = {
    home: 0,
    away: 0,
    periodPts: { home: {}, away: {} },
    lines: { home: {}, away: {} },
    fouls: { home: {}, away: {} },
    teamFouls: { home: 0, away: 0 },
    onFloor: { home: [...HOME_STARTERS], away: [...AWAY_STARTERS] },
    shooting: { home: emptyShooting(), away: emptyShooting() },
    period: 1,
    periodOpen: false,
    rows: [],
    ticker: [],
    freshKey: "",
    tone: "amber",
  }
  for (const p of HOME_PLAYERS) state.lines.home[p.jersey] = emptyLine(p.jersey)
  for (const p of AWAY_PLAYERS) state.lines.away[p.jersey] = emptyLine(p.jersey)

  const rows: PhonePlayRow[] = []
  let runHome = 0
  let runAway = 0
  const ticker: string[] = []

  applied.forEach((e, i) => {
    const side = e.side ?? "home"
    const line = e.j != null ? state.lines[side][e.j] : null
    const agg = state.shooting[side]
    const pts = points(e.k)
    const key = `e${i}`

    switch (e.k) {
      case "PSTART":
        state.period = e.period
        state.periodOpen = true
        state.teamFouls = { home: 0, away: 0 }
        // A quarter that has started reads 0, not a dash: the dash means "not
        // played yet", which is the linescore's whole job.
        state.periodPts.home[e.period] = state.periodPts.home[e.period] ?? 0
        state.periodPts.away[e.period] = state.periodPts.away[e.period] ?? 0
        rows.push({ key, text: "", score: null, home: true, period: `Q${e.period}` })
        break
      case "PEND":
        state.periodOpen = false
        rows.push({ key, text: "", score: null, home: true, period: "End of period" })
        break
      case "S2":
      case "S3":
      case "FT": {
        if (side === "home") runHome += pts
        else runAway += pts
        if (line) line.pts += pts
        state.periodPts[side][e.period] = (state.periodPts[side][e.period] ?? 0) + pts
        if (e.k === "FT") {
          agg.ftm += 1
          agg.fta += 1
        } else {
          agg.fgm += 1
          agg.fga += 1
          if (e.k === "S3") {
            agg.tpm += 1
            agg.tpa += 1
          }
        }
        rows.push({
          key,
          text:
            e.k === "FT"
              ? `${who(side, e.j as number)} makes a free throw`
              : `${who(side, e.j as number)} scores ${pts}`,
          score: `${runHome}–${runAway}`,
          home: side === "home",
        })
        ticker.push(`${e.k === "FT" ? "FT" : pts === 3 ? "3PT" : "2PT"} #${e.j}`)
        break
      }
      case "M2":
      case "M3": {
        agg.fga += 1
        if (e.k === "M3") agg.tpa += 1
        rows.push({
          key,
          text: `${who(side, e.j as number)} misses a ${e.k === "M3" ? "3" : "2"}-pointer`,
          score: null,
          home: side === "home",
        })
        ticker.push(`miss #${e.j}`)
        break
      }
      case "MFT": {
        agg.fta += 1
        rows.push({
          key,
          text: `${who(side, e.j as number)} misses a free throw`,
          score: null,
          home: side === "home",
        })
        ticker.push(`FT miss #${e.j}`)
        break
      }
      case "REB": {
        if (line) line.reb += 1
        agg.reb += 1
        // The product joins a miss to the rebound that followed it. Its own
        // separator is an em-dash, which house copy does not allow, so the
        // demo joins with a middot.
        const last = rows[rows.length - 1]
        if (last && last.text.includes("misses")) {
          last.text = `${last.text} · ${e.off ? "offensive" : "defensive"} rebound ${who(
            side,
            e.j as number
          )}`
        } else {
          rows.push({
            key,
            text: `${e.off ? "Offensive" : "Defensive"} rebound ${who(side, e.j as number)}`,
            score: null,
            home: side === "home",
          })
        }
        ticker.push(`REB #${e.j}`)
        break
      }
      case "AST": {
        if (line) line.ast += 1
        agg.ast += 1
        const last = rows[rows.length - 1]
        if (last && last.text.includes("scores")) {
          last.text = `${last.text}, assisted by ${who(side, e.j as number)}`
        }
        ticker.push(`AST #${e.j}`)
        break
      }
      case "FOUL": {
        if (line) line.pf += 1
        agg.pf += 1
        state.fouls[side][e.j as number] = (state.fouls[side][e.j as number] ?? 0) + 1
        state.teamFouls[side] += 1
        rows.push({
          key,
          text: `Foul on ${who(side, e.j as number)}`,
          score: null,
          home: side === "home",
        })
        ticker.push(`FOUL #${e.j}`)
        break
      }
      case "SUB": {
        const floor = state.onFloor[side]
        const at = floor.indexOf(e.out as number)
        if (at >= 0) floor[at] = e.in as number
        rows.push({
          key,
          text: `Sub: #${e.in} in, #${e.out} out`,
          score: null,
          home: side === "home",
        })
        ticker.push(`SUB #${e.in}`)
        break
      }
    }
  })

  state.home = runHome
  state.away = runAway
  state.rows = [...rows].reverse()
  state.ticker = ticker.slice(-2).reverse()

  const lastPlay = [...rows].reverse().find((r) => !r.period)
  state.freshKey = lastPlay?.key ?? ""
  const lastEvent = applied[applied.length - 1]
  state.tone = !lastEvent
    ? "amber"
    : lastEvent.k === "S2" || lastEvent.k === "S3" || lastEvent.k === "FT"
      ? "green"
      : lastEvent.k === "FOUL"
        ? "red"
        : "amber"
  return state
}

/** Quarters the linescore shows: always four, dashes for the unplayed ones. */
const DISPLAY_PERIODS = [1, 2, 3, 4]

const shootingLine = (m: number, at: number) =>
  at === 0 ? "0-0" : `${m}-${at} · ${Math.round((m / at) * 100)}%`

/** The final table, derived in `docs/roadmap/game-day-numbers.md` §G. */
const STANDINGS = [
  { rank: 1, team: "CKATT Basketball G9", w: 7, l: 2, pct: ".778", gb: "0", strk: "L1" },
  { rank: 2, team: "West United Prep G9", w: 6, l: 3, pct: ".667", gb: "1", strk: "W1" },
  { rank: 3, team: "Burlington Force G9", w: 6, l: 4, pct: ".600", gb: "1.5", strk: "W1" },
  { rank: 4, team: "Toronto Lords G9", w: 5, l: 6, pct: ".455", gb: "3", strk: "W1" },
  { rank: 5, team: "North Toronto Huskies G9", w: 4, l: 5, pct: ".444", gb: "3", strk: "W3" },
  { rank: 6, team: "Mississauga Monarchs G9", w: 4, l: 5, pct: ".444", gb: "3", strk: "L1" },
]

/* ── Pacing ──────────────────────────────────────────────────────────────── */

/**
 * Stop, explain, act, with room for the game to breathe (owner 2026-08-16).
 * The hand takes CURSOR_ARRIVE_MS to reach its target and the balloon lands
 * with it, so a beat holds for the travel, plus long enough to READ the balloon
 * at about 165ms a word with an 800ms buffer, plus a settle. A beat with no
 * balloon is one of the fast taps in a scoring burst, and holds only as long as
 * a tap takes to land.
 */
function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 420
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 165 + 800 : 1500
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const gameDayStory: DemoScript = {
  presentation: "scene",
  scenePhones: true,
  desktopUrl: URL_SCORE,
  initialStage: "desktop",
  chapters: [
    { id: "tipoff", title: "Before tip-off" },
    { id: "scoring", title: "Two taps a play" },
    { id: "family", title: "What the family sees" },
    { id: "buzzer", title: "The buzzer and the sign-off" },
    { id: "story", title: "The story writes itself" },
  ],

  beats: [
    /* ── 1. Before tip-off ────────────────────────────────────────────── */
    paced({
      id: "checklist",
      chapter: "tipoff",
      caption:
        "The scorer's table is a phone on a folding table, and it opens the game with two questions.",
      emphasize: "clock-yes",
      callout: "Whoever is keeping score opens the game on their own phone.",
      set: { screen: "checklist" },
    }),
    paced({
      id: "clock-choice",
      chapter: "tipoff",
      caption: "The table says whether it is running the clock.",
      cursor: "clock-yes",
      press: true,
      callout: "Minutes played are only counted when somebody is starting and stopping it.",
      set: { clockChoice: true },
    }),
    /* PRESS, THEN RESULT (2026-08-16). State is applied at the TOP of a beat, so
       a beat that presses a control AND sets the state that removes it sends the
       hand to something already gone, and a phone keyhole pans to nothing. Every
       press that changes screens in this story therefore leaves its own state
       change, and the toast confirming it, to the beat after it. */
    paced({
      id: "checklist-go",
      chapter: "tipoff",
      caption: "Attendance first, then the five who start.",
      cursor: "checklist-go",
      press: true,
    }),
    paced({
      id: "roll-call",
      chapter: "tipoff",
      caption: "Roll call happens at the door, on the same phone.",
      emphasize: "roll-call",
      callout: "Everyone starts present, so the table only taps whoever did not make it.",
      set: { screen: "attendance" },
    }),
    paced({
      id: "absent",
      chapter: "tipoff",
      caption: "Ethan Lee is not here tonight.",
      cursor: "att-15",
      press: true,
      callout:
        "An absent player reads ABSENT on the scoresheet and does not count a game played in his season stats.",
      set: { absent: true },
    }),
    paced({
      id: "to-lineups",
      chapter: "tipoff",
      caption: "Nine here, one out.",
      cursor: "to-lineups",
      press: true,
    }),
    paced({
      id: "starters",
      chapter: "tipoff",
      caption: "Five and five, confirmed before anybody touches the ball.",
      emphasize: "start-away-37",
      callout: "The starting five is what lets the box score say who was on the floor.",
      set: { screen: "lineup" },
    }),
    paced({
      id: "start-game",
      chapter: "tipoff",
      caption: "One press opens the game, and the clock starts.",
      cursor: "start-game",
      press: true,
    }),

    /* ── 2. Two taps a play ───────────────────────────────────────────── */
    paced({
      id: "phone-arrives",
      chapter: "scoring",
      caption: `${PARENT} is not in the building. He opens the game from a link.`,
      stage: "split",
      emphasize: "live-state",
      callout: "The same game and the same clock, with nothing to install.",
      toast: "Q1 under way",
      set: { phone: "game", screen: "console", evts: AT.tip, clockBase: 600, running: true },
    }),
    paced({
      id: "arm-two",
      chapter: "scoring",
      caption: "Tap an action, then a player. Either order works.",
      cursor: "act-2",
      press: true,
      set: { act: "+2" },
    }),
    paced({
      id: "darius-two",
      chapter: "scoring",
      caption: "Two for Darius Reyes, and the number that moved is the number that flashes.",
      cursor: "floor-away-37",
      press: true,
      callout: "Two taps at the table, and it is on the other phone before the ball is back in play.",
      set: { evts: AT.dariusTwo, act: "" },
    }),
    paced({
      id: "assist",
      chapter: "scoring",
      caption: "The console asks who assisted, and the play says it out loud.",
      cursor: "assist-18",
      press: true,
      callout: "Scores 2, assisted by number eighteen. The sentence writes itself from the two taps.",
      set: { evts: AT.assist },
    }),
    paced({
      id: "arm-miss",
      chapter: "scoring",
      caption: "Misses are recorded too.",
      cursor: "act-miss3",
      press: true,
      set: { act: "3 ✗" },
    }),
    paced({
      id: "miss-three",
      chapter: "scoring",
      caption: "The attempt goes on the sheet as a miss.",
      cursor: "floor-away-37",
      press: true,
      callout: "Attempts are what make a shooting percentage possible later.",
      set: { evts: AT.miss, act: "" },
    }),
    paced({
      id: "arm-reb",
      chapter: "scoring",
      caption: "The rebound is the next tap.",
      cursor: "act-reb",
      press: true,
      set: { act: "REB" },
    }),
    paced({
      id: "rebound",
      chapter: "scoring",
      caption: "Ibrahim White keeps it alive, and the miss and the board become one line.",
      cursor: "floor-away-28",
      press: true,
      set: { evts: AT.rebound, act: "" },
    }),
    paced({
      id: "arm-foul",
      chapter: "scoring",
      caption: "A foul is the same two taps.",
      cursor: "act-foul",
      press: true,
      set: { act: "FOUL" },
    }),
    paced({
      id: "foul",
      chapter: "scoring",
      caption: "Fouls are counted at both ends, and the phone turns that one red.",
      cursor: "floor-home-32",
      press: true,
      callout: "Green is points and red is a foul, so the colour says it before the words do.",
      set: { evts: AT.foul, act: "" },
    }),
    paced({
      id: "subs-open",
      chapter: "scoring",
      caption: "Substitutions get their own drawer, because a swap is two decisions.",
      cursor: "subs-away",
      press: true,
      set: { sheet: true },
    }),
    paced({
      id: "sub-out",
      chapter: "scoring",
      caption: "Who comes off.",
      cursor: "sub-out-34",
      press: true,
      set: { subOut: 34 },
    }),
    paced({
      id: "sub-in",
      chapter: "scoring",
      caption: "Then who goes on.",
      cursor: "sub-in-21",
      press: true,
      set: { subOut: 0, staged: true },
    }),
    paced({
      id: "sub-apply",
      chapter: "scoring",
      caption: "Both halves of the swap go on together.",
      cursor: "sub-apply",
      press: true,
    }),
    paced({
      id: "sub-done",
      chapter: "scoring",
      caption: "Zion Nguyen is on, and the floor follows in amber.",
      emphasize: "floor-away-21",
      callout: "Amber is everything else the table does, so a swap never reads as a score.",
      set: { evts: AT.substitution, sheet: false, staged: false },
    }),
    paced({
      id: "arm-panthers",
      chapter: "scoring",
      caption: "Oakville answer at the other end.",
      cursor: "act-2",
      press: true,
      set: { act: "+2" },
    }),
    paced({
      id: "panthers-two",
      chapter: "scoring",
      caption: "Same two taps, and both totals move.",
      cursor: "floor-home-11",
      press: true,
      set: { evts: AT.panthersTwo, act: "" },
    }),
    paced({
      id: "arm-three",
      chapter: "scoring",
      caption: "Then a wrong entry.",
      cursor: "act-3",
      press: true,
      set: { act: "+3" },
    }),
    paced({
      id: "wrong-entry",
      chapter: "scoring",
      caption: "Three points go on for a shot that rimmed out.",
      cursor: "floor-away-37",
      press: true,
      set: { evts: AT.wrongThree, act: "" },
    }),
    paced({
      id: "undo",
      chapter: "scoring",
      caption: "One tap fixes it, and the phone walks the score back.",
      cursor: "undo",
      press: true,
      callout:
        "The entry is voided, not deleted, and every number built on it walks back on its own.",
      set: { voided: AT.voidIndex, tone: "amber" },
    }),

    /* ── 3. What the family sees ──────────────────────────────────────── */
    paced({
      id: "cut",
      chapter: "family",
      caption: "Three quarters later. Same table, same phone, same clock.",
      emphasize: "linescore",
      callout:
        "Every quarter of it is on the scoreboard he is holding, and the dash means a quarter nobody has played yet.",
      set: { evts: AT.cut, clockBase: 132, running: true, tone: "amber" },
    }),
    paced({
      id: "box",
      chapter: "family",
      caption: "He scrolls past the scoreboard to the box score.",
      cursor: "phone-tab-game",
      press: true,
      set: { phone: "box" },
    }),
    paced({
      id: "box-live",
      chapter: "family",
      caption: "Darius's line moves while he is looking at it.",
      emphasize: "box-highlight",
      callout: "Twenty points, and the score at the top of the screen moves with the row.",
      set: { evts: AT.tour },
    }),
    paced({
      id: "stats",
      chapter: "family",
      caption: "Team stats carry every attempt, not only the ones that went in.",
      cursor: "phone-tab-stats",
      press: true,
      callout: "Because the table recorded the misses, the shooting line is a real one.",
      set: { phone: "stats" },
    }),
    paced({
      id: "plays",
      chapter: "family",
      caption: "And the play-by-play is the whole night in order.",
      cursor: "phone-tab-plays",
      press: true,
      callout: "The same sentences the table entered, assist attribution and all, in one list.",
      set: { phone: "plays" },
    }),
    paced({
      id: "no-account",
      chapter: "family",
      caption: "He was sent a link. There is no app and no account behind it.",
      hold: 3000,
    }),

    /* ── 4. The buzzer and the sign-off ───────────────────────────────── */
    paced({
      id: "last-minute",
      chapter: "buzzer",
      caption: "Under a minute, and every number still comes from the table.",
      cursor: "phone-tab-game",
      press: true,
      set: { phone: "game", clockBase: 41, running: true },
    }),
    paced({
      id: "arm-cut",
      chapter: "buzzer",
      caption: "Oakville cut it to two.",
      cursor: "act-2",
      press: true,
      set: { act: "+2" },
    }),
    paced({
      id: "panthers-cut",
      chapter: "buzzer",
      caption: "Two-point game.",
      cursor: "floor-home-39",
      press: true,
      set: { evts: AT.cut2, act: "" },
    }),
    paced({
      id: "arm-seal",
      chapter: "buzzer",
      caption: "The Lords answer.",
      cursor: "act-2",
      press: true,
      set: { act: "+2" },
    }),
    paced({
      id: "seal",
      chapter: "buzzer",
      caption: "Darius seals it, and it lands on the other phone as it happens.",
      cursor: "floor-away-37",
      press: true,
      set: { evts: AT.seal, act: "" },
    }),
    paced({
      id: "buzzer",
      chapter: "buzzer",
      caption: "The buzzer. Both screens stop on the same zero.",
      /* No hand here. The caption is the clock reaching zero, and the period
         closing is what turns End Q4 into End game, so a press on End Q4 would
         be a press on a control this beat's own state removes. Ring the clock,
         which is the thing the sentence is about. */
      emphasize: "console-clock",
      toast: "Q4 ended",
      set: { clockBase: 0, running: false, evts: AT.buzzer },
    }),
    paced({
      id: "end-game",
      chapter: "buzzer",
      caption: "Nothing is official yet. The table reads the sheet back first.",
      cursor: "end-game",
      press: true,
    }),
    paced({
      id: "potg-pick",
      chapter: "buzzer",
      caption: "Player of the game comes off the sheet, with the top scorer already suggested.",
      emphasize: "approval-sign",
      callout: "The top scorer is suggested from the sheet, and the table can pick anybody.",
      set: { screen: "review" },
    }),
    paced({
      id: "sign",
      chapter: "buzzer",
      caption: "The referee signs at the table, the way he signs the paper one.",
      cursor: "sign-pad",
      press: true,
      callout: "A finger on the glass, exactly where his pen goes on a paper sheet.",
      set: { signed: true, refName: REFEREE },
    }),
    paced({
      id: "pin",
      chapter: "buzzer",
      caption: "A PIN is the other way, checked against the referee's own account.",
      cursor: "approval-pin",
      press: true,
      callout: "A PIN proves which referee signed, where a drawn signature proves only that one was drawn.",
      set: { mode: "pin" },
    }),
    paced({
      id: "mark-final",
      chapter: "buzzer",
      caption: "Marked final, and the game on his phone flips with it.",
      cursor: "mark-final",
      press: true,
      toast: "Result published",
      set: { mode: "sign", final: true, tone: "green", phone: "final" },
    }),
    paced({
      id: "scoresheet",
      chapter: "buzzer",
      caption: "And the paper scoresheet exists, because leagues still need one.",
      emphasize: "download-pdf",
      callout:
        "Foul boxes, quarter marks, the referee's signature and the absences, printed landscape on one page.",
      set: { screen: "sheet" },
    }),
    paced({
      id: "pdf",
      chapter: "buzzer",
      caption: "One tap turns it into the PDF the league files.",
      cursor: "download-pdf",
      press: true,
      toast: "Scoresheet PDF",
    }),

    /* ── 5. The story writes itself ───────────────────────────────────── */
    paced({
      id: "recap",
      chapter: "story",
      caption: "The recap writes itself off the sheet and posts as a card.",
      emphasize: "recap",
      callout: "Minutes after the buzzer, off the same numbers, with nobody typing anything.",
      set: { phone: "feed", recap: true },
    }),
    paced({
      id: "potg",
      chapter: "story",
      caption: "Player of the game lands with it.",
      emphasize: "potg",
      callout: "Twenty two points, four rebounds and one assist, straight off the sheet.",
      set: { potgCard: true },
    }),
    paced({
      id: "standings",
      chapter: "story",
      caption: "And the division moves, because a signed result is a result the league can count.",
      emphasize: "standings",
      callout: "Toronto Lords move from sixth to fourth, computed from completed games.",
      set: { standings: true },
    }),
    paced({
      id: "end",
      chapter: "story",
      caption: "One game, scored on a phone, live on another one the whole way.",
      hold: 5200,
      set: { endCard: true },
    }),
  ],

  /* ── Render ───────────────────────────────────────────────────────────── */

  render: ({ get, reduced }) => {
    const screen = get<string>("screen", "checklist")
    const phone = get<string>("phone", "")
    const evts = get<number>("evts", 0)
    const voidedRaw = get<number>("voided", -1)
    const voided = voidedRaw >= 0 ? voidedRaw : null
    const state = fold(evts, voided)
    const toneOverride = get<string>("tone", "")
    const tone = (toneOverride || state.tone) as PulseTone

    const clockBase = get<number>("clockBase", 600)
    const running = get<boolean>("running", false)
    const act = get<string>("act", "")
    const sheet = get<boolean>("sheet", false)
    const subOut = get<number>("subOut", 0)
    const staged = get<boolean>("staged", false)
    const final = get<boolean>("final", false)
    const endCard = get<boolean>("endCard", false)

    const periodLabel = `Q${state.period}`
    const homeBench = HOME_PLAYERS.map((p) => p.jersey).filter(
      (j) => !state.onFloor.home.includes(j) && !HOME_ABSENT.includes(j)
    )
    const awayBench = AWAY_PLAYERS.map((p) => p.jersey).filter(
      (j) => !state.onFloor.away.includes(j) && !AWAY_ABSENT.includes(j)
    )

    const amara = state.lines.away[37]
    const potgLine = `${amara.pts} PTS · ${amara.reb} REB · ${amara.ast} AST`

    /* ── Left phone: the scorer's console ─────────────────────────────── */

    const consoleScreen = (
      <div className="relative flex h-full flex-col gap-1.5 px-2 py-2">
        <ConsoleHeader
          homeName={HOME.short}
          awayName={AWAY.short}
          homeScore={state.home}
          awayScore={state.away}
          homeFouls={state.teamFouls.home}
          awayFouls={state.teamFouls.away}
          periodLabel={periodLabel}
          clockBase={clockBase}
          running={running}
          reduced={reduced}
          periodOpen={state.periodOpen}
          ended={state.period >= 4}
          ticker={state.ticker}
        />
        <ConsoleChips
          side="home"
          players={HOME_PLAYERS}
          onFloor={state.onFloor.home}
          fouls={state.fouls.home}
          armed={!!act}
          benchCount={homeBench.length}
        />
        <ConsoleChips
          side="away"
          players={AWAY_PLAYERS}
          onFloor={state.onFloor.away}
          fouls={state.fouls.away}
          armed={!!act}
          benchCount={awayBench.length}
        />
        <ConsoleActionPad
          pending={act || null}
          pendingPlayer={null}
          // The console asks for the assist right after a made basket and keeps
          // asking until the table answers or arms the next action, which is
          // also what keeps the prompt on screen for the press.
          assistFor={!act && (evts === AT.dariusTwo || evts === AT.assist) ? 37 : null}
          assistOptions={state.onFloor.away.filter((j) => j !== 37)}
        />
        {sheet && (
          <ConsoleSubsSheet
            teamName={AWAY.name}
            onFloor={state.onFloor.away}
            bench={awayBench}
            players={AWAY_PLAYERS}
            out={subOut || null}
            staged={staged ? [{ out: 34, in: 21 }] : []}
          />
        )}
      </div>
    )

    const sheetRows = AWAY_PLAYERS.map((p) => {
      const l = state.lines.away[p.jersey]
      return {
        jersey: p.jersey,
        name: p.name,
        fouls: l.pf,
        marks: [],
        reb: l.reb,
        ast: l.ast,
        pts: l.pts,
        absent: AWAY_ABSENT.includes(p.jersey),
      }
    })

    const scorer = (
      <PhoneBody>
        <div key={screen} className="demo-fade-in relative flex min-h-0 flex-1 flex-col">
          {screen === "attendance" ? (
            <ConsoleAttendance
              id="roll-call"
              teamName={AWAY.name}
              players={AWAY_PLAYERS}
              absent={get<boolean>("absent", false) ? AWAY_ABSENT : []}
            />
          ) : screen === "lineup" ? (
            <ConsoleLineup
              doneName={HOME.name}
              doneStarters={HOME_STARTERS}
              pickName={AWAY.name}
              players={AWAY_PLAYERS.filter((p) => !AWAY_ABSENT.includes(p.jersey))}
              starters={AWAY_STARTERS}
              side="away"
            />
          ) : screen === "review" ? (
            <ConsoleReview
              homeName={HOME.short}
              awayName={AWAY.short}
              homeScore={state.home}
              awayScore={state.away}
              potg="Darius R."
              potgPoints={amara.pts}
              potgOptions={[
                { jersey: 37, short: "Darius R.", pts: state.lines.away[37].pts },
                { jersey: 39, short: "Andre N.", pts: state.lines.home[39].pts },
                { jersey: 28, short: "Ibrahim W.", pts: state.lines.away[28].pts },
              ]}
              signed={get<boolean>("signed", false)}
              refereeName={get<string>("refName", "")}
              mode={get<"sign" | "pin">("mode", "sign")}
            />
          ) : screen === "sheet" ? (
            <ConsoleScoresheet
              league={LEAGUE}
              season={SEASON}
              when={TIPOFF}
              venue={VENUE}
              homeName={HOME.name}
              awayName={AWAY.name}
              homeScore={state.home}
              awayScore={state.away}
              homeLine={DISPLAY_PERIODS.map((p) => state.periodPts.home[p] ?? 0)}
              awayLine={DISPLAY_PERIODS.map((p) => state.periodPts.away[p] ?? 0)}
              rows={sheetRows}
              potg="Darius Reyes"
              referee={REFEREE}
              signedAt="Aug 22, 1:34 p.m."
            />
          ) : (
            consoleScreen
          )}
          {/* The checklist is a modal OVER the console, which is exactly how
              the product mounts it: `PreGameChecklist` renders above
              `ScoringConsole` on the same route. */}
          {screen === "checklist" && (
            <ConsoleChecklist
              scorekeeper={SCOREKEEPER}
              referee={REFEREE}
              clockChoice={get<boolean | null>("clockChoice", null)}
              invite
            />
          )}
        </div>
        {endCard && (
          <MockEndCard
            eyebrow="A game-day story"
            title="Both phones"
            line="One game, kept on a phone at the table, arriving live on the phone of everybody who could not be there."
            next="Next: everyone in the loop"
          />
        )}
      </PhoneBody>
    )

    /* ── Right phone: the public live game page ───────────────────────── */

    const heroProps = {
      league: `${LEAGUE} · ${SEASON}`,
      home: HOME,
      away: AWAY,
      homeScore: state.home,
      awayScore: state.away,
      periodLabel,
      clockBase,
      running,
      reduced,
      final,
      venue: VENUE,
      linescore: { home: state.periodPts.home, away: state.periodPts.away },
      displayPeriods: DISPLAY_PERIODS,
      tone,
    }
    const chipProps = {
      home: HOME,
      away: AWAY,
      homeScore: state.home,
      awayScore: state.away,
      periodLabel,
      clockBase,
      running,
      reduced,
      final,
      tone,
    }

    const statRows = [
      {
        label: "Field goals",
        h: state.shooting.home.fgm,
        a: state.shooting.away.fgm,
        dh: shootingLine(state.shooting.home.fgm, state.shooting.home.fga),
        da: shootingLine(state.shooting.away.fgm, state.shooting.away.fga),
      },
      {
        label: "3-pointers",
        h: state.shooting.home.tpm,
        a: state.shooting.away.tpm,
        dh: shootingLine(state.shooting.home.tpm, state.shooting.home.tpa),
        da: shootingLine(state.shooting.away.tpm, state.shooting.away.tpa),
      },
      {
        label: "Free throws",
        h: state.shooting.home.ftm,
        a: state.shooting.away.ftm,
        dh: shootingLine(state.shooting.home.ftm, state.shooting.home.fta),
        da: shootingLine(state.shooting.away.ftm, state.shooting.away.fta),
      },
      { label: "Rebounds", h: state.shooting.home.reb, a: state.shooting.away.reb },
      { label: "Assists", h: state.shooting.home.ast, a: state.shooting.away.ast },
      { label: "Fouls", h: state.shooting.home.pf, a: state.shooting.away.pf },
    ]

    const watcher = (
      <PhoneBody>
        {phone === "game" || phone === "final" || phone === "" ? (
          <>
            <LiveHero {...heroProps} />
            <LiveTabs active="game" />
            <div className="min-h-0 flex-1 px-2.5 pt-1.5">
              <LivePlays
                title="Latest plays"
                rows={state.rows.filter((r) => !r.period).slice(0, 3)}
                freshKey={state.freshKey}
                tone={tone}
              />
            </div>
          </>
        ) : phone === "feed" ? (
          <>
            <LiveScoreChip {...chipProps} />
            <div className="min-h-0 flex-1 space-y-2 px-2.5 py-2.5">
              {get<boolean>("potgCard", false) && (
                <LivePotgCard name="Darius Reyes" jersey={37} line={potgLine} fresh />
              )}
              {get<boolean>("recap", false) && !get<boolean>("standings", false) && (
                <LiveRecapCard
                  club="Toronto Lords"
                  title={`Toronto Lords Grade 9 tops Oakville Panthers Grade 9 ${state.away}–${state.home}`}
                  body={`Toronto Lords Grade 9 defeated Oakville Panthers Grade 9 ${state.away}–${state.home} on Saturday, August 22 in ${LEAGUE} ${SEASON} action. The teams traded the lead 6 times before Toronto Lords Grade 9 took control late.`}
                  meta="Posted 6 minutes after the final buzzer"
                  fresh
                />
              )}
              {get<boolean>("standings", false) && (
                <>
                  <p className="text-ink-500 px-0.5 text-[14px] font-bold uppercase tracking-[0.1em]">
                    {DIVISION}
                  </p>
                  <LiveStandings rows={STANDINGS} movedTeam="Toronto Lords G9" />
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <LiveScoreChip {...chipProps} />
            <LiveTabs active={phone === "plays" ? "plays" : phone === "stats" ? "stats" : "game"} />
            <div className="min-h-0 flex-1 px-2.5 pt-1.5">
              {phone === "box" && (
                <LiveBoxScore
                  homeName={HOME.short}
                  awayName={AWAY.short}
                  side="away"
                  players={AWAY_PLAYERS.filter((p) => !AWAY_ABSENT.includes(p.jersey))}
                  lines={state.lines.away}
                  starters={AWAY_STARTERS}
                  onFloor={state.onFloor.away}
                  tone={tone}
                  highlight={37}
                  live={!final}
                />
              )}
              {phone === "stats" && (
                <LiveTeamStats
                  home={HOME}
                  away={AWAY}
                  homeScore={state.home}
                  awayScore={state.away}
                  rows={statRows}
                  tone={tone}
                  pulseLabel="3-pointers"
                />
              )}
              {phone === "plays" && (
                <LivePlays
                  rows={state.rows.slice(0, 8)}
                  freshKey={state.freshKey}
                  tone={tone}
                  filters={["All", "Scoring", "Q4", "Q3"]}
                  activeFilter="All"
                />
              )}
            </div>
          </>
        )}
      </PhoneBody>
    )

    const leftLabel =
      screen === "sheet"
        ? `Scorer's phone · /scoresheet/${"7e467b44"}`
        : `${SCOREKEEPER}'s phone · ${URL_SCORE}`
    const rightLabel = `${PARENT}'s phone · /live/7e467b44`

    return {
      desktop: scorer,
      phone: watcher,
      frameLabels: { left: leftLabel, right: rightLabel },
    }
  },
}
