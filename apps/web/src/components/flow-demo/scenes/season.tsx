"use client"

/**
 * Chapter 5 — The season (steps 27-31): live scoring side by side with the
 * public game page, box scores, standings, AI recaps, chat and polls, then
 * playoffs to the championship. Mirrors /games/[id]/score, /live/[gameId],
 * /scores, /league/[id], /news/[slug], team chat/polls, and the Playoffs tab
 * (docs/demo-inventory/season.md).
 */

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { NewsCard } from "@/components/ui/news-card"
import { ScoreCard } from "@/components/ui/score-card"
import { StandingsTable } from "@/components/ui/standings-table"
import { cn } from "@/components/ui/cn"
import { buildMatchupCover } from "@/lib/content/matchup-cover"
import { Advance } from "../advance"
import { DuoFrame } from "../frames"
import { BOX, CHAMP_RECAP, CHAT, GAME, KID, LEAGUE, PLAYOFFS, POLL_PAGE, RECAP, STANDINGS, TEAM } from "../data"
import { BoxScoreCard, GameHero, GameTabs, LeadersCard, LinescoreCard, SectionH3, TeamStatsCard } from "./game-page"
import { OperatorPage, Panel, PhonePage, SelectBox, Td, Th, TxtInput } from "./shared"
import { SeasonHeader, SeasonTabs } from "./league-setup"

/* ── The scoring console (left half of the duo) ────────────────────────── */

function PlayerTile({ jersey, name, fouls }: { jersey: number; name: string; fouls: number }) {
  return (
    <div className="border-ink-200 rounded-xl border bg-white px-3 py-2.5 text-center">
      <p className="text-ink-950 text-lg font-bold tabular-nums">#{jersey}</p>
      <p className="text-hoop-500 text-[10px] leading-none">{"•".repeat(fouls)}</p>
      <p className="text-ink-500 truncate text-[11px] font-medium">{name}</p>
    </div>
  )
}

function ActionBtn({ label, highlight, confirm }: { label: string; highlight?: boolean; confirm?: string }) {
  const btn = (
    <span
      className={cn(
        "border-ink-200 text-ink-900 block rounded-xl border bg-white px-2 py-3 text-center text-base font-bold",
        highlight && "border-play-300"
      )}
    >
      {label}
    </span>
  )
  return highlight ? (
    <Advance block confirm={confirm}>
      {btn}
    </Advance>
  ) : (
    btn
  )
}

function ConsoleScreen({
  homeScore,
  awayScore,
  clock,
  plus2Advances,
  endAdvances,
  ticker,
}: {
  homeScore: number
  awayScore: number
  clock: string
  plus2Advances?: boolean
  endAdvances?: boolean
  ticker: string[]
}) {
  const homeFive = BOX.slice(0, 5)
  const awayFive = [
    { jersey: 10, name: "Noah S.", pf: 3 },
    { jersey: 3, name: "Lucas K.", pf: 2 },
    { jersey: 24, name: "Ibrahim H.", pf: 1 },
    { jersey: 8, name: "Felix W.", pf: 2 },
    { jersey: 14, name: "Santiago S.", pf: 4 },
  ]
  const endBtn = (
    <span className="border-ink-300 text-ink-900 rounded-lg border bg-white px-3 py-1.5 text-xs font-bold">
      End Q4
    </span>
  )
  return (
    <div className="bg-ink-50 min-h-[560px] px-5 py-4">
      {/* Header bar */}
      <div className="border-ink-200 rounded-2xl border bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#16a34a" }} />
            <span className="text-ink-900 text-sm font-bold">{GAME.homeShort}</span>
            <span className="text-ink-950 text-3xl font-bold tabular-nums">{homeScore}</span>
            <span className="text-ink-400 text-xs">fouls 4</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="bg-ink-900 rounded-full px-2.5 py-1 text-xs font-bold text-white">Q4</span>
            <span className="border-ink-200 rounded-lg border px-2.5 py-1 text-sm font-bold tabular-nums">
              {clock} ⏸
            </span>
            {endAdvances ? <Advance>{endBtn}</Advance> : endBtn}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink-400 text-xs">fouls 6 · bonus</span>
            <span className="text-ink-950 text-3xl font-bold tabular-nums">{awayScore}</span>
            <span className="text-ink-900 text-sm font-bold">{GAME.awayShort}</span>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#7c3aed" }} />
          </div>
        </div>
        <div className="border-ink-100 mt-2.5 flex items-center justify-between border-t pt-2.5">
          <div className="flex gap-1.5">
            {ticker.map((t, i) => (
              <span key={i} className="bg-ink-50 text-ink-600 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                {t} ✕
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <span className="text-court-600">synced</span>
            <span className="border-ink-200 rounded border px-1.5 py-0.5">BOX</span>
            <span className="border-ink-200 rounded border px-1.5 py-0.5">Rows</span>
            <span className="border-ink-200 text-hoop-600 rounded border px-1.5 py-0.5">UNDO</span>
          </div>
        </div>
      </div>
      {/* Body: home tiles | action pad | away tiles */}
      <div className="mt-4 grid grid-cols-[1fr_1.15fr_1fr] gap-4">
        <div className="space-y-2">
          {homeFive.map((p) => (
            <PlayerTile key={p.jersey} jersey={p.jersey} name={p.name} fouls={p.pf} />
          ))}
          <p className="text-ink-500 text-center text-xs font-bold">SUBS ⇄ (7 on bench)</p>
        </div>
        <div>
          <p className="text-ink-500 mb-2 rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold">
            Tap an action, then a player. Either order works
          </p>
          <div className="grid grid-cols-3 gap-2">
            <ActionBtn label="+2" highlight={plus2Advances} />
            <ActionBtn label="+3" />
            <ActionBtn label="FT ✓" />
            <ActionBtn label="2 ✗" />
            <ActionBtn label="3 ✗" />
            <ActionBtn label="FT ✗" />
            <ActionBtn label="REB" />
            <ActionBtn label="AST" />
            <ActionBtn label="FOUL" />
          </div>
        </div>
        <div className="space-y-2">
          {awayFive.map((p) => (
            <PlayerTile key={p.jersey} jersey={p.jersey} name={p.name} fouls={p.pf} />
          ))}
          <p className="text-ink-500 text-center text-xs font-bold">SUBS ⇄ (5 on bench)</p>
        </div>
      </div>
    </div>
  )
}

/* ── The public live page (right half of the duo) ──────────────────────── */

function LiveScreen({
  homeScore,
  awayScore,
  plays,
  flash,
  clock,
}: {
  homeScore: number
  awayScore: number
  plays: Array<{ text: string; team: "h" | "a"; score?: string }>
  flash?: boolean
  clock: string
}) {
  return (
    <div className="min-h-full bg-white">
      <GameHero homeScore={homeScore} awayScore={awayScore} state="live" clock={clock} flashHome={flash} />
      <div className="px-3">
        <GameTabs active="plays" />
      </div>
      <div className="border-ink-100 mx-3 mt-3 overflow-hidden rounded-2xl border bg-white">
        <div className="border-ink-100 flex items-center gap-1.5 overflow-x-auto border-b px-4 py-2">
          {["All", "Scoring", "Q1", "Q2", "Q3", "Q4"].map((c, i) => (
            <span
              key={c}
              className={cn(
                "whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                i === 0 ? "bg-ink-950 text-white" : "text-ink-500 border-ink-200 border bg-white"
              )}
            >
              {c}
            </span>
          ))}
        </div>
        <ul>
          {plays.map((p, i) => (
            <li
              key={p.text}
              className={cn(
                "border-ink-50 flex items-center gap-2.5 border-b px-4 py-1.5 text-xs",
                p.score ? "text-ink-950 font-semibold" : "text-ink-600",
                i === 0 && flash && "score-flash"
              )}
            >
              <span
                className="w-1 self-stretch rounded-full"
                style={{ backgroundColor: p.team === "h" ? GAME.homeColor : GAME.awayColor }}
              />
              <span className="min-w-0 flex-1">{p.text}</span>
              {p.score && <span className="text-ink-900 shrink-0 text-[11px] font-bold tabular-nums">{p.score}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const PLAYS_BEFORE: Array<{ text: string; team: "h" | "a"; score?: string }> = [
  { text: "#7 Marcus C. makes a free throw", team: "h", score: "58–54" },
  { text: "Foul on #14 Santiago S.", team: "a" },
  { text: "#10 Noah S. scores 2", team: "a", score: "57–54" },
  { text: "#23 Jayden T. scores 3, assisted by #4 Ethan P.", team: "h", score: "57–52" },
  { text: "Sub: #21 in, #30 out", team: "h" },
  { text: "#3 Lucas K. misses a 3-pointer, defensive rebound #11 Malik O.", team: "a" },
]

/* Step 27 — live scoring, side by side */
export function SceneLiveDuo() {
  return (
    <DuoFrame
      url="/games/g10-w4-force-huskies/score"
      leftLabel="The scorer's table (console)"
      rightLabel="What every family sees, live"
      sceneKey="live-duo-1"
      left={
        <ConsoleScreen
          homeScore={GAME.liveHome}
          awayScore={GAME.liveAway}
          clock={GAME.liveClock}
          plus2Advances
          ticker={["2PT #23", "FOUL #14", "FT #7"]}
        />
      }
      right={
        <LiveScreen homeScore={GAME.liveHome} awayScore={GAME.liveAway} clock={GAME.liveClock} plays={PLAYS_BEFORE} />
      }
    />
  )
}

export function SceneLiveDuoAfter() {
  return (
    <DuoFrame
      url="/games/g10-w4-force-huskies/score"
      leftLabel="The scorer's table (console)"
      rightLabel="What every family sees, live"
      sceneKey="live-duo-2"
      left={
        <ConsoleScreen
          homeScore={GAME.liveHome + 2}
          awayScore={GAME.liveAway}
          clock="5:04"
          endAdvances
          ticker={["2PT #23", "AST #7", "2PT #23"]}
        />
      }
      right={
        <LiveScreen
          homeScore={GAME.liveHome + 2}
          awayScore={GAME.liveAway}
          clock="5:04"
          flash
          plays={[
            { text: "#23 Jayden T. scores 2, assisted by #7 Marcus C.", team: "h", score: "60–54" },
            ...PLAYS_BEFORE,
          ]}
        />
      }
    />
  )
}

/* Step 27b — review and referee sign-off */
export function SceneReviewFinalize() {
  return (
    <div className="px-10 py-10">
      <h2 className="text-ink-950 text-center text-2xl font-bold">
        Review: {GAME.home} {GAME.finalHome}-{GAME.finalAway} {GAME.away}
      </h2>
      <div className="mx-auto mt-6 grid max-w-4xl grid-cols-2 gap-5">
        {[GAME.home, GAME.away].map((team, side) => (
          <Card key={team} size="sm" className="overflow-hidden p-0">
            <p className="bg-ink-50 text-ink-900 px-4 py-2.5 text-sm font-bold">{team}</p>
            <table className="w-full">
              <thead className="border-ink-100 border-b">
                <tr>
                  <Th>Player</Th>
                  <Th center>PTS</Th>
                  <Th center>REB</Th>
                  <Th center>AST</Th>
                  <Th center>PF</Th>
                </tr>
              </thead>
              <tbody className="divide-ink-50 divide-y">
                {(side === 0
                  ? BOX.slice(0, 5).map((p) => [p.name, p.pts, p.reb, p.ast, p.pf])
                  : [
                      ["Noah S.", 18, 5, 2, 3],
                      ["Lucas K.", 12, 3, 4, 2],
                      ["Ibrahim H.", 9, 7, 1, 1],
                      ["Felix W.", 8, 2, 2, 2],
                      ["Santiago S.", 6, 4, 0, 4],
                    ]
                ).map(([name, pts, reb, ast, pf]) => (
                  <tr key={String(name)}>
                    <Td>{name}</Td>
                    <Td center>{pts}</Td>
                    <Td center>{reb}</Td>
                    <Td center>{ast}</Td>
                    <Td center>{pf}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
      <Card className="mx-auto mt-5 max-w-4xl">
        <div className="flex items-center justify-between">
          <p className="text-ink-900 text-sm font-bold">Referee approval (required by this league)</p>
          <div className="flex gap-1.5 text-xs font-semibold">
            <span className="border-ink-200 text-ink-500 rounded-full border px-3 py-1">Signature</span>
            <span className="border-play-300 bg-play-50 text-play-700 rounded-full border px-3 py-1">
              Referee PIN
            </span>
          </div>
        </div>
        <p className="text-ink-500 mt-2 text-sm">
          The assigned referee enters their personal PIN, verified against their account, the
          strongest form of approval.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="border-play-300 bg-play-50 text-play-700 rounded-full border px-3 py-1 text-sm font-semibold">
            {GAME.referee}
          </span>
          <div className="w-40">
            <TxtInput value="••••" placeholder="Referee PIN" />
          </div>
        </div>
      </Card>
      <div className="mx-auto mt-5 flex max-w-4xl items-center justify-between">
        <span className="text-ink-500 text-sm font-semibold">&larr; Back to scoring</span>
        <Advance confirm="Final. Recap publishing to league news">
          <Button>Mark final</Button>
        </Advance>
      </div>
    </div>
  )
}

/* Step 28a — Scores (phone) */
export function SceneScores() {
  return (
    <PhonePage>
      <p className="text-ink-400 text-[11px] font-bold uppercase tracking-[0.14em]">Around the hub</p>
      <h1 className="font-condensed text-ink-950 text-2xl font-bold uppercase">Scores</h1>
      <p className="text-ink-500 mt-1 text-sm">
        Live games, this week&apos;s finals and what&apos;s coming up, across every league.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="bg-ink-900 rounded-full px-3 py-1 text-xs font-semibold text-white">All leagues</span>
        <span className="border-ink-200 text-ink-600 rounded-full border bg-white px-3 py-1 text-xs font-semibold">
          {LEAGUE.name}
        </span>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-ink-900 text-sm font-bold">Your games</h2>
          <Badge tone="hoop">1</Badge>
        </div>
        <p className="text-ink-400 mb-2 text-xs">Games for your kids&apos; teams and teams you follow.</p>
        <Advance block>
          <ScoreCard
            status="FINAL"
            home={{ name: GAME.home, color: "#16a34a", score: GAME.finalHome }}
            away={{ name: GAME.away, color: "#7c3aed", score: GAME.finalAway }}
            venue="Haber Recreation Centre · Court 1"
          />
        </Advance>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-ink-900 text-sm font-bold">Live now</h2>
          <Badge tone="live" dot>
            2
          </Badge>
        </div>
        <ScoreCard
          status="LIVE"
          home={{ name: "Royal Crown Grade 10", color: "#9333ea", score: 41 }}
          away={{ name: "North York Lions Grade 10", color: "#b45309", score: 38 }}
          venue="Pan Am Sports Centre · Court 2"
        />
      </div>
      <div className="mt-5">
        <h2 className="text-ink-900 mb-2 text-sm font-bold">Upcoming</h2>
        <ScoreCard
          status="SCHEDULED"
          home={{ name: "West United Prep Grade 10", color: "#0891b2" }}
          away={{ name: "Oakville Panthers Grade 10", color: "#be123c" }}
          dateLabel="Sat · 4:00 PM"
          venue="Humber Athletic Centre · Court 1"
        />
      </div>
    </PhonePage>
  )
}

/* Real generated matchup covers, exactly what the recap service ships. */
const RECAP_COVER = buildMatchupCover({
  homeName: GAME.home,
  awayName: GAME.away,
  homeColor: GAME.homeColor,
  awayColor: GAME.awayColor,
  homeScore: GAME.finalHome,
  awayScore: GAME.finalAway,
  label: `${LEAGUE.name} · ${LEAGUE.season}`,
})
const CROWN_LIONS_COVER = buildMatchupCover({
  homeName: "Royal Crown Grade 10",
  awayName: "North York Lions Grade 10",
  homeColor: "#9333ea",
  awayColor: "#b45309",
  homeScore: 58,
  awayScore: 54,
  label: `${LEAGUE.name} · ${LEAGUE.season}`,
})
const CHAMP_COVER = buildMatchupCover({
  homeName: PLAYOFFS.final.home,
  awayName: PLAYOFFS.final.away,
  homeColor: GAME.homeColor,
  awayColor: "#9333ea",
  homeScore: PLAYOFFS.final.hs,
  awayScore: PLAYOFFS.final.as,
  label: `${LEAGUE.name} · Grade 10 Boys Final`,
})

/* Step 29a — Browse the news (phone) */
export function SceneNewsBrowse() {
  return (
    <PhonePage>
      <p className="text-ink-400 text-[11px] font-bold uppercase tracking-[0.14em]">Around the hub</p>
      <h1 className="font-condensed text-ink-950 text-2xl font-bold uppercase">News &amp; Game Recaps</h1>
      <p className="text-ink-500 mt-1 text-sm">
        Every scored game gets a story, plus announcements from clubs and leagues.
      </p>
      <div className="mt-4 space-y-4">
        <Advance block>
          <NewsCard
            title={RECAP.title}
            excerpt={RECAP.body[0]}
            coverUrl={RECAP_COVER}
            dateLabel="Jun 20, 2026"
            author={LEAGUE.name}
          />
        </Advance>
        <NewsCard
          title="Royal Crown edge the Lions in a Q4 comeback"
          excerpt="Royal Crown Grade 10 outscored North York Lions Grade 10 by nine in the fourth to win 58-54 at Pan Am Sports Centre on Saturday."
          coverUrl={CROWN_LIONS_COVER}
          dateLabel="Jun 20, 2026"
          author={LEAGUE.name}
        />
        <NewsCard
          title="Summer skills camp registration opens Monday"
          excerpt="Six weeks of morning sessions at City Above Elite, grades 8 to 11. Spots go quickly, so set a reminder."
          dateLabel="Jun 18, 2026"
          author="City Above Elite"
        />
      </div>
    </PhonePage>
  )
}

/* Step 28b — Final box score (phone) */
export function SceneBoxScore() {
  return (
    <div className="min-h-full bg-white pb-6">
      <Advance block>
        <div>
          <GameHero homeScore={GAME.finalHome} awayScore={GAME.finalAway} state="final" />
        </div>
      </Advance>
      <div className="px-3">
        <GameTabs active="game" />
        <div className="mt-3">
          <LinescoreCard
            rows={[
              {
                color: GAME.homeColor,
                short: GAME.homeShort,
                quarters: GAME.lines.home,
                total: GAME.finalHome,
              },
              {
                color: GAME.awayColor,
                short: GAME.awayShort,
                quarters: GAME.lines.away,
                total: GAME.finalAway,
              },
            ]}
          />
          <SectionH3>Game leaders</SectionH3>
          <LeadersCard
            sections={[
              {
                label: "Points",
                home: { jersey: 23, name: KID.short, value: 21, unit: "PTS", sub: "6 REB · 3 AST" },
                away: { jersey: 10, name: "Noah S.", value: 18, unit: "PTS", sub: "5 REB · 2 AST" },
              },
              {
                label: "Rebounds",
                home: { jersey: 11, name: "Malik O.", value: 8, unit: "REB", sub: "6 DReb · 2 OReb" },
                away: { jersey: 8, name: "Ibrahim H.", value: 7, unit: "REB", sub: "5 DReb · 2 OReb" },
              },
              {
                label: "Assists",
                home: { jersey: 7, name: "Marcus C.", value: 5, unit: "AST", sub: "11 PTS · 1 TO" },
                away: { jersey: 3, name: "Lucas K.", value: 4, unit: "AST", sub: "12 PTS · 2 TO" },
              },
              {
                label: "Defense",
                home: { jersey: 4, name: "Ethan P.", value: 2, unit: "STL", sub: "2 STL · 0 BLK" },
                away: { jersey: 6, name: "Felix W.", value: 2, unit: "STL", sub: "2 STL · 0 BLK" },
              },
            ]}
          />
          <SectionH3>Team stats</SectionH3>
          <TeamStatsCard
            rows={[
              {
                label: "Field goals",
                home: 24 / 51,
                away: 22 / 54,
                displayHome: "24-51 · 47%",
                displayAway: "22-54 · 41%",
              },
              {
                label: "3-pointers",
                home: 5 / 14,
                away: 4 / 16,
                displayHome: "5-14 · 36%",
                displayAway: "4-16 · 25%",
              },
              {
                label: "Free throws",
                home: 9 / 12,
                away: 10 / 15,
                displayHome: "9-12 · 75%",
                displayAway: "10-15 · 67%",
              },
              { label: "Rebounds", home: 32, away: 29 },
              { label: "Assists", home: 13, away: 11 },
              { label: "Steals", home: 4, away: 5 },
              { label: "Blocks", home: 1, away: 2 },
              { label: "Turnovers", home: 7, away: 9 },
              { label: "Fouls", home: 17, away: 14 },
            ]}
          />
          <SectionH3>Box score</SectionH3>
          <BoxScoreCard
            starters={BOX.slice(0, 5).map((p) => ({
              jersey: p.jersey,
              name: p.name,
              pts: p.pts,
              reb: p.reb,
              ast: p.ast,
              stl: p.stl,
              to: p.to,
              top: !!p.top,
            }))}
            bench={BOX.slice(5).map((p) => ({
              jersey: p.jersey,
              name: p.name,
              pts: p.pts,
              reb: p.reb,
              ast: p.ast,
              stl: p.stl,
              to: p.to,
            }))}
            live={false}
            totals={{
              pts: GAME.finalHome,
              reb: BOX.reduce((a, p) => a + p.reb, 0),
              ast: BOX.reduce((a, p) => a + p.ast, 0),
              stl: BOX.reduce((a, p) => a + p.stl, 0),
              to: BOX.reduce((a, p) => a + p.to, 0),
            }}
          />
        </div>
      </div>
    </div>
  )
}

/* Step 28c — Standings on the public league hub (phone) */
export function SceneStandings() {
  return (
    <PhonePage>
      <div
        className="-mx-4 -mt-4 mb-4 px-4 py-5 text-white"
        style={{ background: "linear-gradient(120deg, #1e3a8a, #0b0b0f)" }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            Season underway
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            {LEAGUE.season}
          </span>
        </div>
        <h1 className="font-condensed mt-2 text-2xl font-bold uppercase">{LEAGUE.name}</h1>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            ["30", "Teams"],
            ["118", "Games played"],
            ["4", "Divisions"],
            ["2", "Live now"],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="text-lg font-bold">{v}</p>
              <p className="text-[10px] text-white/60">{l}</p>
            </div>
          ))}
        </div>
      </div>
      <h2 className="text-ink-900 mb-2 text-sm font-bold">Standings</h2>
      <p className="text-ink-400 mb-2 text-xs">Grade 10 Boys</p>
      <StandingsTable
        rows={STANDINGS.map((s, i) => ({
          rank: i + 1,
          name: s.team.replace(" Grade 10", ""),
          color: ["#16a34a", "#9333ea", "#7c3aed", "#0891b2", "#b45309", "#0f766e", "#be123c", "#d97706"][i],
          wins: s.w,
          losses: s.l,
          pct: s.w / (s.w + s.l),
          gamesBack: s.gb,
          streak: s.strk,
        }))}
      />
      <div className="mt-5 flex items-center justify-between">
        <h2 className="text-ink-900 text-sm font-bold">League news</h2>
        <Advance>
          <span className="text-play-700 text-xs font-bold">All news &rarr;</span>
        </Advance>
      </div>
      <Card size="sm" className="mt-2">
        <p className="text-ink-400 text-xs">Jun 20, 2026</p>
        <p className="text-ink-900 mt-1 text-sm font-bold">{RECAP.title}</p>
      </Card>
    </PhonePage>
  )
}

/* Step 29 — AI recap article (phone) */
function RecapArticle({
  title,
  date,
  body,
  cover,
  advanceOnPill,
  confirmText,
}: {
  title: string
  date: string
  body: string[]
  cover: string
  advanceOnPill: string
  confirmText?: string
}) {
  const pills = ["Box score & play-by-play →", TEAM.name, "Burlington Force", LEAGUE.name]
  return (
    <PhonePage>
      <p className="text-ink-400 text-xs font-semibold">&larr; All news</p>
      <Card size="sm" className="mt-3">
        <div className="flex items-center gap-2">
          <Badge tone="play">Game Recap</Badge>
          <span className="text-ink-400 text-xs">{date}</span>
        </div>
        <h1 className="text-ink-950 mt-2 text-lg font-bold leading-snug">{title}</h1>
        <div className="mt-3 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" className="aspect-[16/9] w-full object-cover" />
        </div>
        <div className="text-ink-700 mt-3 space-y-3 text-sm leading-relaxed">
          {body.map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
        </div>
        <p className="text-ink-400 mt-4 text-xs italic">
          Recap generated automatically from the official scoring record.
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {pills.map((p) =>
            p === advanceOnPill ? (
              <Advance key={p} confirm={confirmText}>
                <span className="border-ink-200 text-ink-700 rounded-full border bg-white px-2.5 py-1 text-xs font-semibold">
                  {p}
                </span>
              </Advance>
            ) : (
              <span key={p} className="border-ink-200 text-ink-700 rounded-full border px-2.5 py-1 text-xs font-semibold">
                {p}
              </span>
            )
          )}
        </div>
      </Card>
    </PhonePage>
  )
}

export function SceneRecap() {
  return <RecapArticle title={RECAP.title} date={RECAP.date} body={RECAP.body} cover={RECAP_COVER} advanceOnPill={TEAM.name} />
}

/* Step 30a — Team chat (phone) */
export function SceneChat() {
  return (
    <PhonePage className="px-0">
      <div className="px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-ink-950 text-base font-bold">{TEAM.name}</p>
            <p className="text-ink-400 text-xs">Burlington Force • Team chat</p>
          </div>
          <span className="text-play-700 text-xs font-bold">Polls</span>
        </div>
        <div className="border-ink-100 mt-3 rounded-2xl border bg-white">
          <div className="border-ink-100 flex items-center gap-2 border-b px-3 py-2">
            <span className="text-xs">📌</span>
            <p className="text-ink-600 flex-1 truncate text-xs">
              <span className="font-bold">David Okafor:</span> {CHAT.pinned}
            </p>
          </div>
          <div className="border-ink-100 text-ink-400 border-b px-3 py-1.5 text-[11px] font-semibold">
            24 members · Show ▾
          </div>
          <div className="space-y-3 px-3 py-3">
            <p className="text-ink-400 text-center text-[10px] font-bold uppercase">Today</p>
            {CHAT.messages.map((m) => (
              <div key={m.body} className={cn("max-w-[85%]", m.who === "Maria Thompson" && "ml-auto")}>
                <p className="text-ink-400 mb-0.5 text-[10px] font-semibold">
                  {m.who === "Maria Thompson" ? "You" : m.who}{" "}
                  {m.staff && (
                    <span className="bg-play-50 text-play-700 rounded px-1 py-px text-[8px] font-bold">STAFF</span>
                  )}
                  <span className="ml-1">{m.time}</span>
                </p>
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-xs",
                    m.who === "Maria Thompson" ? "bg-play-600 text-white" : "bg-ink-50 text-ink-800"
                  )}
                >
                  {m.body}
                </div>
              </div>
            ))}
            {/* Poll bubble */}
            <div className="border-ink-100 max-w-[92%] rounded-2xl border p-3">
              <p className="text-ink-900 text-xs font-bold">📊 {CHAT.poll.question}</p>
              <div className="mt-2 space-y-1.5">
                {CHAT.poll.options.map((o, i) => {
                  const row = (
                    <div className="border-ink-100 relative overflow-hidden rounded-lg border px-2.5 py-1.5">
                      <div
                        className={cn("absolute inset-y-0 left-0", o.mine ? "bg-court-100" : "bg-ink-50")}
                        style={{ width: `${(o.count / CHAT.poll.votes) * 100}%` }}
                      />
                      <div className="relative flex items-center justify-between text-[11px]">
                        <span className="text-ink-800 font-semibold">
                          {o.label} {o.mine && <span className="text-court-700">✓ your pick</span>}
                        </span>
                        <span className="text-ink-500">
                          {o.count} · {Math.round((o.count / CHAT.poll.votes) * 100)}%
                        </span>
                      </div>
                    </div>
                  )
                  return i === 0 ? (
                    <Advance key={o.label} block>
                      {row}
                    </Advance>
                  ) : (
                    <div key={o.label}>{row}</div>
                  )
                })}
              </div>
              <p className="text-ink-400 mt-1.5 text-[10px]">{CHAT.poll.votes} votes · tap to vote</p>
            </div>
            <p className="text-ink-400 text-[10px] italic">{CHAT.typing}</p>
          </div>
          <div className="border-ink-100 flex items-center gap-2 border-t px-3 py-2.5">
            <span aria-label="Post a quick poll">📊</span>
            <div className="border-ink-200 text-ink-400 flex-1 rounded-full border px-3 py-1.5 text-xs">
              Message the team…
            </div>
            <Button size="sm">Send</Button>
          </div>
        </div>
      </div>
    </PhonePage>
  )
}

/* Step 30b — Polls page (phone) */
export function ScenePolls() {
  return (
    <PhonePage>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-ink-950 text-base font-bold">{TEAM.name}</p>
          <p className="text-ink-400 text-xs">Burlington Force • Polls &amp; surveys</p>
        </div>
        <span className="text-play-700 text-xs font-bold">Team Chat</span>
      </div>
      <Card size="sm" className="mt-3">
        <div className="flex items-center justify-between">
          <p className="text-ink-950 text-sm font-bold">{POLL_PAGE.title}</p>
          <Badge tone="court">Open</Badge>
        </div>
        <p className="text-ink-400 mt-0.5 text-xs">
          {POLL_PAGE.by} · {POLL_PAGE.created} · {POLL_PAGE.voters} vote(s)
        </p>
        <p className="text-ink-600 mt-1.5 text-xs">{POLL_PAGE.desc}</p>
        <div className="border-ink-100 mt-3 border-t pt-3">
          <p className="text-ink-900 text-xs font-bold">{POLL_PAGE.question}</p>
          <p className="text-ink-400 mt-0.5 text-[10px]">Pick any · {POLL_PAGE.voters} voted</p>
          <div className="mt-2 space-y-1.5">
            {POLL_PAGE.options.map((o) => (
              <div key={o.label} className="border-ink-100 relative overflow-hidden rounded-lg border px-2.5 py-2">
                <div
                  className={cn("absolute inset-y-0 left-0", o.mine ? "bg-court-100" : "bg-ink-50")}
                  style={{ width: `${(o.count / POLL_PAGE.voters) * 100}%` }}
                />
                <div className="relative flex items-center justify-between text-xs">
                  <span className="text-ink-800 font-semibold">
                    {o.label} {o.mine && <span className="text-court-700">✓ your pick</span>}
                  </span>
                  <span className="text-ink-500">
                    {o.count} · {Math.round((o.count / POLL_PAGE.voters) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-ink-400 mt-2 text-[11px]">
            You&apos;ve voted. Pick different options to change your answer.
          </p>
          <div className="mt-3">
            <Advance block>
              <Button block size="sm">
                Update Vote
              </Button>
            </Advance>
          </div>
        </div>
      </Card>
    </PhonePage>
  )
}

/* Step 31a — Generate playoffs (league, desktop) */
export function ScenePlayoffWizard() {
  return (
    <div className="px-10 py-8">
      <SeasonHeader status="In Progress" statusTone="play" lifecycle="Mark Completed" />
      <SeasonTabs active="Playoffs" />
      <Panel title="Generate playoffs">
        <p className="text-ink-500 mb-4 text-sm">
          Pick a division and how many teams qualify. You&apos;ll only be offered formats that work
          for that number. Seeds come from the current standings.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-ink-700 mb-1.5 text-sm font-semibold">Division</p>
            <SelectBox value="Grade 10 Boys" placeholder="Select…" />
          </div>
          <div>
            <p className="text-ink-700 mb-1.5 text-sm font-semibold">Teams qualifying</p>
            <TxtInput value="4" placeholder="e.g. 4" />
          </div>
          <div>
            <p className="text-ink-700 mb-1.5 text-sm font-semibold">First round date</p>
            <TxtInput value="2026-07-04" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="border-play-300 bg-play-50/50 rounded-xl border p-4" aria-pressed="true">
            <div className="flex items-center gap-2">
              <p className="text-ink-900 text-sm font-bold">{PLAYOFFS.formatLabel}</p>
              <Badge tone="gold">Recommended</Badge>
            </div>
            <p className="text-ink-500 mt-1 text-xs">{PLAYOFFS.formatDesc}</p>
            <p className="text-ink-400 mt-1.5 text-xs font-semibold">3 games · 2 round(s)</p>
          </div>
          <div className="border-ink-200 rounded-xl border p-4">
            <p className="text-ink-900 text-sm font-bold">{PLAYOFFS.altLabel}</p>
            <p className="text-ink-500 mt-1 text-xs">{PLAYOFFS.altDesc}</p>
            <p className="text-ink-400 mt-1.5 text-xs font-semibold">4 games · 2 round(s)</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-ink-700 mb-2 text-sm font-semibold">Seeds (current standings)</p>
          <div className="space-y-1.5">
            {PLAYOFFS.seeds.map((s) => (
              <p key={s.seed} className="text-ink-700 text-sm">
                <span className="text-ink-400 font-bold">#{s.seed}</span>{" "}
                <span className="font-semibold">{s.team}</span>{" "}
                <span className="text-ink-400">{s.record}</span>
              </p>
            ))}
          </div>
        </div>
        <div className="mt-5">
          <Advance confirm="Bracket generated">
            <Button>Generate bracket</Button>
          </Advance>
        </div>
      </Panel>
    </div>
  )
}

/* Step 31b — The bracket, played through to the final */
export function SceneBracket() {
  const games = [
    { round: "Round 1", g: PLAYOFFS.semi1 },
    { round: "Round 1", g: PLAYOFFS.semi2 },
    { round: "Round 2", g: PLAYOFFS.final },
  ]
  return (
    <div className="px-10 py-8">
      <SeasonHeader status="In Progress" statusTone="play" lifecycle="Mark Completed" />
      <SeasonTabs active="Playoffs" />
      <Panel title="Playoffs" action={<span className="text-ink-400 text-xs">Delete bracket</span>}>
        <p className="text-ink-500 mb-4 text-sm">
          4 teams · single games · later rounds appear automatically as results are finalized.
        </p>
        <div className="grid grid-cols-2 gap-5">
          <div className="space-y-3">
            <p className="text-ink-400 text-xs font-bold uppercase tracking-[0.12em]">Round 1</p>
            {games.slice(0, 2).map(({ g }) => (
              <Card key={g.label} size="sm">
                <div className="flex items-center justify-between">
                  <p className="text-ink-400 text-xs font-bold">{g.label}</p>
                  <Badge tone="court">COMPLETED</Badge>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={cn("font-bold", g.hs > g.as ? "text-ink-950" : "text-ink-500")}>{g.home}</span>
                    <span className="font-bold tabular-nums">{g.hs}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={cn("font-bold", g.as > g.hs ? "text-ink-950" : "text-ink-500")}>{g.away}</span>
                    <span className="font-bold tabular-nums">{g.as}</span>
                  </div>
                </div>
                <p className="text-ink-400 mt-2 text-xs">{g.when}</p>
              </Card>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-ink-400 text-xs font-bold uppercase tracking-[0.12em]">Round 2</p>
            <Advance block>
              <Card size="sm" className="border-gold-100 bg-highlight-soft">
                <div className="flex items-center justify-between">
                  <p className="text-ink-400 text-xs font-bold">{PLAYOFFS.final.label}</p>
                  <Badge tone="court">COMPLETED</Badge>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-950 font-bold">🏆 {PLAYOFFS.final.home}</span>
                    <span className="font-bold tabular-nums">{PLAYOFFS.final.hs}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-500 font-bold">{PLAYOFFS.final.away}</span>
                    <span className="font-bold tabular-nums">{PLAYOFFS.final.as}</span>
                  </div>
                </div>
                <p className="text-ink-400 mt-2 text-xs">{PLAYOFFS.final.when}</p>
              </Card>
            </Advance>
          </div>
        </div>
      </Panel>
    </div>
  )
}

/* Step 31c — Championship recap (phone) */
export function SceneChampRecap() {
  return (
    <RecapArticle
      title={CHAMP_RECAP.title}
      date={CHAMP_RECAP.date}
      body={CHAMP_RECAP.body}
      cover={CHAMP_COVER}
      advanceOnPill="Box score & play-by-play →"
      confirmText="Champions crowned"
    />
  )
}
