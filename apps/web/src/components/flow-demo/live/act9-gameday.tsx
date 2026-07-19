"use client"

/**
 * Act 10 — Game day, live: the pre-game checklist, attendance roll-call,
 * starting fives, then live scoring side by side with the public game page.
 * Every console tap lands on the phone instantly — no refreshing. Mirrors
 * /games/[id]/score and /live/[gameId] (docs/demo-inventory/season.md).
 */

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/components/ui/cn"
import { PhoneFrame } from "../frames"
import { GAME, LEAGUE } from "../data"
import type { LiveScene } from "./engine"

const TABLE = "Scorer's table"

const Hold = ({ id, children, block }: { id: string; children: React.ReactNode; block?: boolean }) => (
  <span data-live-id={id} className={cn("rounded-xl", block ? "block" : "inline-block")}>
    {children}
  </span>
)

const HOME_FIVE = [
  { j: 23, n: "Jayden T." },
  { j: 7, n: "Marcus C." },
  { j: 11, n: "Malik O." },
  { j: 4, n: "Ethan P." },
  { j: 15, n: "Owen C." },
]
const AWAY_FIVE = [
  { j: 10, n: "Noah S." },
  { j: 3, n: "Lucas K." },
  { j: 24, n: "Ibrahim H." },
  { j: 8, n: "Felix W." },
  { j: 14, n: "Santiago S." },
]

/* G1 — The game-day checklist */
const checklist: LiveScene = {
  id: "l-checklist",
  act: "gameday",
  persona: "club",
  personaLabel: TABLE,
  frame: "desktop",
  url: "/games/g10-w1-force-huskies/score",
  caption:
    "Saturday, May 30, Pan Am Sports Centre. The console opens with a checklist: referee assigned, who runs the clock.",
  script: [
    { wait: 600 },
    { press: "yesClock" },
    { set: { clock: true } },
    { wait: 500 },
    { hold: "continueBtn" },
  ],
  render: (g) => (
    <div className="bg-ink-50 flex min-h-[560px] items-center justify-center px-10 py-10">
      <Card className="w-full max-w-lg">
        <p className="text-ink-400 text-xs font-bold uppercase tracking-[0.14em]">Before tip-off</p>
        <h2 className="text-ink-950 mt-1 text-xl font-bold">Game-day checklist</h2>
        <div className="divide-ink-50 mt-4 divide-y">
          <div className="flex justify-between py-2.5 text-sm">
            <span className="text-ink-500">Scorekeeper</span>
            <span className="text-ink-900 font-semibold">David Okafor</span>
          </div>
          <div className="flex justify-between py-2.5 text-sm">
            <span className="text-ink-500">Referee</span>
            <span className="text-ink-900 font-semibold">Mike Ferreira</span>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-ink-900 text-sm font-bold">Run the game clock?</p>
          <p className="text-ink-400 mt-0.5 text-xs">
            Only choose Yes if you&apos;ll operate start/stop during play, otherwise minutes count
            wrongly. Most games just use the arena clock.
          </p>
          <div className="mt-2.5 flex gap-2">
            <span
              data-live-id="yesClock"
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                g("clock") ? "border-play-400 bg-play-50 text-play-800" : "border-ink-200 text-ink-700"
              )}
            >
              Yes, I&apos;ll run it
            </span>
            <span className="border-ink-200 text-ink-700 rounded-xl border px-4 py-2 text-sm font-semibold">
              No clock
            </span>
          </div>
        </div>
        <div className="mt-5">
          <Hold id="continueBtn" block>
            <Button block>Continue to attendance &amp; scoring &rarr;</Button>
          </Hold>
        </div>
      </Card>
    </div>
  ),
}

/* G2 — Attendance roll-call */
const attendance: LiveScene = {
  id: "l-attendance",
  act: "gameday",
  persona: "club",
  personaLabel: TABLE,
  frame: "desktop",
  url: "/games/g10-w1-force-huskies/score",
  caption:
    "Everyone starts as present; the scorekeeper taps whoever is missing. Absences show on the scoresheet and don't count a game played.",
  script: [
    { wait: 600 },
    { press: "abs18" },
    { set: { absent: true } },
    { wait: 700 },
    { hold: "lineupsBtn" },
  ],
  render: (g) => (
    <div className="bg-ink-50 min-h-[560px] px-10 py-8">
      <h2 className="text-ink-950 text-center text-xl font-bold">
        Attendance · {GAME.home} vs {GAME.away}
      </h2>
      <p className="text-ink-500 mx-auto mt-1 max-w-2xl text-center text-sm">
        Everyone starts as present. Tap whoever is missing. Absent players show on the scoresheet
        and don&apos;t count a game played in their season stats.
      </p>
      <div className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-4">
        {[
          { name: GAME.home, chips: [...HOME_FIVE, { j: 21, n: "Isaiah G." }, { j: 18, n: "Xavier R." }], absentable: true },
          { name: GAME.away, chips: [...AWAY_FIVE, { j: 5, n: "Theo B." }] },
        ].map((team) => {
          const absent = team.absentable && g("absent") ? 1 : 0
          return (
            <Card key={team.name} size="sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-ink-900 text-sm font-bold">{team.name}</p>
                <p className="text-ink-400 text-xs">
                  {team.chips.length - absent} here · {absent} absent
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {team.chips.map((p) => {
                  const isAbsent = team.absentable && p.j === 18 && g("absent")
                  return (
                    <div
                      key={p.j}
                      data-live-id={team.absentable && p.j === 18 ? "abs18" : undefined}
                      className={cn(
                        "rounded-xl border px-2 py-2 text-center transition-colors",
                        isAbsent ? "border-ink-200 bg-ink-100 opacity-60" : "border-court-200 bg-court-50/50"
                      )}
                    >
                      <p className="text-ink-950 text-sm font-bold">#{p.j}</p>
                      <p className="text-ink-500 truncate text-[10px]">{p.n}</p>
                      <p className={cn("text-[9px] font-bold uppercase", isAbsent ? "text-ink-400" : "text-court-600")}>
                        {isAbsent ? "absent" : "present"}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>
      <div className="mt-6 text-center">
        <Hold id="lineupsBtn">
          <Button>Continue to starting lineups &rarr;</Button>
        </Hold>
      </div>
    </div>
  ),
}

/* G3 — Starting fives */
const lineups: LiveScene = {
  id: "l-lineups",
  act: "gameday",
  persona: "club",
  personaLabel: TABLE,
  frame: "desktop",
  url: "/games/g10-w1-force-huskies/score",
  caption: "Pick each starting five and tip off. Subs fix anything later.",
  script: [
    { wait: 500 },
    ...HOME_FIVE.flatMap((p) => [
      { press: `pick${p.j}` } as const,
      { set: { [`s${p.j}`]: true } } as const,
      { wait: 160 } as const,
    ]),
    { wait: 400 },
    { hold: "startBtn" },
  ],
  render: (g) => {
    const picked = HOME_FIVE.filter((p) => g(`s${p.j}`)).length
    return (
      <div className="bg-ink-50 min-h-[560px] px-10 py-8">
        <h2 className="text-ink-950 text-center text-xl font-bold">
          {GAME.home} vs {GAME.away}
        </h2>
        <p className="text-ink-500 mt-1 text-center text-sm">
          {LEAGUE.name} · Pan Am Sports Centre · pick each starting five, then start the game
        </p>
        <div className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-4">
          <Card size="sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-ink-900 text-sm font-bold">{GAME.home}</p>
              <p className={cn("text-xs font-bold", picked === 5 ? "text-court-600" : "text-ink-400")}>
                starting five: {picked}/5
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[...HOME_FIVE, { j: 21, n: "Isaiah G." }].map((p) => (
                <div
                  key={p.j}
                  data-live-id={`pick${p.j}`}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-center transition-colors",
                    g(`s${p.j}`) ? "border-play-400 bg-play-50" : "border-ink-200 bg-white"
                  )}
                >
                  <p className="text-ink-950 text-sm font-bold">#{p.j}</p>
                  <p className="text-ink-500 truncate text-[10px]">{p.n}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card size="sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-ink-900 text-sm font-bold">{GAME.away}</p>
              <p className="text-court-600 text-xs font-bold">starting five: 5/5</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {AWAY_FIVE.map((p) => (
                <div key={p.j} className="border-play-400 bg-play-50 rounded-xl border px-2 py-2 text-center">
                  <p className="text-ink-950 text-sm font-bold">#{p.j}</p>
                  <p className="text-ink-500 truncate text-[10px]">{p.n}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div className="mt-6 flex items-center justify-center gap-4">
          <span className="text-ink-500 text-sm font-semibold">&larr; Attendance</span>
          <Hold id="startBtn">
            <Button disabled={picked < 5}>Start game</Button>
          </Hold>
        </div>
        <p className="text-ink-400 mt-3 text-center text-xs">
          Fewer than 5 marked players? Tap the ones who are here. You can fix lineups with SUBS
          any time.
        </p>
      </div>
    )
  },
}

/* ── The live duo: compact console (real "rows" layout) + public page ──── */

function Chip({ j, dots, id, on }: { j: number; dots: number; id?: string; on?: boolean }) {
  return (
    <div
      data-live-id={id}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-center transition-colors",
        on ? "border-play-400 bg-play-50" : "border-ink-200 bg-white"
      )}
    >
      <p className="text-ink-950 text-sm font-bold tabular-nums">#{j}</p>
      <p className="text-hoop-500 text-[8px] leading-none">{"•".repeat(dots)}</p>
    </div>
  )
}

function Pad({ label, id, on }: { label: string; id?: string; on?: boolean }) {
  return (
    <span
      data-live-id={id}
      className={cn(
        "block rounded-xl border px-2 py-2.5 text-center text-sm font-bold transition-colors",
        on ? "border-play-400 bg-play-50 text-play-800" : "border-ink-200 text-ink-900 bg-white"
      )}
    >
      {label}
    </span>
  )
}

function Console({
  g,
  homeScore,
  awayScore,
  clock,
  ticker,
  strip,
  assistChips,
  reboundOverlay,
  endHold,
}: {
  g: (k: string, d?: unknown) => unknown
  homeScore: number
  awayScore: number
  clock: string
  ticker: string[]
  strip: string
  assistChips?: boolean
  reboundOverlay?: boolean
  endHold?: boolean
}) {
  const endBtn = (
    <span className="border-ink-300 text-ink-900 rounded-lg border bg-white px-2.5 py-1 text-xs font-bold">
      End game &rarr;
    </span>
  )
  return (
    <div className="border-ink-200 relative overflow-hidden rounded-2xl border bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.45)]">
      <div className="border-ink-100 bg-ink-50 flex items-center gap-3 border-b px-4 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
        </div>
        <span className="text-ink-400 mx-auto truncate text-[11px]">
          sportshubone.com/games/g10-w1/score
        </span>
      </div>
      <div className="bg-ink-50/60 space-y-3 p-4">
        {/* Score header */}
        <div className="border-ink-200 rounded-xl border bg-white px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#16a34a" }} />
              <span className="text-ink-900 text-xs font-bold">{GAME.homeShort}</span>
              <span key={homeScore} className="score-flash text-ink-950 text-2xl font-bold tabular-nums">
                {homeScore}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="bg-ink-900 rounded-full px-2 py-0.5 text-[10px] font-bold text-white">Q4</span>
              <span className="border-ink-200 rounded-md border px-1.5 py-0.5 text-xs font-bold tabular-nums">
                {clock} ⏸
              </span>
              {endHold ? <Hold id="endGame">{endBtn}</Hold> : endBtn}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-ink-950 text-2xl font-bold tabular-nums">{awayScore}</span>
              <span className="text-ink-900 text-xs font-bold">{GAME.awayShort}</span>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#7c3aed" }} />
            </div>
          </div>
          <div className="border-ink-100 mt-2 flex items-center gap-1.5 border-t pt-2">
            {ticker.map((t, i) => (
              <span key={i} className="bg-ink-50 text-ink-600 rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                {t} ✕
              </span>
            ))}
            <span className="text-court-600 ml-auto text-[10px] font-bold">synced</span>
            <span className="border-ink-200 rounded border px-1 py-0.5 text-[10px] font-bold">BOX</span>
            <span className="border-ink-200 text-hoop-600 rounded border px-1 py-0.5 text-[10px] font-bold">UNDO</span>
          </div>
        </div>
        {/* Chip rows */}
        <div className="flex items-center gap-1.5">
          <span className="text-ink-500 text-xs font-bold">⇄</span>
          {HOME_FIVE.map((p) => (
            <Chip key={p.j} j={p.j} dots={p.j === 15 ? 3 : p.j === 11 ? 2 : 1} id={`tile${p.j}`} on={!!g(`hl${p.j}`)} />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-ink-500 text-xs font-bold">⇄</span>
          {AWAY_FIVE.map((p) => (
            <Chip key={p.j} j={p.j} dots={p.j === 14 ? 4 : 2} id={`atile${p.j}`} on={!!g(`al${p.j}`)} />
          ))}
        </div>
        {/* Status strip + action pad */}
        <p className="text-ink-500 rounded-lg bg-white px-3 py-1.5 text-center text-xs font-semibold">{strip}</p>
        {assistChips && (
          <div className="live-row-in flex items-center justify-center gap-1.5">
            {[7, 11, 4, 15].map((j) => (
              <span
                key={j}
                data-live-id={`assist${j}`}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-bold",
                  g(`as${j}`) ? "border-play-400 bg-play-50 text-play-800" : "border-ink-200 bg-white"
                )}
              >
                #{j}
              </span>
            ))}
            <span className="text-ink-400 text-xs font-semibold">skip</span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          <Pad label="+2" id="plus2" on={!!g("plus2on")} />
          <Pad label="+3" />
          <Pad label="FT ✓" />
          <Pad label="2 ✗" id="miss2" on={!!g("miss2on")} />
          <Pad label="3 ✗" />
          <Pad label="FT ✗" />
          <Pad label="REB" />
          <Pad label="AST" />
          <Pad label="FOUL" />
        </div>
      </div>
      {reboundOverlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-900/40 p-6">
          <Card size="sm" className="live-pop w-full max-w-sm">
            <p className="text-ink-950 text-sm font-bold">Who got the rebound?</p>
            <p className="text-ink-500 mt-0.5 text-xs">
              Missed shot by #10. Tap whoever grabbed the ball. Their team keeps it (offensive) or
              takes it over (defensive).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase">Offense · {GAME.awayShort}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[10, 24, 14].map((j) => (
                    <span key={j} className="border-ink-200 rounded-lg border bg-white px-2 py-1 text-xs font-bold">
                      #{j}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-ink-400 mb-1.5 text-[10px] font-bold uppercase">Defense · {GAME.homeShort}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[11, 23, 15].map((j) => (
                    <span
                      key={j}
                      data-live-id={j === 11 ? "reb11" : undefined}
                      className={cn(
                        "rounded-lg border px-2 py-1 text-xs font-bold",
                        j === 11 && g("reb") ? "border-play-400 bg-play-50" : "border-ink-200 bg-white"
                      )}
                    >
                      #{j}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-ink-400 mt-3 text-center text-xs font-semibold">Skip, no rebound recorded</p>
          </Card>
        </div>
      )}
    </div>
  )
}

function LivePhone({
  homeScore,
  awayScore,
  clock,
  plays,
  flash,
}: {
  homeScore: number
  awayScore: number
  clock: string
  plays: string[]
  flash?: boolean
}) {
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
            <p key={homeScore} className={cn("text-3xl font-bold tabular-nums", flash && "score-flash")}>
              {homeScore}
            </p>
          </div>
          <div className="text-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              Live
            </span>
            <p className="mt-0.5 text-[10px] font-bold">Q4</p>
            <p className="text-[10px] tabular-nums text-white/70">{clock}</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold">{GAME.awayShort}</p>
            <p className="text-3xl font-bold tabular-nums">{awayScore}</p>
          </div>
        </div>
      </div>
      <div className="border-ink-100 flex border-b text-center text-xs font-bold">
        {["Game", "Stats", "Plays"].map((t, i) => (
          <span key={t} className={cn("flex-1 py-2", i === 2 ? "text-ink-950 border-ink-900 border-b-2" : "text-ink-400")}>
            {t}
          </span>
        ))}
      </div>
      <div className="divide-ink-50 divide-y px-4 py-2">
        {plays.map((p, i) => (
          <p key={p} className={cn("text-ink-700 py-1.5 text-[11px]", i === 0 && flash && "score-flash")}>
            {p}
          </p>
        ))}
      </div>
    </div>
  )
}

function Duo({ console: c, phone }: { console: React.ReactNode; phone: React.ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
      <div className="min-w-0">
        <p className="text-ink-500 mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">
          The scorer&apos;s table (console)
        </p>
        {c}
      </div>
      <div className="min-w-0">
        <p className="text-ink-500 mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em]">
          What every family sees, live
        </p>
        {phone}
      </div>
    </div>
  )
}

const PLAYS_0 = [
  "#7 Marcus C. makes a free throw",
  "Foul on #14 Santiago S.",
  "#10 Noah S. scores 2",
  "#23 Jayden T. scores 3, assisted by #4 Ethan P.",
]

/* G4 — Score it once, it's everywhere: +2 with the assist chain */
const liveScore: LiveScene = {
  id: "l-live-score",
  act: "gameday",
  persona: "club",
  personaLabel: TABLE,
  frame: "plain",
  caption:
    "Fourth quarter. Tap +2 at the table and watch the right side: the basket lands on every phone in the gym the moment it happens. Nobody refreshes anything.",
  script: [
    { wait: 700 },
    { hold: "plus2" },
    { set: { plus2on: true, strip: "2PT. Now tap the player" } },
    { wait: 700 },
    { press: "tile23" },
    { set: { hl23: true, strip: "Assist by?", assist: true } },
    { wait: 800 },
    { press: "assist7" },
    { set: { as7: true } },
    { wait: 300 },
    { set: { scored: true, assist: false, plus2on: false, hl23: false, strip: "Tap an action, then a player. Either order works" } },
    { wait: 1400 },
    { confirm: "On every phone. No refresh." },
  ],
  render: (g) => (
    <Duo
      console={
        <Console
          g={g}
          homeScore={g("scored") ? 58 : 56}
          awayScore={52}
          clock={g("scored") ? "5:04" : "5:12"}
          ticker={g("scored") ? ["2PT #23", "AST #7", "3PT #23"] : ["3PT #23", "2PT #10", "FT #7"]}
          strip={(g("strip") as string) ?? "Tap an action, then a player. Either order works"}
          assistChips={!!g("assist")}
        />
      }
      phone={
        <PhoneFrame sceneKey="live-duo-score">
          <LivePhone
            homeScore={g("scored") ? 58 : 56}
            awayScore={52}
            clock={g("scored") ? "5:04" : "5:12"}
            flash={!!g("scored")}
            plays={g("scored") ? ["#23 Jayden T. scores 2, assisted by #7 Marcus C.", ...PLAYS_0] : PLAYS_0}
          />
        </PhoneFrame>
      }
    />
  ),
}

/* G5 — The other side of the ball: miss and rebound, then the horn */
const liveRebound: LiveScene = {
  id: "l-live-rebound",
  act: "gameday",
  persona: "club",
  personaLabel: TABLE,
  frame: "plain",
  caption:
    "Misses and rebounds too: a missed 2 by the Huskies, board to Malik, and the play-by-play writes itself on every screen. Then the horn.",
  script: [
    { wait: 700 },
    { press: "miss2" },
    { set: { miss2on: true, strip: "2PT miss. Now tap the player" } },
    { wait: 600 },
    { press: "atile10" },
    { set: { al10: true, rebound: true } },
    { wait: 900 },
    { press: "reb11" },
    { set: { reb: true } },
    { wait: 400 },
    { set: { rebounded: true, rebound: false, miss2on: false, al10: false, strip: "Tap an action, then a player. Either order works" } },
    { wait: 1200 },
    { set: { final: true } },
    { wait: 600 },
    { hold: "endGame" },
  ],
  render: (g) => (
    <Duo
      console={
        <Console
          g={g}
          homeScore={g("final") ? 62 : 58}
          awayScore={g("final") ? 58 : 52}
          clock={g("final") ? "0:00" : "4:41"}
          ticker={g("rebounded") ? ["2✗ #10", "REB #11", "2PT #23"] : ["2PT #23", "AST #7", "3PT #23"]}
          strip={(g("strip") as string) ?? "Tap an action, then a player. Either order works"}
          reboundOverlay={!!g("rebound")}
          endHold
        />
      }
      phone={
        <PhoneFrame sceneKey="live-duo-rebound">
          <LivePhone
            homeScore={g("final") ? 62 : 58}
            awayScore={g("final") ? 58 : 52}
            clock={g("final") ? "0:00" : "4:41"}
            flash={!!g("rebounded")}
            plays={
              g("rebounded")
                ? [
                    "#10 Noah S. misses a 2-pointer, defensive rebound #11 Malik O.",
                    "#23 Jayden T. scores 2, assisted by #7 Marcus C.",
                    ...PLAYS_0,
                  ]
                : ["#23 Jayden T. scores 2, assisted by #7 Marcus C.", ...PLAYS_0]
            }
          />
        </PhoneFrame>
      }
    />
  ),
}

export const ACT_GAMEDAY: LiveScene[] = [checklist, attendance, lineups, liveScore, liveRebound]
