"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { TypeText } from "../motion"
import { Btn, Chip, ConsoleTabs, Dialog, Panel, StatusChip } from "../scene-kit"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Standings to playoffs", rebuilt to the gold standard (2026-08-16).
 *
 * WHAT CHANGED, AND WHY. The 2026-08-15 cut ran an invented eight team league
 * ("Metro West Youth Basketball", eight rows all at eight games played) through
 * a mock browser window, and drew a bracket that was four columns of stacked
 * boxes with no connectors. Every number in it was made up and the bracket was
 * not the one the product renders. This rebuild answers three owner rulings.
 *
 *   1. STANDINGS TRUTH IS REAL DATA (owner ruling 2026-08-16). Every row of
 *      every table here was computed by the product's own engine,
 *      `lib/standings/compute.ts`, over the real games of the seeded NPH
 *      Showcase world (season `860f7c32`, 725 completed games). The division is
 *      Grade 10 Boys · PRIME, eleven teams, at their real games played. Four
 *      states of that table appear, and all four are engine output, written
 *      down with their working in `docs/roadmap/playoffs-numbers.md`.
 *   2. THE BRACKET IS THE REAL ONE. The Grade 10 playoff plan already exists in
 *      that world: 42 teams pooled across four divisions, 47 games, an opening
 *      round of 10, a round of 32, a round of 16, quarters, semis, a final, a
 *      third place game and 5 consolation games. The tree drawn here is a
 *      readable REGION of that plan, on the geometry `components/bracket/
 *      bracket-tree.tsx` uses: columns by dependency tier, elbow connectors,
 *      dashed ghost slots carrying their real reference ("Winner of G35"), and
 *      the gold champion node hanging off the final.
 *   3. PRESENTATION (audit D2). Focused working REGIONS composed at 1160
 *      logical and rendered at scale 1.0, no browser chrome, no site header,
 *      one slim context strip. Desktop throughout: this is the league planning
 *      class of surface, which the phone first ruling exempts. Nothing is
 *      authored under 14px and `scripts/demo/readability-audit.mjs` is the gate.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN.
 *   · the Standings tab (`manage/components/standings-tab.tsx`): its sentence
 *     "Computed on read from completed games. Ties are broken in the order
 *     configured under Settings › Rules.", its eleven columns, its Win% printed
 *     as a whole percent, and its Tiebreakers column, which prints the enum
 *     keys the engine records and an em-dash when nothing was applied;
 *   · the Schedule tab's game row and its action strip in the product's own
 *     order, and the exact `window.confirm` sentence the Forfeit button
 *     carries: "Record a FORFEIT by the home team? The away team is awarded
 *     the win in standings.";
 *   · the scoring console's review header, "Review: {home} {score} · {score}
 *     {away}", its amber "Referee approval (required by this league)" panel
 *     with the Signature and Referee PIN modes and the sentence about the PIN
 *     being verified against the referee's account, and "Mark final";
 *   · the Tiebreakers tab: "Used to rank teams with identical records. Applied
 *     top-to-bottom until one team wins the tiebreaker.", "No tiebreakers
 *     configured.", the six options in the product's own order, the up, down
 *     and Remove controls, and the Locked badge;
 *   · the season team page's roster table: #, Player, Age, Position, GP,
 *     Playoffs, with GP titled "from the scorekeeper's attendance roll call",
 *     and `eligibility-action.tsx`: the lowercase "eligible" and "not eligible"
 *     badges, "N of M required games", the required "Ruling note (required)…"
 *     and the buttons "Rule eligible" and "Rule ineligible";
 *   · the Playoffs tab: "Playoff plan", "The whole playoff schedule is planned
 *     now; team names fill in automatically as the regular season finishes.",
 *     the pooling control with its two words, the grade card sentences, "The
 *     top 22 teams skip round 1.", the fit line, "Plan the playoffs", the
 *     legend, and the section titles and blurbs `sectionizeBracket` writes;
 *   · the public league page: the Standings section on `StandingsTable`
 *     (Team, W, L, PCT, GB, STRK) and the League news section on `NewsCard`,
 *     with the recap title `buildTemplateRecap` produces for this scoreline.
 *
 * WHAT IS STAGED RATHER THAN READ, AND IT IS DECLARED.
 *   1. THE FORFEIT. `DEFAULTED` is real: the Schedule tab's two Forfeit
 *      buttons PATCH it, and `compute.ts` credits the other team a win and the
 *      forfeiting team a loss with zero points either way. No game in the
 *      seeded world is defaulted, so ONE real game is recorded as a forfeit
 *      here instead of played: YvY Elite versus Vaughan Panthers, Feb 6. That
 *      single change moves four cells of the table and nothing else, not one
 *      place in the order and not one of the 42 seeds. The arithmetic is in
 *      section C of the numbers sheet.
 *   2. THE ELIGIBILITY FLOOR. Owner ruling: show a four games played floor as
 *      the standard. The setting, the roll call source, the badges and the
 *      written ruling are all real product; the NUMBERS cannot be, because
 *      this world has zero attendance events and no season rosters, so the
 *      players are invented, as they are in every demo (real rosters are
 *      minors). And nothing in the product ENFORCES the floor: it is a display
 *      and a record, not a gate. Both are punch items, section E.
 *   3. NO PUBLIC BRACKET EXISTS. `components/bracket` is imported by exactly
 *      one file, the operator Playoffs tab. The public league page has no
 *      bracket at all. So this demo does not stage one: it ends on what the
 *      public page really carries, the settled standings and the recap card.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

/** The world's own labels carry seeding bookkeeping: the league row ends with
 *  the words "End of Season" and the season label with "(completed)". That is
 *  how the fixture is filed, not what the league is called, so the scenes use
 *  the league's name. Numbers sheet section 0. */
const LEAGUE = "NPH Showcase League"
const SEASON = "Fall/Winter 2026-27"
const DIVISION = "Grade 10 Boys · PRIME"
const GRADE = "Grade 10"

const CTX_STANDINGS = `${LEAGUE} · ${SEASON} · Standings`
const CTX_SCHEDULE = `${LEAGUE} · ${SEASON} · Schedule`
const CTX_TABLE = `${LEAGUE} · ${SEASON} · Scorer's table`
const CTX_RULES = `${LEAGUE} · ${SEASON} · Settings › Rules`
const CTX_TEAM = `${LEAGUE} · ${SEASON} · Teams · MBA`
const CTX_PLAYOFFS = `${LEAGUE} · ${SEASON} · Playoffs`
const CTX_PUBLIC = `ysportshub.com · ${LEAGUE}`

/* ── The table, four states, every one of them engine output ─────────────── */

interface Row {
  team: string
  gp: number
  w: number
  l: number
  pf: number
  pa: number
  /** What the Tiebreakers column prints: the engine records enum keys. */
  tb?: string
  id?: string
}

/** A. Saturday evening. Two games of the division are still to come, so MBA
 *  and Vaughan have played nine and Burloak and YvY have played nine. */
const ROWS_SAT: Row[] = [
  { team: "MBA", gp: 9, w: 6, l: 3, pf: 571, pa: 518, id: "row-mba" },
  { team: "Vaughan Panthers", gp: 9, w: 6, l: 3, pf: 573, pa: 527, id: "row-vaughan" },
  { team: "Retro Elite", gp: 10, w: 6, l: 4, pf: 598, pa: 600 },
  { team: "Alpha Elite", gp: 10, w: 6, l: 4, pf: 620, pa: 623 },
  { team: "Hooptrotters OGs", gp: 10, w: 6, l: 4, pf: 659, pa: 583 },
  { team: "Toronto Top Tier East", gp: 10, w: 6, l: 4, pf: 692, pa: 636 },
  { team: "Burloak Elite (PRIME)", gp: 9, w: 5, l: 4, pf: 589, pa: 595 },
  { team: "Eurostep Basketball", gp: 10, w: 5, l: 5, pf: 653, pa: 675 },
  { team: "Ottawa Elite (incl. Prep)", gp: 10, w: 4, l: 6, pf: 664, pa: 673 },
  { team: "Royal Crown", gp: 10, w: 2, l: 8, pf: 629, pa: 706 },
  { team: "YvY Elite", gp: 9, w: 1, l: 8, pf: 508, pa: 620, id: "row-yvy-table" },
]

/** B. The forfeit is recorded. Vaughan take the win and YvY the loss, and
 *  neither points column moves: a defaulted game is credited 0 to 0. */
const ROWS_FORFEIT: Row[] = [
  { team: "Vaughan Panthers", gp: 10, w: 7, l: 3, pf: 573, pa: 527, id: "row-vaughan" },
  { team: "MBA", gp: 9, w: 6, l: 3, pf: 571, pa: 518, id: "row-mba" },
  { team: "Retro Elite", gp: 10, w: 6, l: 4, pf: 598, pa: 600 },
  { team: "Alpha Elite", gp: 10, w: 6, l: 4, pf: 620, pa: 623 },
  { team: "Hooptrotters OGs", gp: 10, w: 6, l: 4, pf: 659, pa: 583 },
  { team: "Toronto Top Tier East", gp: 10, w: 6, l: 4, pf: 692, pa: 636 },
  { team: "Burloak Elite (PRIME)", gp: 9, w: 5, l: 4, pf: 589, pa: 595 },
  { team: "Eurostep Basketball", gp: 10, w: 5, l: 5, pf: 653, pa: 675 },
  { team: "Ottawa Elite (incl. Prep)", gp: 10, w: 4, l: 6, pf: 664, pa: 673 },
  { team: "Royal Crown", gp: 10, w: 2, l: 8, pf: 629, pa: 706 },
  { team: "YvY Elite", gp: 10, w: 1, l: 9, pf: 508, pa: 620, id: "row-yvy-table" },
]

/** C. Sunday night: the last game is signed and every row is at ten. */
const ROWS_FINAL: Row[] = [
  { team: "MBA", gp: 10, w: 7, l: 3, pf: 640, pa: 571, id: "row-mba" },
  { team: "Vaughan Panthers", gp: 10, w: 7, l: 3, pf: 573, pa: 527, id: "row-vaughan" },
  { team: "Retro Elite", gp: 10, w: 6, l: 4, pf: 598, pa: 600 },
  { team: "Alpha Elite", gp: 10, w: 6, l: 4, pf: 620, pa: 623 },
  { team: "Hooptrotters OGs", gp: 10, w: 6, l: 4, pf: 659, pa: 583 },
  { team: "Toronto Top Tier East", gp: 10, w: 6, l: 4, pf: 692, pa: 636 },
  { team: "Burloak Elite (PRIME)", gp: 10, w: 5, l: 5, pf: 642, pa: 664 },
  { team: "Eurostep Basketball", gp: 10, w: 5, l: 5, pf: 653, pa: 675 },
  { team: "Ottawa Elite (incl. Prep)", gp: 10, w: 4, l: 6, pf: 664, pa: 673 },
  { team: "Royal Crown", gp: 10, w: 2, l: 8, pf: 629, pa: 706 },
  { team: "YvY Elite", gp: 10, w: 1, l: 9, pf: 508, pa: 620 },
]

/** D. The same games, re-read once the tiebreakers are configured. Vaughan
 *  hold first on the one meeting they won; the four teams at six and four
 *  sort by head to head and then by point differential; Eurostep edge Burloak
 *  on points scored. Every `tb` string is what the engine recorded. */
const ROWS_RULED: Row[] = [
  { team: "Vaughan Panthers", gp: 10, w: 7, l: 3, pf: 573, pa: 527, tb: "HEAD_TO_HEAD", id: "row-vaughan" },
  { team: "MBA", gp: 10, w: 7, l: 3, pf: 640, pa: 571, tb: "HEAD_TO_HEAD", id: "row-mba" },
  { team: "Toronto Top Tier East", gp: 10, w: 6, l: 4, pf: 692, pa: 636, tb: "HEAD_TO_HEAD, POINT_DIFFERENTIAL", id: "row-cluster" },
  { team: "Retro Elite", gp: 10, w: 6, l: 4, pf: 598, pa: 600, tb: "HEAD_TO_HEAD, POINT_DIFFERENTIAL" },
  { team: "Hooptrotters OGs", gp: 10, w: 6, l: 4, pf: 659, pa: 583, tb: "HEAD_TO_HEAD" },
  { team: "Alpha Elite", gp: 10, w: 6, l: 4, pf: 620, pa: 623, tb: "HEAD_TO_HEAD" },
  { team: "Eurostep Basketball", gp: 10, w: 5, l: 5, pf: 653, pa: 675, tb: "POINTS_SCORED" },
  { team: "Burloak Elite (PRIME)", gp: 10, w: 5, l: 5, pf: 642, pa: 664, tb: "POINTS_SCORED" },
  { team: "Ottawa Elite (incl. Prep)", gp: 10, w: 4, l: 6, pf: 664, pa: 673 },
  { team: "Royal Crown", gp: 10, w: 2, l: 8, pf: 629, pa: 706 },
  { team: "YvY Elite", gp: 10, w: 1, l: 9, pf: 508, pa: 620 },
]

/** The six options, in the Tiebreakers tab's own order and wording. */
const TIEBREAKERS = [
  "Head-to-head record",
  "Point differential",
  "Points scored",
  "Points allowed (fewest)",
  "Total wins",
  "Coin flip (last resort)",
]

/* ── The two games of the last weekend ───────────────────────────────────── */

/** The forfeited game. `DB` Game 8b741570, Sat Feb 6, YvY at home. */
const FORFEIT_GAME = {
  when: "Sat Feb 6 · 6:45 PM",
  home: "YvY Elite",
  away: "Vaughan Panthers",
  venue: "The Playground",
  court: "Court 3",
}
/** The exact sentence the Forfeit: home button carries. */
const FORFEIT_CONFIRM =
  "Record a FORFEIT by the home team? The away team is awarded the win in standings."

/** The decider. `DB` Game 32bcd68c, Sun Feb 7, 8:00 PM, The Playground Court 2. */
const DECIDER = {
  home: "MBA",
  away: "Burloak Elite (PRIME)",
  homeScore: 69,
  awayScore: 53,
  when: "Sunday, February 7 at 8:00 p.m.",
  where: "The Playground, Court 2",
}

/** The other three games of that weekend, real rows, for the schedule region. */
const SCHEDULE_ROWS = [
  {
    id: "row-yvy",
    when: FORFEIT_GAME.when,
    home: FORFEIT_GAME.home,
    away: FORFEIT_GAME.away,
    venue: FORFEIT_GAME.venue,
    court: FORFEIT_GAME.court,
  },
  {
    when: "Sun Feb 7 · 11:15 AM",
    home: "Royal Crown",
    away: "Burloak Elite (PRIME)",
    venue: "The Playground",
    court: "Court 1",
  },
  {
    when: "Sun Feb 7 · 8:00 PM",
    home: "MBA",
    away: "Burloak Elite (PRIME)",
    venue: "The Playground",
    court: "Court 2",
  },
]

/* ── Eligibility: real flow, invented players (there are no rosters here) ── */

const MIN_GAMES = 4
interface Player {
  number: string
  name: string
  age: number
  position: string
  gp: number
  id?: string
}
const ROSTER: Player[] = [
  { number: "4", name: "A. Osei", age: 15, position: "Guard", gp: 10 },
  { number: "5", name: "S. Dubois", age: 16, position: "Guard", gp: 10 },
  { number: "7", name: "J. Reyes", age: 15, position: "Guard", gp: 9 },
  { number: "9", name: "B. Laurin", age: 16, position: "Forward", gp: 8 },
  { number: "11", name: "R. Patel", age: 15, position: "Guard", gp: 7 },
  { number: "12", name: "D. Mensah", age: 16, position: "Centre", gp: 6 },
  { number: "15", name: "L. Nguyen", age: 15, position: "Forward", gp: 5 },
  { number: "21", name: "C. Okafor", age: 16, position: "Forward", gp: 4 },
  { number: "23", name: "M. Rahim", age: 15, position: "Guard", gp: 3, id: "row-short" },
  { number: "33", name: "N. Achebe", age: 15, position: "Centre", gp: 2 },
]
const SHORT_PLAYER = ROSTER.find((p) => p.id === "row-short")!
const RULING_NOTE = "Broken wrist in December, cleared by the club doctor"

/* ── The playoff plan, straight off the stored plan ──────────────────────── */

const PLAYOFF_TEAMS = 42
const PLAYOFF_GAMES = 47
const PLAYOFF_BYES = 22
const PLAYOFF_WEEKEND = "Tier 2 Finals · Feb 27-28"
const PLAYOFF_FIT = `${PLAYOFF_GAMES} games · fits ${PLAYOFF_WEEKEND} (84 of 162 slots with the other grades)`

/** Every round of the real Grade 10 plan, with its real game count. */
const ROUNDS: Array<{ label: string; games: number; note: string }> = [
  { label: "Opening round", games: 10, note: "seeds 23 to 42" },
  { label: "Round of 32", games: 16, note: "the top 22 join here" },
  { label: "Round of 16", games: 8, note: "" },
  { label: "Quarterfinal", games: 4, note: "" },
  { label: "Semifinal", games: 2, note: "" },
  { label: "Final", games: 1, note: "" },
  { label: "3rd place", games: 1, note: "" },
  { label: "Consolation", games: 5, note: "the opening round losers" },
]

/* ── The bracket ─────────────────────────────────────────────────────────── */

interface TreeSlot {
  seed?: number
  team?: string
  ghost?: string
  /** Structural id of the game that decides this slot, when it is in region. */
  from?: string
}
interface TreeMatch {
  id: string
  code: string
  round: string
  tier: number
  when: string
  home: TreeSlot
  away: TreeSlot
}

/**
 * The readable REGION of the real Grade 10 tree: both quarterfinals that feed
 * the top semifinal, that semifinal, the final and the champion node. Game
 * codes, round names, ghost references and kick-off times are the stored
 * plan's own (`Season.playoffPlan`, games g35, g36, g39, g46).
 *
 * The full 42 team tree is six columns and 47 games wide, which cannot be read
 * at scale 1.0 in a 1160 by 600 region, so the demo stages this end of it and
 * says what the rest is with the round strip.
 */
const TREE: TreeMatch[] = [
  {
    id: "g35",
    code: "G35",
    round: "Quarterfinal",
    tier: 3,
    when: "Sun, Feb 28, 1:45 p.m.",
    home: { ghost: "Winner of G27" },
    away: { ghost: "Winner of G28" },
  },
  {
    id: "g36",
    code: "G36",
    round: "Quarterfinal",
    tier: 3,
    when: "Sun, Feb 28, 1:45 p.m.",
    home: { ghost: "Winner of G29" },
    away: { ghost: "Winner of G30" },
  },
  {
    id: "g39",
    code: "G39",
    round: "Semifinal",
    tier: 4,
    when: "Sun, Feb 28, 4:15 p.m.",
    home: { ghost: "Winner of G35", from: "g35" },
    away: { ghost: "Winner of G36", from: "g36" },
  },
  {
    id: "g46",
    code: "G46",
    round: "Final",
    tier: 5,
    when: "Sun, Feb 28, 6:45 p.m.",
    home: { ghost: "Winner of G39", from: "g39" },
    away: { ghost: "Winner of G40" },
  },
]

/** The third place game, its own section on the real board. */
const THIRD: TreeMatch = {
  id: "g47",
  code: "G47",
  round: "3rd place",
  tier: 5,
  when: "Sun, Feb 28, 6:45 p.m.",
  home: { ghost: "Loser of G39" },
  away: { ghost: "Loser of G40" },
}

/** Two of the five consolation games, with the plan's own references. */
const CONSOLATION: TreeMatch[] = [
  {
    id: "g41",
    code: "G41",
    round: "Consolation",
    tier: 1,
    when: "Sat, Feb 27, 4:15 p.m.",
    home: { ghost: "Loser of G1" },
    away: { ghost: "Loser of G2" },
  },
  {
    id: "g42",
    code: "G42",
    round: "Consolation",
    tier: 1,
    when: "Sat, Feb 27, 5:30 p.m.",
    home: { ghost: "Loser of G3" },
    away: { ghost: "Loser of G4" },
  },
]

/** The opening round, where the real seeds show: plan games g1 and g3. */
const OPENING: TreeMatch[] = [
  {
    id: "g1",
    code: "G1",
    round: "Opening round",
    tier: 0,
    when: "Sat, Feb 27, 10:00 a.m.",
    home: { seed: 35, team: "Brotherhood Elite" },
    away: { seed: 36, team: "FEIA (Fort Erie)" },
  },
  {
    id: "g3",
    code: "G3",
    round: "Opening round",
    tier: 0,
    when: "Sat, Feb 27, 10:00 a.m.",
    home: { seed: 24, team: "Dragons de Gatineau (GAME SPEAKS)" },
    away: { seed: 41, team: "Wiggins Elite" },
  },
]

/* ── The public page ─────────────────────────────────────────────────────── */

/**
 * The STRK column, computed the way `lib/queries/standings.ts` computes it:
 * walk the season's COMPLETED games in date order and keep each team's
 * trailing run. Defaulted games are not part of that walk, which is why
 * Vaughan's W1 is their last PLAYED win rather than the forfeit.
 */
const STREAKS: Record<string, string> = {
  "Vaughan Panthers": "W1",
  MBA: "W3",
  "Toronto Top Tier East": "W1",
  "Retro Elite": "L1",
  "Hooptrotters OGs": "L2",
  "Alpha Elite": "W5",
}

/** The recap title `buildTemplateRecap` writes for a 16 point margin:
 *  `${winner} ${titleVerb(16)} ${loser} ${winnerScore}–${loserScore}`. */
const RECAP_TITLE = `${DECIDER.home} rolls past ${DECIDER.away} ${DECIDER.homeScore}–${DECIDER.awayScore}`
const RECAP_BODY = `${DECIDER.home} rolled past ${DECIDER.away} ${DECIDER.homeScore}–${DECIDER.awayScore} on Sunday, February 7 in ${LEAGUE} ${SEASON} action.`

/* ── Pacing ──────────────────────────────────────────────────────────────── */

/**
 * Stop, explain, act (owner ruling 2026-08-16: "slow is the point"). The hand
 * takes CURSOR_ARRIVE_MS to reach its target and the balloon lands with it, so
 * a beat holds for the travel, plus long enough to READ the balloon at about
 * 180ms a word with a 900ms buffer for the eye to find it, plus a settle so the
 * next thing does not fire on the last syllable.
 */
function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 220
  const settle = 500
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 180 + 900 : 2400
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const playoffsStory: DemoScript = {
  presentation: "scene",
  desktopUrl: "/manage/leagues/nph-showcase/seasons/fall-winter-2026-27/manage?tab=standings",
  context: CTX_STANDINGS,
  initialStage: "desktop",
  chapters: [
    { id: "weekend", title: "The last weekend" },
    { id: "rule", title: "The rule that decides" },
    { id: "who", title: "Who can play" },
    { id: "bracket", title: "Everybody plays" },
  ],

  beats: [
    /* ── 1. The last weekend ──────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "weekend",
      caption: `Two games left in ${DIVISION}, and first place is not settled.`,
      emphasize: "table",
      callout:
        "MBA and Vaughan have played nine. The table is worked out from completed games the moment you open it.",
      set: { screen: "standings", table: "sat" },
    }),
    paced({
      id: "to-schedule",
      chapter: "weekend",
      caption: "Saturday night, and one of them does not happen.",
      context: CTX_SCHEDULE,
      cursor: "row-yvy",
      press: true,
      callout: "YvY Elite cannot field a team, and the league has to record that.",
      set: { screen: "schedule", open: true },
    }),
    paced({
      id: "forfeit",
      chapter: "weekend",
      caption: "The league records a forfeit.",
      cursor: "forfeit-home",
      press: true,
      callout: "One press, on the game itself.",
      set: { dialog: "forfeit" },
    }),
    paced({
      id: "forfeit-ok",
      chapter: "weekend",
      caption: "One sentence, and it says exactly what it will do to the table.",
      cursor: "confirm-forfeit",
      press: true,
      toast: `Forfeit recorded · ${FORFEIT_GAME.away} awarded the win`,
      set: { dialog: "", forfeited: true, open: false },
    }),
    paced({
      id: "forfeit-table",
      chapter: "weekend",
      caption: "Vaughan take the win, YvY take the loss, and neither points column moves.",
      context: CTX_STANDINGS,
      emphasize: "row-vaughan",
      callout:
        "A forfeit is a win, a loss, and no points at all. It can never flatter a differential.",
      set: { screen: "standings", table: "forfeit" },
    }),
    paced({
      id: "review",
      chapter: "weekend",
      caption: "Sunday night, the game that decides first place is at the review screen.",
      context: CTX_TABLE,
      emphasize: "review-head",
      callout: "The scorer's table has the sheet. Nothing counts until it is signed.",
      set: { screen: "review" },
    }),
    paced({
      id: "sign",
      chapter: "weekend",
      caption: "The referee approves it with the PIN tied to their own account.",
      cursor: "mark-final",
      press: true,
      callout: "The PIN is checked against the assigned referee's own account.",
    }),
    paced({
      id: "final",
      chapter: "weekend",
      caption: "One press writes the box score, completes the game and starts everything downstream.",
      emphasize: "final-card",
      toast: `${DECIDER.home} ${DECIDER.homeScore}, ${DECIDER.away} ${DECIDER.awayScore} · marked final`,
      set: { finalized: true },
    }),
    paced({
      id: "settled",
      chapter: "weekend",
      caption: "And the table has already moved. Every row is at ten games.",
      context: CTX_STANDINGS,
      emphasize: "row-mba",
      callout: "Nobody typed a result into a standings page. The table reads the games.",
      set: { screen: "standings", table: "final" },
    }),

    /* ── 2. The rule that decides ─────────────────────────────────────── */
    paced({
      id: "tie",
      chapter: "rule",
      caption: "Two teams finished seven and three, and the Tiebreakers column is empty.",
      emphasize: "tb-col",
      callout:
        "The order between them is an accident, and that is what leagues argue about in March.",
    }),
    paced({
      id: "rules-tab",
      chapter: "rule",
      caption: "This league never wrote its tiebreakers down. Most have not.",
      context: `${CTX_RULES} · Tiebreakers`,
      emphasize: "tb-empty",
      callout: "One screen, and the rules are the league's own, in its own order.",
      set: { screen: "tiebreakers", order: 0 },
    }),
    paced({
      id: "add-h2h",
      chapter: "rule",
      caption: "Head-to-head first.",
      cursor: "tb-add-1",
      press: true,
      callout: "The rule every parent already believes in: who beat whom.",
      set: { order: 1 },
    }),
    paced({
      id: "add-rest",
      chapter: "rule",
      caption: "Then the ladder under it, applied top to bottom until one team wins the tiebreaker.",
      emphasize: "tb-list",
      callout: "Six rules, ending in a coin flip that always lands the same way.",
      set: { order: 6 },
    }),
    paced({
      id: "lock",
      chapter: "rule",
      caption: "And locked, before a playoff game is played.",
      cursor: "tb-lock",
      press: true,
      toast: "Tiebreakers locked · Feb 8, 2027",
      callout: "Locked means nobody reorders them once they start deciding somebody's season.",
      set: { locked: true },
    }),
    paced({
      id: "reread",
      chapter: "rule",
      caption: "The table re-reads itself, and Vaughan hold first place.",
      context: CTX_STANDINGS,
      emphasize: "row-vaughan",
      callout: "They met once, in October, and Vaughan won it by four.",
      set: { screen: "standings", table: "ruled" },
    }),
    paced({
      id: "cluster",
      chapter: "rule",
      caption: "Four teams finished six and four, and every row names the rule that placed it.",
      emphasize: "row-cluster",
      callout:
        "The column is the engine's own record of which rule separated which teams.",
    }),

    /* ── 3. Who can play ──────────────────────────────────────────────── */
    paced({
      id: "floor",
      chapter: "who",
      caption: "Then the question nobody wants on the Thursday before playoffs.",
      context: `${CTX_RULES} · Playoffs`,
      emphasize: "min-games",
      callout: "Four games of ten, written down before the playoffs rather than argued during them.",
      set: { screen: "rules" },
    }),
    paced({
      id: "roster",
      chapter: "who",
      caption: "Games played come from the scorekeeper's roll call, not from a coach's memory.",
      context: CTX_TEAM,
      emphasize: "gp-col",
      callout: "Attendance is taken at the start of every scored game, and that record counts.",
      set: { screen: "roster" },
    }),
    paced({
      id: "short",
      chapter: "who",
      caption: `One player is short. ${SHORT_PLAYER.name} broke a wrist in December.`,
      cursor: "row-short",
      press: true,
      callout: "Three of four. The badge is automatic; the argument is not.",
      set: { override: true },
    }),
    paced({
      id: "note",
      chapter: "who",
      caption: "The league can overrule it, and the product will not let them do it quietly.",
      type: { key: "note", text: RULING_NOTE },
      callout: "The note is required, and the note IS the ruling.",
      emphasize: "ruling-note",
    }),
    paced({
      id: "ruled",
      chapter: "who",
      caption: "Ruled in, with the reason attached to her name for anybody who asks in March.",
      cursor: "rule-eligible",
      press: true,
      toast: "Ruling saved",
      callout: "A decision somebody made and signed.",
      set: { ruled: true, override: false },
    }),

    /* ── 4. Everybody plays ───────────────────────────────────────────── */
    paced({
      id: "playoffs",
      chapter: "bracket",
      caption: `${GRADE} runs as four divisions, and its playoffs are one championship.`,
      context: CTX_PLAYOFFS,
      emphasize: "pooling",
      callout: "Four divisions all season, one bracket at the end.",
      set: { screen: "playoffs" },
    }),
    paced({
      id: "everyone",
      chapter: "bracket",
      caption: `All ${PLAYOFF_TEAMS} teams make the playoffs, and everyone plays at least two games.`,
      emphasize: "in-sentence",
      callout: "Nobody's season ends because of a table.",
    }),
    paced({
      id: "fit",
      chapter: "bracket",
      caption: "Checked against the gym time that is actually booked.",
      emphasize: "fit-line",
      callout: `${PLAYOFF_GAMES} games, and the weekend holds them alongside two other grades.`,
    }),
    paced({
      id: "plan",
      chapter: "bracket",
      caption: "One press plans the whole weekend.",
      cursor: "plan-playoffs",
      press: true,
      toast: `${PLAYOFF_GAMES} playoff games planned · ${GRADE}`,
      callout: "Every game gets a time, a gym and a court now.",
      set: { planned: true },
    }),
    paced({
      id: "rounds",
      chapter: "bracket",
      caption: `${PLAYOFF_GAMES} games: an opening round of ten, then 32, 16, quarters, semis and a final.`,
      emphasize: "round-strip",
      callout: `64 slots and ${PLAYOFF_TEAMS} teams, so the top ${PLAYOFF_BYES} skip the opening round.`,
    }),
    paced({
      id: "tree",
      chapter: "bracket",
      caption: "This is the bracket the league gets, and the one every club sees.",
      emphasize: "tree",
      callout: "Winners move right, and the lines show which game feeds which slot.",
      set: { view: "tree" },
    }),
    paced({
      id: "ghost",
      chapter: "bracket",
      caption: "Nothing is guessed at. An undecided slot says which game decides it.",
      cursor: "ghost-slot",
      hover: "ghost-slot",
      callout: "When G35 is signed, that name fills itself in.",
    }),
    paced({
      id: "third",
      chapter: "bracket",
      caption: "The two beaten semifinalists play for bronze at the same time as the final.",
      emphasize: "third-card",
      callout: "Bronze is a real game on the schedule.",
      set: { view: "extra" },
    }),
    paced({
      id: "consolation",
      chapter: "bracket",
      caption: "And the ten teams knocked out on Saturday morning are already scheduled again.",
      emphasize: "consolation",
      callout: "Five consolation games, drawn rather than promised.",
    }),
    paced({
      id: "public",
      chapter: "bracket",
      caption: "The public page carries the settled table and the recap of the game that decided it.",
      context: CTX_PUBLIC,
      emphasize: "public-news",
      callout:
        "Same engine, same rows, and a recap written the moment the sheet was signed.",
      set: { screen: "public" },
    }),
    paced({
      id: "end",
      chapter: "bracket",
      caption:
        "A forfeit recorded honestly, a final signed at the table, a rule that decided first place, and 42 teams with a Saturday.",
      hold: 4600,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "standings")
    const dialog = get<string>("dialog", "")

    const desktop = (
      <div className="relative flex h-full flex-col">
        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {screen === "standings" && <StandingsScreen state={get<string>("table", "sat")} />}
          {screen === "schedule" && (
            <ScheduleScreen open={get("open", false)} forfeited={get("forfeited", false)} />
          )}
          {screen === "review" && <ReviewScreen finalized={get("finalized", false)} />}
          {screen === "tiebreakers" && (
            <TiebreakersScreen shown={get("order", 0)} locked={get("locked", false)} />
          )}
          {screen === "rules" && <RulesScreen />}
          {screen === "roster" && (
            <RosterScreen
              override={get("override", false)}
              ruled={get("ruled", false)}
              note={
                <TypeText
                  text={get<string>("note", "")}
                  typing={typingKey === "note"}
                  placeholder="Ruling note (required)…"
                />
              }
            />
          )}
          {screen === "playoffs" && (
            <PlayoffsScreen planned={get("planned", false)} view={get<string>("view", "")} />
          )}
          {screen === "public" && <PublicScreen />}
        </div>

        {/* The product's own confirmation: a native window.confirm carrying
            one sentence, no reason field and no audience. */}
        <Dialog
          open={dialog === "forfeit"}
          title={FORFEIT_CONFIRM}
          footer={
            <>
              <Btn tone="quiet" size="sm">
                Cancel
              </Btn>
              <Btn id="confirm-forfeit" size="sm">
                OK
              </Btn>
            </>
          }
        />

        {get("endCard", false) && <EndCard />}
      </div>
    )

    return { desktop }
  },
}

/* ── Standings ───────────────────────────────────────────────────────────── */

function Shell({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <>
      <ConsoleTabs active={tab} />
      <div className="bg-ink-50/70 min-h-0 flex-1 px-5 py-3.5">{children}</div>
    </>
  )
}

function StandingsScreen({ state }: { state: string }) {
  const rows =
    state === "ruled"
      ? ROWS_RULED
      : state === "final"
        ? ROWS_FINAL
        : state === "forfeit"
          ? ROWS_FORFEIT
          : ROWS_SAT
  const ruled = state === "ruled"
  return (
    <Shell tab="Standings">
      <Panel
        title="Standings"
        meta={`${DIVISION} · 11 teams`}
        action={<Btn tone="quiet" size="sm">Refresh</Btn>}
      >
        <p className="text-ink-600 px-4 pt-2.5 text-[14px] font-medium">
          Computed on read from completed games. Ties are broken in the order configured under
          Settings › Rules.
        </p>
        <div data-demo-target="table" className="px-3 pb-2.5 pt-2">
          <table className="w-full table-fixed">
            <thead>
              <tr className="bg-ink-50">
                <Th className="w-[34px]">#</Th>
                <Th>Team</Th>
                <Th className="w-[44px] text-right">GP</Th>
                <Th className="w-[38px] text-right">W</Th>
                <Th className="w-[38px] text-right">L</Th>
                <Th className="w-[34px] text-right">T</Th>
                <Th className="w-[52px] text-right">PF</Th>
                <Th className="w-[52px] text-right">PA</Th>
                <Th className="w-[56px] text-right">Diff</Th>
                <Th className="w-[58px] text-right">Win%</Th>
                <Th className="w-[300px]" id="tb-col">
                  Tiebreakers
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const diff = r.pf - r.pa
                const pct = Math.round((r.w / r.gp) * 100)
                return (
                  <tr
                    key={r.team}
                    data-demo-target={r.id}
                    className={cn(
                      "border-ink-100 border-t transition-colors duration-300 motion-reduce:transition-none",
                      i === 0 ? "bg-gold-50/70" : "bg-white",
                      "data-[demo-hover=true]:bg-play-50/60"
                    )}
                  >
                    <td className="text-ink-400 px-3 py-1 text-[14px] font-bold tabular-nums">
                      {i + 1}
                    </td>
                    <td className="text-ink-900 truncate px-3 py-1 text-[15px] font-semibold">
                      {r.team}
                    </td>
                    <Td>{r.gp}</Td>
                    <Td strong>{r.w}</Td>
                    <Td>{r.l}</Td>
                    <Td>0</Td>
                    <Td>{r.pf}</Td>
                    <Td>{r.pa}</Td>
                    <td
                      className={cn(
                        "px-3 py-1 text-right text-[14px] font-bold tabular-nums",
                        diff > 0 ? "text-court-700" : diff < 0 ? "text-hoop-600" : "text-ink-500"
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff}
                    </td>
                    <Td strong>{pct}%</Td>
                    <td
                      className={cn(
                        "truncate px-3 py-1 text-[14px] font-semibold tabular-nums",
                        r.tb ? "text-court-700" : "text-ink-400"
                      )}
                    >
                      {r.tb ?? "·"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="text-ink-500 mt-2 text-[14px] font-medium">
        {ruled
          ? "Six tiebreakers configured and locked. Every tied row shows which rule placed it."
          : "No tiebreakers configured, so tied teams sit in win-percentage order."}
      </p>
    </Shell>
  )
}

function Th({
  children,
  className,
  id,
}: {
  children?: ReactNode
  className?: string
  id?: string
}) {
  return (
    <th
      data-demo-target={id}
      className={cn(
        "text-ink-500 px-3 py-2 text-left text-[14px] font-bold uppercase tracking-[0.06em]",
        className
      )}
    >
      {children}
    </th>
  )
}

function Td({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-1 text-right text-[14px] tabular-nums",
        strong ? "text-ink-900 font-bold" : "text-ink-600"
      )}
    >
      {children}
    </td>
  )
}

/* ── Schedule tab, and the forfeit ───────────────────────────────────────── */

function ScheduleScreen({ open, forfeited }: { open: boolean; forfeited: boolean }) {
  return (
    <Shell tab="Schedule">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="border-ink-200 flex shrink-0 overflow-hidden rounded-lg border bg-white text-[14px] font-bold">
          <span className="text-ink-500 px-2.5 py-1">Whole season</span>
          <span className="bg-play-600 px-2.5 py-1 text-white">Weekend 11 · Feb 6 to 7</span>
        </span>
        <Chip tone="court" strong>
          Published
        </Chip>
        <span className="text-ink-500 truncate text-[14px] font-semibold">
          {DIVISION} · last weekend of the regular season
        </span>
      </div>
      <Panel title={`Games in ${DIVISION}`} action={<Chip tone="neutral" strong>3 of 3</Chip>}>
        <div className="space-y-1 px-3 py-2">
          {SCHEDULE_ROWS.map((r) => (
            <GameRow
              key={r.when + r.home}
              id={r.id}
              when={r.when}
              home={r.home}
              away={r.away}
              venue={r.venue}
              court={r.court}
              status={r.id === "row-yvy" && forfeited ? "DEFAULTED" : "SCHEDULED"}
              open={open && r.id === "row-yvy"}
            />
          ))}
        </div>
      </Panel>
    </Shell>
  )
}

/**
 * One row of the Schedule tab and its expansion. The action strip is the
 * product's own, in the product's own order, with the two amber
 * Forfeit buttons and the hoop-red Cancel game beside them.
 */
function GameRow({
  id,
  when,
  home,
  away,
  venue,
  court,
  status,
  open,
}: {
  id?: string
  when: string
  home: string
  away: string
  venue: string
  court: string
  status: "SCHEDULED" | "DEFAULTED"
  open: boolean
}) {
  const dead = status === "DEFAULTED"
  return (
    <div
      data-demo-target={id}
      className={cn(
        "rounded-xl border bg-white transition-colors duration-300 motion-reduce:transition-none",
        open ? "border-ink-300" : "border-ink-100",
        dead && "border-gold-400 bg-gold-50/60"
      )}
    >
      <div className="flex w-full items-center justify-between gap-3 px-3.5 py-2">
        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-ink-700 shrink-0 whitespace-nowrap text-[15px] font-bold tabular-nums">
            {when}
          </span>
          <span className="text-ink-900 text-[15px] font-semibold">
            {home} <span className="text-ink-400 font-medium">vs</span> {away}
          </span>
          <span className="text-ink-500 text-[14px] font-medium">
            {venue} · {court}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusChip tone={dead ? "gold" : "court"}>{status}</StatusChip>
          <span className="text-ink-400 text-[14px]">{open ? "▴" : "▾"}</span>
        </div>
      </div>
      {open && (
        <div className="border-ink-100 flex flex-wrap items-center gap-1.5 border-t px-3.5 py-2">
          <Btn tone="quiet" size="sm">
            Box score ↗
          </Btn>
          <Btn tone="quiet" size="sm">
            Pin in place
          </Btn>
          <span className="border-play-300 text-play-700 inline-flex shrink-0 items-center rounded-xl border bg-white px-3.5 py-1.5 text-[14px] font-bold">
            Find alternates
          </span>
          <span
            data-demo-target="forfeit-home"
            className="border-gold-400 text-gold-600 inline-flex shrink-0 items-center rounded-xl border bg-white px-3.5 py-1.5 text-[14px] font-bold"
          >
            Forfeit: home
          </span>
          <span className="border-gold-400 text-gold-600 inline-flex shrink-0 items-center rounded-xl border bg-white px-3.5 py-1.5 text-[14px] font-bold">
            Forfeit: away
          </span>
          <span className="border-hoop-300 text-hoop-700 inline-flex shrink-0 items-center rounded-xl border bg-white px-3.5 py-1.5 text-[14px] font-bold">
            Cancel game
          </span>
        </div>
      )}
    </div>
  )
}

/* ── The scorer's table ──────────────────────────────────────────────────── */

/**
 * The console's review screen, composed as a region: the header sentence
 * and the referee approval panel. The box score is deliberately absent: this
 * world has no scoring events, so drawing player lines would be inventing them.
 */
function ReviewScreen({ finalized }: { finalized: boolean }) {
  if (finalized) {
    return (
      <div className="bg-ink-50/70 flex min-h-0 flex-1 items-center justify-center px-10">
        <div data-demo-target="final-card" className="live-pop w-full max-w-[720px] text-center">
          <p className="text-court-700 text-[15px] font-bold uppercase tracking-[0.2em]">Final</p>
          <p className="font-display text-ink-950 mt-2 text-[46px] font-extrabold leading-none tabular-nums">
            {DECIDER.home} {DECIDER.homeScore}{" "}
            <span className="text-ink-300">·</span> {DECIDER.awayScore} {DECIDER.away}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Chip tone="court" strong>
              Signed by the assigned referee, PIN verified
            </Chip>
            <Chip tone="neutral" strong>
              Game status: COMPLETED
            </Chip>
          </div>
          <p className="text-ink-600 mx-auto mt-4 max-w-[560px] text-[15px] font-medium leading-snug">
            Box score written, recap published, standings input changed, playoff bracket advanced.
            Every one of those happened because the sheet was marked final.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="bg-ink-50/70 flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
      <div data-demo-target="review-head" className="text-center">
        <p className="font-display text-ink-950 text-[26px] font-extrabold">
          Review: {DECIDER.home} {DECIDER.homeScore} <span className="text-ink-300">·</span>{" "}
          {DECIDER.awayScore} {DECIDER.away}
        </p>
        <p className="text-ink-500 mt-1 text-[15px] font-semibold">
          {LEAGUE} · {SEASON} · {DECIDER.where} · {DECIDER.when}
        </p>
      </div>

      <div className="border-gold-400 bg-gold-50 mx-auto w-full max-w-[720px] rounded-2xl border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-gold-600 text-[16px] font-bold">
            Referee approval{" "}
            <span className="text-ink-600 font-semibold">(required by this league)</span>
          </p>
          <span className="border-ink-200 flex overflow-hidden rounded-lg border bg-white text-[14px] font-bold">
            <span className="text-ink-500 px-2.5 py-1">Signature</span>
            <span className="bg-gold-100 text-gold-600 px-2.5 py-1">Referee PIN</span>
          </span>
        </div>
        <p className="text-ink-700 mt-2 text-[15px] font-medium leading-snug">
          The assigned referee enters their personal PIN, verified against their account, the
          strongest form of approval.
        </p>
        <div className="border-ink-200 mt-2.5 flex items-center justify-center gap-2 rounded-xl border bg-white px-3 py-2.5">
          {[0, 1, 2, 3].map((d) => (
            <span
              key={d}
              className="bg-ink-100 text-ink-700 flex h-9 w-9 items-center justify-center rounded-lg text-[18px] font-bold"
            >
              •
            </span>
          ))}
        </div>
        <div className="border-court-200 bg-court-50 mt-2.5 flex items-center gap-2 rounded-xl border px-3 py-1.5">
          <span className="bg-court-600 flex h-5 w-5 items-center justify-center rounded-full text-[14px] font-black text-white">
            ✓
          </span>
          <span className="text-court-900 text-[15px] font-semibold">
            Matched: the referee assigned to this game
          </span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[720px] items-center gap-3">
        <span className="text-ink-400 text-[15px] font-semibold">← Back to scoring</span>
        <span className="ml-auto">
          <Btn id="mark-final" tone="court">
            Mark final
          </Btn>
        </span>
      </div>
    </div>
  )
}

/* ── Tiebreakers ─────────────────────────────────────────────────────────── */

function TiebreakersScreen({ shown, locked }: { shown: number; locked: boolean }) {
  return (
    <Shell tab="Settings">
      <Panel
        title="Tiebreaker order"
        action={
          locked ? (
            <Chip tone="court" strong>
              Locked Feb 8, 2027
            </Chip>
          ) : (
            <Btn id="tb-lock" tone="quiet" size="sm">
              Lock for the playoffs
            </Btn>
          )
        }
      >
        <div className="px-4 py-3">
          <p className="text-ink-600 text-[15px] font-medium">
            Used to rank teams with identical records. Applied top-to-bottom until one team wins
            the tiebreaker.
          </p>

          {shown === 0 ? (
            <p data-demo-target="tb-empty" className="text-ink-500 mt-3 text-[16px] font-semibold">
              No tiebreakers configured.
            </p>
          ) : (
            <ol data-demo-target="tb-list" className="mt-3 space-y-1.5">
              {TIEBREAKERS.slice(0, shown).map((t, i) => (
                <li
                  key={t}
                  className="border-court-100 bg-court-50 live-row-in flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2"
                  style={{ animationDelay: `${Math.min(i * 70, 350)}ms` }}
                >
                  <span className="text-ink-900 text-[15px] font-semibold">
                    <span className="text-ink-400 mr-2 font-bold tabular-nums">{i + 1}.</span>
                    {t}
                  </span>
                  <span className="flex items-center gap-3 text-[14px] font-bold">
                    <span className={locked ? "text-ink-300" : "text-ink-500"}>↑</span>
                    <span className={locked ? "text-ink-300" : "text-ink-500"}>↓</span>
                    <span className={locked ? "text-ink-300" : "text-hoop-600"}>Remove</span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {shown < TIEBREAKERS.length && (
            <div className="border-ink-200 mt-4 border-t pt-3">
              <p className="text-ink-600 mb-2 text-[14px] font-bold uppercase tracking-[0.06em]">
                Add a tiebreaker
              </p>
              <div className="flex flex-wrap gap-2">
                {TIEBREAKERS.slice(shown).map((t, i) => (
                  <span
                    key={t}
                    data-demo-target={i === 0 ? `tb-add-${shown + 1}` : undefined}
                    className="border-ink-200 text-ink-700 inline-flex items-center rounded-xl border bg-white px-3.5 py-1.5 text-[14px] font-bold"
                  >
                    + {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </Shell>
  )
}

/* ── The eligibility rule and the roster ─────────────────────────────────── */

function RulesScreen() {
  return (
    <Shell tab="Settings">
      <Panel title="Playoffs" meta="Season rules">
        <div className="grid grid-cols-3 gap-4 px-4 py-4">
          <div>
            <p className="text-ink-700 mb-1.5 text-[15px] font-bold">Playoff format</p>
            <div className="flex flex-wrap gap-1.5">
              {["Single elimination", "Double elimination", "Round robin"].map((f, i) => (
                <span
                  key={f}
                  className={cn(
                    "rounded-full px-3 py-1 text-[14px] font-semibold",
                    i === 0 ? "bg-play-100 text-play-800" : "text-ink-500 bg-ink-50"
                  )}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div data-demo-target="min-games">
            <p className="text-ink-700 mb-1.5 text-[15px] font-bold">
              Minimum games played to be playoff-eligible
            </p>
            <div className="flex items-center gap-2">
              <span className="border-ink-200 flex w-[92px] items-center justify-center rounded-xl border bg-white py-2 text-[22px] font-extrabold tabular-nums">
                {MIN_GAMES}
              </span>
              <Btn size="sm">Save</Btn>
            </div>
            <p className="text-ink-500 mt-2 text-[14px] font-medium leading-snug">
              Leave empty for no rule. Eligibility is computed from the scorekeeper&apos;s
              attendance roll call across completed games; overrule any player from their team page
              (a written note is required).
            </p>
          </div>
          <div>
            <p className="text-ink-700 mb-1.5 text-[15px] font-bold">Games guaranteed</p>
            <span className="border-ink-200 flex w-[92px] items-center justify-center rounded-xl border bg-white py-2 text-[22px] font-extrabold tabular-nums">
              10
            </span>
            <p className="text-ink-500 mt-2 text-[14px] font-medium leading-snug">
              What every club was sold, and what the schedule kept.
            </p>
          </div>
        </div>
      </Panel>
    </Shell>
  )
}

function RosterScreen({
  override,
  ruled,
  note,
}: {
  override: boolean
  ruled: boolean
  note: ReactNode
}) {
  return (
    <Shell tab="Teams">
      <Panel title="MBA" meta={`${DIVISION} · roster submitted, frozen on submission`}>
        <div className="px-3 py-2">
          <table className="w-full table-fixed">
            <thead>
              <tr className="bg-ink-50">
                <Th className="w-[48px]">#</Th>
                <Th>Player</Th>
                <Th className="w-[64px]">Age</Th>
                <Th className="w-[110px]">Position</Th>
                <Th className="w-[62px] text-right" id="gp-col">
                  GP
                </Th>
                <Th className="w-[300px]">Playoffs</Th>
              </tr>
            </thead>
            <tbody>
              {ROSTER.map((p) => {
                const short = p.gp < MIN_GAMES
                const overridden = p.id === "row-short" && ruled
                const eligible = !short || overridden
                return (
                  <tr
                    key={p.name}
                    data-demo-target={p.id}
                    className={cn(
                      "border-ink-100 border-t bg-white transition-colors duration-300 motion-reduce:transition-none",
                      "data-[demo-hover=true]:bg-play-50/60 data-[demo-press=true]:bg-play-50"
                    )}
                  >
                    <td className="text-ink-500 px-3 py-1 text-[14px] font-bold tabular-nums">
                      {p.number}
                    </td>
                    <td className="text-ink-900 px-3 py-1 text-[15px] font-semibold">{p.name}</td>
                    <td className="text-ink-500 px-3 py-1 text-[14px] font-medium">{p.age}</td>
                    <td className="text-ink-500 px-3 py-1 text-[14px] font-medium">{p.position}</td>
                    <td
                      className={cn(
                        "px-3 py-1 text-right text-[15px] font-bold tabular-nums",
                        short ? "text-hoop-600" : "text-ink-900"
                      )}
                    >
                      {p.gp}
                    </td>
                    <td className="px-3 py-1">
                      <span className="flex items-center gap-2">
                        <span
                          key={String(eligible)}
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[14px] font-bold",
                            eligible ? "bg-court-50 text-court-700" : "bg-hoop-50 text-hoop-700",
                            overridden && "live-pop"
                          )}
                        >
                          {eligible ? "eligible" : "not eligible"}
                          {overridden ? " *" : ""}
                        </span>
                        <span className="text-ink-500 truncate text-[14px] font-medium">
                          {overridden
                            ? `league ruling: ${RULING_NOTE}`
                            : `${p.gp} of ${MIN_GAMES} required games`}
                        </span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {override && !ruled && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1628]/35 px-10">
          <div className="border-ink-200 live-pop w-full max-w-[520px] rounded-3xl border bg-white p-5 shadow-[0_50px_120px_-40px_rgba(15,23,42,0.65)]">
            <div className="flex items-center gap-3">
              <p className="text-ink-900 text-[18px] font-bold">{SHORT_PLAYER.name}</p>
              <span className="bg-hoop-50 text-hoop-700 ml-auto rounded-full px-2.5 py-0.5 text-[14px] font-bold">
                not eligible
              </span>
            </div>
            <p className="text-ink-500 mt-1 text-[15px] font-semibold">
              {SHORT_PLAYER.gp} of {MIN_GAMES} required games
            </p>
            <span
              data-demo-target="ruling-note"
              className="border-ink-200 mt-3 flex min-h-[42px] items-center rounded-xl border bg-white px-3 py-2 text-[15px]"
            >
              {note}
            </span>
            <div className="mt-3 flex items-center gap-2">
              <Btn id="rule-eligible" tone="court" size="sm">
                Rule eligible
              </Btn>
              <span className="bg-hoop-600 inline-flex items-center rounded-xl px-3.5 py-1.5 text-[14px] font-bold text-white">
                Rule ineligible
              </span>
              <span className="text-ink-400 ml-auto text-[14px] font-semibold">Close</span>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}

/* ── Playoffs ────────────────────────────────────────────────────────────── */

/**
 * The Playoffs tab, in the two states a 1160 by 600 region can hold honestly.
 *
 * The real tab stacks the config cards ABOVE a bracket that is 47 games wide,
 * so the whole thing is a scrolling page. A scene is a focused region of a
 * page, so the plan beats show the top of it (pooling, the grade card, the fit
 * line, the round strip) and the bracket beats show the board with a one line
 * reminder of what was just configured. Shrinking both into one frame is the
 * shrink this presentation exists to ban.
 */
function PlayoffsScreen({ planned, view }: { planned: boolean; view: string }) {
  const board = view === "tree" || view === "extra"
  return (
    <Shell tab="Playoffs">
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="font-display text-ink-900 text-[19px] font-extrabold uppercase tracking-[0.02em]">
            Playoff plan
          </p>
          <p className="text-ink-500 text-[14px] font-medium">
            The whole playoff schedule is planned now; team names fill in automatically as the
            regular season finishes.
          </p>
        </div>
        <span className="ml-auto shrink-0">
          <Btn id="plan-playoffs" tone="court" size="sm">
            {planned ? "Re-plan the playoffs" : "Plan the playoffs"}
          </Btn>
        </span>
      </div>

      {board ? (
        <>
          <p className="border-ink-200 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-white px-3.5 py-1.5 text-[14px] font-semibold">
            <span className="text-ink-900">{GRADE}</span>
            <span className="text-ink-600">{PLAYOFF_TEAMS} teams, one championship</span>
            <span className="text-ink-600">{PLAYOFF_GAMES} games</span>
            <span className="text-ink-600">everyone plays at least 2</span>
            <span className="text-court-700 ml-auto">{PLAYOFF_WEEKEND}</span>
          </p>
          {view === "extra" ? <ExtraBoard /> : <TreeBoard />}
        </>
      ) : (
        <>
          <div
            data-demo-target="pooling"
            className="border-ink-200 bg-ink-50/60 mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2"
          >
            <p className="text-ink-700 text-[15px] font-medium">
              <span className="text-ink-900 font-bold">{GRADE}</span> runs as 4 divisions; its
              playoffs are
            </p>
            <span className="border-ink-200 flex overflow-hidden rounded-lg border text-[14px] font-bold">
              <span className="bg-play-600 px-2.5 py-1 text-white">one championship</span>
              <span className="text-ink-600 bg-white px-2.5 py-1">a bracket per division</span>
            </span>
          </div>

          <div className="border-ink-200 mt-2 rounded-xl border bg-white px-3.5 py-2.5">
            <p data-demo-target="in-sentence" className="text-ink-900 text-[15px] font-semibold">
              All {PLAYOFF_TEAMS} teams make the playoffs. Everyone plays at least 2 games; champion
              crowned Sunday.
            </p>
            <p className="text-ink-500 mt-0.5 text-[14px] font-medium">
              The top {PLAYOFF_BYES} teams skip round 1.
            </p>
            <p data-demo-target="fit-line" className="text-court-700 mt-0.5 text-[14px] font-bold">
              ✓ {PLAYOFF_FIT}
            </p>
          </div>

          {planned ? (
            <div className="mt-2.5 space-y-2.5">
              <RoundStrip />
              <p className="text-ink-500 text-[14px] font-medium">
                Every one of those games has a time, a gym and a court on the booked weekend, and
                the names fill in as the rounds decide them.
              </p>
            </div>
          ) : (
            <div className="border-ink-300 mt-2.5 rounded-2xl border border-dashed bg-white px-6 py-8 text-center">
              <p className="font-display text-ink-900 text-[19px] font-extrabold uppercase tracking-wide">
                No playoff games yet
              </p>
              <p className="text-ink-500 mx-auto mt-1.5 max-w-[620px] text-[15px] font-medium leading-snug">
                Playoffs are planned once the season is underway. The plan takes your divisions and
                the final standings, and you pick who qualifies, how many games everyone is
                guaranteed, and how brackets pool.
              </p>
            </div>
          )}
        </>
      )}
    </Shell>
  )
}

function RoundStrip() {
  return (
    <div
      data-demo-target="round-strip"
      className="border-ink-200 flex flex-wrap items-center gap-1.5 rounded-xl border bg-white px-3 py-2"
    >
      <span className="text-ink-900 mr-1 text-[15px] font-bold">
        {PLAYOFF_GAMES} games
      </span>
      {ROUNDS.map((r) => (
        <span
          key={r.label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[14px] font-semibold",
            r.label === "Consolation"
              ? "border-play-200 bg-play-50 text-play-700"
              : "border-ink-200 text-ink-700 bg-white"
          )}
        >
          {r.label}
          <span className="text-ink-400 font-bold tabular-nums">{r.games}</span>
        </span>
      ))}
    </div>
  )
}

/* ── The tree ────────────────────────────────────────────────────────────── */

/**
 * The bracket geometry, mirrored from `components/bracket/bracket-tree.tsx` and
 * re-scaled so nothing is under 14px:
 *   · every slot is one row unit, and a slot fed by an in-region game inherits
 *     that game's span;
 *   · a game's centre is the middle of its two slots, so the tree
 *     converges toward the final instead of stacking at the top;
 *   · connectors are SVG elbows in neutral grey on integer pixels.
 */
/* Sized so the whole region (3 columns, the champion node, the section padding
   and the shell gutters) lands inside 1160 with room to spare, and so the tree
   plus its heads and legend land inside 600. Nothing here is under 14px. */
const S = { boxW: 240, gap: 48, row: 56, cardH: 94, teamH: 29, metaH: 20, seedW: 26 }
const CHAMP_W = 190
const LINE = "#d9d9df"

function layout(matches: TreeMatch[]) {
  const byId = new Map(matches.map((m) => [m.id, m]))
  const feeder = (slot: TreeSlot, of: TreeMatch): TreeMatch | null => {
    if (!slot.from) return null
    const f = byId.get(slot.from)
    if (!f || f.tier >= of.tier) return null
    return f
  }
  const spanOf = (m: TreeMatch): number => {
    const h = feeder(m.home, m)
    const a = feeder(m.away, m)
    return (h ? spanOf(h) : 1) + (a ? spanOf(a) : 1)
  }
  const referenced = new Set<string>()
  for (const m of matches) {
    for (const slot of [m.home, m.away]) {
      const f = feeder(slot, m)
      if (f) referenced.add(f.id)
    }
  }
  const roots = matches.filter((m) => !referenced.has(m.id)).sort((a, b) => b.tier - a.tier)
  const center = new Map<string, number>()
  const place = (m: TreeMatch, start: number) => {
    const h = feeder(m.home, m)
    const a = feeder(m.away, m)
    const hs = h ? spanOf(h) : 1
    const as = a ? spanOf(a) : 1
    if (h) place(h, start)
    if (a) place(a, start + hs)
    center.set(m.id, start + (hs + as) / 2)
  }
  let cursor = 0
  for (const r of roots) {
    place(r, cursor)
    cursor += spanOf(r)
  }
  const cols = [...new Set(matches.map((m) => m.tier))].sort((a, b) => a - b)
  const colIndex = new Map(cols.map((t, i) => [t, i]))
  return { center, cols, colIndex, totalSpan: Math.max(cursor, 2), feeder, root: roots[0] ?? null }
}

function TreeBoard() {
  const l = layout(TREE)
  const xOf = (m: TreeMatch) => (l.colIndex.get(m.tier) ?? 0) * (S.boxW + S.gap)
  const midY = (m: TreeMatch) => Math.round((l.center.get(m.id) ?? 0) * S.row)
  const width = (l.cols.length - 1) * (S.boxW + S.gap) + S.boxW + S.gap + CHAMP_W
  const height = l.totalSpan * S.row

  const edges: Array<{ key: string; d: string }> = []
  for (const m of TREE) {
    for (const [side, slot] of [
      ["h", m.home],
      ["a", m.away],
    ] as const) {
      const f = l.feeder(slot, m)
      if (!f) continue
      const x1 = xOf(f) + S.boxW
      const y1 = midY(f)
      const x2 = xOf(m)
      const y2 = midY(m)
      const mid = Math.round(x1 + (x2 - x1) / 2)
      edges.push({
        key: `${m.id}-${side}`,
        d: y1 === y2 ? `M ${x1} ${y1} H ${x2}` : `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`,
      })
    }
  }
  if (l.root) {
    edges.push({
      key: "champ",
      d: `M ${xOf(l.root) + S.boxW} ${midY(l.root)} H ${xOf(l.root) + S.boxW + S.gap}`,
    })
  }

  return (
    <section data-demo-target="tree" className="mt-2">
      {/* The real tab puts the legend on the same line as the unit title. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <SectionHead
          title="Championship bracket"
          blurb="Winners move right. The final decides the banner."
          count={`${PLAYOFF_GAMES - 5 - 1} games`}
        />
        <div className="mb-1.5">
          <Legend />
        </div>
      </div>
      <div className="border-ink-100 bg-ink-50/40 rounded-2xl border p-3">
        <div style={{ width, minWidth: width }}>
          <div className="mb-1.5 flex" style={{ gap: S.gap }}>
            {l.cols.map((tier) => {
              const column = TREE.filter((m) => m.tier === tier)
              return (
                <div key={tier} style={{ width: S.boxW }} className="shrink-0">
                  <p className="text-ink-600 truncate text-[14px] font-bold uppercase tracking-[0.08em]">
                    {column[0].round}
                  </p>
                </div>
              )
            })}
            <div style={{ width: CHAMP_W }} className="shrink-0">
              <p className="text-gold-600 truncate text-[14px] font-bold uppercase tracking-[0.08em]">
                Champion
              </p>
            </div>
          </div>

          <div className="relative" style={{ height }}>
            <svg
              className="pointer-events-none absolute left-0 top-0"
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              aria-hidden="true"
              shapeRendering="crispEdges"
            >
              {edges.map((e) => (
                <path key={e.key} d={e.d} fill="none" stroke={LINE} strokeWidth={1.5} />
              ))}
            </svg>
            {TREE.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                gold={m.round === "Final"}
                ghostId={m.id === "g39" ? "ghost-slot" : undefined}
                style={{
                  position: "absolute",
                  left: xOf(m),
                  top: midY(m) - S.cardH / 2,
                  width: S.boxW,
                }}
              />
            ))}
            {l.root && (
              <div
                style={{
                  position: "absolute",
                  left: xOf(l.root) + S.boxW + S.gap,
                  top: midY(l.root) - S.cardH / 2,
                  width: CHAMP_W,
                  height: S.cardH,
                }}
                className="border-gold-400 bg-gold-50 flex flex-col justify-center rounded-xl border px-3"
              >
                <p className="text-gold-600 text-[14px] font-bold uppercase tracking-[0.1em]">
                  🏆 Champion
                </p>
                <p className="text-ink-500 mt-1 text-[14px] font-semibold">Decided by the final</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </section>
  )
}

/**
 * What hangs off the tree: the bronze game, the consolation round the beaten
 * opening-round teams play the same day, and the opening round itself, which is
 * the only place in this region where real team names and seeds appear (the
 * seeds are known, so the plan resolved them).
 */
function ExtraBoard() {
  return (
    <section className="mt-2 grid grid-cols-3 gap-4">
      <div data-demo-target="third-card">
        <SectionHead
          title="Third place"
          blurb="The two beaten semifinalists play for bronze."
          count="1 game"
        />
        <MatchCard match={THIRD} />
        <p className="text-ink-500 mt-2 text-[14px] font-medium leading-snug">
          Scheduled at the same hour as the final, on the court beside it.
        </p>
      </div>

      <div data-demo-target="consolation">
        <SectionHead
          title="Consolation bracket"
          blurb="Everybody plays: teams knocked out early keep playing on their own tree."
          count="5 games"
        />
        <div className="space-y-2">
          {CONSOLATION.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      </div>

      <div>
        <SectionHead
          title="Opening round"
          blurb="Seeds 23 to 42 open the weekend. The plan calls it the round of 64: 64 slots, 42 teams, 22 byes."
          count="10 games"
        />
        <div className="space-y-2">
          {OPENING.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionHead({
  title,
  blurb,
  count,
}: {
  title: string
  blurb: string
  count: string
}) {
  return (
    <div className="mb-1.5">
      <div className="flex items-baseline gap-2">
        <span aria-hidden="true" className="bg-play-500 inline-block h-3.5 w-1 rounded-full" />
        <h3 className="text-ink-900 text-[15px] font-bold uppercase tracking-[0.1em]">{title}</h3>
        <span className="text-ink-400 text-[14px] font-semibold">{count}</span>
      </div>
      <p className="text-ink-500 mt-0.5 text-[14px] font-medium">{blurb}</p>
    </div>
  )
}

function MatchCard({
  match,
  gold,
  ghostId,
  style,
}: {
  match: TreeMatch
  gold?: boolean
  ghostId?: string
  style?: React.CSSProperties
}) {
  const resolved = !!match.home.team && !!match.away.team
  return (
    <div
      style={{ height: S.cardH, ...style }}
      className={cn(
        "relative overflow-hidden rounded-xl border shadow-[0_2px_6px_-3px_rgba(15,23,42,0.35)]",
        gold
          ? "border-gold-400 bg-gold-50"
          : resolved
            ? "border-ink-200 bg-white"
            : "border-ink-200/80 border-dashed bg-white/85"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          resolved ? "bg-play-400" : "bg-ink-200"
        )}
      />
      <div className="flex h-full flex-col justify-center py-2 pl-3 pr-2">
        <SlotLine slot={match.home} targetId={ghostId} />
        <SlotLine slot={match.away} />
        <p
          className="text-ink-400 flex items-center gap-1.5 truncate text-[14px] font-semibold"
          style={{ height: S.metaH, lineHeight: `${S.metaH}px` }}
        >
          <span className="text-ink-500">{match.code}</span>
          <span className="text-ink-300">·</span>
          <span className="truncate font-medium">{match.when}</span>
        </p>
      </div>
    </div>
  )
}

function SlotLine({ slot, targetId }: { slot: TreeSlot; targetId?: string }) {
  return (
    <div className="flex items-center gap-1.5" style={{ height: S.teamH }}>
      <span
        style={{ width: S.seedW }}
        className={cn(
          "bg-ink-100 text-ink-600 shrink-0 rounded text-center text-[14px] font-bold leading-[20px]",
          slot.seed == null && "opacity-0"
        )}
      >
        {slot.seed ?? ""}
      </span>
      {slot.team ? (
        <span className="text-ink-900 min-w-0 flex-1 truncate text-[15px] font-semibold">
          {slot.team}
        </span>
      ) : (
        <span className="min-w-0 flex-1">
          <span
            data-demo-target={targetId}
            className="border-ink-300 text-ink-500 inline-block max-w-full truncate rounded-md border border-dashed px-2 text-[14px] font-bold uppercase leading-[22px] tracking-wide"
          >
            {slot.ghost ?? "To be decided"}
          </span>
        </span>
      )}
    </div>
  )
}

function Legend() {
  return (
    <p className="text-ink-500 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] font-medium">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="border-ink-200 inline-block h-3 w-3 rounded-sm border bg-white" />
        teams decided
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="border-ink-300 inline-block h-3 w-3 rounded-sm border border-dashed" />
        waiting on an earlier result
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="bg-ink-100 text-ink-600 inline-block h-4 w-5 rounded text-center text-[14px] font-bold leading-[16px]"
        >
          1
        </span>
        seed
      </span>
    </p>
  )
}

/* ── The public league page ──────────────────────────────────────────────── */

function PublicScreen() {
  return (
    <div className="bg-ink-50/70 flex min-h-0 flex-1 flex-col gap-3 px-5 py-3.5">
      <div className="grid grid-cols-[minmax(0,1fr)_420px] gap-3">
        <section className="border-ink-200 overflow-hidden rounded-2xl border bg-white">
          <div className="border-ink-100 flex items-baseline gap-2 border-b px-4 py-2.5">
            <span aria-hidden="true" className="bg-gold-400 inline-block h-3.5 w-1 rounded-full" />
            <h3 className="font-display text-ink-900 text-[17px] font-extrabold uppercase tracking-[0.02em]">
              Standings
            </h3>
            <span className="text-ink-500 text-[14px] font-semibold">{DIVISION}</span>
          </div>
          <table className="w-full table-fixed">
            <thead>
              <tr className="bg-ink-50">
                <Th>Team</Th>
                <Th className="w-[46px] text-center">W</Th>
                <Th className="w-[46px] text-center">L</Th>
                <Th className="w-[64px] text-center">PCT</Th>
                <Th className="w-[52px] text-center">GB</Th>
                <Th className="w-[64px] text-center">STRK</Th>
              </tr>
            </thead>
            <tbody>
              {ROWS_RULED.slice(0, 6).map((r, i) => {
                const leader = ROWS_RULED[0]
                /* The page's own games-back arithmetic, and its own "—" for
                   the leader, which the house copy rule turns into a middot. */
                const gb = (leader.w - r.w + (r.l - leader.l)) / 2
                return (
                  <tr key={r.team} className="border-ink-100 border-t bg-white">
                    <td className="text-ink-900 truncate px-3 py-1.5 text-[15px] font-semibold">
                      {r.team}
                    </td>
                    <td className="text-ink-900 px-3 py-1.5 text-center text-[15px] font-bold tabular-nums">
                      {r.w}
                    </td>
                    <td className="text-ink-600 px-3 py-1.5 text-center text-[15px] tabular-nums">
                      {r.l}
                    </td>
                    <td className="text-ink-600 px-3 py-1.5 text-center text-[15px] tabular-nums">
                      .{String(Math.round((r.w / r.gp) * 1000)).padStart(3, "0")}
                    </td>
                    <td className="text-ink-500 px-3 py-1.5 text-center text-[15px] tabular-nums">
                      {i === 0 ? "·" : gb.toFixed(1).replace(/\.0$/, "")}
                    </td>
                    <td className="text-ink-500 px-3 py-1.5 text-center text-[14px] font-semibold">
                      {STREAKS[r.team] ?? ""}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section data-demo-target="public-news" className="min-w-0">
          <div className="mb-1.5 flex items-baseline gap-2">
            <span aria-hidden="true" className="bg-hoop-400 inline-block h-3.5 w-1 rounded-full" />
            <h3 className="font-display text-ink-900 text-[17px] font-extrabold uppercase tracking-[0.02em]">
              League news
            </h3>
            <span className="text-play-700 ml-auto text-[14px] font-bold">All news →</span>
          </div>
          <article className="border-ink-200 overflow-hidden rounded-2xl border bg-white">
            <div className="bg-[#0b1628] px-4 py-5">
              <p className="text-[14px] font-bold uppercase tracking-[0.14em] text-white/60">
                {LEAGUE} · {SEASON}
              </p>
              <p className="font-display mt-1 text-[26px] font-extrabold leading-none text-white tabular-nums">
                {DECIDER.home} {DECIDER.homeScore} <span className="text-white/40">·</span>{" "}
                {DECIDER.awayScore} {DECIDER.away}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-ink-500 text-[14px] font-bold uppercase tracking-[0.06em]">
                Game recap · Feb 7, 2027
              </p>
              <p className="text-ink-900 mt-1 text-[16px] font-bold leading-snug">{RECAP_TITLE}</p>
              <p className="text-ink-600 mt-1 text-[14px] font-medium leading-snug">{RECAP_BODY}</p>
            </div>
          </article>
        </section>
      </div>
      <p className="text-ink-500 text-[14px] font-medium">
        Every club, every family and anybody with the link reads the same table, from the same
        engine, with no login.
      </p>
    </div>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0b1628] px-12 text-white">
      <div className="live-pop max-w-[780px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A league chapter
        </p>
        <h3 className="font-display mt-2 text-[34px] font-extrabold leading-tight">
          Standings to playoffs
        </h3>
        <p className="mt-3 text-[17px] leading-relaxed text-white/75">
          A forfeit recorded as a forfeit, a final signed at the scorer&apos;s table, a table that
          recalculated itself twice, a rule that decided first place and said so on the row, and 42
          teams who all have a game on Saturday.
        </p>
        <p className="mt-5 text-[15px] font-semibold text-white/50">Next: waivers, start to finish</p>
      </div>
    </div>
  )
}
