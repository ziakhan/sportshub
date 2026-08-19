"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import {
  BracketLegend,
  BracketTree,
  sectionizeBracket,
  type BracketMatch,
  type BracketSection,
} from "@/components/bracket"
import { NewsCard } from "@/components/ui/news-card"
import { SectionHeader } from "@/components/ui/section-header"
import { StandingsTable } from "@/components/ui/standings-table"
import { TypeText } from "../motion"
import type { DemoBeat, DemoScript } from "../types"

/**
 * "Standings to playoffs", rebuilt to the realism standard (mock-ui.tsx R1–R8)
 * on 2026-08-19, over the cut the owner drove on 2026-08-16.
 *
 * WHAT THE 08-16 CUT GOT RIGHT AND KEEPS: every number is engine output over
 * the seeded NPH Showcase "End of Season" world, written down with its working
 * in `docs/roadmap/playoffs-numbers.md`. The story is the same story: a forfeit
 * recorded honestly, a final signed at the scorer's table, a tie decided by a
 * written rule, who is allowed to play, and a bracket with every team in it.
 *
 * WHAT CHANGED: FIDELITY. The 08-16 cut drew those screens on `scene-kit.tsx`,
 * a 14px-floor kit authored before R1. Every screen below is now the REAL
 * component's markup at the product's own sizes, and every flow runs to its
 * real end state.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited).
 * Console paths are under `app/(platform)/manage/leagues/[id]/seasons/[seasonId]`:
 *
 *   · the console shell is `manage/page.tsx`: the SmartBack line, the floated
 *     "Waiver signing status →", the condensed uppercase h1 carrying the SEASON
 *     label, the league name under it, the status Badge, the "Season checklist"
 *     button that shows on every tab but Overview, and the flat nine-tab row
 *     with the play-600 underline. Same shell the season story films;
 *   · Standings is `manage/components/standings-tab.tsx`: PanelHeader +
 *     Refresh, its sentence "Computed on read from completed games. Ties are
 *     broken in the order configured under Settings › Rules.", the condensed
 *     division heading, and the eleven-column table inside its own
 *     `rounded-xl border border-ink-100` scroller, at the tab's real
 *     text-xs/[10px] type with the font-mono rank and differential;
 *   · Schedule is `manage/components/schedule-tab.tsx` GamesTable: PanelHeader
 *     with the List/Board switch and the count pill, the collapsed game row
 *     (date, teams with the ink-400 "vs", venue · court, status Badge through
 *     `toneForStatus`, the caret), and the expanded action strip in the
 *     product's own order with its own tones: Box score ↗, Pin in place, Find
 *     alternates (play), Forfeit: home and Forfeit: away (amber), Cancel game
 *     (hoop). The confirm carries the button's exact sentence;
 *   · the scorer's table is `components/scoring/scoring-console.tsx` on the bare
 *     `(scoring)` layout: the centred "Review: {home} {score} · {score} {away}",
 *     the amber approval panel with "Referee approval (required by this
 *     league)", the Signature / Referee PIN switch, the named referee chip and
 *     the PIN field, then "← Back to scoring" beside the court-600 "Mark
 *     final", and the REAL finalized screen: "Final", the 3xl scoreline, and
 *     the two play-600 links to the scoresheet and the public box score;
 *   · Settings is `manage/components/settings-tab.tsx`: the status strip of
 *     section chips with their real hints (Rules reads "Tiebreakers needed
 *     before finalizing" until they exist), the numbered SectionHeading, and
 *     inside section 6 the three panels `rules-settings.tsx` renders in order:
 *     Playoffs (format ChipGroup, teams advancing, the minimum-games field with
 *     its Save and its [10px] helper), `game-day-policies.tsx`, and
 *     `tiebreakers-tab.tsx` (its sentence, its six options in its own order,
 *     its ↑ ↓ Remove row, and its "+ label" add chips);
 *   · the team page is `teams/[submissionId]/page.tsx`: the header with its
 *     status and payment Badges, the "Roster (N)" panel with the real
 *     no-roster-submitted line this world would print, the table with GP titled
 *     "from the scorekeeper's attendance roll call", and `eligibility-action.tsx`
 *     as it really is: the lowercase Badge IS the control, and the ruling is a
 *     w-72 popover under it with "N of M required games", the required "Ruling
 *     note (required)…" field, and Rule eligible / Rule ineligible / Close;
 *   · Playoffs is `manage/components/playoffs-tab.tsx`: "Playoff plan" with
 *     "Plan the playoffs" beside it, its blurb, the grade-pooling row with its
 *     two words, the grade card's four sentences, the court-700 result line the
 *     POST writes, the grade tab, the Bracket / Schedule switch, and both
 *     views: the bracket is `components/bracket` itself, imported and rendered,
 *     not a copy of it, so the tree, the elbows, the dashed ghosts carrying
 *     "Winner of G35", the maple backdrop and the gold champion node are the
 *     product's own; the schedule view is the tab's own day tables;
 *   · the public page is `(public)/league/[id]/page.tsx`, rendering the real
 *     `SectionHeader`, the real `StandingsTable` (Team, W, L, PCT, GB, STRK,
 *     leader row in highlight-soft) and the real `NewsCard`.
 *
 * DELIBERATE DEPARTURES, ALL DECLARED:
 *   · NO LOCK BEAT. The 08-16 cut pressed a "Lock for the playoffs" button.
 *     That button does not exist: `tiebreakersLockedAt` is set by
 *     `api/seasons/[id]/route.ts` when the season is FINALIZED, and the tab
 *     only ever RENDERS the lock as a Badge. The demo therefore never locks
 *     anything; the balloon says what the product really does instead.
 *   · NO ROUND STRIP, NO INVENTED "GAMES GUARANTEED" CARD. Both were drawn by
 *     the old cut; the Playoffs tab and the Rules panel draw neither. The 47
 *     games are stated where the product states them: the result line, the
 *     bracket's own column heads and the schedule view.
 *   · COMPOSITION, not invention. The pane is 1160x600 and these pages are
 *     taller, so long screens scroll inside it exactly as they do in a browser,
 *     the bracket scrolls sideways inside its own scroller the way the real one
 *     does, the games list is filmed at the window holding the last weekend
 *     (the real list is the season's 780 committed games, and its count says
 *     so), and the console header's margins are tightened from mb-6 to fit 600
 *     logical. The season story makes the same three compressions.
 *   · The console's Tiebreakers column and the public table's GB print an
 *     em-dash when nothing applies; the house copy rule bans that character, so
 *     both print a middot. Same substitution the numbers sheet declares.
 *   · The review screen carries no box score and no Player of the Game panel:
 *     this world has zero scoring events, so both would be invented (numbers
 *     sheet E7).
 *
 * INVENTED-CONTENT LEDGER (everything not read from the world):
 *   · THE FORFEIT. `DEFAULTED` is real end to end, but no game in the seeded
 *     world is defaulted, so ONE real game is recorded as a forfeit rather than
 *     played: YvY Elite versus Vaughan Panthers, Feb 6. It moves four cells and
 *     nothing else, not one place in the order and not one of the 42 seeds
 *     (numbers sheet section C);
 *   · THE ELIGIBILITY FLOOR. The four-game floor is the owner's standard. The
 *     setting, the roll-call source, the badge and the written ruling are all
 *     real product, but this world has zero attendance events and no season
 *     rosters, so the ten players and their game counts are staged, as every
 *     roster in every demo is (real rosters are minors). Nothing in the product
 *     ENFORCES the floor either; both are punch items, section E1;
 *   · the team page's applied date and its waiver columns are not printed,
 *     because this world does not hold them;
 *   · the plan result line is scoped to the grade on screen; the real POST
 *     plans every grade at once (section D5).
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
const CTX_TABLE = "Scorer's table · MBA vs Burloak Elite (PRIME)"
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
  {
    team: "Vaughan Panthers",
    gp: 10,
    w: 7,
    l: 3,
    pf: 573,
    pa: 527,
    tb: "HEAD_TO_HEAD",
    id: "row-vaughan",
  },
  { team: "MBA", gp: 10, w: 7, l: 3, pf: 640, pa: 571, tb: "HEAD_TO_HEAD", id: "row-mba" },
  {
    team: "Toronto Top Tier East",
    gp: 10,
    w: 6,
    l: 4,
    pf: 692,
    pa: 636,
    tb: "HEAD_TO_HEAD, POINT_DIFFERENTIAL",
    id: "row-cluster",
  },
  {
    team: "Retro Elite",
    gp: 10,
    w: 6,
    l: 4,
    pf: 598,
    pa: 600,
    tb: "HEAD_TO_HEAD, POINT_DIFFERENTIAL",
  },
  { team: "Hooptrotters OGs", gp: 10, w: 6, l: 4, pf: 659, pa: 583, tb: "HEAD_TO_HEAD" },
  { team: "Alpha Elite", gp: 10, w: 6, l: 4, pf: 620, pa: 623, tb: "HEAD_TO_HEAD" },
  { team: "Eurostep Basketball", gp: 10, w: 5, l: 5, pf: 653, pa: 675, tb: "POINTS_SCORED" },
  { team: "Burloak Elite (PRIME)", gp: 10, w: 5, l: 5, pf: 642, pa: 664, tb: "POINTS_SCORED" },
  { team: "Ottawa Elite (incl. Prep)", gp: 10, w: 4, l: 6, pf: 664, pa: 673 },
  { team: "Royal Crown", gp: 10, w: 2, l: 8, pf: 629, pa: 706 },
  { team: "YvY Elite", gp: 10, w: 1, l: 9, pf: 508, pa: 620 },
]

/** `tiebreakers-tab.tsx` TIEBREAKER_OPTIONS, in the file's own order. */
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
/** `DB` the referee assigned to that game's crew. */
const REFEREE = "Mike Ferreira"

/** The window of the committed-games list the demo films: the division's three
 *  games on the last weekend of the regular season. */
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
/** `DB` committed games in the season: what the count pill really reads. */
const SEASON_GAMES = 780

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
  { number: "11", name: "M. Rahim", age: 15, position: "Guard", gp: 3, id: "row-short" },
  { number: "12", name: "D. Mensah", age: 16, position: "Centre", gp: 6 },
  { number: "15", name: "L. Nguyen", age: 15, position: "Forward", gp: 5 },
  { number: "21", name: "C. Okafor", age: 16, position: "Forward", gp: 4 },
  { number: "23", name: "R. Patel", age: 15, position: "Guard", gp: 7 },
  { number: "33", name: "N. Achebe", age: 15, position: "Centre", gp: 2 },
]
const SHORT_PLAYER = ROSTER.find((p) => p.id === "row-short")!
const RULING_NOTE = "Broken wrist in December, cleared by the club doctor"

/* ── The playoff plan, straight off the stored plan ──────────────────────── */

const PLAYOFF_TEAMS = 42
const PLAYOFF_GAMES = 47
const PLAYOFF_PLACEHOLDERS = 31
const PLAYOFF_BYES = 22
const PLAYOFF_WEEKEND = "Tier 2 Finals · Feb 27-28"
/** `playoffs-tab.tsx` renders `d.preview.fit.text` after a court-700 check. */
const PLAYOFF_FIT = `${PLAYOFF_GAMES} games · fits ${PLAYOFF_WEEKEND} (84 of 162 slots with the other grades)`

/**
 * The readable REGION of the real Grade 10 tree, as `BracketMatch`es fed to the
 * product's own `sectionizeBracket` and `BracketTree`: both quarterfinals that
 * feed the top semifinal, that semifinal, the final, the bronze game and two of
 * the five consolation games. Codes, rounds, tiers, ghost references and
 * kick-off times are the stored plan's own (numbers sheet D3).
 *
 * Slots whose `from` points outside the region (G27, G40, G1) resolve to
 * nothing, which is exactly how the real tree draws a game whose feeder is off
 * in another column: a dashed ghost with no line into it.
 */
const PLAN_GAMES: BracketMatch[] = [
  {
    id: "g35",
    code: "G35",
    round: "Quarterfinal",
    tier: 3,
    whenLabel: "Sun, Feb 28, 1:45 p.m.",
    home: { kind: "WINNER", from: "g27", ghostLabel: "Winner of G27" },
    away: { kind: "WINNER", from: "g28", ghostLabel: "Winner of G28" },
  },
  {
    id: "g36",
    code: "G36",
    round: "Quarterfinal",
    tier: 3,
    whenLabel: "Sun, Feb 28, 1:45 p.m.",
    home: { kind: "WINNER", from: "g29", ghostLabel: "Winner of G29" },
    away: { kind: "WINNER", from: "g30", ghostLabel: "Winner of G30" },
  },
  {
    id: "g39",
    code: "G39",
    round: "Semifinal",
    tier: 4,
    whenLabel: "Sun, Feb 28, 4:15 p.m.",
    home: { kind: "WINNER", from: "g35", ghostLabel: "Winner of G35" },
    away: { kind: "WINNER", from: "g36", ghostLabel: "Winner of G36" },
  },
  {
    id: "g46",
    code: "G46",
    round: "Final",
    tier: 5,
    whenLabel: "Sun, Feb 28, 6:45 p.m.",
    home: { kind: "WINNER", from: "g39", ghostLabel: "Winner of G39" },
    away: { kind: "WINNER", from: "g40", ghostLabel: "Winner of G40" },
  },
  {
    id: "g47",
    code: "G47",
    round: "3rd place",
    tier: 5,
    whenLabel: "Sun, Feb 28, 6:45 p.m.",
    home: { kind: "LOSER", from: "g39", ghostLabel: "Loser of G39" },
    away: { kind: "LOSER", from: "g40", ghostLabel: "Loser of G40" },
  },
  {
    id: "g41",
    code: "G41",
    round: "Consolation",
    tier: 1,
    whenLabel: "Sat, Feb 27, 4:15 p.m.",
    home: { kind: "LOSER", from: "g1", ghostLabel: "Loser of G1" },
    away: { kind: "LOSER", from: "g2", ghostLabel: "Loser of G2" },
  },
  {
    id: "g42",
    code: "G42",
    round: "Consolation",
    tier: 1,
    whenLabel: "Sat, Feb 27, 5:30 p.m.",
    home: { kind: "LOSER", from: "g3", ghostLabel: "Loser of G3" },
    away: { kind: "LOSER", from: "g4", ghostLabel: "Loser of G4" },
  },
]

const SECTIONS: BracketSection[] = sectionizeBracket(PLAN_GAMES)
const sectionByKey = (key: string) => SECTIONS.find((s) => s.key === key) ?? null

/**
 * The Schedule view of the same plan: the tab groups the weekend's games by
 * day and prints time, round and the two labels, dimming a game whose teams
 * are not decided. Rounds are the generator's own words, which is why the
 * opening round reads "Round of 64" here and "Opening round" as a column head
 * (`roundLabel` in bracket-tree.tsx renames it). Numbers sheet D3.
 */
const PLAN_DAYS: Array<{ day: string; games: Array<{ at: string; round: string; teams: string; resolved: boolean }> }> = [
  {
    day: "Saturday, Feb 27",
    games: [
      {
        at: "10:00 a.m.",
        round: "Round of 64",
        teams: "Brotherhood Elite||FEIA (Fort Erie)",
        resolved: true,
      },
      {
        at: "10:00 a.m.",
        round: "Round of 64",
        teams: "Dragons de Gatineau (GAME SPEAKS)||Wiggins Elite",
        resolved: true,
      },
      { at: "4:15 p.m.", round: "Consolation", teams: "Loser of G1||Loser of G2", resolved: false },
      { at: "5:30 p.m.", round: "Consolation", teams: "Loser of G3||Loser of G4", resolved: false },
    ],
  },
  {
    day: "Sunday, Feb 28",
    games: [
      {
        at: "1:45 p.m.",
        round: "Quarterfinal",
        teams: "Winner of G27||Winner of G28",
        resolved: false,
      },
      {
        at: "1:45 p.m.",
        round: "Quarterfinal",
        teams: "Winner of G29||Winner of G30",
        resolved: false,
      },
      {
        at: "4:15 p.m.",
        round: "Semifinal",
        teams: "Winner of G35||Winner of G36",
        resolved: false,
      },
      { at: "6:45 p.m.", round: "Final", teams: "Winner of G39||Winner of G40", resolved: false },
      { at: "6:45 p.m.", round: "3rd place", teams: "Loser of G39||Loser of G40", resolved: false },
    ],
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
 * Human pace (owner 2026-08-19), the same function the converted your-week and
 * season stories use: a beat holds for the cursor's travel, plus long enough to
 * read the balloon at about 140ms a word, plus a settle. People click, then
 * click again; long reads are only bought where a balloon earns one.
 */
function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
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
        "The table is worked out from the completed games the moment it is opened, not by a job that runs overnight.",
      set: { screen: "standings", table: "sat" },
    }),
    /* Engine law: `set` applies at beat START, so a press that also swaps the
       screen deletes its own target. Every press below is its own beat and the
       landing is the next one. */
    paced({
      id: "to-schedule",
      chapter: "weekend",
      caption: "One of the two is never played.",
      cursor: "tab-schedule",
      press: true,
    }),
    paced({
      id: "schedule",
      chapter: "weekend",
      caption: "The last weekend of the regular season, in the committed games.",
      context: CTX_SCHEDULE,
      set: { screen: "schedule" },
      emphasize: "row-yvy",
    }),
    paced({
      id: "open-row",
      chapter: "weekend",
      caption: "YvY Elite cannot field a team on Saturday night.",
      cursor: "row-yvy",
      press: true,
    }),
    paced({
      id: "row-open",
      chapter: "weekend",
      caption: "Everything the league can do to a game is on the game.",
      set: { open: true },
      emphasize: "row-actions",
    }),
    paced({
      id: "forfeit",
      chapter: "weekend",
      caption: "A forfeit by the home team.",
      cursor: "forfeit-home",
      press: true,
    }),
    paced({
      id: "forfeit-dialog",
      chapter: "weekend",
      caption: "The confirmation names what it will do to the table.",
      set: { dialog: "forfeit" },
      emphasize: "confirm-forfeit",
      callout: "The league records the forfeit on the game, and never edits a standings row.",
    }),
    paced({
      id: "forfeit-ok",
      chapter: "weekend",
      caption: "Recorded.",
      cursor: "confirm-forfeit",
      press: true,
    }),
    paced({
      id: "forfeited",
      chapter: "weekend",
      caption: "The row carries it: DEFAULTED, and no score.",
      set: { dialog: "", forfeited: true },
      emphasize: "row-yvy",
    }),
    paced({
      id: "forfeit-table",
      chapter: "weekend",
      caption: "Vaughan take the win, YvY take the loss, and both points columns stand still.",
      context: CTX_STANDINGS,
      set: { screen: "standings", table: "forfeit", open: false },
      emphasize: "row-vaughan",
      callout: "A defaulted game is credited zero to zero, so nobody's differential moves.",
    }),
    paced({
      id: "review",
      chapter: "weekend",
      caption: "Sunday night, and the game that decides first place is at the review screen.",
      context: CTX_TABLE,
      set: { screen: "review" },
      emphasize: "approval",
      callout: "The PIN is checked against the assigned referee's own account.",
    }),
    paced({
      id: "mark-final",
      chapter: "weekend",
      caption: "Mark final.",
      cursor: "mark-final",
      press: true,
    }),
    paced({
      id: "final",
      chapter: "weekend",
      caption: "Signed at the table, and official from here.",
      set: { finalized: true },
      emphasize: "final-card",
      callout: "That one press writes the box score, publishes the recap and moves the table.",
    }),
    paced({
      id: "settled",
      chapter: "weekend",
      caption: "The table has already moved, and every row is at ten games.",
      context: CTX_STANDINGS,
      set: { screen: "standings", table: "final" },
      emphasize: "row-mba",
    }),

    /* ── 2. The rule that decides ─────────────────────────────────────── */
    paced({
      id: "tie",
      chapter: "rule",
      caption: "Two teams finished seven and three, and the Tiebreakers column is empty.",
      emphasize: "tb-col",
      callout: "With nothing configured, teams on the same record sit in win-percentage order.",
    }),
    paced({
      id: "to-settings",
      chapter: "rule",
      caption: "The rules live in one place.",
      cursor: "tab-settings",
      press: true,
    }),
    paced({
      id: "tiebreakers",
      chapter: "rule",
      caption: "This league has no tiebreakers written down.",
      context: `${CTX_RULES}`,
      set: { screen: "settings", scroll: 470, order: 0 },
      emphasize: "tb-empty",
    }),
    paced({
      id: "add-h2h",
      chapter: "rule",
      caption: "Head-to-head first.",
      cursor: "tb-add-1",
      press: true,
    }),
    paced({
      id: "h2h",
      chapter: "rule",
      caption: "Added, and it can be moved or removed until the season is finalized.",
      set: { order: 1 },
      emphasize: "tb-list",
      callout: "Head-to-head reads only the games those two teams played against each other.",
    }),
    paced({
      id: "add-rest",
      chapter: "rule",
      caption: "Then the ladder under it, applied top to bottom until one team wins.",
      set: { order: 6, scroll: 540 },
      emphasize: "tb-list",
    }),
    paced({
      id: "locks",
      chapter: "rule",
      caption: "Six rules, ending in one that always answers.",
      emphasize: "tb-list",
      callout:
        "The order locks itself when the season is finalized, so nobody rewrites it while it is placing teams.",
    }),
    paced({
      id: "reread",
      chapter: "rule",
      caption: "The table re-reads itself, and Vaughan hold first place.",
      context: CTX_STANDINGS,
      set: { screen: "standings", table: "ruled" },
      emphasize: "row-vaughan",
      callout: "They met once, in October, and Vaughan won it by four.",
    }),
    paced({
      id: "cluster",
      chapter: "rule",
      caption: "Four teams finished six and four, and every row names the rule that placed it.",
      emphasize: "row-cluster",
      callout: "Two rules on a row means head-to-head left them level and the next one separated them.",
    }),

    /* ── 3. Who can play ──────────────────────────────────────────────── */
    paced({
      id: "floor",
      chapter: "who",
      caption: "Then the question of who is allowed to play.",
      context: `${CTX_RULES}`,
      set: { screen: "settings", scroll: 0 },
      emphasize: "min-games",
      callout: "Four games of ten, written down before the playoffs rather than argued during them.",
    }),
    paced({
      id: "roster",
      chapter: "who",
      caption: "Games played come from the scorekeeper's roll call.",
      context: CTX_TEAM,
      set: { screen: "roster" },
      emphasize: "gp-col",
      callout: "Attendance is taken at the start of every scored game, and that record is the count.",
    }),
    paced({
      id: "short",
      chapter: "who",
      caption: `One player is short. ${SHORT_PLAYER.name} broke a wrist in December.`,
      cursor: "row-short-badge",
      press: true,
    }),
    paced({
      id: "popover",
      chapter: "who",
      caption: "The badge is the control: the league can overrule it either way.",
      set: { override: true },
      emphasize: "ruling-note",
    }),
    paced({
      id: "note",
      chapter: "who",
      caption: "The note is required.",
      type: { key: "note", text: RULING_NOTE },
      emphasize: "ruling-note",
      callout: "Neither button will save until a reason is written.",
    }),
    paced({
      id: "rule-eligible",
      chapter: "who",
      caption: "Ruled in.",
      cursor: "rule-eligible",
      press: true,
    }),
    paced({
      id: "ruled",
      chapter: "who",
      caption: "The star marks a ruling, and the reason stays on her record.",
      set: { ruled: true, override: false },
      emphasize: "row-short",
    }),

    /* ── 4. Everybody plays ───────────────────────────────────────────── */
    /* No tab press here: the story is on the team PAGE, which is its own route
       and carries no console tabs, so a press would have nothing to hit. */
    paced({
      id: "playoffs",
      chapter: "bracket",
      caption: `${GRADE} runs as four divisions all season, and one championship at the end.`,
      context: CTX_PLAYOFFS,
      set: { screen: "playoffs", scroll: 0 },
      emphasize: "pooling",
    }),
    paced({
      id: "everyone",
      chapter: "bracket",
      caption: `All ${PLAYOFF_TEAMS} teams make the playoffs, and everyone plays at least twice.`,
      emphasize: "in-sentence",
    }),
    paced({
      id: "fit",
      chapter: "bracket",
      caption: "Checked against the gym time that is actually booked.",
      emphasize: "fit-line",
    }),
    paced({
      id: "plan",
      chapter: "bracket",
      caption: "One press plans the whole weekend.",
      cursor: "plan-playoffs",
      press: true,
    }),
    paced({
      id: "planned",
      chapter: "bracket",
      caption: `${PLAYOFF_GAMES} games planned, ${PLAYOFF_PLACEHOLDERS} of them still waiting on names.`,
      set: { planned: true },
      emphasize: "plan-msg",
    }),
    paced({
      id: "tree",
      chapter: "bracket",
      caption: "This is the bracket the league gets, and the one every club sees.",
      set: { scroll: 400 },
      emphasize: "tree",
    }),
    paced({
      id: "ghost",
      chapter: "bracket",
      caption: "Nothing is guessed at: an undecided slot says which game decides it.",
      set: { treeX: 230 },
      emphasize: "tree",
      callout: "When G35 is signed, that name fills itself in and the final is one game closer.",
    }),
    paced({
      id: "consolation",
      chapter: "bracket",
      caption: "The teams beaten on Saturday morning are already scheduled again.",
      set: { scroll: 940 },
      emphasize: "consolation",
    }),
    paced({
      id: "to-sched-view",
      chapter: "bracket",
      caption: "The same plan, as a schedule.",
      set: { scroll: 210 },
      cursor: "view-schedule",
      press: true,
    }),
    paced({
      id: "sched-view",
      chapter: "bracket",
      caption: "Two days, and every game already has a time.",
      set: { view: "schedule", scroll: 380 },
      emphasize: "sched-list",
      callout: "These slots are booked now, so no club waits on the semifinals to know when it plays.",
    }),
    paced({
      id: "public",
      chapter: "bracket",
      caption: "The public page carries the settled table.",
      context: CTX_PUBLIC,
      set: { screen: "public", scroll: 0 },
      emphasize: "public-table",
    }),
    paced({
      id: "public-news",
      chapter: "bracket",
      caption: "And the recap of the game that decided it.",
      set: { scroll: 400 },
      emphasize: "public-news",
      callout: "Same engine, same rows, and the recap was written the moment the sheet was signed.",
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
          {screen === "standings" && <StandingsScreen state={get<string>("table", "sat")} />}
          {screen === "schedule" && (
            <ScheduleScreen open={get("open", false)} forfeited={get("forfeited", false)} />
          )}
          {screen === "review" && <ReviewScreen finalized={get("finalized", false)} />}
          {screen === "settings" && (
            <SettingsScreen shown={get("order", 0)} scroll={scroll} />
          )}
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
            <PlayoffsScreen
              planned={get("planned", false)}
              view={get<string>("view", "bracket")}
              scroll={scroll}
              treeX={get("treeX", 0)}
            />
          )}
          {screen === "public" && <PublicScreen scroll={scroll} />}
        </div>

        {/* `schedule-tab.tsx` guards the forfeit with window.confirm; the scene
            has no browser chrome to hang a native sheet on, so it is drawn as
            the product's own dialog with the confirm's exact sentence. */}
        <ConfirmDialog
          open={dialog === "forfeit"}
          title={FORFEIT_CONFIRM}
          confirmId="confirm-forfeit"
        />

        {get("endCard", false) && <EndCard />}
      </div>
    )

    return { desktop }
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
  variant?: "solid" | "subtle"
  className?: string
}) {
  const solid =
    tone === "court"
      ? "bg-court-600 text-white"
      : tone === "hoop"
        ? "bg-hoop-600 text-white"
        : "bg-play-600 text-white"
  return (
    <span
      data-demo-target={id}
      className={cn(
        "inline-flex shrink-0 cursor-default items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-shadow duration-150 data-[demo-press=true]:shadow-inner data-[demo-press=true]:brightness-95 motion-reduce:transition-none",
        variant === "solid" && solid,
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

const TABS: Array<{ label: string; id?: string }> = [
  { label: "Overview" },
  { label: "Clubs" },
  { label: "Teams" },
  { label: "Plan Your Season" },
  { label: "Schedule", id: "tab-schedule" },
  { label: "Standings", id: "tab-standings" },
  { label: "Playoffs", id: "tab-playoffs" },
  { label: "Referees" },
  { label: "⚙ Settings", id: "tab-settings" },
]

function Console({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col px-6 py-3">
      <div className="flex shrink-0 items-baseline justify-between">
        <p className="text-ink-500 text-sm font-medium">&larr; {LEAGUE}</p>
        <p className="text-play-700 text-sm font-medium">Waiver signing status &rarr;</p>
      </div>
      <div className="mt-1 flex shrink-0 items-start justify-between gap-4">
        <div>
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase leading-none tracking-wide">
            {SEASON}
          </h1>
          <p className="text-ink-500 mt-1 text-sm">{LEAGUE}</p>
          <Badge className="mt-2" tone="play">
            In Progress
          </Badge>
        </div>
        <Button variant="subtle">Season checklist</Button>
      </div>
      <div className="border-ink-100 mt-3 flex shrink-0 flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <span
            key={t.label}
            data-demo-target={t.id}
            className={cn(
              "relative -mb-px whitespace-nowrap px-3 py-2.5 text-sm font-semibold",
              t.label === tab ? "text-play-600" : "text-ink-500",
              "data-[demo-hover=true]:text-ink-800"
            )}
          >
            {t.label}
            {t.label === tab && (
              <span className="bg-play-600 absolute inset-x-2 -bottom-px h-0.5 rounded-full" />
            )}
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1 pt-4">{children}</div>
    </div>
  )
}

/* ── Standings (`manage/components/standings-tab.tsx`) ───────────────────── */

function StandingsScreen({ state }: { state: string }) {
  const rows =
    state === "ruled"
      ? ROWS_RULED
      : state === "final"
        ? ROWS_FINAL
        : state === "forfeit"
          ? ROWS_FORFEIT
          : ROWS_SAT
  return (
    <Console tab="Standings">
      {/* The panel is its natural height and the PAGE scrolls, exactly as the
          browser does it: the eleventh row sits under the fold at 600 logical,
          it is not squeezed out of the table. */}
      <Pane offset={0}>
      <div className={cn(PANEL, "p-5")}>
        <PanelHeader
          className="mb-1"
          title="Standings"
          action={<Button variant="subtle">Refresh</Button>}
        />
        <p className="text-ink-500 mb-3 text-xs">
          Computed on read from completed games. Ties are broken in the order configured under
          Settings &rsaquo; Rules.
        </p>
        <h4 className="font-condensed text-ink-800 mb-2 text-sm font-bold uppercase tracking-wide">
          {DIVISION}
        </h4>
        <div
          data-demo-target="table"
          className="border-ink-100 overflow-hidden rounded-xl border"
        >
          <table className="text-ink-700 w-full text-xs">
            <thead className="bg-ink-50 text-ink-500 text-[10px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-1.5 text-left">#</th>
                <th className="px-3 py-1.5 text-left">Team</th>
                <th className="px-3 py-1.5 text-right">GP</th>
                <th className="px-3 py-1.5 text-right">W</th>
                <th className="px-3 py-1.5 text-right">L</th>
                <th className="px-3 py-1.5 text-right">T</th>
                <th className="px-3 py-1.5 text-right">PF</th>
                <th className="px-3 py-1.5 text-right">PA</th>
                <th className="px-3 py-1.5 text-right">Diff</th>
                <th className="px-3 py-1.5 text-right">Win%</th>
                <th data-demo-target="tb-col" className="px-3 py-1.5 text-left">
                  Tiebreakers
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const diff = r.pf - r.pa
                return (
                  <tr
                    key={r.team}
                    data-demo-target={r.id}
                    className="border-ink-100 border-t transition-colors data-[demo-hover=true]:bg-ink-50/60"
                  >
                    <td className="text-ink-400 px-3 py-1.5 font-mono text-[10px]">{i + 1}</td>
                    <td className="text-ink-900 px-3 py-1.5 font-medium">{r.team}</td>
                    <td className="px-3 py-1.5 text-right">{r.gp}</td>
                    <td className="px-3 py-1.5 text-right">{r.w}</td>
                    <td className="px-3 py-1.5 text-right">{r.l}</td>
                    <td className="px-3 py-1.5 text-right">0</td>
                    <td className="px-3 py-1.5 text-right">{r.pf}</td>
                    <td className="px-3 py-1.5 text-right">{r.pa}</td>
                    <td
                      className={cn(
                        "px-3 py-1.5 text-right font-mono text-[11px]",
                        diff > 0 ? "text-court-700" : diff < 0 ? "text-hoop-600" : "text-ink-500"
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {Math.round((r.w / r.gp) * 100)}%
                    </td>
                    {/* The real column prints an em-dash when nothing applied;
                        the house copy rule turns that into a middot. */}
                    <td className="text-ink-500 px-3 py-1.5 text-[10px]">{r.tb ?? "·"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      </Pane>
    </Console>
  )
}

/* ── Schedule tab, and the forfeit ───────────────────────────────────────── */

/**
 * `schedule-tab.tsx` GamesTable. The season's committed games are one list of
 * 780 rows behind "Show all games"; the pane is filmed at the window holding
 * the division's last weekend, and the count pill carries the real total.
 */
function ScheduleScreen({ open, forfeited }: { open: boolean; forfeited: boolean }) {
  return (
    <Console tab="Schedule">
      <div className={cn(PANEL, "p-5")}>
        <PanelHeader
          className="mb-3"
          title="Committed games"
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
                {SEASON_GAMES}
              </span>
            </span>
          }
        />
        <div className="space-y-2">
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
      </div>
    </Console>
  )
}

/**
 * One row of the games list and its expansion, `schedule-tab.tsx` lines 1037
 * to 1141: the collapsed line, the status Badge through `toneForStatus`
 * (DEFAULTED is hoop, SCHEDULED is play), and the action strip in the
 * product's own order and tones.
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
  return (
    <div
      data-demo-target={id}
      className="border-ink-100 rounded-xl border bg-white transition-colors data-[demo-hover=true]:border-ink-300"
    >
      <div className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <span className="text-ink-700 whitespace-nowrap">{when}</span>
          <span className="text-ink-900 font-medium">
            {home} <span className="text-ink-400">vs</span> {away}
          </span>
          <span className="text-ink-500">
            {venue} · {court}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={status === "DEFAULTED" ? "hoop" : "play"}>{status}</Badge>
          <span className="text-ink-400 text-[10px]">{open ? "▴" : "▾"}</span>
        </div>
      </div>
      {open && (
        <div className="border-ink-100 border-t px-3 py-3 text-xs">
          <div data-demo-target="row-actions" className="flex flex-wrap items-center gap-2">
            <span className="border-ink-200 text-ink-700 rounded-lg border px-2 py-1 text-[11px] font-semibold">
              Box score ↗
            </span>
            <span className="border-ink-200 text-ink-700 rounded-lg border px-2 py-1 text-[11px] font-semibold">
              Pin in place
            </span>
            <span className="border-play-300 text-play-700 rounded-lg border px-2 py-1 text-[11px] font-semibold">
              Find alternates
            </span>
            <span
              data-demo-target="forfeit-home"
              className="border-amber-300 text-amber-700 rounded-lg border px-2 py-1 text-[11px] font-semibold data-[demo-press=true]:bg-amber-50"
            >
              Forfeit: home
            </span>
            <span className="border-amber-300 text-amber-700 rounded-lg border px-2 py-1 text-[11px] font-semibold">
              Forfeit: away
            </span>
            <span className="border-hoop-300 text-hoop-700 rounded-lg border px-2 py-1 text-[11px] font-semibold">
              Cancel game
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── The scorer's table (`components/scoring/scoring-console.tsx`) ───────── */

/**
 * The review screen on the bare `(scoring)` layout. No box score and no Player
 * of the Game panel: this world has zero scoring events, so both tables would
 * be empty in the product and inventing player lines is the one thing R1
 * forbids (numbers sheet E7).
 */
function ReviewScreen({ finalized }: { finalized: boolean }) {
  if (finalized) {
    return (
      <div className="bg-ink-50 flex min-h-0 flex-1 items-center justify-center">
        <div data-demo-target="final-card" className="live-pop mx-auto max-w-lg p-8 text-center">
          <h2 className="text-ink-900 text-xl font-bold">Final</h2>
          <p className="text-ink-900 mt-2 text-3xl font-bold">
            {DECIDER.home} {DECIDER.homeScore} · {DECIDER.awayScore} {DECIDER.away}
          </p>
          <div className="mt-4 flex justify-center gap-4">
            <span className="text-play-600 text-sm font-semibold">
              Official scoresheet (print) &rarr;
            </span>
            <span className="text-play-600 text-sm font-semibold">Public box score &rarr;</span>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="bg-ink-50 flex min-h-0 flex-1 flex-col justify-center">
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
        <h2 className="text-ink-950 text-center text-lg font-bold">
          Review: {DECIDER.home} {DECIDER.homeScore} · {DECIDER.awayScore} {DECIDER.away}
        </h2>
        <p className="text-ink-500 text-center text-xs">
          {LEAGUE} · {SEASON} · {DECIDER.where} · {DECIDER.when}
        </p>

        <div
          data-demo-target="approval"
          className="border-amber-300 bg-amber-50 rounded-xl border p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-amber-800 text-[13px] font-semibold">
              Referee approval (required by this league)
            </p>
            <div className="flex rounded-lg bg-white p-0.5">
              <span className="text-ink-500 rounded-md px-2.5 py-1 text-[11px] font-semibold">
                Signature
              </span>
              <span className="bg-amber-100 text-amber-900 rounded-md px-2.5 py-1 text-[11px] font-semibold">
                Referee PIN
              </span>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {/* The product joins the clause with an em-dash; house copy takes
                a comma. */}
            <p className="text-ink-600 text-sm">
              The assigned referee enters their personal PIN, verified against their account, the
              strongest form of approval.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="border-amber-500 bg-amber-100 text-amber-900 rounded-lg border px-2.5 py-1.5 text-xs font-semibold">
                {REFEREE}
              </span>
            </div>
            <span className="border-amber-300 text-ink-400 block w-full rounded-lg border bg-white px-3 py-2 text-sm">
              ● ● ● ●
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <span className="border-ink-200 text-ink-700 flex-1 rounded-xl border px-4 py-3 text-center text-sm font-semibold">
            &larr; Back to scoring
          </span>
          <span
            data-demo-target="mark-final"
            className="bg-court-600 flex-1 rounded-xl px-4 py-3 text-center text-sm font-bold text-white data-[demo-press=true]:brightness-95"
          >
            Mark final
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── Settings › Rules (`settings-tab.tsx` + `rules-settings.tsx`) ────────── */

const SETTINGS_CHIPS = [
  { label: "Basics", hint: "Set", ok: true },
  { label: "Divisions", hint: "10 divisions", ok: true },
  { label: "Registration", hint: "Closed", ok: true },
  { label: "Game format", hint: "Set", ok: true },
  { label: "Sessions & rounds", hint: "7 sessions", ok: true },
]

function SettingsScreen({ shown, scroll }: { shown: number; scroll: number }) {
  const rulesOk = shown > 0
  return (
    <Console tab="⚙ Settings">
      <Pane offset={scroll}>
        <div className="space-y-6 pb-8">
          <div className="flex flex-wrap gap-2">
            {SETTINGS_CHIPS.map((c) => (
              <span
                key={c.label}
                className="border-court-200 bg-court-50 text-court-700 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
              >
                <span>✓</span>
                {c.label}
                <span className="font-normal">· {c.hint}</span>
              </span>
            ))}
            <span
              data-demo-target="rules-chip"
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                rulesOk
                  ? "border-court-200 bg-court-50 text-court-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              )}
            >
              <span>{rulesOk ? "✓" : "!"}</span>
              Rules
              <span className="font-normal">
                · {rulesOk ? "Tiebreakers set" : "Tiebreakers needed before finalizing"}
              </span>
            </span>
          </div>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-condensed text-ink-950 text-lg font-bold uppercase tracking-wide">
                <span className="text-ink-300 mr-1.5">6.</span>
                Rules
              </h2>
              {rulesOk ? (
                <span className="text-court-600 text-sm font-bold">✓</span>
              ) : (
                <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                  needs attention
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div className={PANEL}>
                <PanelHeader title="Playoffs" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-ink-700 mb-1 text-xs font-medium">Playoff format</p>
                    <div className="flex flex-wrap gap-2">
                      {["None / TBD", "Single Elimination"].map((f, i) => (
                        <span
                          key={f}
                          className={cn(
                            "inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 text-sm font-semibold",
                            i === 1
                              ? "border-play-600 bg-play-600 text-white shadow-sm"
                              : "border-ink-200 text-ink-700 bg-white"
                          )}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-ink-700 mb-1 text-xs font-medium">
                      Teams advancing to playoffs
                    </p>
                    <span className="border-ink-200 text-ink-900 block rounded-xl border px-2 py-1.5 text-sm">
                      42
                    </span>
                  </div>
                  <div data-demo-target="min-games">
                    <p className="text-ink-700 mb-1 text-xs font-medium">
                      Minimum games played to be playoff-eligible
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="border-ink-200 text-ink-900 w-24 rounded-xl border px-2 py-1.5 text-sm">
                        {MIN_GAMES}
                      </span>
                      <span className="bg-play-600 rounded-lg px-3 py-1.5 text-sm font-semibold text-white">
                        Save
                      </span>
                    </div>
                    <p className="text-ink-400 mt-1 text-[10px]">
                      Leave empty for no rule. Eligibility is computed from the scorekeeper&apos;s
                      attendance roll call across completed games; overrule any player from their
                      team page (a written note is required).
                    </p>
                  </div>
                </div>
                <p className="text-ink-500 mt-3 text-xs">
                  Brackets are generated on the Playoffs tab once the season is underway.
                </p>
              </div>

              <div className="border-ink-100 shadow-soft mt-4 rounded-2xl border bg-white p-4">
                <h3 className="text-ink-900 text-sm font-bold uppercase tracking-wide">
                  Game-day policies
                </h3>
                <label className="text-ink-700 mt-2 flex items-start gap-2 text-sm">
                  <span className="border-ink-300 mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border bg-white text-[9px] font-black text-play-700">
                    ✓
                  </span>
                  <span>
                    Allow guest players
                    <span className="text-ink-400 block text-xs">
                      A scorekeeper can add a pickup player (name and jersey only) to a single game
                      when a team is short. Guests are labeled &quot;(Guest)&quot; in the box score,
                      never count in official season stats or leaderboards, and never join a roster.
                    </span>
                  </span>
                </label>
              </div>

              <TiebreakersPanel shown={shown} />
            </div>
          </section>
        </div>
      </Pane>
    </Console>
  )
}

/** `manage/components/tiebreakers-tab.tsx`, verbatim. */
function TiebreakersPanel({ shown }: { shown: number }) {
  return (
    <div className={PANEL}>
      <PanelHeader className="mb-1" title="Tiebreaker order" />
      <p className="text-ink-500 mb-4 text-xs">
        Used to rank teams with identical records. Applied top-to-bottom until one team wins the
        tiebreaker.
      </p>

      {shown > 0 ? (
        <ol data-demo-target="tb-list" className="space-y-2">
          {TIEBREAKERS.slice(0, shown).map((t, i) => (
            <li
              key={t}
              className="border-court-100 bg-court-50 live-row-in flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition-colors"
              style={{ animationDelay: `${Math.min(i * 70, 350)}ms` }}
            >
              <span className="text-ink-900">
                <span className="text-ink-400 mr-2 font-mono text-xs">{i + 1}.</span>
                {t}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-ink-500 text-xs">↑</span>
                <span className="text-ink-500 text-xs">↓</span>
                <span className="text-xs text-red-500">Remove</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p data-demo-target="tb-empty" className="text-ink-500 text-sm">
          No tiebreakers configured.
        </p>
      )}

      <div className="border-ink-200 mt-4 border-t pt-4">
        <p className="text-ink-600 mb-2 text-xs font-medium">Add a tiebreaker</p>
        <div className="flex flex-wrap gap-2">
          {TIEBREAKERS.slice(shown).map((t, i) => (
            <span
              key={t}
              data-demo-target={i === 0 ? `tb-add-${shown + 1}` : undefined}
              className="border-ink-200 text-ink-700 rounded-full border px-3 py-1 text-xs data-[demo-press=true]:border-play-300 data-[demo-press=true]:text-play-700"
            >
              + {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── The team page (`teams/[submissionId]/page.tsx`) ─────────────────────── */

const SUB_PANEL = "border-ink-100 shadow-soft rounded-2xl border bg-white p-4"
const SUB_H2 = "text-ink-900 mb-2 text-sm font-bold uppercase tracking-wide"

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
    <div className="mx-auto flex h-full w-full min-h-0 max-w-5xl flex-col gap-3 p-5">
      <div className="shrink-0">
        <p className="text-ink-500 text-sm font-medium">
          &larr; {LEAGUE} · {SEASON}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-ink-900 text-2xl font-bold">MBA</h1>
          <Badge tone="court">approved</Badge>
          <Badge tone="court">paid</Badge>
        </div>
        <p className="text-ink-500 mt-1 text-sm">
          MBA · {DIVISION} · <span className="text-play-600">public page &rarr;</span>
        </p>
      </div>

      <div className={cn(SUB_PANEL, "min-h-0 flex-1")}>
        <h2 className={cn(SUB_H2, "mb-1")}>Roster ({ROSTER.length})</h2>
        <p className="text-ink-500 mb-3 text-xs">
          No roster submitted yet · showing the club&apos;s current roster.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ink-400 border-ink-100 border-b text-left text-xs uppercase">
              <th className="py-1.5 pr-2">#</th>
              <th className="py-1.5 pr-2">Player</th>
              <th className="py-1.5 pr-2">Age</th>
              <th className="py-1.5 pr-2">Position</th>
              <th data-demo-target="gp-col" className="py-1.5 pr-2">
                GP
              </th>
              <th className="py-1.5 pr-2">Playoffs</th>
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
                  className="border-ink-50 border-b last:border-0"
                >
                  <td className="text-ink-500 py-1.5 pr-2">{p.number}</td>
                  <td className="text-ink-900 py-1.5 pr-2 font-medium">{p.name}</td>
                  <td className="text-ink-500 py-1.5 pr-2">{p.age}</td>
                  <td className="text-ink-500 py-1.5 pr-2">{p.position}</td>
                  <td className="text-ink-700 py-1.5 pr-2 font-medium">{p.gp}</td>
                  <td className="py-1.5 pr-2">
                    <span className="relative inline-flex items-center gap-1">
                      <span
                        data-demo-target={p.id === "row-short" ? "row-short-badge" : undefined}
                        key={String(eligible)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ring-1 ring-inset",
                          eligible ? BADGE_TONES.court : BADGE_TONES.danger,
                          overridden && "live-pop"
                        )}
                      >
                        {eligible ? "eligible" : "not eligible"}
                        {overridden ? " *" : ""}
                      </span>
                      {p.id === "row-short" && override && (
                        <RulingPopover note={note} />
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** `eligibility-action.tsx`: the w-72 popover under the badge, verbatim. */
function RulingPopover({ note }: { note: ReactNode }) {
  return (
    <div className="border-ink-200 live-pop absolute left-0 top-7 z-40 w-72 rounded-xl border bg-white p-3 shadow-lg">
      <p className="text-ink-900 text-xs font-bold">{SHORT_PLAYER.name}</p>
      <p className="text-ink-500 mt-0.5 text-xs">
        {SHORT_PLAYER.gp} of {MIN_GAMES} required games
      </p>
      <span
        data-demo-target="ruling-note"
        className="border-ink-200 mt-2 flex min-h-[30px] w-full items-center rounded-lg border px-2 py-1.5 text-xs"
      >
        {note}
      </span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          data-demo-target="rule-eligible"
          className="bg-court-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-white data-[demo-press=true]:brightness-95"
        >
          Rule eligible
        </span>
        <span className="bg-hoop-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-white">
          Rule ineligible
        </span>
        <span className="text-ink-400 px-1 py-1 text-xs">Close</span>
      </div>
    </div>
  )
}

/* ── Playoffs (`manage/components/playoffs-tab.tsx`) ─────────────────────── */

function PlayoffsScreen({
  planned,
  view,
  scroll,
  treeX,
}: {
  planned: boolean
  view: string
  scroll: number
  treeX: number
}) {
  const championship = sectionByKey("championship")
  const third = sectionByKey("third")
  const consolation = sectionByKey("consolation")
  return (
    <Console tab="Playoffs">
      <Pane offset={scroll}>
        <div className={cn(PANEL, "pb-8")}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <PanelHeader title="Playoff plan" />
            <Button id="plan-playoffs">Plan the playoffs</Button>
          </div>
          <p className="text-ink-500 -mt-2 mb-3 text-xs">
            The whole playoff schedule is planned now; team names fill in automatically as the
            regular season finishes.
          </p>

          <div
            data-demo-target="pooling"
            className="border-ink-100 bg-ink-50/50 mb-3 space-y-2 rounded-xl border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-ink-700 text-xs">
                <span className="text-ink-900 font-semibold">{GRADE}</span> runs as 4 divisions; its
                playoffs are
              </p>
              <div className="border-ink-200 inline-flex overflow-hidden rounded-lg border text-xs">
                <span className="bg-play-600 px-2.5 py-1 font-semibold text-white">
                  one championship
                </span>
                <span className="text-ink-600 bg-white px-2.5 py-1 font-semibold">
                  a bracket per division
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="border-ink-100 rounded-xl border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-ink-900 text-sm font-semibold">{GRADE}</p>
                  <p data-demo-target="in-sentence" className="text-ink-700 mt-0.5 text-xs">
                    All {PLAYOFF_TEAMS} teams make the playoffs. Everyone plays at least 2 games;
                    champion crowned Sunday.
                  </p>
                  <p className="text-ink-500 mt-0.5 text-xs">
                    The top {PLAYOFF_BYES} teams skip round 1.
                  </p>
                  <p data-demo-target="fit-line" className="text-court-700 mt-0.5 text-xs font-semibold">
                    ✓ {PLAYOFF_FIT}
                  </p>
                </div>
                <span className="text-play-600 text-xs font-semibold">Change</span>
              </div>
            </div>
          </div>

          {planned ? (
            <>
              <p data-demo-target="plan-msg" className="text-court-700 mt-3 text-xs font-semibold">
                {PLAYOFF_GAMES} playoff games planned. {PLAYOFF_PLACEHOLDERS} show placeholders
                until the regular season decides the teams.
              </p>
              <div className="border-ink-100 mt-4 flex flex-wrap gap-1 border-b pb-2">
                <span className="bg-play-600 rounded-lg px-3 py-1.5 text-xs font-bold text-white">
                  {GRADE}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="border-ink-100 inline-flex overflow-hidden rounded-lg border text-xs">
                  <span
                    className={cn(
                      "px-3 py-1 font-semibold",
                      view === "bracket" ? "bg-play-600 text-white" : "text-ink-600 bg-white"
                    )}
                  >
                    Bracket
                  </span>
                  <span
                    data-demo-target="view-schedule"
                    className={cn(
                      "px-3 py-1 font-semibold",
                      view === "schedule" ? "bg-play-600 text-white" : "text-ink-600 bg-white"
                    )}
                  >
                    Schedule
                  </span>
                </div>
              </div>

              {view === "schedule" ? (
                <PlanSchedule />
              ) : (
                <div className="mt-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-ink-900 text-xs font-bold uppercase tracking-[0.14em]">
                      {GRADE}
                    </p>
                    <BracketLegend />
                  </div>
                  {/* The product's own board: `components/bracket`, imported
                      rather than copied, so the tree, the elbows, the dashed
                      ghosts and the champion node are the real ones. */}
                  <div className="min-w-0 space-y-5">
                    {championship && (
                      <BracketScroll x={treeX}>
                        <div data-demo-target="tree">
                          <BracketTree section={championship} />
                        </div>
                      </BracketScroll>
                    )}
                    {third && (
                      <div data-demo-target="third">
                        <BracketTree section={third} />
                      </div>
                    )}
                    {consolation && (
                      <div data-demo-target="consolation">
                        <BracketTree section={consolation} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
          {/* Before a plan exists the tab shows exactly this and no more: the
              grade cards, and nothing where the board will be. */}
        </div>
      </Pane>
    </Console>
  )
}

/**
 * The bracket's own scroller is inside `BracketTree` (overflow-x-auto), which
 * is exactly how an operator reaches the later rounds. The demo drives that
 * same scroller rather than shrinking the tree to fit.
 */
function BracketScroll({ x, children }: { x: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const region = box.current?.querySelector<HTMLElement>('[role="region"]')
    region?.scrollTo({ left: x, behavior: "smooth" })
  }, [x])
  return <div ref={box}>{children}</div>
}

/** The tab's Schedule view: one block per weekend, one table per day. */
function PlanSchedule() {
  return (
    <div data-demo-target="sched-list" className="mt-4 space-y-4">
      <p className="text-ink-900 mb-1 text-xs font-bold uppercase tracking-wide">
        {PLAYOFF_WEEKEND}
      </p>
      {PLAN_DAYS.map((d) => (
        <div key={d.day} className="mb-2">
          <p className="text-ink-500 mb-1 text-[11px] font-semibold">{d.day}</p>
          <table className="w-full text-xs">
            <tbody>
              {d.games.map((g, i) => {
                const [home, away] = g.teams.split("||")
                return (
                  <tr key={`${g.at}-${i}`} className="border-ink-50 border-b">
                    <td className="text-ink-500 whitespace-nowrap py-1 pr-2">{g.at}</td>
                    <td className="text-ink-500 py-1 pr-2">{g.round}</td>
                    <td className={cn("py-1", g.resolved ? "text-ink-900 font-semibold" : "text-ink-400")}>
                      {home} <span className="text-ink-300 font-normal">vs</span> {away}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/* ── The public league page (`(public)/league/[id]/page.tsx`) ────────────── */

function PublicScreen({ scroll }: { scroll: number }) {
  const leader = ROWS_RULED[0]
  return (
    <div className="bg-white">
      <Pane offset={scroll}>
        <div className="mx-auto w-full max-w-[820px] space-y-10 px-4 py-6 pb-16">
          <section>
            <SectionHeader title="Standings" accent="gold" className="mb-5" />
            <div className="grid grid-cols-1 gap-6">
              <div>
                <h3 className="text-ink-950 mb-2 px-1 text-sm font-bold uppercase tracking-wide">
                  {DIVISION}
                </h3>
                <div data-demo-target="public-table">
                  <StandingsTable
                    rows={ROWS_RULED.slice(0, 6).map((r, i) => ({
                      rank: i + 1,
                      name: r.team,
                      wins: r.w,
                      losses: r.l,
                      pct: r.w / r.gp,
                      gamesBack:
                        i === 0
                          ? "·"
                          : ((leader.w - r.w + (r.l - leader.l)) / 2).toFixed(1).replace(/\.0$/, ""),
                      streak: STREAKS[r.team],
                    }))}
                  />
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader
              title="League news"
              accent="hoop"
              className="mb-5"
              action={<span className="text-play-600 text-sm font-semibold">All news &rarr;</span>}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div data-demo-target="public-news">
                <NewsCard
                  title={RECAP_TITLE}
                  excerpt={RECAP_BODY}
                  dateLabel="Feb 7, 2027"
                  author="Game recap"
                />
              </div>
            </div>
          </section>
        </div>
      </Pane>
    </div>
  )
}

/* ── The confirm, and the end card ───────────────────────────────────────── */

function ConfirmDialog({
  open,
  title,
  confirmId,
}: {
  open: boolean
  title: string
  confirmId: string
}) {
  if (!open) return null
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1628]/45 px-8">
      <div className="live-pop w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-[0_40px_90px_-40px_rgba(15,23,42,0.7)]">
        <h4 className="text-ink-950 text-base font-semibold leading-snug">{title}</h4>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="subtle">Cancel</Button>
          <Button id={confirmId} tone="court">
            OK
          </Button>
        </div>
      </div>
    </div>
  )
}

function EndCard() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b1628] px-10 text-white">
      <div className="live-pop max-w-[560px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A league chapter
        </p>
        <h3 className="font-display mt-2 text-[30px] font-extrabold leading-tight">
          Standings to playoffs
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          A forfeit recorded as a forfeit, a final signed at the scorer&apos;s table, a table that
          recalculated itself twice, a rule that decided first place and said so on the row, and 42
          teams who all have a game on Saturday.
        </p>
        <p className="mt-4 text-[14px] font-semibold text-white/50">Next: waivers, start to finish</p>
      </div>
    </div>
  )
}
