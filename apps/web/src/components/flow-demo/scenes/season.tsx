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
import { StandingsTable } from "@/components/ui/standings-table"
import { cn } from "@/components/ui/cn"
import { Advance } from "../advance"
import { DuoFrame } from "../frames"
import { BOX, CHAMP_RECAP, CHAT, GAME, KID, LEAGUE, PLAYOFFS, POLL_PAGE, RECAP, STANDINGS, TEAM } from "../data"
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

function LiveHero({
  homeScore,
  awayScore,
  state,
  clock,
  flash,
}: {
  homeScore: number
  awayScore: number
  state: "live" | "final"
  clock?: string
  flash?: boolean
}) {
  return (
    <div
      className="px-4 py-5 text-white"
      style={{ background: "linear-gradient(120deg, #14532d 0%, #0b0b0f 55%, #4c1d95 100%)" }}
    >
      <p className="text-center text-[11px] font-semibold text-white/70">
        {LEAGUE.name} · {LEAGUE.season}
      </p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-center">
          <p className="text-xs font-bold">{GAME.homeShort}</p>
          <p className="text-[10px] text-white/60">8-1</p>
          <p className={cn("mt-1 text-4xl font-bold tabular-nums", flash && "score-flash")}>{homeScore}</p>
        </div>
        <div className="text-center">
          {state === "live" ? (
            <>
              <span className="bg-live-500/20 text-live-300 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                Live
              </span>
              <p className="mt-1 text-xs font-bold">Q4</p>
              <p className="text-[11px] tabular-nums text-white/70">{clock}</p>
            </>
          ) : (
            <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
              Final
            </span>
          )}
        </div>
        <div className="text-center">
          <p className="text-xs font-bold">{GAME.awayShort}</p>
          <p className="text-[10px] text-white/60">6-3</p>
          <p className={cn("mt-1 text-4xl font-bold tabular-nums", state === "final" && "text-white/60")}>
            {awayScore}
          </p>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] text-white/60">{GAME.venue}</p>
    </div>
  )
}

function LiveScreen({
  homeScore,
  awayScore,
  plays,
  flash,
  clock,
}: {
  homeScore: number
  awayScore: number
  plays: string[]
  flash?: boolean
  clock: string
}) {
  return (
    <div className="min-h-full bg-white">
      <LiveHero homeScore={homeScore} awayScore={awayScore} state="live" clock={clock} flash={flash} />
      <div className="border-ink-100 flex border-b text-center text-sm font-bold">
        {["Game", "Stats", "Plays"].map((t, i) => (
          <span key={t} className={cn("flex-1 py-2.5", i === 2 ? "text-ink-950 border-ink-900 border-b-2" : "text-ink-400")}>
            {t}
          </span>
        ))}
      </div>
      <div className="px-4 py-3">
        <div className="mb-2 flex gap-1.5">
          {["All", "Scoring", "Q4"].map((c, i) => (
            <span
              key={c}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                i === 0 ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-500"
              )}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="divide-ink-50 divide-y">
          {plays.map((p, i) => (
            <p key={p} className={cn("text-ink-700 py-2 text-xs", i === 0 && flash && "score-flash")}>
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

const PLAYS_BEFORE = [
  "#7 Marcus C. makes a free throw",
  "Foul on #14 Santiago S.",
  "#10 Noah S. scores 2",
  "#23 Jayden T. scores 3, assisted by #4 Ethan P.",
  "Sub: #21 in, #30 out",
  "#3 Lucas K. misses a 3-pointer, defensive rebound #11 Malik O.",
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
          plays={["#23 Jayden T. scores 2, assisted by #7 Marcus C.", ...PLAYS_BEFORE]}
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
          <Card size="sm">
            <div className="flex items-center justify-between">
              <Badge tone="neutral">Final</Badge>
              <span className="text-ink-400 text-xs">Today</span>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-ink-950 text-sm font-bold">{GAME.home}</span>
                <span className="text-ink-950 text-lg font-bold tabular-nums">{GAME.finalHome}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-500 text-sm font-semibold">{GAME.away}</span>
                <span className="text-ink-500 text-lg font-bold tabular-nums">{GAME.finalAway}</span>
              </div>
            </div>
          </Card>
        </Advance>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-ink-900 text-sm font-bold">Live now</h2>
          <Badge tone="live" dot>
            2
          </Badge>
        </div>
        <Card size="sm">
          <div className="flex items-center justify-between">
            <Badge tone="live" dot>
              Live
            </Badge>
            <span className="text-ink-400 text-xs">Q3</span>
          </div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-ink-950 text-sm font-bold">Royal Crown Grade 10</span>
              <span className="text-ink-950 text-lg font-bold tabular-nums">41</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-950 text-sm font-bold">North York Lions Grade 10</span>
              <span className="text-ink-950 text-lg font-bold tabular-nums">38</span>
            </div>
          </div>
        </Card>
      </div>
      <div className="mt-5">
        <h2 className="text-ink-900 mb-2 text-sm font-bold">Upcoming</h2>
        <Card size="sm">
          <div className="flex items-center justify-between">
            <Badge tone="play">Upcoming</Badge>
            <span className="text-ink-400 text-xs">4:00 PM</span>
          </div>
          <p className="text-ink-950 mt-2 text-sm font-bold">West United Prep Grade 10</p>
          <p className="text-ink-500 text-sm font-semibold">Oakville Panthers Grade 10</p>
        </Card>
      </div>
    </PhonePage>
  )
}

/* Step 28b — Final box score (phone) */
export function SceneBoxScore() {
  return (
    <div className="min-h-full bg-white">
      <Advance block>
        <div>
          <LiveHero homeScore={GAME.finalHome} awayScore={GAME.finalAway} state="final" />
        </div>
      </Advance>
      <div className="px-4 py-4">
        <Card size="sm" className="overflow-hidden p-0">
          <table className="w-full text-center">
            <thead className="border-ink-100 border-b">
              <tr>
                <Th> </Th>
                {[1, 2, 3, 4].map((q) => (
                  <Th key={q} center>
                    {q}
                  </Th>
                ))}
                <Th center>Tot</Th>
              </tr>
            </thead>
            <tbody className="divide-ink-50 divide-y">
              {[
                [GAME.homeShort, ...GAME.lines.home, GAME.finalHome],
                [GAME.awayShort, ...GAME.lines.away, GAME.finalAway],
              ].map((row) => (
                <tr key={String(row[0])}>
                  {row.map((c, i) => (
                    <Td key={i} center className={cn(i === 0 && "text-left font-bold", i === 5 && "font-bold")}>
                      {c}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card size="sm" className="mt-3">
          <p className="text-ink-900 mb-3 text-sm font-bold">Game leaders</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Points", `#23 ${KID.short}`, "21", "PTS", "6 REB · 3 AST"],
              ["Rebounds", "#11 Malik O.", "8", "REB", "9 PTS · 1 AST"],
              ["Assists", "#7 Marcus C.", "5", "AST", "11 PTS · 2 REB"],
              ["Defense", "#4 Ethan P.", "2", "STL", "6 PTS · 2 AST"],
            ].map(([cat, who, n, unit, sub]) => (
              <div key={cat} className="bg-ink-50 rounded-xl p-3">
                <p className="text-ink-400 text-[10px] font-bold uppercase tracking-[0.12em]">{cat}</p>
                <p className="text-ink-900 mt-1 text-xs font-bold">{who}</p>
                <p className="text-ink-950 text-xl font-bold">
                  {n} <span className="text-ink-400 text-[10px] font-semibold">{unit}</span>
                </p>
                <p className="text-ink-400 text-[10px]">{sub}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card size="sm" className="mt-3 overflow-hidden p-0">
          <div className="border-ink-100 flex border-b text-center text-xs font-bold">
            <span className="text-ink-950 border-ink-900 flex-1 border-b-2 py-2">{GAME.home}</span>
            <span className="text-ink-400 flex-1 py-2">{GAME.away}</span>
          </div>
          <table className="w-full">
            <thead className="border-ink-100 border-b">
              <tr>
                <Th>Player</Th>
                <Th center>Min</Th>
                <Th center>Pts</Th>
                <Th center>Reb</Th>
                <Th center>Ast</Th>
                <Th center>TO</Th>
              </tr>
            </thead>
            <tbody className="divide-ink-50 divide-y">
              <tr>
                <td colSpan={6} className="text-ink-400 bg-ink-50/60 px-3 py-1 text-[10px] font-bold uppercase">
                  Starters
                </td>
              </tr>
              {BOX.slice(0, 5).map((p) => (
                <tr key={p.jersey}>
                  <Td>
                    <span className="font-semibold">
                      #{p.jersey} {p.name}
                    </span>{" "}
                    {p.top && (
                      <span className="bg-gold-50 text-gold-600 rounded px-1 py-0.5 text-[9px] font-bold">TOP</span>
                    )}
                  </Td>
                  <Td center>{p.min}</Td>
                  <Td center className="font-bold">
                    {p.pts}
                  </Td>
                  <Td center>{p.reb}</Td>
                  <Td center>{p.ast}</Td>
                  <Td center>{p.to}</Td>
                </tr>
              ))}
              <tr>
                <td colSpan={6} className="text-ink-400 bg-ink-50/60 px-3 py-1 text-[10px] font-bold uppercase">
                  Bench
                </td>
              </tr>
              {BOX.slice(5, 9).map((p) => (
                <tr key={p.jersey}>
                  <Td>
                    <span className="font-semibold">
                      #{p.jersey} {p.name}
                    </span>
                  </Td>
                  <Td center>{p.min}</Td>
                  <Td center className="font-bold">
                    {p.pts}
                  </Td>
                  <Td center>{p.reb}</Td>
                  <Td center>{p.ast}</Td>
                  <Td center>{p.to}</Td>
                </tr>
              ))}
              <tr className="bg-ink-50/60">
                <Td className="font-bold">Team</Td>
                <Td center />
                <Td center className="font-bold">
                  {GAME.finalHome}
                </Td>
                <Td center className="font-bold">
                  {BOX.reduce((a, p) => a + p.reb, 0)}
                </Td>
                <Td center className="font-bold">
                  {BOX.reduce((a, p) => a + p.ast, 0)}
                </Td>
                <Td center className="font-bold">
                  {BOX.reduce((a, p) => a + p.to, 0)}
                </Td>
              </tr>
            </tbody>
          </table>
        </Card>
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
  advanceOnPill,
  confirmText,
}: {
  title: string
  date: string
  body: string[]
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
  return <RecapArticle title={RECAP.title} date={RECAP.date} body={RECAP.body} advanceOnPill={TEAM.name} />
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
      advanceOnPill="Box score & play-by-play →"
      confirmText="Champions crowned"
    />
  )
}
