"use client"

/**
 * Parent-cut game day: no scoring console, just the public game page the way
 * a family actually watches it. The box score is built to the real
 * /live/[gameId] structure (linescore, game leaders, full stat columns,
 * starters/bench, team totals) and updates itself cell by cell with the same
 * green flash the product uses. Mirrors docs/demo-inventory/season.md.
 */

import { Badge } from "@/components/ui/badge"
import { cn } from "@/components/ui/cn"
import { GAME, KID, LEAGUE } from "../data"
import type { LiveScene } from "./engine"

const MARIA = "Maria (parent)"

const Hold = ({ id, children, block }: { id: string; children: React.ReactNode; block?: boolean }) => (
  <span data-live-id={id} className={cn("rounded-xl", block ? "block" : "inline-block")}>
    {children}
  </span>
)

/* Base box rows: state just before the closing run. `d` marks on-floor. */
interface Row {
  j: number
  n: string
  min: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  to: number
  pf: number
  floor?: boolean
}
const HOME_BASE: Row[] = [
  { j: 23, n: "Jayden T.", min: 26, pts: 18, reb: 6, ast: 3, stl: 1, blk: 0, to: 2, pf: 2, floor: true },
  { j: 7, n: "Marcus C.", min: 24, pts: 11, reb: 2, ast: 4, stl: 0, blk: 0, to: 1, pf: 1, floor: true },
  { j: 11, n: "Malik O.", min: 23, pts: 9, reb: 7, ast: 1, stl: 0, blk: 1, to: 1, pf: 3, floor: true },
  { j: 4, n: "Ethan P.", min: 21, pts: 6, reb: 1, ast: 2, stl: 2, blk: 0, to: 0, pf: 2, floor: true },
  { j: 15, n: "Owen C.", min: 19, pts: 5, reb: 4, ast: 0, stl: 0, blk: 0, to: 1, pf: 4, floor: true },
  { j: 21, n: "Isaiah G.", min: 13, pts: 4, reb: 5, ast: 0, stl: 0, blk: 0, to: 0, pf: 1 },
  { j: 9, n: "Andre B.", min: 11, pts: 3, reb: 1, ast: 1, stl: 1, blk: 0, to: 1, pf: 0 },
  { j: 33, n: "Kai N.", min: 10, pts: 2, reb: 2, ast: 0, stl: 0, blk: 0, to: 0, pf: 1 },
  { j: 12, n: "Darius B.", min: 9, pts: 1, reb: 0, ast: 1, stl: 0, blk: 0, to: 0, pf: 0 },
  { j: 5, n: "Amir K.", min: 7, pts: 0, reb: 1, ast: 0, stl: 0, blk: 0, to: 1, pf: 1 },
  { j: 30, n: "Cole A.", min: 6, pts: 0, reb: 2, ast: 0, stl: 0, blk: 0, to: 0, pf: 2 },
]

function Flash({ on, children, bold }: { on?: boolean; children: React.ReactNode; bold?: boolean }) {
  return (
    <span key={String(children)} className={cn("tabular-nums", on && "score-flash", bold && "font-bold")}>
      {children}
    </span>
  )
}

/* The one parent game-day scene: the page scores itself */
const parentBoxScore: LiveScene = {
  id: "l-parent-boxscore",
  act: "pgame",
  persona: "parent",
  personaLabel: MARIA,
  frame: "phone",
  caption:
    "Game day, from the stands or from work. The box score keeps itself current: watch Jayden's three, the assist, and the rebound land in the numbers the second they happen.",
  script: [
    { wait: 1200 },
    // Jayden hits a three, Marcus assists: PTS, AST, totals and linescore flash
    { set: { three: true } },
    { wait: 2200 },
    // Huskies answer inside
    { set: { answer: true } },
    { wait: 2000 },
    // Malik rips the defensive board off a Huskies miss
    { set: { board: true } },
    { wait: 1800 },
    { set: { final: true } },
    { wait: 800 },
    { hold: "leadersCard" },
  ],
  render: (g) => {
    const three = !!g("three")
    const answer = !!g("answer")
    const board = !!g("board")
    const fin = !!g("final")
    const homeScore = three ? 62 : 59
    const awayScore = answer ? 58 : 56
    const jayden = { pts: three ? 21 : 18, ast: 3 }
    const marcusAst = three ? 5 : 4
    const malikReb = board ? 8 : 7
    const q4Home = three ? 17 : 14
    const q4Away = answer ? 14 : 12
    const totals = {
      pts: homeScore,
      reb: 31 + (board ? 1 : 0),
      ast: 12 + (three ? 1 : 0),
      stl: 4,
      blk: 1,
      to: 7,
      pf: 17,
    }
    return (
      <div className="min-h-full bg-white">
        <div
          className="px-4 py-4 text-white"
          style={{ background: "linear-gradient(120deg, #14532d 0%, #0b0b0f 55%, #4c1d95 100%)" }}
        >
          <p className="text-center text-[10px] font-semibold text-white/70">
            {LEAGUE.name} · {LEAGUE.season}
          </p>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="text-center">
              <p className="text-xs font-bold">{GAME.homeShort}</p>
              <p key={homeScore} className={cn("text-3xl font-bold tabular-nums", three && "score-flash")}>
                {homeScore}
              </p>
            </div>
            <div className="text-center">
              {fin ? (
                <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide">
                  Final
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                    Live
                  </span>
                  <p className="mt-0.5 text-[10px] font-bold">Q4</p>
                  <p className="text-[10px] tabular-nums text-white/70">{three ? "0:41" : "1:58"}</p>
                </>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs font-bold">{GAME.awayShort}</p>
              <p key={awayScore} className={cn("text-3xl font-bold tabular-nums", answer && !fin && "score-flash")}>
                {awayScore}
              </p>
            </div>
          </div>
        </div>
        <div className="border-ink-100 flex border-b text-center text-xs font-bold">
          {["Game", "Stats", "Plays"].map((t, i) => (
            <span key={t} className={cn("flex-1 py-2", i === 1 ? "text-ink-950 border-ink-900 border-b-2" : "text-ink-400")}>
              {t}
            </span>
          ))}
        </div>
        <div className="space-y-3 px-3 py-3">
          {/* Linescore */}
          <div className="border-ink-100 overflow-hidden rounded-xl border">
            <table className="w-full text-center text-[11px]">
              <thead className="border-ink-100 border-b">
                <tr>
                  <th className="text-ink-500 px-2 py-1.5 text-left font-extrabold" />
                  {[1, 2, 3, 4].map((q) => (
                    <th key={q} className="text-ink-500 px-2 py-1.5 font-extrabold">
                      {q}
                    </th>
                  ))}
                  <th className="text-ink-500 px-2 py-1.5 font-extrabold">Tot</th>
                </tr>
              </thead>
              <tbody className="divide-ink-50 divide-y">
                <tr>
                  <td className="text-ink-900 px-2 py-1.5 text-left font-bold">{GAME.homeShort}</td>
                  <td className="px-2 py-1.5">16</td>
                  <td className="px-2 py-1.5">14</td>
                  <td className="px-2 py-1.5">15</td>
                  <td className="px-2 py-1.5">
                    <Flash on={three}>{q4Home}</Flash>
                  </td>
                  <td className="px-2 py-1.5 font-bold">
                    <Flash on={three} bold>
                      {homeScore}
                    </Flash>
                  </td>
                </tr>
                <tr>
                  <td className="text-ink-900 px-2 py-1.5 text-left font-bold">{GAME.awayShort}</td>
                  <td className="px-2 py-1.5">15</td>
                  <td className="px-2 py-1.5">16</td>
                  <td className="px-2 py-1.5">13</td>
                  <td className="px-2 py-1.5">
                    <Flash on={answer && !fin}>{q4Away}</Flash>
                  </td>
                  <td className="px-2 py-1.5 font-bold">
                    <Flash on={answer && !fin} bold>
                      {awayScore}
                    </Flash>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Game leaders */}
          <Hold id="leadersCard" block>
            <div className="border-ink-100 rounded-xl border p-3">
              <p className="text-ink-900 mb-2 text-xs font-bold">Game leaders</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Points", `#23 ${KID.short}`, jayden.pts, "PTS", `${malikReb === 8 ? 6 : 6} REB · 3 AST`, three],
                  ["Rebounds", "#11 Malik O.", malikReb, "REB", "9 PTS · 1 AST", board],
                  ["Assists", "#7 Marcus C.", marcusAst, "AST", "11 PTS · 2 REB", three],
                  ["Defense", "#4 Ethan P.", 2, "STL", "6 PTS · 2 AST", false],
                ].map(([cat, who, n, unit, sub, flash]) => (
                  <div key={String(cat)} className="bg-ink-50 rounded-lg p-2.5">
                    <p className="text-ink-400 text-[9px] font-bold uppercase tracking-[0.12em]">{String(cat)}</p>
                    <p className="text-ink-900 mt-0.5 text-[11px] font-bold">{String(who)}</p>
                    <p className="text-ink-950 text-lg font-bold">
                      <Flash on={!!flash} bold>
                        {n as number}
                      </Flash>{" "}
                      <span className="text-ink-400 text-[9px] font-semibold">{String(unit)}</span>
                    </p>
                    <p className="text-ink-400 text-[9px]">{String(sub)}</p>
                  </div>
                ))}
              </div>
            </div>
          </Hold>
          {/* Full box score */}
          <div className="border-ink-100 overflow-hidden rounded-xl border">
            <div className="border-ink-100 flex border-b text-center text-[11px] font-bold">
              <span className="text-ink-950 border-ink-900 flex-1 border-b-2 py-1.5">{GAME.homeShort}</span>
              <span className="text-ink-400 flex-1 py-1.5">{GAME.awayShort}</span>
            </div>
            <table className="w-full text-[10.5px]">
              <thead className="border-ink-100 border-b">
                <tr>
                  {["Player", "Min", "Pts", "Reb", "Ast", "Stl", "Blk", "TO", "PF"].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        "text-ink-500 px-1 py-1.5 font-extrabold uppercase tracking-tight",
                        i === 0 ? "pl-2 text-left" : "text-center"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-ink-50 divide-y">
                <tr>
                  <td colSpan={9} className="text-ink-400 bg-ink-50/60 px-2 py-0.5 text-[9px] font-bold uppercase">
                    Starters
                  </td>
                </tr>
                {HOME_BASE.slice(0, 5).map((p) => {
                  const pts = p.j === 23 ? jayden.pts : p.pts
                  const ast = p.j === 7 ? marcusAst : p.ast
                  const reb = p.j === 11 ? malikReb : p.reb
                  return (
                    <tr key={p.j}>
                      <td className="text-ink-900 py-1 pl-2 pr-1 font-semibold">
                        #{p.j} {p.n}
                        {p.j === 23 && (
                          <span className="bg-gold-50 text-gold-600 ml-1 rounded px-0.5 text-[8px] font-bold">TOP</span>
                        )}
                        {p.floor && !fin && <span className="text-court-500"> ●</span>}
                      </td>
                      <td className="px-1 py-1 text-center tabular-nums">{p.min + (three ? 2 : 0)}</td>
                      <td className="px-1 py-1 text-center font-bold">
                        <Flash on={p.j === 23 && three} bold>
                          {pts}
                        </Flash>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <Flash on={p.j === 11 && board}>{reb}</Flash>
                      </td>
                      <td className="px-1 py-1 text-center">
                        <Flash on={p.j === 7 && three}>{ast}</Flash>
                      </td>
                      <td className="px-1 py-1 text-center tabular-nums">{p.stl}</td>
                      <td className="px-1 py-1 text-center tabular-nums">{p.blk}</td>
                      <td className="px-1 py-1 text-center tabular-nums">{p.to}</td>
                      <td className={cn("px-1 py-1 text-center tabular-nums", p.pf >= 4 && "text-hoop-600 font-bold")}>
                        {p.pf}
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td colSpan={9} className="text-ink-400 bg-ink-50/60 px-2 py-0.5 text-[9px] font-bold uppercase">
                    Bench
                  </td>
                </tr>
                {HOME_BASE.slice(5).map((p) => (
                  <tr key={p.j}>
                    <td className="text-ink-900 py-1 pl-2 pr-1 font-semibold">
                      #{p.j} {p.n}
                    </td>
                    <td className="px-1 py-1 text-center tabular-nums">{p.min}</td>
                    <td className="px-1 py-1 text-center font-bold tabular-nums">{p.pts}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{p.reb}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{p.ast}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{p.stl}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{p.blk}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{p.to}</td>
                    <td className="px-1 py-1 text-center tabular-nums">{p.pf}</td>
                  </tr>
                ))}
                <tr className="bg-ink-50/60">
                  <td className="text-ink-900 py-1 pl-2 pr-1 font-bold">Team</td>
                  <td className="px-1 py-1 text-center" />
                  <td className="px-1 py-1 text-center font-bold">
                    <Flash on={three} bold>
                      {totals.pts}
                    </Flash>
                  </td>
                  <td className="px-1 py-1 text-center font-bold">
                    <Flash on={board} bold>
                      {totals.reb}
                    </Flash>
                  </td>
                  <td className="px-1 py-1 text-center font-bold">
                    <Flash on={three} bold>
                      {totals.ast}
                    </Flash>
                  </td>
                  <td className="px-1 py-1 text-center font-bold tabular-nums">{totals.stl}</td>
                  <td className="px-1 py-1 text-center font-bold tabular-nums">{totals.blk}</td>
                  <td className="px-1 py-1 text-center font-bold tabular-nums">{totals.to}</td>
                  <td className="px-1 py-1 text-center font-bold tabular-nums">{totals.pf}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {fin && (
            <div className="live-row-in border-court-200 bg-court-50/50 rounded-xl border p-3">
              <p className="text-ink-900 text-xs font-bold">Final Score</p>
              <p className="text-ink-600 text-[11px]">
                Final: {GAME.home} {GAME.finalHome}-{GAME.finalAway} {GAME.away}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  },
}

/* Team chat: the coach posts, the poll runs, Maria votes without leaving */
const liveChat: LiveScene = {
  id: "l-parent-chat",
  act: "schedule",
  persona: "parent",
  personaLabel: MARIA,
  frame: "phone",
  caption:
    "Team chat lives next to the calendar: pinned notes from the coach, and quick polls the whole team answers in a tap. Maria votes on the team dinner.",
  script: [
    { wait: 800 },
    { set: { msg2: true } },
    { wait: 1400 },
    { press: "pollOpt" },
    { set: { voted: true } },
    { wait: 900 },
    { hold: "pollsLink" },
  ],
  render: (g) => (
    <div className="bg-ink-50/60 min-h-full px-4 pb-10 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-ink-950 text-base font-bold">Burlington Force Grade 10</p>
          <p className="text-ink-400 text-xs">Burlington Force · Team chat</p>
        </div>
        <Hold id="pollsLink">
          <span className="text-play-700 text-xs font-bold">Polls</span>
        </Hold>
      </div>
      <div className="border-ink-100 mt-3 rounded-2xl border bg-white">
        <div className="border-ink-100 flex items-center gap-2 border-b px-3 py-2">
          <span className="text-xs">📌</span>
          <p className="text-ink-600 flex-1 truncate text-xs">
            <span className="font-bold">David Okafor:</span> Practice moves to Haber Rec on
            Thursday, 7pm, Court 2.
          </p>
        </div>
        <div className="space-y-3 px-3 py-3">
          <p className="text-ink-400 text-center text-[10px] font-bold uppercase">Today</p>
          <div className="max-w-[85%]">
            <p className="text-ink-400 mb-0.5 text-[10px] font-semibold">
              David Okafor{" "}
              <span className="bg-play-50 text-play-700 rounded px-1 py-px text-[8px] font-bold">STAFF</span>
              <span className="ml-1">4:12 PM</span>
            </p>
            <div className="bg-ink-50 text-ink-800 rounded-2xl px-3 py-2 text-xs">
              Great win Saturday. Film session before Thursday practice, doors at 6:40.
            </div>
          </div>
          {!!g("msg2") && (
            <div className="live-row-in ml-auto max-w-[85%]">
              <p className="text-ink-400 mb-0.5 text-right text-[10px] font-semibold">You · 4:20 PM</p>
              <div className="bg-play-600 rounded-2xl px-3 py-2 text-xs text-white">
                Jayden will be there. Is the team dinner still on after the last session?
              </div>
            </div>
          )}
          <div className="border-ink-100 max-w-[92%] rounded-2xl border p-3">
            <p className="text-ink-900 text-xs font-bold">📊 Team dinner spot for June 28?</p>
            <div className="mt-2 space-y-1.5">
              {[
                { label: "Boston Pizza on Fairview", count: g("voted") ? 9 : 8, mine: !!g("voted") },
                { label: "The Works Burlington", count: 4 },
                { label: "Potluck at the gym", count: 1 },
              ].map((o, i) => {
                const total = g("voted") ? 14 : 13
                const row = (
                  <div className="border-ink-100 relative overflow-hidden rounded-lg border px-2.5 py-1.5">
                    <div
                      className={cn("absolute inset-y-0 left-0", o.mine ? "bg-court-100" : "bg-ink-50")}
                      style={{ width: `${Math.round((o.count / total) * 100)}%` }}
                    />
                    <div className="relative flex items-center justify-between text-[11px]">
                      <span className="text-ink-800 font-semibold">
                        {o.label}{" "}
                        {o.mine && <span className="text-court-700 live-pop inline-block">✓ your pick</span>}
                      </span>
                      <span className="text-ink-500">
                        {o.count} · {Math.round((o.count / total) * 100)}%
                      </span>
                    </div>
                  </div>
                )
                return i === 0 ? (
                  <div key={o.label} data-live-id="pollOpt">
                    {row}
                  </div>
                ) : (
                  <div key={o.label}>{row}</div>
                )
              })}
            </div>
            <p className="text-ink-400 mt-1.5 text-[10px]">
              {g("voted") ? "14 votes" : "13 votes · tap to vote"}
            </p>
          </div>
        </div>
        <div className="border-ink-100 flex items-center gap-2 border-t px-3 py-2.5">
          <span>📊</span>
          <div className="border-ink-200 text-ink-400 flex-1 rounded-full border px-3 py-1.5 text-xs">
            Message the team…
          </div>
          <span className="bg-play-600 rounded-xl px-3 py-1.5 text-xs font-bold text-white">Send</span>
        </div>
      </div>
    </div>
  ),
}

export const ACT_PARENT_GAMEDAY: LiveScene[] = [liveChat, parentBoxScore]
