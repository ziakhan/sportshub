"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Crest } from "@/components/ui/crest"
import { PlayerMug } from "@/components/ui/player-mug"
import { TypeText } from "../motion"
import { MockBand, MockButton, MockEndCard, MockPill, MockTopBar } from "../mock-ui"
import type { DemoScript } from "../types"

/**
 * Chapter 9: "Standings to playoffs" (owner-signed script, 2026-08-15).
 *
 * THE ARGUMENT. The end of a season is where amateur leagues lose their
 * credibility. Two teams finish level, somebody rings somebody, a rule gets
 * remembered differently by each club, and a kid who played every week finds
 * out on the Thursday that she is not in the playoff roster. This chapter is
 * about a league that can answer all three questions on screen: who is ahead,
 * why, and who is allowed to play.
 *
 * THE PAINFUL DETAIL (owner's law, named for this chapter): ELIGIBILITY IS
 * SETTLED BY THE ATTENDANCE ROLL CALL, NOT BY MEMORY. The scorekeeper takes
 * attendance at the start of every scored game, that record is what counts
 * games played, and the minimum is a number the league set in writing. When a
 * commissioner overrules it, the product demands a written note first, and the
 * note is stored as the ruling. The demo stops on a player who is one game
 * short with a broken wrist, because that is the case every league actually
 * argues about.
 *
 * TRUTH TO THE PRODUCT. Every surface mirrors one that ships today:
 *   · the result — components/scoring/scoring-console.tsx: the review screen
 *     "Review: {home} {score} — {score} {away}", the "Referee approval" panel
 *     with its Signature and Referee PIN modes and the line about a PIN being
 *     verified against the referee's account, and "Mark final". There is no
 *     FINAL status in the schema: a finalized game is COMPLETED, which is
 *     exactly what the standings engine consumes;
 *   · the table — manage/.../components/standings-tab.tsx: the columns #,
 *     Team, GP, W, L, T, PF, PA, Diff, Win% and Tiebreakers, and the sentence
 *     under the title, "Computed on read from completed games. Ties are broken
 *     in the order configured under Settings › Rules.";
 *   · the tiebreakers — tiebreakers-tab.tsx: "Used to rank teams with
 *     identical records. Applied top-to-bottom until one team wins the
 *     tiebreaker.", and the six options in the league's own order. The coin
 *     flip is deterministic in lib/standings/compute.ts, so a re-run never
 *     changes an answer;
 *   · the eligibility — rules-settings.tsx "Minimum games played to be
 *     playoff-eligible" with its helper text, lib/seasons/games-played.ts, and
 *     eligibility-action.tsx: the lowercase "eligible" and "not eligible"
 *     badges, "N of M required games", the required "Ruling note (required)…"
 *     and the buttons "Rule eligible" and "Rule ineligible";
 *   · the bracket — playoffs-tab.tsx: "Playoff plan", the qualifier and
 *     guarantee sentences, "Plan the playoffs" with its sub copy, the Bracket,
 *     Consolations and Schedule views, the legend "White = teams decided ·
 *     gray = waiting on an earlier result · the small number is the seed", the
 *     "🏆 Champion" and "3rd place" labels, and the round names from
 *     lib/playoffs/formats.ts.
 *
 * TWO SCRIPT CORRECTIONS THE PRODUCT FORCED (2026-08-15):
 *   1. The brief asked for movement arrows in the standings. The table has no
 *      movement column, on purpose: a standings sheet states where you are,
 *      not where you were. Movement in this product is a CARD, published by
 *      detectAndPublishStandingsMovement() when a final changes the order, and
 *      that is what families actually see. So the demo moves the row and lands
 *      the card, rather than drawing an arrow the product does not have.
 *   2. The brief asked for a publish beat. Playoff games are written with
 *      publishedAt stamped at creation (lib/playoffs/generate.ts), so there is
 *      nothing to publish afterwards: pressing "Plan the playoffs" IS the
 *      announcement, and the public league page has the bracket the same
 *      second. The demo shows that instead of inventing a second button.
 *
 * MOTION. One fixed window. The table reorders in place, the badge flips where
 * it stands, and the bracket fills column by column rather than the camera
 * travelling along it.
 */

/* ── Cast ────────────────────────────────────────────────────────────────── */

const LEAGUE = "Metro West Youth Basketball"
const SEASON = "Fall 2026"
const DIVISION = "U11 Girls Rep · East"
const CLUB = "Riverside Ravens"
const OPPONENT = "Lakeshore Lightning"

const URL_SCORE = "/games/ravens-lightning-nov-14/score"
const URL_STANDINGS = "/manage/leagues/metro-west/seasons/fall-2026/manage?tab=standings"
const URL_TEAM = "/manage/leagues/metro-west/seasons/fall-2026/teams/riverside-u11g"
const URL_PLAYOFFS = "/manage/leagues/metro-west/seasons/fall-2026/manage?tab=playoffs"
const URL_PUBLIC = "/league/metro-west"

interface StandRow {
  team: string
  gp: number
  w: number
  l: number
  pf: number
  pa: number
  tiebreak?: string
}

/** Before the Ravens game is finalized: they have played seven. */
const BEFORE: StandRow[] = [
  { team: OPPONENT, gp: 8, w: 7, l: 1, pf: 342, pa: 268 },
  { team: "Northside Nets", gp: 8, w: 6, l: 2, pf: 301, pa: 285 },
  { team: CLUB, gp: 7, w: 5, l: 2, pf: 276, pa: 241 },
  { team: "Harbourfront Heat", gp: 8, w: 5, l: 3, pf: 296, pa: 288 },
  { team: "Parkdale Panthers", gp: 8, w: 4, l: 4, pf: 282, pa: 291 },
  { team: "Etobicoke Eagles", gp: 8, w: 3, l: 5, pf: 271, pa: 302 },
  { team: "Scarborough Storm", gp: 8, w: 2, l: 6, pf: 258, pa: 311 },
  { team: "Weston Wolves", gp: 8, w: 1, l: 7, pf: 244, pa: 288 },
]

/** After: level on record with the Nets, ahead on the second tiebreaker. */
const AFTER: StandRow[] = [
  { team: OPPONENT, gp: 8, w: 7, l: 1, pf: 342, pa: 268 },
  { team: CLUB, gp: 8, w: 6, l: 2, pf: 318, pa: 279, tiebreak: "H2H 1-1 · diff +39" },
  { team: "Northside Nets", gp: 8, w: 6, l: 2, pf: 301, pa: 285, tiebreak: "H2H 1-1 · diff +16" },
  { team: "Harbourfront Heat", gp: 8, w: 5, l: 3, pf: 296, pa: 288 },
  { team: "Parkdale Panthers", gp: 8, w: 4, l: 4, pf: 282, pa: 291 },
  { team: "Etobicoke Eagles", gp: 8, w: 3, l: 5, pf: 271, pa: 302 },
  { team: "Scarborough Storm", gp: 8, w: 2, l: 6, pf: 258, pa: 311 },
  { team: "Weston Wolves", gp: 8, w: 1, l: 7, pf: 244, pa: 288 },
]

const TIEBREAKERS = [
  "Head-to-head record",
  "Point differential",
  "Points scored",
  "Points allowed (fewest)",
  "Total wins",
  "Coin flip (last resort)",
]

interface RosterRow {
  number: string
  name: string
  gp: number
}

const ROSTER: RosterRow[] = [
  { number: "23", name: "Amara Bello", gp: 5 },
  { number: "7", name: "Priya Nair", gp: 8 },
  { number: "11", name: "Jada Okafor", gp: 7 },
  { number: "4", name: "Mia Chen", gp: 6 },
  { number: "15", name: "Sofia Rossi", gp: 4 },
  { number: "9", name: "Hannah Kaur", gp: 8 },
  { number: "21", name: "Leah Nguyen", gp: 5 },
  { number: "3", name: "Zoe Adeyemi", gp: 2 },
]

const MIN_GAMES = 5

export const playoffsStory: DemoScript = {
  desktopUrl: URL_SCORE,
  initialStage: "desktop",
  chapters: [
    { id: "table", title: "The table tells the truth" },
    { id: "who", title: "Who qualifies" },
    { id: "bracket", title: "The bracket builds itself" },
  ],

  beats: [
    /* ── 1. The table tells the truth ─────────────────────────────────── */
    {
      id: "review",
      chapter: "table",
      caption:
        "The last game of the regular season is at the review screen, where the table checks the sheet before anybody calls it a result.",
      hold: 3400,
      url: URL_SCORE,
      set: { screen: "review" },
    },
    {
      id: "mark-final",
      chapter: "table",
      caption:
        "The referee signs it, by drawn signature or by the PIN tied to their own account, and only then does the button do anything.",
      hold: 3200,
      cursor: "mark-final",
      press: true,
    },
    {
      id: "final",
      chapter: "table",
      caption:
        "One press writes the box score, stamps the game complete, and sets off everything downstream without anybody chasing it.",
      hold: 3200,
      set: { finalized: true },
      toast: "Riverside Ravens 42, Lakeshore Lightning 38",
    },
    {
      id: "standings",
      chapter: "table",
      caption:
        "The standings are not a nightly job that might not have run. They are worked out from completed games at the moment you look.",
      hold: 3600,
      url: URL_STANDINGS,
      set: { screen: "standings" },
    },
    {
      id: "moved",
      chapter: "table",
      caption:
        "So the table has already moved. Second place, on the last Saturday, off the back of a four point win.",
      hold: 3600,
      set: { moved: true },
    },
    {
      id: "card",
      chapter: "table",
      caption:
        "And because families do not sit refreshing a standings page, the move goes out as a card. That is where movement lives in this product, not as an arrow in a column.",
      hold: 3600,
      set: { movementCard: true },
    },
    {
      id: "tie",
      chapter: "table",
      caption:
        "Two teams finished six and two, which is where most seasons start arguing. Here the row shows its own working.",
      hold: 3600,
      cursor: "tie-row",
      hover: "tie-row",
    },
    {
      id: "rules",
      chapter: "table",
      caption:
        "They split their two meetings, so head to head settles nothing and the next rule takes over. The order was set before a ball was thrown, and the last resort is a coin flip that always lands the same way, so re-running it never changes an answer.",
      hold: 4000,
      set: { rules: true },
    },

    /* ── 2. Who qualifies ─────────────────────────────────────────────── */
    {
      id: "roster",
      chapter: "who",
      caption:
        "Then the question nobody wants to ask on the Thursday before playoffs: who is actually allowed to play.",
      hold: 3400,
      url: URL_TEAM,
      set: { screen: "roster", rules: false, movementCard: false },
    },
    {
      id: "rule",
      chapter: "who",
      caption:
        "This league wrote down a minimum of five games, and games played come from the scorekeeper's roll call at the start of every scored game. Not from a coach's memory in February.",
      hold: 3800,
      cursor: "min-games",
      hover: "min-games",
    },
    {
      id: "short",
      chapter: "who",
      caption:
        "Two players are short. One of them broke her wrist in October and has been at every practice since.",
      hold: 3600,
      cursor: "row-rossi",
      press: true,
    },
    {
      id: "override",
      chapter: "who",
      caption:
        "The league can overrule it in either direction, and the product will not let them do it silently: the note is required, and the note is the ruling.",
      hold: 3800,
      set: { override: true },
      type: { key: "note", text: "Broken wrist, cleared by the club doctor" },
    },
    {
      id: "ruled",
      chapter: "who",
      caption:
        "Ruled in, with the reason attached to her name for anybody who asks later. The other one stays out, and that is a decision somebody made rather than a thing that happened.",
      hold: 3600,
      cursor: "rule-eligible",
      press: true,
      set: { ruled: true },
      toast: "Ruling saved",
    },

    /* ── 3. The bracket builds itself ─────────────────────────────────── */
    {
      id: "playoffs",
      chapter: "bracket",
      caption:
        "The playoff plan is written as sentences, not as a form. Read it aloud and you have told the parents everything they need.",
      hold: 3600,
      url: URL_PLAYOFFS,
      set: { screen: "playoffs", override: false },
    },
    {
      id: "guarantee",
      chapter: "bracket",
      caption:
        "The line that matters to a family driving ninety minutes: everyone plays at least two. Losing on Saturday morning does not end your weekend.",
      hold: 3600,
      cursor: "guarantee",
      hover: "guarantee",
    },
    {
      id: "fit",
      chapter: "bracket",
      caption:
        "And it is checked against the weekend that is actually booked, in court hours, before anybody is promised anything.",
      hold: 3400,
    },
    {
      id: "plan-press",
      chapter: "bracket",
      caption: "One press.",
      hold: 2600,
      cursor: "plan-playoffs",
      press: true,
    },
    {
      id: "built",
      chapter: "bracket",
      caption:
        "Fourteen games, seeded off the table you just watched settle, with the rounds named the way people say them out loud.",
      hold: 3800,
      set: { planned: true },
      toast: "14 playoff games planned",
    },
    {
      id: "legend",
      chapter: "bracket",
      caption:
        "The grey slots are honest about themselves: they are waiting on an earlier result, and the small number is the seed. Nobody has to guess which winner goes where.",
      hold: 3600,
    },
    {
      id: "consolations",
      chapter: "bracket",
      caption:
        "The teams knocked out on Saturday morning are already scheduled again in the afternoon. That is the guarantee, drawn rather than promised.",
      hold: 3600,
      cursor: "tab-consolations",
      press: true,
      set: { view: "consolations" },
    },
    {
      id: "public",
      chapter: "bracket",
      caption:
        "There is no second button called publish. The bracket is created live, so the public league page has it the same second, and twelve clubs stop emailing to ask.",
      hold: 3800,
      url: URL_PUBLIC,
      set: { screen: "public", view: "bracket" },
    },
    {
      id: "done",
      chapter: "bracket",
      caption:
        "A result at the table on Saturday, a table that recalculated itself, a ruling with a reason on it, and a bracket every family can read by Sunday lunchtime.",
      hold: 3800,
    },
    {
      id: "end-card",
      chapter: "bracket",
      caption: "Standings to playoffs.",
      hold: 3800,
      set: { endCard: true },
    },
  ],

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "review")
    const finalized = get("finalized", false)
    const moved = get("moved", false)
    const movementCard = get("movementCard", false)
    const rules = get("rules", false)
    const override = get("override", false)
    const ruled = get("ruled", false)
    const planned = get("planned", false)
    const view = get<string>("view", "bracket")
    const endCard = get("endCard", false)

    const desktop = (
      <div className="relative flex h-full flex-col bg-[#f7f8fa]">
        <MockTopBar
          workspace={LEAGUE}
          tabs={["Overview", "Clubs", "Schedule", "Standings", "Playoffs"]}
          activeTab={
            screen === "playoffs" ? "Playoffs" : screen === "standings" ? "Standings" : "Clubs"
          }
        />

        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {screen === "review" && <ReviewScreen finalized={finalized} />}
          {screen === "standings" && (
            <StandingsScreen moved={moved} card={movementCard} rules={rules} />
          )}
          {screen === "roster" && (
            <RosterScreen
              override={override}
              ruled={ruled}
              note={
                <TypeText
                  text={get<string>("note", "")}
                  typing={typingKey === "note"}
                  placeholder="Ruling note (required)…"
                />
              }
            />
          )}
          {screen === "playoffs" && <PlayoffsScreen planned={planned} view={view} />}
          {screen === "public" && <PublicLeagueScreen />}
        </div>

        {endCard && (
          <MockEndCard
            eyebrow="Chapter 9 of 10"
            title="Standings to playoffs"
            line="A final at the scorer's table, a table that recalculates itself, a tiebreaker that shows its working, and a bracket that is public the second it exists."
            next="Waivers, start to finish"
          />
        )}
      </div>
    )

    return { desktop }
  },
}

/* ── The review screen ───────────────────────────────────────────────────── */

function ReviewScreen({ finalized }: { finalized: boolean }) {
  if (finalized) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-10">
        <div className="live-pop w-full max-w-[520px] text-center">
          <p className="text-court-700 text-[13px] font-bold uppercase tracking-[0.22em]">Final</p>
          <p className="font-condensed text-ink-950 mt-2 text-[46px] font-bold leading-none tabular-nums">
            {CLUB} 42 <span className="text-ink-300">—</span> 38 {OPPONENT}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <MockPill tone="court">Signed by Mike Osei, PIN verified</MockPill>
            <MockPill tone="neutral">Game status: COMPLETED</MockPill>
          </div>
          <p className="text-ink-500 mt-4 text-[12.5px] leading-relaxed">
            Box score written, recap queued, standings input changed, playoff bracket advanced.
            Every one of those happened because the sheet was marked final, not because somebody
            remembered to do them.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <span className="text-play-600 text-[12.5px] font-semibold underline">
              Official scoresheet (print) →
            </span>
            <span className="text-play-600 text-[12.5px] font-semibold underline">
              Public box score →
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-8 py-5">
      <h1 className="font-condensed text-ink-950 text-[24px] font-bold">
        Review: {CLUB} 42 <span className="text-ink-300">—</span> 38 {OPPONENT}
      </h1>
      <p className="text-ink-500 mt-0.5 text-[12.5px]">
        {LEAGUE} · {SEASON} · Riverside CC, Court 2
      </p>

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px] gap-4">
        <section className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
          <header className="border-ink-100 flex items-center gap-3 border-b px-4 py-2">
            <h2 className="text-ink-900 text-[14px] font-semibold">Box score</h2>
            <span className="text-ink-400 text-[11.5px]">Fold of every event recorded tonight</span>
          </header>
          <table className="w-full table-fixed">
            <thead className="bg-ink-50">
              <tr>
                <Th className="w-[40px]">#</Th>
                <Th>Player</Th>
                <Th className="w-[52px] text-right">PTS</Th>
                <Th className="w-[52px] text-right">REB</Th>
                <Th className="w-[52px] text-right">AST</Th>
                <Th className="w-[52px] text-right">PF</Th>
              </tr>
            </thead>
            <tbody className="divide-ink-50 divide-y">
              {[
                ["23", "Amara Bello", 18, 7, 4, 1],
                ["7", "Priya Nair", 9, 9, 2, 2],
                ["11", "Jada Okafor", 7, 3, 5, 3],
                ["4", "Mia Chen", 5, 2, 1, 1],
                ["9", "Hannah Kaur", 3, 4, 0, 2],
              ].map(([n, name, pts, reb, ast, pf]) => (
                <tr key={String(name)} className="bg-white">
                  <td className="px-4 py-1">
                    <PlayerMug
                      name={String(name)}
                      accentKey={String(name)}
                      jerseyNumber={String(n)}
                      sizeClassName="h-[22px] w-[22px] rounded-full"
                    />
                  </td>
                  <td className="text-ink-900 px-4 py-1 text-[12.5px] font-semibold">{name}</td>
                  <td className="text-ink-950 px-4 py-1 text-right text-[12.5px] font-bold tabular-nums">
                    {pts}
                  </td>
                  <td className="text-ink-600 px-4 py-1 text-right text-[12.5px] tabular-nums">
                    {reb}
                  </td>
                  <td className="text-ink-600 px-4 py-1 text-right text-[12.5px] tabular-nums">
                    {ast}
                  </td>
                  <td className="text-ink-600 px-4 py-1 text-right text-[12.5px] tabular-nums">
                    {pf}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="border-ink-100 flex flex-col overflow-hidden rounded-2xl border bg-white">
          <header className="border-ink-100 border-b px-4 py-2">
            <h2 className="text-ink-900 text-[14px] font-semibold">
              Referee approval{" "}
              <span className="text-hoop-600 text-[12px] font-medium">(required by this league)</span>
            </h2>
          </header>
          <div className="flex-1 px-4 py-3">
            <div className="flex gap-1.5">
              <span className="border-ink-200 text-ink-500 flex-1 rounded-lg border bg-white px-2 py-1 text-center text-[11.5px] font-semibold">
                Signature
              </span>
              <span className="border-play-500 bg-play-50 text-play-700 flex-1 rounded-lg border px-2 py-1 text-center text-[11.5px] font-bold">
                Referee PIN
              </span>
            </div>
            <p className="text-ink-500 mt-2 text-[11.5px] leading-relaxed">
              The assigned referee enters their personal PIN, verified against their account, the
              strongest form of approval.
            </p>
            <div className="border-ink-200 mt-2.5 flex items-center justify-center gap-2 rounded-xl border bg-white px-3 py-2.5">
              {["•", "•", "•", "•"].map((d, i) => (
                <span
                  key={i}
                  className="bg-ink-100 text-ink-700 flex h-8 w-8 items-center justify-center rounded-lg text-[16px] font-bold"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="border-court-200 bg-court-50 mt-2.5 flex items-center gap-2 rounded-xl border px-2.5 py-1.5">
              <span className="bg-court-600 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white">
                ✓
              </span>
              <span className="text-court-900 text-[11.5px] font-semibold">
                Mike Osei, assigned referee
              </span>
            </div>
            <p className="text-ink-400 mt-2 text-[11px] leading-relaxed">
              Referee unavailable? Finalize without approval (stamped on the sheet)
            </p>
          </div>
          <div className="border-ink-100 flex items-center gap-2 border-t px-4 py-2.5">
            <span className="text-ink-400 text-[11.5px] font-semibold">← Back to scoring</span>
            <span className="ml-auto">
              <MockButton id="mark-final" tone="court">
                Mark final
              </MockButton>
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}

/* ── Standings ───────────────────────────────────────────────────────────── */

function StandingsScreen({
  moved,
  card,
  rules,
}: {
  moved: boolean
  card: boolean
  rules: boolean
}) {
  const rows = moved ? AFTER : BEFORE
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MockBand
        eyebrow={`${LEAGUE} · ${SEASON}`}
        title="Standings"
        description="Computed on read from completed games. Ties are broken in the order configured under Settings › Rules."
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-3 px-6 py-3">
        <section className="border-ink-100 overflow-hidden rounded-2xl border bg-white shadow-[0_10px_30px_-26px_rgba(15,23,42,0.55)]">
          <header className="border-ink-100 flex items-center gap-3 border-b px-4 py-2">
            <h2 className="text-ink-900 text-[14.5px] font-semibold">{DIVISION}</h2>
            <span className="text-ink-400 text-[11.5px]">8 teams</span>
          </header>
          <table className="w-full table-fixed">
            <thead className="bg-ink-50">
              <tr>
                <Th className="w-[34px]">#</Th>
                <Th>Team</Th>
                <Th className="w-[38px] text-right">GP</Th>
                <Th className="w-[34px] text-right">W</Th>
                <Th className="w-[34px] text-right">L</Th>
                <Th className="w-[30px] text-right">T</Th>
                <Th className="w-[46px] text-right">PF</Th>
                <Th className="w-[46px] text-right">PA</Th>
                <Th className="w-[52px] text-right">Diff</Th>
                <Th className="w-[52px] text-right">Win%</Th>
                <Th className="w-[132px]">Tiebreakers</Th>
              </tr>
            </thead>
            <tbody className="divide-ink-50 divide-y">
              {rows.map((r, i) => {
                const diff = r.pf - r.pa
                const pct = (r.w / r.gp).toFixed(3).replace(/^0/, "")
                const isUs = r.team === CLUB
                return (
                  <tr
                    key={r.team}
                    data-demo-target={r.tiebreak ? "tie-row" : undefined}
                    className={cn(
                      "transition-all duration-500 motion-reduce:transition-none",
                      i === 0 ? "bg-highlight-soft" : "bg-white",
                      isUs && moved && "demo-pulse-green",
                      "data-[demo-hover=true]:bg-play-50/50"
                    )}
                  >
                    <td
                      className={cn(
                        "px-4 py-1 text-[12px] font-bold tabular-nums",
                        i === 0 ? "text-gold-600" : "text-ink-400"
                      )}
                    >
                      {i + 1}
                    </td>
                    <td className="px-4 py-1">
                      <span className="flex items-center gap-2">
                        <Crest name={r.team} sizeClassName="h-5 w-5 rounded-md text-[8px]" />
                        <span
                          className={cn(
                            "truncate text-[12.5px]",
                            isUs ? "text-ink-950 font-bold" : "text-ink-800 font-medium"
                          )}
                        >
                          {r.team}
                        </span>
                      </span>
                    </td>
                    <Td>{r.gp}</Td>
                    <Td strong>{r.w}</Td>
                    <Td>{r.l}</Td>
                    <Td>0</Td>
                    <Td>{r.pf}</Td>
                    <Td>{r.pa}</Td>
                    <td
                      className={cn(
                        "px-4 py-1 text-right text-[12px] font-semibold tabular-nums",
                        diff > 0 ? "text-court-600" : "text-hoop-600"
                      )}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff}
                    </td>
                    <Td strong>{pct}</Td>
                    <td className="text-ink-500 px-4 py-1 text-[10.5px] tabular-nums">
                      {r.tiebreak ?? ""}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <div className="space-y-3">
          {card && (
            <article className="border-ink-100 live-row-in overflow-hidden rounded-2xl border bg-white shadow-[0_10px_28px_-18px_rgba(15,23,42,0.6)]">
              <div className="bg-court-600 px-3 py-1.5">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/80">
                  Standings movement
                </p>
              </div>
              <div className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <Crest name={CLUB} size="xs" />
                  <p className="text-ink-950 text-[12.5px] font-bold leading-snug">
                    {CLUB} jump to 2nd in {DIVISION}
                  </p>
                </div>
                <p className="text-ink-500 mt-1 text-[11px] leading-snug">
                  Level with Northside Nets, ahead on point differential, one weekend left.
                </p>
              </div>
            </article>
          )}

          <section
            className={cn(
              "border-ink-100 rounded-2xl border bg-white px-3 py-2",
              rules && "live-pop"
            )}
          >
            <p className="text-ink-900 text-[12.5px] font-bold">Tiebreakers</p>
            <p className="text-ink-500 mt-0.5 text-[10px] leading-snug">
              Used to rank teams with identical records. Applied top-to-bottom until one team wins
              the tiebreaker.
            </p>
            <ol className="mt-1.5 space-y-[3px]">
              {TIEBREAKERS.map((t, i) => (
                <li
                  key={t}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-[2px] text-[10.5px] transition-colors duration-300 motion-reduce:transition-none",
                    rules && i === 0 && "border-ink-200 bg-ink-50 text-ink-500 line-through",
                    rules && i === 1
                      ? "border-court-300 bg-court-50 text-court-900 font-bold"
                      : "border-ink-100 text-ink-600"
                  )}
                >
                  <span className="text-ink-400 w-3 shrink-0 text-[10px] font-bold tabular-nums">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
            {rules && (
              <p className="text-ink-500 mt-1.5 text-[10px] leading-snug">
                They split their two meetings, so rule one settles nothing and rule two decides it.
              </p>
            )}
            <MockPill tone="neutral">Locked 12 Sep 2026</MockPill>
          </section>
        </div>
      </div>
    </div>
  )
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "text-ink-500 px-4 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em]",
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
        "px-4 py-1 text-right text-[12px] tabular-nums",
        strong ? "text-ink-950 font-bold" : "text-ink-600"
      )}
    >
      {children}
    </td>
  )
}

/* ── Eligibility ─────────────────────────────────────────────────────────── */

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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <MockBand
        eyebrow={`${LEAGUE} · ${SEASON}`}
        title={`${CLUB} · U11 Girls Rep`}
        description="Submitted roster, frozen on submission. Games played come from the scorekeeper's attendance roll call across completed games."
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-4 px-6 py-4">
        <section className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
          <header className="border-ink-100 flex items-center gap-3 border-b px-4 py-2">
            <h2 className="text-ink-900 text-[14.5px] font-semibold">Roster</h2>
            <span className="text-ink-400 text-[11.5px]">10 of 10 submitted</span>
          </header>
          <table className="w-full table-fixed">
            <thead className="bg-ink-50">
              <tr>
                <Th className="w-[46px]">#</Th>
                <Th>Player</Th>
                <Th className="w-[96px]">Position</Th>
                <Th className="w-[52px] text-right">GP</Th>
                <Th className="w-[232px]">Playoffs</Th>
              </tr>
            </thead>
            <tbody className="divide-ink-50 divide-y">
              {ROSTER.map((p) => {
                const isRossi = p.name === "Sofia Rossi"
                const eligible = p.gp >= MIN_GAMES || (isRossi && ruled)
                const overridden = isRossi && ruled
                return (
                  <tr
                    key={p.name}
                    data-demo-target={isRossi ? "row-rossi" : undefined}
                    className={cn(
                      "bg-white transition-colors duration-300 motion-reduce:transition-none",
                      "data-[demo-hover=true]:bg-play-50/50",
                      "data-[demo-press=true]:bg-play-50"
                    )}
                  >
                    <td className="px-4 py-1">
                      <PlayerMug
                        name={p.name}
                        accentKey={p.name}
                        jerseyNumber={p.number}
                        sizeClassName="h-[22px] w-[22px] rounded-full"
                      />
                    </td>
                    <td className="text-ink-900 px-4 py-1 text-[12.5px] font-semibold">{p.name}</td>
                    <td className="text-ink-500 px-4 py-1 text-[11.5px]">Guard</td>
                    <td
                      className={cn(
                        "px-4 py-1 text-right text-[12px] font-bold tabular-nums",
                        p.gp >= MIN_GAMES ? "text-ink-950" : "text-hoop-600"
                      )}
                    >
                      {p.gp}
                    </td>
                    <td className="px-4 py-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          key={String(eligible)}
                          className={cn(
                            "rounded-full px-2 py-[2px] text-[11px] font-semibold",
                            eligible
                              ? "bg-court-50 text-court-700"
                              : "bg-hoop-50 text-hoop-700",
                            overridden && "demo-pulse-green"
                          )}
                        >
                          {eligible ? "eligible" : "not eligible"}
                          {overridden ? " *" : ""}
                        </span>
                        <span className="text-ink-400 truncate text-[10px]">
                          {overridden
                            ? "league ruling: broken wrist"
                            : `${p.gp} of ${MIN_GAMES} required games`}
                        </span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <section
          data-demo-target="min-games"
          className={cn(
            "border-ink-100 h-fit rounded-2xl border bg-white px-3 py-2.5 transition-all duration-200 motion-reduce:transition-none",
            "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
          )}
        >
          <p className="text-ink-400 text-[10px] font-bold uppercase tracking-[0.12em]">Playoffs</p>
          <p className="text-ink-900 mt-1 text-[12.5px] font-bold">
            Minimum games played to be playoff-eligible
          </p>
          <div className="border-ink-200 mt-1.5 flex w-[74px] items-center justify-center rounded-xl border bg-white py-1.5">
            <span className="text-ink-950 text-[18px] font-bold tabular-nums">{MIN_GAMES}</span>
          </div>
          <p className="text-ink-500 mt-2 text-[10.5px] leading-snug">
            Leave empty for no rule. Eligibility is computed from the scorekeeper&apos;s attendance
            roll call across completed games; overrule any player from their team page (a written
            note is required).
          </p>
        </section>
      </div>

      {override && !ruled && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1628]/35 px-10">
          <div className="live-pop border-ink-100 w-full max-w-[440px] overflow-hidden rounded-3xl border bg-white shadow-[0_50px_120px_-40px_rgba(15,23,42,0.65)]">
            <header className="border-ink-100 border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <PlayerMug
                  name="Sofia Rossi"
                  accentKey="Sofia Rossi"
                  jerseyNumber="15"
                  sizeClassName="h-8 w-8 rounded-full"
                />
                <div>
                  <h3 className="text-ink-900 text-[15px] font-bold">Sofia Rossi</h3>
                  <p className="text-ink-500 text-[11.5px]">4 of 5 required games</p>
                </div>
                <span className="bg-hoop-50 text-hoop-700 ml-auto rounded-full px-2 py-[2px] text-[11px] font-semibold">
                  not eligible
                </span>
              </div>
            </header>
            <div className="px-5 py-4">
              <span className="border-ink-200 flex min-h-[38px] items-center rounded-xl border bg-white px-3 py-2 text-[12.5px]">
                {note}
              </span>
              <p className="text-ink-400 mt-1.5 text-[11px]">
                A ruling without a reason is how a league loses an argument in March.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <MockButton id="rule-eligible" tone="court" size="sm">
                  Rule eligible
                </MockButton>
                <MockButton tone="quiet" size="sm">
                  Rule ineligible
                </MockButton>
                <span className="text-ink-400 ml-auto text-[11.5px] font-semibold">Close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Playoffs ────────────────────────────────────────────────────────────── */

const QUARTERS: Array<[string, number, string, number]> = [
  [OPPONENT, 1, "Weston Wolves", 8],
  ["Harbourfront Heat", 4, "Parkdale Panthers", 5],
  [CLUB, 2, "Scarborough Storm", 7],
  ["Northside Nets", 3, "Etobicoke Eagles", 6],
]

function PlayoffsScreen({ planned, view }: { planned: boolean; view: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MockBand
        eyebrow={`${LEAGUE} · ${SEASON}`}
        title="Playoff plan"
        description="The whole playoff schedule is planned now; team names fill in automatically as the regular season finishes."
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-6 py-2.5">
        <section className="border-ink-100 shrink-0 rounded-2xl border bg-white px-4 py-2">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-ink-900 text-[13px] font-semibold">
                {DIVISION}: <span className="font-bold">Top 8 of 12 teams make the playoffs.</span>
              </p>
              <p
                data-demo-target="guarantee"
                className={cn(
                  "text-ink-900 rounded-lg text-[13px] font-semibold transition-all duration-200 motion-reduce:transition-none",
                  "data-[demo-hover=true]:bg-play-50 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
                )}
              >
                Everyone plays at least 2 games; champion crowned Sunday.
              </p>
              <p className="text-court-700 text-[12px] font-semibold">
                ✓ 14 games over Feb 21 to 22, 2 gyms, 21 of 24 booked court-hours used
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-play-600 text-[11.5px] font-semibold underline">Change</span>
              <div className="mt-2">
                <MockButton id="plan-playoffs" tone="court">
                  {planned ? "Re-plan the playoffs" : "Plan the playoffs"}
                </MockButton>
              </div>
            </div>
          </div>
        </section>

        {planned ? (
          <section className="border-ink-100 min-h-0 flex-1 overflow-hidden rounded-2xl border bg-white">
            <header className="border-ink-100 flex items-center gap-2 border-b px-4 py-2">
              {["Bracket", "Consolations", "Schedule"].map((t) => {
                const active = t.toLowerCase() === view
                return (
                  <span
                    key={t}
                    data-demo-target={t === "Consolations" ? "tab-consolations" : undefined}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-semibold transition-all duration-200 motion-reduce:transition-none",
                      active ? "bg-ink-900 text-white" : "text-ink-500 bg-white",
                      !active && "data-[demo-hover=true]:bg-ink-100",
                      "data-[demo-press=true]:scale-[0.97]"
                    )}
                  >
                    {t}
                  </span>
                )
              })}
              <span className="text-ink-400 ml-auto text-[11px]">
                White = teams decided · gray = waiting on an earlier result · the small number is
                the seed
              </span>
            </header>
            <div className="px-3 py-2">
              {view === "consolations" ? <ConsolationBoard /> : <BracketBoard />}
            </div>
          </section>
        ) : (
          <section className="border-ink-300 flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-dashed bg-white px-8 text-center">
            <h3 className="text-ink-900 font-condensed text-[19px] font-bold uppercase tracking-wide">
              No playoff games yet
            </h3>
            <p className="text-ink-500 mt-1.5 max-w-[520px] text-[12.5px] leading-relaxed">
              Playoffs are planned once the season is underway. The plan takes your divisions and
              the final standings (tiebreakers live under Settings › Rules): you&apos;ll pick who
              qualifies, how many games everyone is guaranteed, and how brackets pool.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

function BracketBoard() {
  return (
    <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_150px] gap-3">
      <BracketColumn title="Quarterfinal">
        {QUARTERS.map(([home, hs, away, as], i) => (
          <Matchup
            key={home}
            label={`Quarterfinal ${i + 1}`}
            when={i < 2 ? "Sat 9:00 AM" : "Sat 11:00 AM"}
            home={home}
            homeSeed={hs}
            away={away}
            awaySeed={as}
            delay={i * 80}
          />
        ))}
      </BracketColumn>

      <BracketColumn title="Semifinal">
        <Matchup
          label="Semifinal 1"
          when="Sat 3:00 PM"
          home="Winner QF1"
          away="Winner QF2"
          pending
          delay={340}
        />
        <Matchup
          label="Semifinal 2"
          when="Sat 5:00 PM"
          home="Winner QF3"
          away="Winner QF4"
          pending
          delay={400}
        />
      </BracketColumn>

      <BracketColumn title="Final">
        <Matchup
          label="Final"
          when="Sun 1:00 PM"
          home="Winner SF1"
          away="Winner SF2"
          pending
          delay={460}
        />
        <div
          className="border-gold-300 bg-gold-50 live-row-in mt-1 rounded-xl border px-2.5 py-2 text-center"
          style={{ animationDelay: "520ms" }}
        >
          <p className="text-gold-600 text-[10px] font-bold uppercase tracking-[0.16em]">
            🏆 Champion
          </p>
          <p className="text-ink-400 mt-0.5 text-[11px]">Crowned Sunday</p>
        </div>
      </BracketColumn>

      <BracketColumn title="3rd place">
        <Matchup
          label="3rd place"
          when="Sun 11:00 AM"
          home="Loser SF1"
          away="Loser SF2"
          pending
          compact
          delay={560}
        />
        <p className="text-ink-400 mt-1 text-[10.5px] leading-snug">
          14 games planned. 6 show placeholders until the regular season decides the teams.
        </p>
      </BracketColumn>
    </div>
  )
}

function ConsolationBoard() {
  return (
    <div>
      <p className="text-ink-600 text-[12px]">
        Every team keeps playing. Losers drop into a placement bracket settling every position, so
        the guarantee of two games is drawn rather than promised.
      </p>
      <div className="mt-2 grid grid-cols-[repeat(3,minmax(0,1fr))_150px] gap-3">
        <BracketColumn title="Consolation, round 1">
          <Matchup
            label="Consolation — Round 1, Game 1"
            when="Sat 1:00 PM"
            home="Loser QF1"
            away="Loser QF2"
            pending
            delay={0}
          />
          <Matchup
            label="Consolation — Round 1, Game 2"
            when="Sat 1:00 PM"
            home="Loser QF3"
            away="Loser QF4"
            pending
            delay={80}
          />
        </BracketColumn>
        <BracketColumn title="5th place">
          <Matchup
            label="5th place"
            when="Sun 9:00 AM"
            home="Winner C1"
            away="Winner C2"
            pending
            delay={160}
          />
        </BracketColumn>
        <BracketColumn title="7th place">
          <Matchup
            label="7th place"
            when="Sun 9:00 AM"
            home="Loser C1"
            away="Loser C2"
            pending
            delay={220}
          />
        </BracketColumn>
        <BracketColumn title="Guarantee">
          <div className="border-court-200 bg-court-50 rounded-xl border px-2.5 py-2">
            <p className="text-court-900 text-[11.5px] font-bold">Every team: 2 games</p>
            <p className="text-court-800/80 mt-0.5 text-[10.5px] leading-snug">
              Nobody drives ninety minutes on a Saturday to play once and go home.
            </p>
          </div>
        </BracketColumn>
      </div>
    </div>
  )
}

function BracketColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em]">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Matchup({
  label,
  when,
  home,
  homeSeed,
  away,
  awaySeed,
  pending,
  compact,
  delay = 0,
}: {
  label: string
  when: string
  home: string
  homeSeed?: number
  away: string
  awaySeed?: number
  pending?: boolean
  compact?: boolean
  delay?: number
}) {
  return (
    <div
      className={cn(
        "live-row-in rounded-xl border px-2 py-1",
        pending ? "border-ink-200 bg-ink-50" : "border-ink-200 bg-white shadow-sm"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-baseline justify-between gap-1">
        <p className="text-ink-400 truncate text-[9px] font-bold uppercase tracking-[0.1em]">
          {label}
        </p>
        {!compact && <p className="text-ink-400 shrink-0 text-[9px] tabular-nums">{when}</p>}
      </div>
      <SeedLine name={home} seed={homeSeed} pending={pending} />
      <SeedLine name={away} seed={awaySeed} pending={pending} />
    </div>
  )
}

function SeedLine({
  name,
  seed,
  pending,
}: {
  name: string
  seed?: number
  pending?: boolean
}) {
  return (
    <div className="mt-[1px] flex items-center gap-1.5">
      <span
        className={cn(
          "flex h-3 w-3 shrink-0 items-center justify-center rounded text-[7.5px] font-bold tabular-nums",
          seed ? "bg-ink-100 text-ink-600" : "bg-ink-200/60 text-transparent"
        )}
      >
        {seed ?? "0"}
      </span>
      {!pending && <Crest name={name} sizeClassName="h-3.5 w-3.5 shrink-0 rounded text-[6.5px]" />}
      <span
        className={cn(
          "min-w-0 truncate text-[10.5px] leading-tight",
          pending ? "text-ink-400 italic" : "text-ink-900 font-semibold"
        )}
      >
        {name}
      </span>
    </div>
  )
}

/* ── The public league page ──────────────────────────────────────────────── */

function PublicLeagueScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MockBand
        eyebrow={LEAGUE}
        title={`${SEASON} playoffs`}
        description="Feb 21 to 22 · Riverside CC and Northside HS · every game, every seed, public the moment it was planned."
      />
      <div className="min-h-0 flex-1 px-6 py-3.5">
        <div className="border-ink-100 flex items-center gap-2 rounded-t-2xl border border-b-0 bg-white px-4 py-2">
          {["Standings", "Schedule", "Playoffs", "Clubs"].map((t) => (
            <span
              key={t}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-semibold",
                t === "Playoffs" ? "bg-ink-900 text-white" : "text-ink-500"
              )}
            >
              {t}
            </span>
          ))}
          <span className="ml-auto">
            <MockPill tone="court">Live bracket</MockPill>
          </span>
        </div>
        <div className="border-ink-100 rounded-b-2xl border bg-white px-4 py-3">
          <BracketBoard />
        </div>
      </div>
    </div>
  )
}
