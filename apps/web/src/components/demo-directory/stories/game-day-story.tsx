"use client"

import { MockEndCard, MockTopBar } from "../mock-ui"
import {
  ConsoleActionPad,
  ConsoleChecklist,
  ConsoleFinal,
  ConsoleFloor,
  ConsoleHeader,
  ConsoleLineup,
  ConsoleReview,
  ConsoleSubsSheet,
  PhoneBoxScore,
  PhoneMiniScore,
  PhoneGameTabs,
  PhonePlayList,
  PhonePotgCard,
  PhoneRecapCard,
  PhoneScoreHero,
  PhoneStandings,
  PhoneTeamStats,
  type MockLine,
  type MockPlayer,
  type PhonePlayRow,
  type PhoneTeam,
  type PulseTone,
} from "../mock-scoring"
import type { DemoScript } from "../types"

/**
 * Story 4: "Game day, both sides at once" (owner-signed script, 2026-08-15).
 *
 * THE ARGUMENT. A youth game is scored by a parent volunteer on a folding
 * table, and everyone who could not be in the gym finds out the score by text
 * message an hour later. This story puts both ends of that on one stage: the
 * console at the table on the left, the phone of a mother who is still at work
 * on the right, and one game running through both.
 *
 * THE OWNER'S SYNC LAWS, and where each one lives:
 *   1. ONE CLOCK, BOTH FRAMES. There is a single clock value in scene state and
 *      a single ticker behind it (`useDemoClock`, mock-scoring.tsx). The console
 *      and the phone do not each run a clock that happens to agree: they render
 *      the same number from the same store, so they cannot drift. It ticks
 *      through the play beats and stops dead when the table stops it.
 *   2. THE PHONE FLASHES WHAT CHANGED. Every value on the phone that can move
 *      is wrapped in `Pulse`: green for a made shot or a score going up, red
 *      for a foul, amber for everything else the table does (a substitution, a
 *      period, a correction). The flash is on the element itself, so a score
 *      digit, a linescore cell, a box-score cell and a play row each announce
 *      their own change.
 *   3. THE FULL ACTION SET, MISSES INCLUDED. The pad carries exactly what this
 *      league's console carries: +2, +3, FT ✓, 2 ✗, 3 ✗, FT ✗, REB, AST, FOUL.
 *      Steals and blocks are not on it, because they are not on the table's
 *      console tonight; the phone still renders the real box-score columns, so
 *      what the table cannot record reads as a zero rather than disappearing.
 *   4. SCORE AND QUARTER TRAVEL TOGETHER. The hero carries both, and every
 *      other phone view carries the mini score chip, which is the real page's
 *      own sticky chip with the clock added.
 *   5. ONE PLAY, ONE MOMENT. The play-by-play entry pops in on the same beat
 *      the score flashes, and the assist play carries its attribution the way
 *      the product writes it.
 *
 * THE STATE MODEL. Everything the two frames show is FOLDED from one event
 * stream, exactly like the product: `EVENTS` is the game, a beat says how many
 * of them have happened, and the fold derives scores, the linescore, both box
 * scores, team fouls, who is on the floor and the play-by-play. That is what
 * makes the undo beat honest: the mistaken three is not deleted, it is VOIDED,
 * and every number that was built on it walks back on its own.
 *
 * TRUTH TO THE PRODUCT. The console mirrors components/scoring/scoring-console
 * .tsx and components/scoring/pre-game-checklist.tsx, down to the wording of
 * the status strip ("Tap an action, then a player"), the dashed "SUBS ⇄ (n on
 * bench)", the red UNDO, the synced pill, and the referee approval block with
 * its Signature / Referee PIN switch. The phone mirrors app/(public)/live/
 * [gameId]: the navy hero with the linescore inside it, the mini score chip,
 * the Game / Team stats / Play-by-play tabs, the box score behind its team
 * switcher, and the play rows with their neutral rail and running score.
 */

/* ── Cast ────────────────────────────────────────────────────────────────── */

/**
 * The teams as every score surface writes them: the club name on the row and
 * the age group with the record underneath, which is how the live page keeps a
 * long youth team name readable on a phone.
 */
const HOME: PhoneTeam = {
  name: "Riverside Ravens",
  short: "RR · U11",
  record: "7-2 · U11 Girls Rep",
}
const AWAY: PhoneTeam = {
  name: "Lakeshore Lightning",
  short: "LL · U11",
  record: "6-3 · U11 Girls Rep",
}
const LEAGUE = "Ontario Community League · 2026 Winter"
const VENUE = "Riverside CC, Court 2"
const REFEREE = "Mike Osei"
const SCOREKEEPER = "Dana Michaels"

const HOME_PLAYERS: MockPlayer[] = [
  { jersey: 23, name: "Amara Bello", short: "Amara B." },
  { jersey: 7, name: "Maya Rivera", short: "Maya R." },
  { jersey: 4, name: "Priya Shah", short: "Priya S." },
  { jersey: 11, name: "Zoe Tremblay", short: "Zoe T." },
  { jersey: 5, name: "Nia Okafor", short: "Nia O." },
  { jersey: 9, name: "Hana Kimura", short: "Hana K." },
  { jersey: 12, name: "Sofia Ricci", short: "Sofia R." },
  { jersey: 15, name: "Layla Haddad", short: "Layla H." },
]
const AWAY_PLAYERS: MockPlayer[] = [
  { jersey: 10, name: "Jade Whitford", short: "Jade W." },
  { jersey: 8, name: "Talia Grant", short: "Talia G." },
  { jersey: 6, name: "Erin Doyle", short: "Erin D." },
  { jersey: 14, name: "Riya Patel", short: "Riya P." },
  { jersey: 21, name: "Casey Moreau", short: "Casey M." },
  { jersey: 3, name: "Ivy Chen", short: "Ivy C." },
  { jersey: 17, name: "Noor Aziz", short: "Noor A." },
]

const HOME_STARTERS = [23, 7, 4, 11, 5]
const AWAY_STARTERS = [10, 8, 6, 14, 21]

const URL_SCORE = "/games/ravens-lightning-jan-18/score"

/* ── The game, as an event stream ────────────────────────────────────────── */

type Kind =
  | "PSTART"
  | "PEND"
  | "S2"
  | "S3"
  | "FT"
  | "M2"
  | "M3"
  | "REB"
  | "AST"
  | "FOUL"
  | "SUB"

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

const ev = (k: Kind, side: "home" | "away", j: number, period: number, off?: boolean): Ev => ({
  k,
  side,
  j,
  period,
  off,
})
const sub = (side: "home" | "away", inJ: number, outJ: number, period: number): Ev => ({
  k: "SUB",
  side,
  in: inJ,
  out: outJ,
  period,
})

/** What the camera watches in the first quarter. */
const FILMED: Ev[] = [
  { k: "PSTART", period: 1 }, // 0
  ev("S2", "home", 23, 1), // 1
  ev("AST", "home", 7, 1), // 2
  ev("M3", "home", 23, 1), // 3
  ev("REB", "home", 11, 1, true), // 4
  ev("FOUL", "away", 14, 1), // 5
  sub("home", 9, 5, 1), // 6
  ev("S2", "away", 10, 1), // 7
  ev("S3", "home", 23, 1), // 8 — the entry that never happened
]

/** The rest of the night, scored by the same table off camera. */
const OFFCAM: Ev[] = [
  ev("S2", "home", 7, 1),
  ev("M2", "home", 5, 1),
  ev("REB", "away", 21, 1),
  ev("S2", "away", 21, 1),
  ev("S3", "home", 4, 1),
  ev("FOUL", "home", 4, 1),
  ev("S3", "away", 8, 1),
  ev("S2", "home", 11, 1),
  ev("M3", "away", 8, 1),
  ev("REB", "home", 11, 1),
  ev("S2", "away", 6, 1),
  ev("FT", "home", 7, 1),
  ev("FT", "home", 7, 1),
  ev("FOUL", "away", 6, 1),
  ev("FT", "away", 14, 1),
  { k: "PEND", period: 1 },

  { k: "PSTART", period: 2 },
  sub("home", 12, 11, 2),
  ev("S3", "away", 8, 2),
  ev("S2", "home", 23, 2),
  ev("S2", "away", 10, 2),
  ev("M2", "home", 12, 2),
  ev("REB", "home", 23, 2, true),
  ev("S2", "home", 9, 2),
  ev("AST", "home", 23, 2),
  ev("FOUL", "away", 21, 2),
  ev("S2", "away", 21, 2),
  ev("S2", "home", 12, 2),
  ev("M3", "home", 4, 2),
  ev("REB", "away", 10, 2),
  ev("S3", "away", 6, 2),
  ev("FOUL", "home", 5, 2),
  ev("FT", "home", 4, 2),
  ev("FT", "home", 4, 2),
  ev("S2", "away", 14, 2),
  ev("FOUL", "home", 11, 2),
  sub("home", 11, 12, 2),
  { k: "PEND", period: 2 },

  { k: "PSTART", period: 3 },
  ev("S2", "home", 23, 3),
  ev("S2", "away", 10, 3),
  ev("S3", "home", 7, 3),
  ev("AST", "home", 23, 3),
  ev("M2", "away", 21, 3),
  ev("REB", "home", 23, 3),
  ev("S2", "home", 12, 3),
  ev("S3", "away", 14, 3),
  ev("FOUL", "away", 8, 3),
  ev("S2", "home", 11, 3),
  ev("M3", "home", 23, 3),
  ev("REB", "home", 11, 3, true),
  sub("home", 15, 9, 3),
  ev("FT", "home", 15, 3),
  ev("S2", "away", 6, 3),
  ev("FOUL", "home", 7, 3),
  ev("S2", "away", 3, 3),
  sub("home", 9, 15, 3),
  ev("S2", "home", 9, 3),
  { k: "PEND", period: 3 },

  { k: "PSTART", period: 4 },
  ev("S2", "home", 9, 4),
  ev("S3", "away", 8, 4),
  ev("FOUL", "away", 14, 4),
  ev("FT", "home", 9, 4),
  ev("M2", "away", 21, 4),
  ev("REB", "home", 23, 4),
  ev("S2", "home", 11, 4),
  ev("S2", "away", 10, 4),
  ev("FOUL", "away", 21, 4),
  ev("S2", "home", 4, 4),
  ev("FT", "home", 11, 4),
  ev("FOUL", "home", 4, 4),
]

/** The basket the phone is watching when she is on the box score. */
const TOUR: Ev[] = [ev("S2", "home", 23, 4), ev("AST", "home", 4, 4)]

/** The last minute, and the buzzer. */
const CLOSE: Ev[] = [
  ev("S2", "away", 10, 4),
  ev("S2", "home", 23, 4),
  { k: "PEND", period: 4 },
]

const EVENTS: Ev[] = [...FILMED, ...OFFCAM, ...TOUR, ...CLOSE]

/** Beat checkpoints, counted rather than typed, so an edit cannot desync them. */
const AT = {
  tip: 1,
  amaraTwo: 2,
  assist: 3,
  miss: 4,
  rebound: 5,
  foul: 6,
  substitution: 7,
  awayTwo: 8,
  wrongThree: 9,
  /** The mistaken three, voided rather than deleted. */
  voidIndex: 8,
  cut: FILMED.length + OFFCAM.length,
  tour: FILMED.length + OFFCAM.length + TOUR.length,
  awayLate: FILMED.length + OFFCAM.length + TOUR.length + 1,
  seal: FILMED.length + OFFCAM.length + TOUR.length + 2,
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
 * Everything both frames render, derived from the first `count` events with
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
  state.ticker = ticker.slice(-3).reverse()

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

const shootingLine = (m: number, a: number) =>
  a === 0 ? "0-0" : `${m}-${a} · ${Math.round((m / a) * 100)}%`

/* ── The script ──────────────────────────────────────────────────────────── */

export const gameDayStory: DemoScript = {
  desktopUrl: URL_SCORE,
  initialStage: "desktop",
  chapters: [
    { id: "tipoff", title: "Tip-off at the table" },
    { id: "scoring", title: "Scoring, honestly" },
    { id: "family", title: "What the family sees" },
    { id: "buzzer", title: "The buzzer and the sign-off" },
    { id: "story", title: "The story writes itself" },
  ],

  beats: [
    /* ── 1. Tip-off at the table ──────────────────────────────────────── */
    {
      id: "checklist",
      chapter: "tipoff",
      caption:
        "The scorer's table opens the game, and the console asks the two questions that decide whether the record is worth anything.",
      hold: 3400,
      set: { screen: "checklist" },
    },
    {
      id: "clock-choice",
      chapter: "tipoff",
      caption:
        "Somebody is running the clock tonight, so the minutes on this sheet will be real ones.",
      hold: 2600,
      cursor: "clock-yes",
      press: true,
      set: { clockChoice: true },
    },
    {
      id: "checklist-go",
      chapter: "tipoff",
      caption: "Attendance first, then the five who start.",
      hold: 2400,
      cursor: "checklist-go",
      press: true,
    },
    {
      id: "starters",
      chapter: "tipoff",
      caption:
        "Five and five, confirmed at the table before anybody touches the ball. That is what makes the minutes and who was on the floor mean something later.",
      hold: 3400,
      cursor: "start-home-23",
      hover: "start-home-23",
      set: { screen: "lineup" },
    },
    {
      id: "start-game",
      chapter: "tipoff",
      caption: "One press opens the game.",
      hold: 2600,
      cursor: "start-game",
      press: true,
    },
    {
      id: "clock-start",
      chapter: "tipoff",
      caption:
        "The clock starts here. This is the only clock the game has, and every screen watching it reads the same one.",
      hold: 3400,
      cursor: "console-clock",
      press: true,
      toast: "Q1 under way",
      set: { screen: "console", evts: AT.tip, clockBase: 600, running: true },
    },

    /* ── 2. Scoring, honestly ─────────────────────────────────────────── */
    {
      id: "phone-arrives",
      chapter: "scoring",
      caption:
        "Amara's mother is still at work. She opens the game from a link, and the clock is already running in her hand.",
      hold: 3400,
      stage: "split",
      set: { phone: "game" },
    },
    {
      id: "arm-two",
      chapter: "scoring",
      caption: "Tap an action, then a player. Either order works.",
      hold: 2400,
      cursor: "act-2",
      press: true,
      set: { act: "+2" },
    },
    {
      id: "amara-two",
      chapter: "scoring",
      caption:
        "Two for Amara Bello. Her mother's screen has it before the ball is back in play, and the number that moved is the number that flashes.",
      hold: 3400,
      cursor: "floor-home-23",
      press: true,
      set: { evts: AT.amaraTwo, act: "" },
    },
    {
      id: "assist",
      chapter: "scoring",
      caption:
        "The console asks who assisted, and the play on the phone says it out loud: scores 2, assisted by number seven.",
      hold: 3400,
      cursor: "assist-7",
      press: true,
      set: { evts: AT.assist },
    },
    {
      id: "arm-miss",
      chapter: "scoring",
      caption:
        "Misses are recorded too. A sheet that only counts the shots that went in is not a scoresheet.",
      hold: 2600,
      cursor: "act-miss3",
      press: true,
      set: { act: "3 ✗" },
    },
    {
      id: "miss-three",
      chapter: "scoring",
      caption:
        "The attempt lands on the phone as a miss, and it goes straight into the shooting line the team stats read from.",
      hold: 3200,
      cursor: "floor-home-23",
      press: true,
      set: { evts: AT.miss, act: "" },
    },
    {
      id: "arm-reb",
      chapter: "scoring",
      caption: "The rebound is the next tap.",
      hold: 2200,
      cursor: "act-reb",
      press: true,
      set: { act: "REB" },
    },
    {
      id: "rebound",
      chapter: "scoring",
      caption:
        "Zoe Tremblay keeps it alive, and the miss and the rebound become one line rather than two.",
      hold: 3200,
      cursor: "floor-home-11",
      press: true,
      set: { evts: AT.rebound, act: "" },
    },
    {
      id: "arm-foul",
      chapter: "scoring",
      caption: "A foul is the same two taps.",
      hold: 2200,
      cursor: "act-foul",
      press: true,
      set: { act: "FOUL" },
    },
    {
      id: "foul",
      chapter: "scoring",
      caption:
        "Fouls are counted at both ends. The team count moves on the console and the number that moved on the phone turns red.",
      hold: 3400,
      cursor: "floor-away-14",
      press: true,
      set: { evts: AT.foul, act: "" },
    },
    {
      id: "subs-open",
      chapter: "scoring",
      caption: "Substitutions get their own drawer, because a swap is two decisions, not one.",
      hold: 2600,
      cursor: "subs-home",
      press: true,
      set: { sheet: true },
    },
    {
      id: "sub-out",
      chapter: "scoring",
      caption: "Who comes out.",
      hold: 2200,
      cursor: "sub-out-5",
      press: true,
      set: { subOut: 5 },
    },
    {
      id: "sub-in",
      chapter: "scoring",
      caption: "Then who goes in.",
      hold: 2400,
      cursor: "sub-in-9",
      press: true,
      set: { subOut: 0, staged: true },
    },
    {
      id: "sub-apply",
      chapter: "scoring",
      caption: "Both halves of the swap go on together.",
      hold: 2800,
      cursor: "sub-apply",
      press: true,
      set: { evts: AT.substitution },
    },
    {
      id: "sub-done",
      chapter: "scoring",
      caption:
        "Hana Kimura is on. The floor on the phone follows in amber, which is how the box score knows who was out there.",
      hold: 3200,
      set: { sheet: false, staged: false, subOut: 0 },
    },
    {
      id: "arm-away",
      chapter: "scoring",
      caption: "Lakeshore answer at the other end.",
      hold: 2200,
      cursor: "act-2",
      press: true,
      set: { act: "+2" },
    },
    {
      id: "away-two",
      chapter: "scoring",
      caption: "Same two taps, and both totals move.",
      hold: 2800,
      cursor: "floor-away-10",
      press: true,
      set: { evts: AT.awayTwo, act: "" },
    },
    {
      id: "arm-three",
      chapter: "scoring",
      caption: "And now the thing that happens at every scorer's table in the country.",
      hold: 2400,
      cursor: "act-3",
      press: true,
      set: { act: "+3" },
    },
    {
      id: "wrong-entry",
      chapter: "scoring",
      caption: "Three points go on for a shot that rimmed out.",
      hold: 2800,
      cursor: "floor-home-23",
      press: true,
      set: { evts: AT.wrongThree, act: "" },
    },
    {
      id: "undo",
      chapter: "scoring",
      caption:
        "Mistakes happen. This one is fixed in one tap, and the phone walks the score back rather than carrying a wrong number all night.",
      hold: 3800,
      cursor: "undo",
      press: true,
      set: { voided: AT.voidIndex, tone: "amber" },
    },

    /* ── 3. What the family sees ──────────────────────────────────────── */
    {
      id: "cut",
      chapter: "family",
      caption:
        "Three quarters later. Same table, same phone, and every quarter of it is on the scoreboard she is holding.",
      hold: 3600,
      stage: "phone",
      set: { evts: AT.cut, clockBase: 252, running: true, tone: "amber" },
    },
    {
      id: "hero",
      chapter: "family",
      caption:
        "Score and quarter together at the top, the clock still ticking, and the quarter by quarter under it.",
      hold: 3200,
      set: { tone: "" },
    },
    {
      id: "box",
      chapter: "family",
      caption:
        "She scrolls past the scoreboard to the box score, and the score comes with her as a chip so she never loses it.",
      hold: 3200,
      set: { phone: "box" },
    },
    {
      id: "box-live",
      chapter: "family",
      caption:
        "Amara's line moves while she is looking at it: eight points, and the score at the top moves with it.",
      hold: 3800,
      set: { evts: AT.tour },
    },
    {
      id: "stats",
      chapter: "family",
      caption: "Team stats carry every attempt, not only the ones that went in.",
      hold: 3200,
      cursor: "phone-tab-stats",
      press: true,
      set: { phone: "stats" },
    },
    {
      id: "plays",
      chapter: "family",
      caption:
        "And the play-by-play is the whole night in order, assist attribution and all, the same sentences the table entered.",
      hold: 3600,
      cursor: "phone-tab-plays",
      press: true,
      set: { phone: "plays" },
    },
    {
      id: "no-account",
      chapter: "family",
      caption: "No app, no account, no login. Somebody sent her a link.",
      hold: 3000,
    },

    /* ── 4. The buzzer and the sign-off ───────────────────────────────── */
    {
      id: "last-minute",
      chapter: "buzzer",
      caption: "Under a minute, and the table is still the only place these numbers come from.",
      hold: 3000,
      stage: "split",
      set: { phone: "game", clockBase: 38, running: true },
    },
    {
      id: "arm-away-late",
      chapter: "buzzer",
      caption: "Lakeshore get one back.",
      hold: 2200,
      cursor: "act-2",
      press: true,
      set: { act: "+2" },
    },
    {
      id: "away-late",
      chapter: "buzzer",
      caption: "Three-point game.",
      hold: 2600,
      cursor: "floor-away-10",
      press: true,
      set: { evts: AT.awayLate, act: "" },
    },
    {
      id: "arm-seal",
      chapter: "buzzer",
      caption: "Ravens answer.",
      hold: 2200,
      cursor: "act-2",
      press: true,
      set: { act: "+2" },
    },
    {
      id: "seal",
      chapter: "buzzer",
      caption: "Amara seals it, and her mother watches it happen from her desk.",
      hold: 3000,
      cursor: "floor-home-23",
      press: true,
      set: { evts: AT.seal, act: "" },
    },
    {
      id: "buzzer",
      chapter: "buzzer",
      caption: "The buzzer. The clock stops on both screens at the same zero.",
      hold: 3000,
      cursor: "end-period",
      press: true,
      toast: "Q4 ended",
      set: { clockBase: 0, running: false },
    },
    {
      id: "period-closed",
      chapter: "buzzer",
      caption: "Q4 is closed, and the console offers the last button of the night.",
      hold: 2800,
      cursor: "end-game",
      press: true,
      set: { evts: AT.buzzer },
    },
    {
      id: "review",
      chapter: "buzzer",
      caption: "Nothing is official yet. The table reads the sheet back first.",
      hold: 2800,
      set: { screen: "review" },
    },
    {
      id: "sign",
      chapter: "buzzer",
      caption:
        "The referee signs at the table, the way he signs the paper one. A PIN is the other way, checked against his own account.",
      hold: 3600,
      cursor: "sign-pad",
      press: true,
      set: { signed: true, refName: REFEREE },
    },
    {
      id: "mark-final",
      chapter: "buzzer",
      caption: "Marked final, and the game on her phone flips with it.",
      hold: 3600,
      cursor: "mark-final",
      press: true,
      toast: "Result published",
      set: { final: true, tone: "green" },
    },
    {
      id: "official",
      chapter: "buzzer",
      caption:
        "The table is done. The scoresheet is signed, printable, and the same numbers are already public.",
      hold: 3000,
      set: { screen: "final" },
    },

    /* ── 5. The story writes itself ───────────────────────────────────── */
    {
      id: "recap",
      chapter: "story",
      caption:
        "The recap writes itself off the sheet and posts to the team page as a card, minutes after the buzzer.",
      hold: 3800,
      stage: "phone",
      set: { phone: "feed", recap: true },
    },
    {
      id: "potg",
      chapter: "story",
      caption:
        "Player of the game comes off the same sheet, so nobody has to remember who had the good night.",
      hold: 3400,
      set: { potg: true },
    },
    {
      id: "standings",
      chapter: "story",
      caption:
        "And the standings move, because a result a referee signed is a result the league can count.",
      hold: 3600,
      set: { standings: true },
    },
    {
      id: "end",
      chapter: "story",
      caption: "Every seat in the gym, and every seat that could not make it.",
      hold: 5200,
      stage: "split",
      set: { endCard: true },
    },
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
      (j) => !state.onFloor.home.includes(j)
    )
    const awayBench = AWAY_PLAYERS.map((p) => p.jersey).filter(
      (j) => !state.onFloor.away.includes(j)
    )

    /* ── Desktop: the console ─────────────────────────────────────────── */

    const consoleScreen = (
      <div className="relative flex h-full flex-col">
        <div className="min-h-0 flex-1 p-3">
          <ConsoleHeader
            homeName={HOME.name}
            awayName={AWAY.name}
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
            tone={tone}
          />
          <div className="mt-2 grid grid-cols-[1fr_2fr_1fr] gap-2">
            <ConsoleFloor
              side="home"
              players={HOME_PLAYERS}
              onFloor={state.onFloor.home}
              fouls={state.fouls.home}
              armed={!!act}
              benchCount={homeBench.length}
            />
            <ConsoleActionPad
              pending={act || null}
              // The console asks for the assist right after a made basket and
              // keeps asking until the table answers or arms the next action,
              // which is also what keeps the chip on screen for the press.
              assistFor={
                !act && (evts === AT.amaraTwo || evts === AT.assist) ? 23 : null
              }
              assistOptions={state.onFloor.home.filter((j) => j !== 23)}
            />
            <ConsoleFloor
              side="away"
              players={AWAY_PLAYERS}
              onFloor={state.onFloor.away}
              fouls={state.fouls.away}
              armed={!!act}
              benchCount={awayBench.length}
            />
          </div>
        </div>
        {sheet && (
          <ConsoleSubsSheet
            teamName={HOME.name}
            onFloor={state.onFloor.home}
            bench={homeBench}
            players={HOME_PLAYERS}
            out={subOut || null}
            staged={staged ? [{ out: 5, in: 9 }] : []}
          />
        )}
      </div>
    )

    const desktop = (
      <div className="relative flex h-full flex-col">
        <MockTopBar
          workspace="Riverside Ravens"
          tabs={["Dashboard", "Teams", "Schedule", "Scoring"]}
          activeTab="Scoring"
        />
        <div key={screen} className="demo-fade-in relative flex min-h-0 flex-1 flex-col">
          {screen === "lineup" ? (
            <ConsoleLineup
              homeName={HOME.name}
              awayName={AWAY.name}
              league={LEAGUE}
              venue={VENUE}
              homePlayers={HOME_PLAYERS.slice(0, 6)}
              awayPlayers={AWAY_PLAYERS.slice(0, 6)}
              homeStarters={HOME_STARTERS}
              awayStarters={AWAY_STARTERS}
            />
          ) : screen === "review" ? (
            <ConsoleReview
              homeName={HOME.name}
              awayName={AWAY.name}
              homeScore={state.home}
              awayScore={state.away}
              potg="Amara Bello"
              potgLine={`${state.lines.home[23].pts} pts`}
              mode="sign"
              signed={get<boolean>("signed", false)}
              refereeName={get<string>("refName", "")}
              sheets={[
                { name: HOME.name, players: HOME_PLAYERS, lines: state.lines.home },
                { name: AWAY.name, players: AWAY_PLAYERS, lines: state.lines.away },
              ]}
            />
          ) : screen === "final" ? (
            <ConsoleFinal
              homeName={HOME.name}
              awayName={AWAY.name}
              homeScore={state.home}
              awayScore={state.away}
              referee={REFEREE}
            />
          ) : (
            consoleScreen
          )}
          {screen === "checklist" && (
            <ConsoleChecklist
              scorekeeper={SCOREKEEPER}
              referee={REFEREE}
              clockChoice={get<boolean | null>("clockChoice", null)}
            />
          )}
        </div>

        {endCard && (
          <MockEndCard
            eyebrow="Story 4 of 10"
            title="Every seat in the gym"
            line="One game, scored once at the table, arriving live on the phone of everybody who could not be there, and signed off before anybody leaves the building."
            cta="Browse all demos"
          />
        )}
      </div>
    )

    /* ── Phone: the live game page ────────────────────────────────────── */

    const heroProps = {
      league: LEAGUE,
      home: HOME,
      away: AWAY,
      homeScore: state.home,
      awayScore: state.away,
      period: state.period,
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
    const miniProps = {
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

    const amara = state.lines.home[23]
    const potgLine = `${amara.pts} PTS · ${amara.reb} REB · ${amara.ast} AST`

    const phoneNode = (
      <div className="flex h-full flex-col bg-[#f6f7f9]">
        {phone === "game" || phone === "" ? (
          <>
            <PhoneScoreHero {...heroProps} />
            <PhoneGameTabs active="game" />
            <div className="min-h-0 flex-1 px-2.5">
              <PhonePlayList
                title="Latest plays"
                rows={state.rows.filter((r) => !r.period).slice(0, 5)}
                freshKey={state.freshKey}
                tone={tone}
              />
            </div>
          </>
        ) : phone === "feed" ? (
          <>
            <PhoneMiniScore {...miniProps} />
            <div className="min-h-0 flex-1 space-y-2 px-2.5 py-2.5">
              <p className="text-ink-500 px-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                Riverside Ravens · team page
              </p>
              {get<boolean>("recap", false) && (
                <PhoneRecapCard
                  club="Riverside Ravens"
                  kind="Game recap"
                  title={`Ravens hold on ${state.home}-${state.away} against Lakeshore`}
                  body={`Amara Bello led the way with ${amara.pts} points, ${amara.reb} rebounds and ${amara.ast} assists, and the Ravens closed the fourth without giving up the lead.`}
                  meta="Posted 6 minutes after the final buzzer"
                  fresh
                />
              )}
              {get<boolean>("potg", false) && (
                <PhonePotgCard name="Amara Bello" jersey={23} line={potgLine} fresh />
              )}
              {get<boolean>("standings", false) && (
                <PhoneStandings
                  rows={[
                    { pos: 1, team: "Scarborough Blues", record: "9-1", pts: 18 },
                    {
                      pos: 2,
                      team: "Riverside Ravens",
                      record: "8-2",
                      pts: 16,
                      you: true,
                    },
                    { pos: 3, team: "Lakeshore Lightning", record: "6-4", pts: 12 },
                    { pos: 4, team: "Etobicoke Eagles", record: "5-5", pts: 10 },
                  ]}
                  movedTeam="Riverside Ravens"
                />
              )}
            </div>
          </>
        ) : (
          <>
            <PhoneMiniScore {...miniProps} />
            <PhoneGameTabs active={phone === "plays" ? "plays" : phone === "stats" ? "stats" : "game"} />
            <div className="min-h-0 flex-1 px-2.5">
              {phone === "box" && (
                <PhoneBoxScore
                  homeName="Riverside Ravens"
                  awayName="Lakeshore Lightning"
                  side="home"
                  players={HOME_PLAYERS}
                  lines={state.lines.home}
                  starters={HOME_STARTERS}
                  onFloor={state.onFloor.home}
                  tone={tone}
                  highlight={23}
                />
              )}
              {phone === "stats" && (
                <PhoneTeamStats
                  home={HOME}
                  away={AWAY}
                  rows={statRows}
                  tone={tone}
                  pulseLabel="3-pointers"
                />
              )}
              {phone === "plays" && (
                <PhonePlayList
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
      </div>
    )

    return { desktop, phone: phoneNode }
  },
}
