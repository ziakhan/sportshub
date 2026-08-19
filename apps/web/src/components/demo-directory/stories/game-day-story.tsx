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
  LiveGameLeaders,
  LiveHero,
  LivePlays,
  LivePotgCard,
  LivePregame,
  LiveRecapCard,
  LiveScoreChip,
  LiveStandings,
  LiveTabs,
  LiveTeamStats,
  LiveWaiting,
  MockEndCard,
  PhoneBody,
  ScrollPane,
  type MockLine,
  type MockPlayer,
  type PhonePlayRow,
  type PhoneTeam,
  type PulseTone,
} from "../mock-scoring"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Game day, both phones" (owner ruling 2026-08-16), converted to the mock
 * realism standard 2026-08-19 (mock-ui.tsx R1-R8). The flagship of the
 * thirteen, and the last one converted.
 *
 * THE ARGUMENT. A youth game is scored by a parent volunteer on a folding
 * table, and everyone who could not be in the gym finds out the score by text
 * message an hour later. This story puts both ends of that on one stage, and
 * both of them are PHONES: the scorer's phone on the left, the phone of a
 * father who is not in the building on the right, and one game running through
 * both.
 *
 * ═══ THE TWO OWNER RULINGS THIS CUT EXISTS FOR (2026-08-19) ═══
 *
 * 1. ALTERNATE, CONTINUOUSLY. "We make sure we switch between the scorekeeper
 *    and the game page, whoever that actor is." The 08-16 cut sat on the
 *    console for the whole action chapter and first cut to the watching phone
 *    about thirty seconds in. Here every recorded action is THREE beats:
 *
 *        arm the action (left) → tap the player (left) → IT LANDS (right)
 *
 *    and the third beat rings the element on the father's phone that just
 *    changed. That cadence is not decoration: it is also what makes the
 *    press/land law honest, because scene state is applied at the TOP of a
 *    beat, so a press and the state it causes can never share one. During live
 *    play no side holds for more than three beats in a row, and the one
 *    four-beat run is the substitution drawer, which is a single modal
 *    decision the eye stays inside.
 *
 *    The engine reads the acting side off the DOM, not off the script: the
 *    beat's `cursor`, else its string `emphasize`, resolves to a
 *    `data-demo-target`, and `SceneStage` finds which handset that element
 *    lives in (frames.tsx `data-demo-frame`). So the alternation IS the choice
 *    of target on every beat, and there is nothing to keep in sync.
 *
 * 2. THE REAL PRE-GAME, WITH THE BUTTONS BEING PRESSED. "Let's show them all
 *    the proper attendance lineup changes; if we need to scroll up a little bit
 *    to show them pressing the buttons, let's do that." The pre-game steps
 *    stack BOTH teams (`scoring-console.tsx` L808 / L877,
 *    `flex-col gap-4 md:flex-row`), so a phone gets one tall column and a
 *    thumb. This cut retires the 08-16 shortcut that showed one team and
 *    reduced the other to a done row: both roll calls and both pick lists are
 *    on the pane at their real height, and the beat SCROLLS to whichever
 *    control is being pressed. Filmed on camera: #29 Daniel Osei marked absent
 *    on the Panthers' bench, the scroll to the Lords' bench, #15 Ethan Lee
 *    marked absent, "Continue to starting lineups", the last two Lords starters
 *    tapped in (3/5 → 4/5 → 5/5), "Start game" going from disabled to live, and
 *    the press itself.
 *
 * ═══ WHAT EVERY SCREEN IS ═══
 *
 * LEFT HANDSET, `/games/7e467b44/score`:
 *   · the checklist modal, `components/scoring/pre-game-checklist.tsx`;
 *   · attendance, `scoring-console.tsx` L710-819: both roll calls, the
 *     "here · absent" counts, present/absent tiles, "+ Add guest player";
 *   · starting fives, L822-926: both pick lists with absentees already
 *     filtered out (L880), "starting five: n/5", the disabled Start game and
 *     the "Fewer than 5 marked players?" footnote;
 *   · the console: header, mono clock button, End Q1, ticker, synced pill, BOX,
 *     UNDO; the two fives as jersey chip rows behind the dashed ⇄ subs button;
 *     the action pad with EXACTLY a STANDARD league's nine buttons; the status
 *     strip; the "Assist by?" chain; the subs drawer with staged swaps;
 *   · the review screen and the referee approval block with its Signature /
 *     Referee PIN switch (AUTHORIZED phone composition, numbers sheet §C.1);
 *   · the official scoresheet at `/scoresheet/7e467b44` (§C.2).
 *
 * RIGHT HANDSET, `/live/7e467b44`, and it is ONE SCROLLING PAGE, exactly as
 * the product composes it, with the sticky score chip appearing when the hero
 * scrolls away:
 *   · `score-hero.tsx` in all THREE of its states: pre-game (the tip-off strip
 *     where LIVE would sit, no linescore because no period has been played),
 *     live (LIVE pill, period, amber condensed clock), and final;
 *   · `pregame-rosters.tsx`: "This game hasn't started yet" and both rosters
 *     with season averages, which is what he is looking at before tip-off;
 *   · `live-view.tsx` L253: "Waiting for the first play", which is what a live
 *     game with no recorded play says, and it is what the tip-off beat lands on;
 *   · the Game / Team stats / Play-by-play tabs, which the page only renders
 *     once there are stats to render;
 *   · `game-leaders.tsx` face-off cards, each washed with the PLAYER's accent
 *     and carrying the hand-drawn `PlayerMug`;
 *   · `box-score.tsx`: the switcher with full team names and club-colour dots,
 *     starters above bench, the TOP badge and the energy-ink points column;
 *   · `play-by-play-tab.tsx`: the filter chips and the washed scoring rows,
 *     which is the tab he watches the live action on;
 *   · `team-stats-tab.tsx` comparison bars, `potg-card.tsx` with the mug, the
 *     recap as a CARD (owner law 2026-07-25) and the division table.
 *
 * ═══ THE SYNC LAWS ═══
 *   1. ONE CLOCK, BOTH PHONES. A single value in scene state and a single
 *      ticker behind it (`useDemoClock`). The handsets render the same number
 *      from the same store, so they cannot drift; `data-demo-clock` marks both
 *      and the drive asserts the strings are equal.
 *   2. THE PARENT'S PHONE FLASHES WHAT CHANGED. Every value that can move is
 *      wrapped in `Pulse`: green for a made shot or a score, red for a foul,
 *      amber for everything else the table does.
 *   3. THE FULL ACTION SET, MISSES INCLUDED. +2, +3, FT ✓, 2 ✗, 3 ✗, FT ✗, REB,
 *      AST, FOUL: a STANDARD stat-depth league's pad. Steals, blocks and
 *      turnovers are FULL-depth only, so the box score carries them as zeros
 *      rather than pretending the table recorded them.
 *   4. ONE PLAY, ONE MOMENT. The play line lands on the beat the score flashes,
 *      and carries its attribution the way the product writes it: "#37 Darius
 *      R. scores 2, assisted by #18 Isaiah C."
 *
 * THE STATE MODEL. Everything both phones show is FOLDED from one event
 * stream, exactly like the product: `EVENTS` is the game, a beat says how many
 * of them have happened, and one `fold()` derives the score, the linescore,
 * both box scores, team fouls, who is on the floor, the shooting lines, the
 * leaders and the play-by-play. That is what makes the undo beat honest: the
 * mistaken three is not deleted, it is VOIDED, and every number built on it
 * walks back on its own.
 *
 * INVENTED-CONTENT LEDGER (everything on screen not read from the database):
 *   · `PRIYA` the scorekeeper's name. The local `UserRole` table was wiped
 *     before this build, so there is no assignment to read (numbers sheet §C.4);
 *   · the season averages on the pre-game roster tables. `DB`-documented are
 *     Darius Reyes 14.7 points a game, Ibrahim White 13.2, Jayden Anderson 12.9
 *     and Andre Nguyen 10.0 (numbers sheet §A); every other PPG, and all of the
 *     RPG and APG columns, are invented, ordered to match the starting fives
 *     the season really produced;
 *   · "Aug 22, 1:34 p.m." on the scoresheet's signature line.
 * Everything else — the league, the season, the weekend, the game, both
 * rosters with their real jersey numbers, the referee, the parent, the
 * division table and the recap sentences — is read out of the seeded NPH
 * Summer League, and the staged game is reconciled event by event in
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
/**
 * The five the table has tapped in when the camera reaches the lineup step.
 * The last two, #29 and #34, go in on camera, which is what takes "Start game"
 * from disabled to live.
 */
const AWAY_PICKED_3 = [37, 28, 18]
const AWAY_PICKED_4 = [37, 28, 18, 29]
/** Marked at the door: one on each side. */
const HOME_ABSENT = [29]
const AWAY_ABSENT = [15]

/**
 * Season averages on the pre-game roster tables. `DB`-documented: Darius Reyes
 * 14.7, Ibrahim White 13.2, Jayden Anderson 12.9, Andre Nguyen 10.0 (numbers
 * sheet §A). Every other line is INVENTED and ordered so the five highest
 * scorers are the five the season really started.
 */
interface Avg {
  jersey: number
  gp: number
  ppg: string
  rpg: string
  apg: string
}
const HOME_AVG: Avg[] = [
  { jersey: 11, gp: 9, ppg: "12.9", rpg: "4.6", apg: "2.1" },
  { jersey: 39, gp: 9, ppg: "10.0", rpg: "3.3", apg: "1.0" },
  { jersey: 16, gp: 9, ppg: "8.4", rpg: "2.1", apg: "1.4" },
  { jersey: 34, gp: 9, ppg: "6.2", rpg: "4.8", apg: "0.7" },
  { jersey: 32, gp: 8, ppg: "3.1", rpg: "4.4", apg: "0.5" },
  { jersey: 33, gp: 8, ppg: "2.6", rpg: "2.9", apg: "0.4" },
  { jersey: 29, gp: 7, ppg: "2.1", rpg: "1.6", apg: "0.3" },
  { jersey: 12, gp: 7, ppg: "1.7", rpg: "1.1", apg: "0.6" },
  { jersey: 35, gp: 6, ppg: "1.2", rpg: "0.8", apg: "0.2" },
  { jersey: 42, gp: 5, ppg: "0.8", rpg: "0.6", apg: "0.2" },
]
const AWAY_AVG: Avg[] = [
  { jersey: 37, gp: 10, ppg: "14.7", rpg: "4.2", apg: "1.6" },
  { jersey: 28, gp: 10, ppg: "13.2", rpg: "6.1", apg: "1.1" },
  { jersey: 18, gp: 10, ppg: "9.8", rpg: "5.4", apg: "3.2" },
  { jersey: 29, gp: 9, ppg: "5.6", rpg: "2.7", apg: "0.6" },
  { jersey: 34, gp: 10, ppg: "4.9", rpg: "3.1", apg: "0.8" },
  { jersey: 21, gp: 9, ppg: "3.4", rpg: "1.5", apg: "0.5" },
  { jersey: 4, gp: 10, ppg: "2.8", rpg: "2.2", apg: "0.4" },
  { jersey: 15, gp: 8, ppg: "2.2", rpg: "1.3", apg: "0.3" },
  { jersey: 17, gp: 7, ppg: "1.4", rpg: "0.9", apg: "0.2" },
  { jersey: 38, gp: 6, ppg: "0.9", rpg: "0.7", apg: "0.1" },
]

const URL_SCORE = "/games/7e467b44/score"
const URL_LIVE = "/live/7e467b44"

/**
 * Where the panes stand when a beat scrolls them, in logical px. Both pre-game
 * screens are taller than the 486px a handset gives its content, which is the
 * point: the owner asked to see the pane move to the button being pressed.
 * `SCROLL_END` is not a measurement, it is "the bottom": `ScrollPane` measures
 * itself and clamps, so a control can never end up under the handset's edge.
 */
const ATT_AWAY = 330
const SCROLL_END = 9999
/**
 * And where the parent's page stands. The live page is one scrolling column
 * (hero, tabs, then the tab's own content), so a "tab" is a tap and a "look
 * further down" is a scroll, exactly as it is in his hand.
 */
const SCROLL_BOX = 754
const SCROLL_STATS = 300

/* ── The game, as an event stream ────────────────────────────────────────── */

type Kind =
  | "PSTART"
  | "PEND"
  | "S2"
  | "S3"
  | "FT"
  | "M2"
  | "M3"
  | "MFT"
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
  /** Where the camera rejoins: everything before the basket he watches. */
  cut: EVENTS.length - 5,
  /** The basket he watches land in the box score, and nothing after it. */
  tour: EVENTS.length - 4,
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
  /** Offensive boards only, so the leaders card can say "n DREB · n OREB". */
  oreb: { home: Record<number, number>; away: Record<number, number> }
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
    oreb: { home: {}, away: {} },
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
        if (e.off && e.j != null) state.oreb[side][e.j] = (state.oreb[side][e.j] ?? 0) + 1
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

/**
 * Game leaders, picked exactly as `live/[gameId]/components/model.ts` picks
 * them: `leaderOf` ignores anybody on zero, so a category with no leader on a
 * side renders the dashed empty cell rather than a name with a nought beside
 * it, and the Defense section does not exist at all in a STANDARD league
 * because steals and blocks are never recorded.
 */
type LeaderEntry = {
  key: string
  short: string
  jersey: number
  value: number
  unit: string
  sub: string
} | null

function leaderSections(state: Folded) {
  const pick = (
    side: "home" | "away",
    value: (l: MockLine) => number,
    unit: string,
    sub: (l: MockLine) => string
  ): LeaderEntry => {
    const roster = side === "home" ? HOME_PLAYERS : AWAY_PLAYERS
    let best: MockLine | null = null
    for (const p of roster) {
      const l = state.lines[side][p.jersey]
      if (value(l) <= 0) continue
      if (!best || value(l) > value(best)) best = l
    }
    if (!best) return null
    const jersey = best.jersey
    return {
      key: `${side}-${jersey}`,
      short: short(side, jersey),
      jersey,
      value: value(best),
      unit,
      sub: sub(best),
    }
  }
  const orebOf = (side: "home" | "away", j: number) => state.oreb[side][j] ?? 0
  const section = (
    label: string,
    value: (l: MockLine) => number,
    unit: string,
    sub: (side: "home" | "away", l: MockLine) => string
  ) => ({
    label,
    home: pick("home", value, unit, (l) => sub("home", l)),
    away: pick("away", value, unit, (l) => sub("away", l)),
  })
  return [
    section(
      "Points",
      (l) => l.pts,
      "PTS",
      (_s, l) => `${l.reb} REB · ${l.ast} AST`
    ),
    section(
      "Rebounds",
      (l) => l.reb,
      "REB",
      (s, l) => `${l.reb - orebOf(s, l.jersey)} DREB · ${orebOf(s, l.jersey)} OREB`
    ),
    section(
      "Assists",
      (l) => l.ast,
      "AST",
      (_s, l) => `${l.pts} PTS · ${l.to} TO`
    ),
  ].filter((sec) => sec.home || sec.away)
}

/** Pre-game roster rows, in the page's own order: season points, descending. */
const avgRows = (avgs: Avg[], roster: MockPlayer[]) =>
  avgs.map((a) => ({
    jersey: a.jersey,
    name: roster.find((p) => p.jersey === a.jersey)?.name ?? "",
    gp: a.gp,
    ppg: a.ppg,
    rpg: a.rpg,
    apg: a.apg,
  }))

/**
 * `DB` Player a18c732d, Darius Reyes. The mug's tone is hashed from the player
 * id, which is why the real id is here rather than a label.
 */
const DARIUS_ID = "a18c732d"

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
 * Human pace (owner 2026-08-19, your-week's `paced` verbatim): people click,
 * then click again. The hand takes CURSOR_ARRIVE_MS to reach its target and the
 * balloon lands with it, so a beat holds for the travel plus long enough to
 * READ the balloon, and a beat with no balloon holds only as long as a tap
 * takes to land.
 */
function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/**
 * A LANDING beat: the press happened last beat, and this one shows the result
 * arriving on the OTHER handset.
 *
 * It rings the element that changed, which is also what tells the engine which
 * phone is acting (`activeTarget` → `data-demo-frame`), and it overrides the
 * ring's default EMPHASIS_HOLD_MS. A flash is 1.05s of CSS and the ring pulses
 * twice inside that; parking another 1.2s on top of every one of them is what
 * makes an action chapter drag.
 */
function land(
  b: Omit<DemoBeat, "hold" | "emphasize"> & { emphasize: string; holdMs?: number }
): DemoBeat {
  return paced({ holdMs: 400, ...b })
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
    /* ══ 1. Before tip-off ═══ the scorer's phone, alone on the stage ═══════
       Every press in this chapter is on camera, and the pane scrolls to the
       control being pressed rather than pretending a tall screen is short
       (owner 2026-08-19). */
    paced({
      id: "checklist",
      chapter: "tipoff",
      caption:
        "The scorer's table is a phone on a folding table, and it opens the game with a checklist.",
      emphasize: "checklist-card",
      holdMs: 400,
      callout:
        "The two names on it are the league's own assignment, read back before anything is scored.",
      set: { screen: "checklist" },
    }),
    paced({
      id: "clock-choice",
      chapter: "tipoff",
      caption: "The table says whether it is running the clock.",
      cursor: "clock-yes",
      press: true,
      callout: "Minutes played are only counted when somebody is starting and stopping it.",
    }),
    /* PRESS, THEN RESULT. Scene state is applied at the TOP of a beat, so a
       beat that presses a control AND sets the state that control causes has
       already changed the screen before the hand reaches it. Every beat below
       therefore LANDS the previous press first, and then makes the next one. */
    paced({
      id: "checklist-go",
      chapter: "tipoff",
      caption: "Attendance first, then the five who start.",
      cursor: "checklist-go",
      press: true,
      set: { clockChoice: true },
    }),
    paced({
      id: "att-home",
      chapter: "tipoff",
      caption: "Roll call at the door, and both benches are on the one screen.",
      cursor: "att-home-29",
      press: true,
      set: { screen: "attendance", attScroll: 0 },
    }),
    paced({
      id: "att-home-land",
      chapter: "tipoff",
      caption: "Daniel Osei did not travel.",
      emphasize: "att-home-29",
      holdMs: 400,
      callout:
        "An absent player reads ABSENT on the scoresheet and does not count a game played in his season stats.",
      set: { absentHome: true },
    }),
    paced({
      id: "att-away",
      chapter: "tipoff",
      caption: "The other bench is the same list, one scroll down.",
      cursor: "att-away-15",
      press: true,
      set: { attScroll: ATT_AWAY },
    }),
    paced({
      id: "to-lineups",
      chapter: "tipoff",
      caption: "Nine here, one out, on both sides.",
      cursor: "to-lineups",
      press: true,
      set: { absentAway: true, attScroll: SCROLL_END },
    }),
    paced({
      id: "lineups",
      chapter: "tipoff",
      caption: "Then the starting fives, with the two absences already taken out of both lists.",
      emphasize: "lineup-home",
      holdMs: 400,
      set: { screen: "lineup", lineScroll: 0 },
    }),
    paced({
      id: "pick-29",
      chapter: "tipoff",
      caption: "The Panthers are five. The Lords are three deep, and the last two go in here.",
      cursor: "start-away-29",
      press: true,
      set: { lineScroll: SCROLL_END },
    }),
    paced({
      id: "pick-34",
      chapter: "tipoff",
      caption: "Four.",
      cursor: "start-away-34",
      press: true,
      set: { awayPicked: 4 },
    }),
    paced({
      id: "five-five",
      chapter: "tipoff",
      caption: "Five and five, and Start game comes on.",
      emphasize: "start-game",
      holdMs: 400,
      callout:
        "The starting five is what lets the box score say who was on the floor and who came off the bench.",
      set: { awayPicked: 5 },
    }),

    /* ══ 2. Two taps a play ═══ the alternation ═════════════════════════════
       Every recorded action is three beats: arm it (left), tap the player
       (left), watch it land (right). No side holds for more than three in a
       row, and the single four-beat run is the subs drawer. */
    paced({
      id: "phone-arrives",
      chapter: "scoring",
      caption: `${PARENT} is not in the building. He opens the game from the link on the schedule.`,
      stage: "split",
      emphasize: "pregame-card",
      holdMs: 500,
      callout: "There is no app to install and no account behind it.",
    }),
    paced({
      id: "start-press",
      chapter: "scoring",
      caption: "The table starts the game.",
      cursor: "start-game",
      press: true,
    }),
    land({
      id: "tip-off",
      chapter: "scoring",
      caption: "Tip-off, and the page he is holding goes live on its own.",
      emphasize: "waiting-card",
      holdMs: 500,
      toast: "Q1 under way",
      set: { screen: "console", view: "live", evts: AT.tip, clockBase: 600, running: true },
    }),
    paced({
      id: "arm-two",
      chapter: "scoring",
      caption: "Tap an action, then a player. Either order works.",
      cursor: "act-2",
      press: true,
    }),
    paced({
      id: "tap-darius",
      chapter: "scoring",
      caption: "Two for Darius Reyes.",
      cursor: "floor-away-37",
      press: true,
      set: { act: "+2" },
    }),
    land({
      id: "land-two",
      chapter: "scoring",
      caption: "The number that moved is the number that flashes.",
      emphasize: "live-score-away",
      callout: "Two taps at the table, and it is on his phone before the ball is back in play.",
      set: { evts: AT.dariusTwo, act: "" },
    }),
    paced({
      id: "to-plays",
      chapter: "scoring",
      caption: "He wants every play, not only the score.",
      cursor: "phone-tab-plays",
      press: true,
    }),
    paced({
      id: "assist-press",
      chapter: "scoring",
      caption: "Back at the table, the console is asking who assisted.",
      cursor: "assist-18",
      press: true,
      set: { tab: "plays" },
    }),
    land({
      id: "land-assist",
      chapter: "scoring",
      caption: "Scores 2, assisted by number eighteen.",
      emphasize: "fresh-play",
      callout: "The sentence writes itself from the two taps, and both phones get the same one.",
      set: { evts: AT.assist },
    }),
    paced({
      id: "arm-miss",
      chapter: "scoring",
      caption: "Misses are recorded too.",
      cursor: "act-miss3",
      press: true,
    }),
    paced({
      id: "tap-miss",
      chapter: "scoring",
      caption: "The attempt goes on the sheet as a miss.",
      cursor: "floor-away-37",
      press: true,
      set: { act: "3 ✗" },
    }),
    land({
      id: "land-miss",
      chapter: "scoring",
      caption: "No points, and the play list says so.",
      emphasize: "fresh-play",
      callout: "Attempts are what make a shooting percentage possible later.",
      set: { evts: AT.miss, act: "" },
    }),
    paced({
      id: "arm-reb",
      chapter: "scoring",
      caption: "The rebound is the next tap.",
      cursor: "act-reb",
      press: true,
    }),
    paced({
      id: "tap-reb",
      chapter: "scoring",
      caption: "Ibrahim White keeps it alive.",
      cursor: "floor-away-28",
      press: true,
      set: { act: "REB" },
    }),
    land({
      id: "land-reb",
      chapter: "scoring",
      caption: "The miss and the board become one line, the way the product writes it.",
      emphasize: "fresh-play",
      set: { evts: AT.rebound, act: "" },
    }),
    paced({
      id: "arm-foul",
      chapter: "scoring",
      caption: "A foul is the same two taps.",
      cursor: "act-foul",
      press: true,
    }),
    paced({
      id: "tap-foul",
      chapter: "scoring",
      caption: "On Liam Silva, and the team count moves with it.",
      cursor: "floor-home-32",
      press: true,
      set: { act: "FOUL" },
    }),
    land({
      id: "land-foul",
      chapter: "scoring",
      caption: "Red on the other phone.",
      emphasize: "fresh-play",
      callout: "Green is points and red is a foul, so the colour says it before the words do.",
      set: { evts: AT.foul, act: "" },
    }),
    /* The drawer is the one four-beat run on one side. A substitution is a
       single modal decision and the eye stays inside it, so breaking it up
       would read as an interruption rather than as alternation. */
    paced({
      id: "subs-open",
      chapter: "scoring",
      caption: "Substitutions get their own drawer, because a swap is two decisions.",
      cursor: "subs-away",
      press: true,
    }),
    paced({
      id: "sub-out",
      chapter: "scoring",
      caption: "Who comes off.",
      cursor: "sub-out-34",
      press: true,
      set: { sheet: true },
    }),
    paced({
      id: "sub-in",
      chapter: "scoring",
      caption: "Then who goes on.",
      cursor: "sub-in-21",
      press: true,
      set: { subOut: 34 },
    }),
    paced({
      id: "sub-apply",
      chapter: "scoring",
      caption: "Both halves of the swap go on together.",
      cursor: "sub-apply",
      press: true,
      set: { subOut: 0, staged: true },
    }),
    land({
      id: "land-sub",
      chapter: "scoring",
      caption: "Zion Nguyen is on, and the floor follows in amber.",
      emphasize: "fresh-play",
      callout: "Amber is everything else the table does, so a swap never reads as a score.",
      set: { evts: AT.substitution, sheet: false, staged: false },
    }),
    paced({
      id: "arm-panthers",
      chapter: "scoring",
      caption: "Oakville answer at the other end.",
      cursor: "act-2",
      press: true,
    }),
    paced({
      id: "tap-panthers",
      chapter: "scoring",
      caption: "Same two taps.",
      cursor: "floor-home-11",
      press: true,
      set: { act: "+2" },
    }),
    land({
      id: "land-panthers",
      chapter: "scoring",
      caption: "And both totals move.",
      emphasize: "live-score-home",
      set: { evts: AT.panthersTwo, act: "" },
    }),
    paced({
      id: "arm-three",
      chapter: "scoring",
      caption: "Then a wrong entry.",
      cursor: "act-3",
      press: true,
    }),
    paced({
      id: "tap-three",
      chapter: "scoring",
      caption: "Three points, for a shot that rimmed out.",
      cursor: "floor-away-37",
      press: true,
      set: { act: "+3" },
    }),
    land({
      id: "land-three",
      chapter: "scoring",
      caption: "The wrong score is on every phone watching the game.",
      emphasize: "live-score-away",
      set: { evts: AT.wrongThree, act: "" },
    }),
    paced({
      id: "undo-press",
      chapter: "scoring",
      caption: "One tap fixes it.",
      cursor: "undo",
      press: true,
    }),
    land({
      id: "land-undo",
      chapter: "scoring",
      caption: "And the phone walks the score back.",
      emphasize: "live-score-away",
      callout:
        "The entry is voided, not deleted, and every number built on it walks back on its own.",
      set: { voided: AT.voidIndex, tone: "amber" },
    }),

    /* ══ 3. What the family sees ═══ the acting surface is now his ══════════ */
    land({
      id: "cut",
      chapter: "family",
      caption: "Three quarters later. Same table, same phone, same clock.",
      emphasize: "linescore",
      callout:
        "Every quarter is on the scoreboard he is holding, and a dash means a quarter nobody has played yet.",
      set: { evts: AT.cut, clockBase: 132, running: true, tone: "amber" },
    }),
    paced({
      id: "to-game",
      chapter: "family",
      caption: "The rest of the game lives under the scoreboard.",
      cursor: "phone-tab-game",
      press: true,
    }),
    land({
      id: "leaders",
      chapter: "family",
      caption: "Leaders first, one card each way.",
      emphasize: "leaders",
      callout:
        "Computed from the same events the table is entering, so nobody types them anywhere.",
      set: { tab: "game", scroll: 0 },
    }),
    land({
      id: "box",
      chapter: "family",
      caption: "He scrolls down to the box score, one team at a time.",
      emphasize: "box-card",
      set: { scroll: SCROLL_BOX },
    }),
    paced({
      id: "arm-watch",
      chapter: "family",
      caption: "The table is still working.",
      cursor: "act-2",
      press: true,
    }),
    paced({
      id: "tap-watch",
      chapter: "family",
      caption: "Darius again.",
      cursor: "floor-away-37",
      press: true,
      set: { act: "+2" },
    }),
    land({
      id: "land-watch",
      chapter: "family",
      caption: "His son's row moves while he is looking at it.",
      emphasize: "box-highlight",
      callout: "Twenty points, and the total at the top of the screen moves with the row.",
      set: { evts: AT.tour, act: "" },
    }),
    paced({
      id: "to-stats",
      chapter: "family",
      caption: "Team stats carry every attempt, not only the ones that went in.",
      cursor: "phone-tab-stats",
      press: true,
      set: { scroll: 0 },
    }),
    land({
      id: "stats",
      chapter: "family",
      caption: "Field goals, threes and free throws, both ways.",
      emphasize: "team-stats",
      callout: "Because the table recorded the misses, the shooting line is a real one.",
      set: { tab: "stats", scroll: SCROLL_STATS },
    }),

    /* ══ 4. The buzzer and the sign-off ═════════════════════════════════════ */
    paced({
      id: "back-to-game",
      chapter: "buzzer",
      caption: "Under a minute.",
      cursor: "phone-tab-game",
      press: true,
      set: { scroll: 0 },
    }),
    land({
      id: "last-minute",
      chapter: "buzzer",
      caption: "Six points in it, and every number still comes from the table.",
      emphasize: "live-state",
      set: { tab: "game", clockBase: 41, running: true },
    }),
    paced({
      id: "arm-cut",
      chapter: "buzzer",
      caption: "Oakville cut into it.",
      cursor: "act-2",
      press: true,
    }),
    paced({
      id: "tap-cut",
      chapter: "buzzer",
      caption: "Andre Nguyen.",
      cursor: "floor-home-39",
      press: true,
      set: { act: "+2" },
    }),
    land({
      id: "land-cut",
      chapter: "buzzer",
      caption: "Four points in it, with half a minute left.",
      emphasize: "live-score-home",
      set: { evts: AT.cut2, act: "" },
    }),
    paced({
      id: "arm-seal",
      chapter: "buzzer",
      caption: "The Lords answer.",
      cursor: "act-2",
      press: true,
    }),
    paced({
      id: "tap-seal",
      chapter: "buzzer",
      caption: "Darius seals it.",
      cursor: "floor-away-37",
      press: true,
      set: { act: "+2" },
    }),
    land({
      id: "land-seal",
      chapter: "buzzer",
      caption: "And it lands on the other phone as it happens.",
      emphasize: "live-score-away",
      set: { evts: AT.seal, act: "" },
    }),
    paced({
      id: "buzzer",
      chapter: "buzzer",
      caption: "The buzzer. Both screens stop on the same zero.",
      /* No hand here. The caption is the clock reaching zero, and closing the
         period is what turns End Q4 into End game, so a press on End Q4 would
         be a press on a control this beat's own state removes. */
      emphasize: "console-clock",
      holdMs: 400,
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
    land({
      id: "review",
      chapter: "buzzer",
      caption: "Player of the game comes off the sheet.",
      emphasize: "potg-block",
      callout: "The top scorer is suggested from the sheet, and the table can pick anybody.",
      set: { screen: "review" },
    }),
    land({
      id: "still-live",
      chapter: "buzzer",
      caption: "His page has not moved.",
      emphasize: "live-state",
      callout: "It still says live, because a result is not a result until somebody signs it off.",
    }),
    paced({
      id: "sign-press",
      chapter: "buzzer",
      caption: "The referee signs at the table, the way he signs the paper one.",
      cursor: "sign-pad",
      press: true,
    }),
    paced({
      id: "signed",
      chapter: "buzzer",
      caption: "A finger on the glass. Beside it, the stronger option.",
      cursor: "approval-pin",
      press: true,
      set: { signed: true, refName: REFEREE },
    }),
    land({
      id: "pin",
      chapter: "buzzer",
      caption: "A PIN, checked against the referee's own account.",
      emphasize: "approval-pin",
      callout: "A drawn signature proves somebody signed. A PIN proves who.",
      set: { mode: "pin" },
    }),
    paced({
      id: "final-press",
      chapter: "buzzer",
      caption: "Then the result is marked final.",
      cursor: "mark-final",
      press: true,
    }),
    land({
      id: "land-final",
      chapter: "buzzer",
      caption: "The game on his phone flips with it.",
      emphasize: "potg",
      holdMs: 600,
      toast: "Result published",
      callout:
        "Player of the Game lands with the result: twenty two points, four rebounds and one assist, straight off the sheet.",
      set: { final: true, tone: "green", scroll: 0 },
    }),
    land({
      id: "scoresheet",
      chapter: "buzzer",
      caption: "And the paper scoresheet exists, because leagues still need one.",
      emphasize: "sheet-doc",
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

    /* ══ 5. The story writes itself ═════════════════════════════════════════ */
    land({
      id: "recap",
      chapter: "story",
      caption: "On the team's own page, the recap has already posted as a card.",
      emphasize: "recap",
      callout: "Minutes after the buzzer, off the same numbers, with nobody typing anything.",
      set: { view: "feed", recap: true },
    }),
    land({
      id: "standings",
      chapter: "story",
      caption: "And the division moves, because a signed result is a result the league can count.",
      emphasize: "standings",
      callout: "Toronto Lords move from sixth to fourth, computed from completed games.",
      set: { standings: true, scroll: SCROLL_END },
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

    const darius = state.lines.away[37]
    const potgLine = `${darius.pts} PTS · ${darius.reb} REB · ${darius.ast} AST`

    /* ══ LEFT HANDSET: the scorer's phone, /games/7e467b44/score ═════════ */

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
          /* The console chains straight from a made basket to "Assist by?" and
             keeps asking until the table answers, which is also what keeps the
             prompt on screen for the beat that presses it. */
          assistFor={!act && evts === AT.dariusTwo ? 37 : null}
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

    /** The five the table has tapped in so far, at this point in the story. */
    const awayPicked = get<number>("awayPicked", 3)
    const awayStartersNow =
      awayPicked >= 5 ? AWAY_STARTERS : awayPicked === 4 ? AWAY_PICKED_4 : AWAY_PICKED_3

    const scorer = (
      <PhoneBody>
        <div key={screen} className="demo-fade-in relative flex min-h-0 flex-1 flex-col">
          {screen === "attendance" ? (
            <ConsoleAttendance
              homeName={HOME.name}
              awayName={AWAY.name}
              homePlayers={HOME_PLAYERS}
              awayPlayers={AWAY_PLAYERS}
              homeAbsent={get<boolean>("absentHome", false) ? HOME_ABSENT : []}
              awayAbsent={get<boolean>("absentAway", false) ? AWAY_ABSENT : []}
              scrollY={get<number>("attScroll", 0)}
            />
          ) : screen === "lineup" ? (
            <ConsoleLineup
              league={LEAGUE}
              venue={VENUE}
              homeName={HOME.name}
              awayName={AWAY.name}
              /* The real picker filters absentees out of both lists
                 (scoring-console.tsx L880), so the two people marked at the
                 door are simply not offered as starters. */
              homePlayers={HOME_PLAYERS.filter((p) => !HOME_ABSENT.includes(p.jersey))}
              awayPlayers={AWAY_PLAYERS.filter((p) => !AWAY_ABSENT.includes(p.jersey))}
              homeStarters={HOME_STARTERS}
              awayStarters={awayStartersNow}
              scrollY={get<number>("lineScroll", 0)}
            />
          ) : screen === "review" ? (
            <ConsoleReview
              homeName={HOME.short}
              awayName={AWAY.short}
              homeScore={state.home}
              awayScore={state.away}
              potg="Darius R."
              potgPoints={darius.pts}
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

    /* ══ RIGHT HANDSET: /live/7e467b44, ONE SCROLLING PAGE ═══════════════
       The live page is a column: the hero, then the tabs, then the tab's own
       content. So "look further down" is a scroll and the sticky score chip
       appears when the hero goes past the top, exactly as it does in his
       hand. */

    const view = get<string>("view", "pre")
    const tab = get<"game" | "stats" | "plays">("tab", "game")
    const scroll = get<number>("scroll", 0)
    const heroState = view === "pre" ? "pre" : final ? "final" : "live"
    /** The page only draws its tabs once the table has recorded something. */
    const hasStats = evts >= AT.dariusTwo

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
      state: heroState as "pre" | "live" | "final",
      tipoff: TIPOFF,
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

    const gameTab = (
      <>
        <LiveGameLeaders sections={leaderSections(state)} />
        <LiveBoxScore
          homeName={HOME.name}
          awayName={AWAY.name}
          homeColor={HOME.color}
          awayColor={AWAY.color}
          side="away"
          players={AWAY_PLAYERS.filter((p) => !AWAY_ABSENT.includes(p.jersey))}
          lines={state.lines.away}
          starters={AWAY_STARTERS}
          onFloor={state.onFloor.away}
          tone={tone}
          highlight={37}
          live={!final}
        />
        <LivePlays
          title="Latest plays"
          id="latest-plays"
          rows={state.rows.slice(0, 5)}
          freshKey={state.freshKey}
          tone={tone}
        />
      </>
    )

    const watcher = (
      <PhoneBody>
        {view === "feed" ? (
          <>
            <LiveScoreChip {...chipProps} />
            <div className="min-h-0 flex-1">
              <ScrollPane y={scroll}>
                <div className="space-y-2 px-2.5 py-2.5">
                  {get<boolean>("recap", false) && (
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
              </ScrollPane>
            </div>
          </>
        ) : (
          <>
            {/* The chip is the hero's stand-in once the hero has scrolled off,
                which is what the real page does with it. */}
            {scroll > 140 && <LiveScoreChip {...chipProps} />}
            <div className="min-h-0 flex-1">
              <ScrollPane y={scroll}>
                <LiveHero {...heroProps} />
                <div className="space-y-2.5 px-2.5 pb-3">
                  {final && (
                    <div className="pt-2.5">
                      <LivePotgCard
                        name="Darius Reyes"
                        jersey={37}
                        playerKey={DARIUS_ID}
                        line={potgLine}
                        fresh
                      />
                    </div>
                  )}
                  {view === "pre" ? (
                    <div className="pt-2.5">
                      <LivePregame
                        teams={[
                          { name: HOME.name, rows: avgRows(HOME_AVG, HOME_PLAYERS) },
                          { name: AWAY.name, rows: avgRows(AWAY_AVG, AWAY_PLAYERS) },
                        ]}
                      />
                    </div>
                  ) : !hasStats ? (
                    <div className="pt-2.5">
                      <LiveWaiting />
                    </div>
                  ) : (
                    <>
                      <div className="-mx-2.5">
                        <LiveTabs active={tab} />
                      </div>
                      {tab === "game" && gameTab}
                      {tab === "stats" && (
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
                      {tab === "plays" && (
                        <LivePlays
                          id="plays-list"
                          rows={state.rows.slice(0, 9)}
                          freshKey={state.freshKey}
                          tone={tone}
                          filters={["All", "Scoring", "Q1", "Q2", "Q3", "Q4"].slice(
                            0,
                            2 + state.period
                          )}
                          activeFilter="All"
                        />
                      )}
                    </>
                  )}
                </div>
              </ScrollPane>
            </div>
          </>
        )}
      </PhoneBody>
    )

    const leftLabel =
      screen === "sheet"
        ? `${SCOREKEEPER}'s phone · /scoresheet/7e467b44`
        : `${SCOREKEEPER}'s phone · ${URL_SCORE}`
    const rightLabel =
      view === "feed" ? `${PARENT}'s phone · /team/77311a01` : `${PARENT}'s phone · ${URL_LIVE}`

    return {
      desktop: scorer,
      phone: watcher,
      frameLabels: { left: leftLabel, right: rightLabel },
    }
  },
}
