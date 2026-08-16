"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { demoNow } from "./motion"
import { cn } from "@/components/ui/cn"
import { Crest } from "@/components/ui/crest"

/**
 * Game-day kit, PHONE AND PHONE (owner ruling 2026-08-16).
 *
 * The 2026-08-15 kit drew a desktop console beside a 300px handset. The owner
 * ruled both sides onto phones: "I want to show them the capability of how easy
 * it is to keep the scoring from the phone... that scorekeeper app should be
 * both mobile." Everything here is therefore authored at 390 logical, rendered
 * at scale 1.0, and nothing is smaller than 14px, which is what
 * `scripts/demo/readability-audit.mjs` gates.
 *
 * TWO SURFACES, MIRRORED SCREEN BY SCREEN AGAINST WHAT SHIPS TODAY:
 *
 *  · THE SCORER'S PHONE — `/games/[id]/score`, which is
 *    `components/scoring/pre-game-checklist.tsx` followed by
 *    `components/scoring/scoring-console.tsx`. The console ALREADY has a phone
 *    layout in the product (`chipRow`, the sticky `actionPad`, the one-line
 *    header), so this is a mirror of a real phone screen, not a fabrication:
 *      · the checklist modal, its Scorekeeper / Referee rows, the "Run the
 *        game clock?" choice with "Yes — I'll run it" / "No clock", the guest
 *        scorekeeper link, and "Continue to attendance & scoring →";
 *      · the attendance roll call, "Everyone starts as present — tap whoever is
 *        missing", present / absent tiles, "+ Add guest player";
 *      · the starting-five picker, "starting five: n/5", "Start game";
 *      · the console header: each team's score and period fouls, the mono clock
 *        button that starts and stops, "End Q1", the event ticker, the synced
 *        pill, BOX and the red UNDO;
 *      · the two fives as JERSEY CHIP ROWS behind a dashed ⇄ subs button, which
 *        is the product's own phone layout;
 *      · the action pad, with EXACTLY the buttons a STANDARD stat-depth league
 *        carries: +2, +3, FT ✓, 2 ✗, 3 ✗, FT ✗, REB, AST, FOUL. No steals, no
 *        blocks, no turnovers: `showHustle` is FULL-depth only;
 *      · the status strip, which really does read "Tap an action, then a player
 *        — either order works" and then names the pending half of the pair;
 *      · the assist chain prompt, "Assist by?", with the four other jerseys;
 *      · the review screen: both box tables, the Player of the Game picker with
 *        "top scorer suggested", and the Referee approval block with its
 *        Signature / Referee PIN switch and the signature pad;
 *      · the official scoresheet at `/scoresheet/[gameId]`, with its foul
 *        boxes, per-quarter scoring marks, signature line and the real
 *        "Download PDF (landscape)" action.
 *
 *  · THE PARENT'S PHONE — `/live/[gameId]`, the phone composition the page
 *    itself ships (`components/score-hero.tsx` renders a full-width row per
 *    team below `sm`): the navy stage, the LIVE pill with the period and the
 *    amber clock, the linescore with a dash for unplayed quarters, the
 *    Game / Team stats / Play-by-play tabs, the box score behind its team
 *    switcher with the full Pts Reb Ast Stl Blk TO PF line, the play rows with
 *    their neutral rail and running score, and, on a finished game, the Player
 *    of the Game card.
 *
 * DEPARTURES, DECLARED (full list in docs/roadmap/game-day-numbers.md §H):
 *  1. TYPE. The live page authors its meta at 10.5px and its play rows at
 *     13.5px. Reproduced here at 14px and up, because the demo is watched at
 *     arm's length on somebody else's laptop.
 *  2. The product joins a miss to its rebound with an em-dash. House copy
 *     forbids one, so the demo joins with a middot.
 *  3. The scorer's phone carries a compact score chip on the review and
 *     scoresheet screens; the real screens rely on the page above them.
 *
 * THE CLOCK IS ONE VALUE. Both phones read `useDemoClock`, a single
 * module-level store with a single ticker, so they cannot drift by a frame:
 * they are rendering the same number. `data-demo-clock` marks both, and the
 * playback drive asserts they are equal on every beat that shows them.
 */

/* ── One clock, both phones ──────────────────────────────────────────────── */

interface ClockState {
  key: string
  base: number
  running: boolean
  startedAt: number
}

const clock: ClockState = { key: "", base: 0, running: false, startedAt: 0 }
const listeners = new Set<() => void>()
let ticker: ReturnType<typeof setInterval> | null = null

/** Seconds the whole demo agrees the period has left.
 *
 *  Measured in DEMO time, not wall time (motion.tsx `demoNow`), so the game
 *  clock runs down at the speed the viewer chose and a speed change mid period
 *  never makes it jump. */
function readClock(): number {
  if (!clock.running) return clock.base
  const elapsed = Math.floor((demoNow() - clock.startedAt) / 1000)
  return Math.max(0, clock.base - elapsed)
}

export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

/**
 * The shared game clock. Every consumer passes the same beat state, so the
 * first one to render a new beat resets the store and the rest agree with it;
 * all of them then read the same derived number on the same tick.
 */
export function useDemoClock(base: number, running: boolean, reduced: boolean): number {
  const key = `${base}|${running}`
  if (clock.key !== key) {
    clock.key = key
    clock.base = base
    clock.running = running
    clock.startedAt = demoNow()
  }

  const [, force] = useState(0)
  useEffect(() => {
    if (reduced || !running) return
    const listener = () => force((n) => n + 1)
    listeners.add(listener)
    if (!ticker) ticker = setInterval(() => listeners.forEach((l) => l()), 250)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0 && ticker) {
        clearInterval(ticker)
        ticker = null
      }
    }
  }, [reduced, running, key])

  return reduced ? base : readClock()
}

/**
 * The clock as it appears on a surface. `where` is what the verification drive
 * reads: "console" is the scorer's phone, "phone" is the parent's, and the
 * drive asserts the two strings are identical on every beat that shows both.
 */
export function DemoClock({
  base,
  running,
  reduced,
  where,
  className,
}: {
  base: number
  running: boolean
  reduced: boolean
  where: "console" | "phone"
  className?: string
}) {
  const seconds = useDemoClock(base, running, reduced)
  return (
    <span data-demo-clock={where} className={cn("tabular-nums", className)}>
      {fmtClock(seconds)}
    </span>
  )
}

/* ── The pulse ───────────────────────────────────────────────────────────── */

export type PulseTone = "green" | "red" | "amber"

/**
 * Flashes its box whenever `value` changes. This is the parent phone's side of
 * the owner's sync law: the element that CHANGED is the element that pulses,
 * and the tone says what kind of change it was. Green for a made shot or a
 * score, red for a foul, amber for a substitution or a correction.
 */
export function Pulse({
  value,
  tone = "green",
  className,
  children,
}: {
  value: string | number
  tone?: PulseTone
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  const toneRef = useRef(tone)
  toneRef.current = tone

  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    const el = ref.current
    if (!el) return
    el.classList.remove("demo-pulse-green", "demo-pulse-red", "demo-pulse-amber")
    // Restart the animation even when two changes land back to back.
    void el.offsetWidth
    el.classList.add(`demo-pulse-${toneRef.current}`)
  }, [value])

  return (
    <span ref={ref} className={cn("inline-block", className)}>
      {children}
    </span>
  )
}

/* ── Shared shapes ───────────────────────────────────────────────────────── */

export interface MockPlayer {
  jersey: number
  name: string
  /** "Darius R." — first name plus last initial, the product's own shortName. */
  short: string
}

export interface MockLine {
  jersey: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  to: number
  pf: number
}

export interface PhoneTeam {
  name: string
  /** "TL · G9", the live page's `shortTeam`. */
  short: string
  record: string
}

const TARGET = (id?: string) => (id ? { "data-demo-target": id } : {})

/** The phone screen both surfaces sit in: light app ground, no chrome. */
export function PhoneBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex h-full flex-col bg-[#f4f5f7]", className)}>{children}</div>
}

/* ══ THE SCORER'S PHONE ═══════════════════════════════════════════════════ */

/* ── Pre-game checklist (components/scoring/pre-game-checklist.tsx) ──────── */

export function ConsoleChecklist({
  scorekeeper,
  referee,
  clockChoice,
  invite,
}: {
  scorekeeper: string | null
  referee: string | null
  clockChoice: boolean | null
  invite?: boolean
}) {
  const row = (label: string, value: string | null) => (
    <div
      key={label}
      className={cn(
        "flex items-center justify-between rounded-xl border px-3 py-2 text-[15px]",
        value ? "border-court-200 bg-court-50" : "border-gold-400 bg-gold-50"
      )}
    >
      <span className="text-ink-800 font-semibold">{label}</span>
      <span className={value ? "text-court-700 font-semibold" : "text-gold-600 font-semibold"}>
        {value ?? "Not assigned"}
      </span>
    </div>
  )
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 px-3">
      <div className="live-pop w-full rounded-3xl bg-white p-3.5 shadow-xl">
        <p className="text-play-600 text-[14px] font-bold uppercase tracking-[0.18em]">
          Before tip-off
        </p>
        <h2 className="text-ink-950 mt-1 text-[19px] font-bold">Game-day checklist</h2>

        <div className="mt-3 space-y-2">
          {row("Scorekeeper", scorekeeper)}
          {row("Referee", referee)}
        </div>

        <div className="border-ink-100 mt-2.5 rounded-xl border p-2.5">
          <p className="text-ink-800 text-[15px] font-bold">Run the game clock?</p>
          <p className="text-ink-500 mt-0.5 text-[14px] leading-snug">
            Only choose Yes if you&apos;ll operate start/stop during play, otherwise minutes count
            wrongly. Most games just use the arena clock.
          </p>
          <div className="mt-2 flex gap-2">
            <span
              data-demo-target="clock-yes"
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-center text-[14px] font-bold",
                clockChoice === true
                  ? "border-court-600 bg-court-600 text-white"
                  : "border-ink-200 text-ink-600"
              )}
            >
              Yes, I&apos;ll run it
            </span>
            <span
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-center text-[14px] font-bold",
                clockChoice === false ? "border-ink-700 bg-ink-700 text-white" : "border-ink-200 text-ink-600"
              )}
            >
              No clock
            </span>
          </div>
        </div>

        {invite && (
          <div className="border-ink-100 mt-2.5 flex items-center gap-2 rounded-xl border p-2.5">
            <span className="text-ink-800 min-w-0 flex-1 text-[14px] font-bold leading-snug">
              Need a volunteer? Send a one-time scoring link.
            </span>
            <span className="bg-play-600 shrink-0 rounded-lg px-2.5 py-1.5 text-[14px] font-bold text-white">
              Guest link
            </span>
          </div>
        )}

        <span
          data-demo-target="checklist-go"
          className="text-ink-700 mt-2 block w-full rounded-xl border border-transparent py-1.5 text-center text-[15px] font-bold"
        >
          Continue to attendance &amp; scoring →
        </span>
      </div>
    </div>
  )
}

/* ── Attendance roll call (scoring-console.tsx, pregameStep "attendance") ── */

export function ConsoleAttendance({
  teamName,
  players,
  absent,
  id,
}: {
  teamName: string
  players: MockPlayer[]
  absent: number[]
  id?: string
}) {
  const here = players.length - absent.length
  return (
    <div className="flex h-full flex-col px-3 py-2">
      <h2 className="text-ink-950 text-[17px] font-bold leading-tight">Attendance</h2>
      <p className="text-ink-600 mt-0.5 text-[14px] leading-snug">
        Everyone starts as present, tap whoever is missing. An absent player does not count a game
        played in their season stats.
      </p>

      <div className="border-ink-200 mt-2 min-h-0 flex-1 rounded-xl border bg-white p-2">
        <h3 className="text-ink-900 flex items-baseline gap-2 text-[15px] font-bold">
          {teamName}
          <span className="text-ink-600 text-[14px] font-semibold">
            {here} here · {absent.length} absent
          </span>
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-1.5" {...TARGET(id)}>
          {players.map((p) => {
            const off = absent.includes(p.jersey)
            return (
              <span
                key={p.jersey}
                data-demo-target={`att-${p.jersey}`}
                className={cn(
                  "rounded-lg border px-2 py-1 text-left text-[14px] leading-snug transition-colors duration-300 motion-reduce:transition-none",
                  off
                    ? "border-hoop-300 bg-hoop-50 text-hoop-700 line-through"
                    : "border-court-300 bg-court-50 text-ink-800"
                )}
              >
                <span className="text-[16px] font-bold">#{p.jersey}</span>
                <span className="ml-1.5">{p.short}</span>
                <span className="block text-[14px] font-bold uppercase">
                  {off ? "absent" : "present"}
                </span>
              </span>
            )
          })}
        </div>
        <span className="text-ink-500 mt-1.5 block text-[14px] font-bold">
          + Add guest player (this game only)
        </span>
      </div>

      <span
        data-demo-target="to-lineups"
        className="bg-play-600 mt-2 block rounded-xl px-4 py-2 text-center text-[15px] font-bold text-white"
      >
        Continue to starting lineups →
      </span>
    </div>
  )
}

/* ── Starting fives (scoring-console.tsx, pregameStep "starters") ────────── */

/**
 * The starting-five picker.
 *
 * The real screen stacks BOTH teams' pick lists and the phone scrolls between
 * them; the demo frame cannot scroll, so it shows the team being picked and
 * keeps the finished one as its own done row, which is what the operator sees
 * once they have scrolled past it. Declared in the numbers sheet §C.
 */
export function ConsoleLineup({
  doneName,
  doneStarters,
  pickName,
  players,
  starters,
  side,
}: {
  doneName: string
  doneStarters: number[]
  pickName: string
  players: MockPlayer[]
  starters: number[]
  side: "home" | "away"
}) {
  return (
    <div className="flex h-full flex-col gap-2 px-3 py-2.5">
      <p className="text-ink-600 text-[14px] font-semibold leading-snug">
        Pick each starting five, then start the game.
      </p>

      <div className="border-court-200 bg-court-50 flex items-center gap-2 rounded-xl border px-2.5 py-2">
        <span className="text-court-700 text-[15px] font-bold">✓</span>
        <span className="text-ink-900 min-w-0 flex-1 truncate text-[15px] font-bold">{doneName}</span>
        <span className="text-court-700 shrink-0 text-[14px] font-semibold">
          starting five: {doneStarters.length}/5
        </span>
      </div>

      <div className="border-ink-200 rounded-xl border bg-white p-2.5">
        <h3 className="text-ink-900 flex items-baseline gap-2 text-[15px] font-bold">
          <span className="truncate">{pickName}</span>
          <span className="text-ink-600 shrink-0 text-[14px] font-semibold">
            starting five: {starters.length}/5
          </span>
        </h3>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {players.map((p) => {
            const on = starters.includes(p.jersey)
            return (
              <span
                key={p.jersey}
                data-demo-target={`start-${side}-${p.jersey}`}
                className={cn(
                  "rounded-lg border px-1.5 py-1.5 text-left text-[14px] transition-colors duration-300 motion-reduce:transition-none",
                  on ? "border-play-400 bg-play-50 text-play-800" : "border-ink-200 text-ink-700"
                )}
              >
                <span className="text-[15px] font-bold">#{p.jersey}</span>
                <span className="block truncate">{p.short}</span>
              </span>
            )
          })}
        </div>
      </div>

      <span
        data-demo-target="start-game"
        className="bg-court-600 mt-auto block rounded-xl px-4 py-2.5 text-center text-[15px] font-bold text-white"
      >
        Start game
      </span>
    </div>
  )
}

/* ── The console header (scoring-console.tsx, the phone header) ──────────── */

export function ConsoleHeader({
  homeName,
  awayName,
  homeScore,
  awayScore,
  homeFouls,
  awayFouls,
  periodLabel,
  clockBase,
  running,
  reduced,
  periodOpen,
  ended,
  ticker: tickerRows,
}: {
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  homeFouls: number
  awayFouls: number
  periodLabel: string
  clockBase: number
  running: boolean
  reduced: boolean
  periodOpen: boolean
  ended: boolean
  ticker: string[]
}) {
  return (
    <div className="border-ink-200 rounded-2xl border bg-white p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px]">
            <span className="bg-play-400 mr-1 inline-block h-2 w-2 rounded-full align-middle" />
            <span className="text-ink-500 font-semibold">{homeName}</span>
          </p>
          <p className="text-ink-950 text-[28px] font-bold leading-none tabular-nums">{homeScore}</p>
          <p className="text-ink-400 text-[14px] font-semibold leading-tight">fouls {homeFouls}</p>
        </div>

        <div className="shrink-0 text-center">
          <p className="text-ink-900 text-[15px] font-bold">{periodLabel}</p>
          <span
            data-demo-target="console-clock"
            className={cn(
              "mt-0.5 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[22px] font-bold",
              running ? "bg-court-50 text-court-700" : "bg-ink-100 text-ink-700"
            )}
          >
            <DemoClock base={clockBase} running={running} reduced={reduced} where="console" />
            <span className="text-[14px]">{running ? "⏸" : "▶"}</span>
          </span>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            {periodOpen ? (
              <span
                data-demo-target="end-period"
                className="border-ink-200 text-ink-600 rounded-lg border px-2 py-0.5 text-[14px] font-bold"
              >
                End {periodLabel}
              </span>
            ) : ended ? (
              <span
                data-demo-target="end-game"
                className="bg-court-600 rounded-lg px-2 py-0.5 text-[14px] font-bold text-white"
              >
                End game →
              </span>
            ) : (
              <span className="bg-play-600 rounded-lg px-2 py-0.5 text-[14px] font-bold text-white">
                Start next
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-[14px]">
            <span className="text-ink-500 font-semibold">{awayName}</span>
            <span className="bg-court-400 ml-1 inline-block h-2 w-2 rounded-full align-middle" />
          </p>
          <p className="text-ink-950 text-[28px] font-bold leading-none tabular-nums">{awayScore}</p>
          <p className="text-ink-400 text-[14px] font-semibold leading-tight">fouls {awayFouls}</p>
        </div>
      </div>

      {/* ticker + sync + box + undo, the product's own bottom strip */}
      <div className="border-ink-100 mt-1.5 flex items-center gap-1.5 border-t pt-1.5">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
          {tickerRows.slice(0, 1).map((t) => (
            <span
              key={t}
              className="bg-ink-50 text-ink-600 shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[14px]"
            >
              {t} ✕
            </span>
          ))}
        </div>
        <span
          data-demo-target="synced"
          className="bg-court-50 text-court-700 shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[14px] font-bold"
        >
          synced
        </span>
        <span className="border-ink-200 text-ink-600 shrink-0 rounded-lg border px-2 py-1 text-[14px] font-bold">
          BOX
        </span>
        <span
          data-demo-target="undo"
          className="bg-hoop-600 shrink-0 rounded-lg px-3 py-1 text-[14px] font-bold text-white"
        >
          UNDO
        </span>
      </div>
    </div>
  )
}

/* ── The five on the floor, as the product's phone chip row ──────────────── */

export function ConsoleChips({
  side,
  players,
  onFloor,
  fouls,
  armed,
  benchCount,
}: {
  side: "home" | "away"
  players: MockPlayer[]
  onFloor: number[]
  fouls: Record<number, number>
  armed: boolean
  benchCount: number
}) {
  const accent = side === "home" ? "border-b-play-400" : "border-b-court-400"
  const subsTone =
    side === "home" ? "border-play-300 text-play-700" : "border-court-300 text-court-700"
  return (
    <div className="flex items-stretch gap-1.5">
      <span
        data-demo-target={`subs-${side}`}
        className={cn(
          "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed text-[16px] font-bold",
          subsTone
        )}
      >
        ⇄<span className="text-[14px] font-semibold">{benchCount}</span>
      </span>
      {onFloor.map((j) => {
        const pf = fouls[j] ?? 0
        return (
          <span
            key={j}
            data-demo-target={`floor-${side}-${j}`}
            className={cn(
              "text-ink-950 relative flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl border border-b-4 bg-white text-[19px] font-bold transition-colors duration-300 motion-reduce:transition-none",
              accent,
              armed ? "border-play-300" : "border-ink-200"
            )}
          >
            {j}
            {pf > 0 && (
              <span className="text-hoop-600 absolute right-1 top-0 text-[14px] leading-none">
                {"•".repeat(Math.min(pf, 5))}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

/* ── The action pad (scoring-console.tsx `actionPad`) ────────────────────── */

/**
 * EXACTLY the STANDARD stat-depth set. `showMisses = depth !== "SCORE_ONLY"`
 * puts the three miss buttons and REB / AST on the pad; `showHustle = depth ===
 * "FULL"` would add STL, BLK, TO and TECH, and the NPH Summer League is
 * STANDARD, so they are not on this table's pad tonight.
 */
export function ConsoleActionPad({
  pending,
  pendingPlayer,
  assistFor,
  assistOptions,
}: {
  pending: string | null
  pendingPlayer: number | null
  /** Jersey of the shooter the console is chaining an assist to. */
  assistFor: number | null
  assistOptions: number[]
}) {
  const btn = (label: string, id: string, tone: string) => (
    <span
      data-demo-target={id}
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center rounded-xl px-1 py-2 text-[15px] font-bold transition-shadow duration-150 motion-reduce:transition-none",
        pending === label ? "ring-play-500 ring-2" : "",
        tone
      )}
    >
      {label}
    </span>
  )
  return (
    <div className="border-ink-200 rounded-2xl border bg-white p-2 shadow-sm">
      {/* Fixed-height status strip: content swaps, nothing ever inserts. */}
      <div className="mb-1.5 flex min-h-[38px] items-center justify-center gap-1.5 px-1">
        {assistFor != null ? (
          <>
            <span className="text-play-800 shrink-0 whitespace-nowrap text-[14px] font-bold">
              Assist by?
            </span>
            {assistOptions.map((j) => (
              <span
                key={j}
                data-demo-target={`assist-${j}`}
                className="border-play-300 text-play-800 flex h-10 min-w-[40px] shrink-0 items-center justify-center rounded-lg border bg-white text-[15px] font-bold"
              >
                #{j}
              </span>
            ))}
            <span className="text-ink-600 shrink-0 px-1 text-[14px]">skip</span>
          </>
        ) : pending ? (
          <p className="text-play-700 text-[14px] font-bold">{pending}. Now tap the player</p>
        ) : pendingPlayer ? (
          <p className="text-play-700 text-[14px] font-bold">
            #{pendingPlayer}. Now tap an action
          </p>
        ) : (
          <p className="text-ink-500 text-[14px]">
            Tap an action, then a player, either order works
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {btn("+2", "act-2", "bg-court-600 text-white")}
        {btn("+3", "act-3", "bg-court-600 text-white")}
        {btn("FT ✓", "act-ft", "bg-court-500 text-white")}
        {btn("2 ✗", "act-miss2", "bg-ink-100 text-ink-700")}
        {btn("3 ✗", "act-miss3", "bg-ink-100 text-ink-700")}
        {btn("FT ✗", "act-missft", "bg-ink-100 text-ink-700")}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {btn("REB", "act-reb", "bg-play-50 text-play-700")}
        {btn("AST", "act-ast", "bg-play-50 text-play-700")}
        {btn("FOUL", "act-foul", "bg-amber-100 text-amber-800")}
      </div>
    </div>
  )
}

/* ── The subs drawer (scoring-console.tsx `subsFor` panel) ───────────────── */

export function ConsoleSubsSheet({
  teamName,
  onFloor,
  bench,
  players,
  out,
  staged,
}: {
  teamName: string
  onFloor: number[]
  bench: number[]
  players: MockPlayer[]
  out: number | null
  staged: { out: number; in: number }[]
}) {
  const nameOf = (j: number) => players.find((p) => p.jersey === j)?.short ?? ""
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-2xl bg-white p-3 shadow-[0_-18px_50px_-24px_rgba(15,23,42,0.6)]">
      <p className="text-ink-950 text-[16px] font-bold">Substitutions</p>
      <p className="text-ink-500 mt-0.5 text-[14px]">
        {teamName} · tap who comes off, then who goes on.
      </p>

      <p className="text-ink-500 mt-2 text-[14px] font-bold uppercase tracking-[0.08em]">
        On the floor
      </p>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {onFloor.map((j) => (
          <span
            key={j}
            data-demo-target={`sub-out-${j}`}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-[14px] transition-colors duration-200 motion-reduce:transition-none",
              out === j ? "border-hoop-400 bg-hoop-50 text-hoop-700" : "border-ink-200 text-ink-800"
            )}
          >
            <span className="text-[15px] font-bold">#{j}</span>
            <span className="block truncate">{nameOf(j)}</span>
          </span>
        ))}
      </div>

      <p className="text-ink-500 mt-2 text-[14px] font-bold uppercase tracking-[0.08em]">
        On the bench
      </p>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {bench.map((j) => (
          <span
            key={j}
            data-demo-target={`sub-in-${j}`}
            className={cn(
              "rounded-lg border px-2 py-1.5 text-[14px] transition-colors duration-200 motion-reduce:transition-none",
              staged.some((s) => s.in === j)
                ? "border-court-400 bg-court-50 text-court-700"
                : "border-ink-200 text-ink-800"
            )}
          >
            <span className="text-[15px] font-bold">#{j}</span>
            <span className="block truncate">{nameOf(j)}</span>
          </span>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-ink-600 flex-1 text-[14px] font-semibold">
          {staged.length > 0
            ? staged.map((s) => `#${s.in} in for #${s.out}`).join(" · ")
            : "No swaps staged yet"}
        </span>
        <span
          data-demo-target="sub-apply"
          className={cn(
            "rounded-xl px-3.5 py-2 text-[15px] font-bold text-white",
            staged.length > 0 ? "bg-court-600" : "bg-ink-300"
          )}
        >
          Apply {staged.length > 0 ? staged.length : ""}
        </span>
      </div>
    </div>
  )
}

/* ── Review and sign-off (scoring-console.tsx `reviewing`) ───────────────── */

export function ConsoleReview({
  homeName,
  awayName,
  homeScore,
  awayScore,
  potg,
  potgPoints,
  potgOptions,
  signed,
  refereeName,
  mode,
}: {
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  potg: string
  potgPoints: number
  potgOptions: { jersey: number; short: string; pts: number }[]
  signed: boolean
  refereeName: string
  mode: "sign" | "pin"
}) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden px-3 py-2.5">
      <h2 className="text-ink-950 text-center text-[16px] font-bold leading-tight">
        Review: {homeName} <span className="tabular-nums">{homeScore}</span> ·{" "}
        <span className="tabular-nums">{awayScore}</span> {awayName}
      </h2>

      <div className="border-play-200 bg-play-50 rounded-xl border p-2.5">
        <p className="text-play-800 text-[14px] font-bold">
          Player of the Game (optional)
          <span className="text-play-600 ml-1.5 font-medium">top scorer suggested</span>
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {potgOptions.map((o) => (
            <span
              key={o.jersey}
              className={cn(
                "rounded-lg border px-2 py-1 text-[14px] font-bold",
                o.short === potg
                  ? "border-play-500 bg-play-100 text-play-900"
                  : "border-ink-200 text-ink-700 bg-white"
              )}
            >
              #{o.jersey} {o.short} · {o.pts} pts
            </span>
          ))}
        </div>
      </div>

      <div className="border-amber-300 bg-amber-50 rounded-xl border p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-amber-800 text-[14px] font-bold">Referee approval (optional)</p>
          <span className="flex rounded-lg bg-white p-0.5">
            {(
              [
                ["sign", "Signature"],
                ["pin", "Referee PIN"],
              ] as const
            ).map(([key, label]) => (
              <span
                key={key}
                data-demo-target={`approval-${key}`}
                className={cn(
                  "rounded-md px-2 py-1 text-[14px] font-bold",
                  mode === key ? "bg-amber-100 text-amber-900" : "text-ink-500"
                )}
              >
                {label}
              </span>
            ))}
          </span>
        </div>

        {mode === "pin" ? (
          <div className="mt-2 space-y-1.5">
            <p className="text-ink-600 text-[14px] leading-snug">
              The assigned referee enters their personal PIN, verified against their account, the
              strongest form of approval.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <span className="border-amber-500 bg-amber-100 text-amber-900 rounded-lg border px-2 py-1 text-[14px] font-bold">
                {refereeName || "Mike Ferreira"}
              </span>
            </div>
            <span className="border-amber-300 text-ink-400 block rounded-lg border bg-white px-3 py-2 text-[15px]">
              ● ● ● ●
            </span>
          </div>
        ) : (
          <div className="mt-2 space-y-1.5">
            <span
              data-demo-target="sign-pad"
              className={cn(
                "border-amber-300 flex h-[92px] items-center justify-center rounded-lg border bg-white",
                signed ? "" : "text-ink-400 text-[14px]"
              )}
            >
              {signed ? (
                <SignatureMark />
              ) : (
                "Sign here with a finger"
              )}
            </span>
            <span className="border-amber-300 block rounded-lg border bg-white px-3 py-2 text-[15px]">
              {refereeName ? (
                <span className="text-ink-900 font-semibold">{refereeName}</span>
              ) : (
                <span className="text-ink-400">Referee&apos;s printed name</span>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="mt-auto flex gap-2">
        <span className="border-ink-200 text-ink-700 flex-1 rounded-xl border px-3 py-2.5 text-center text-[15px] font-bold">
          ← Back to scoring
        </span>
        <span
          data-demo-target="mark-final"
          className="bg-court-600 flex-1 rounded-xl px-3 py-2.5 text-center text-[15px] font-bold text-white"
        >
          Mark final
        </span>
      </div>
    </div>
  )
}

/** The referee's drawn signature: ink from the pad, not a font. */
function SignatureMark() {
  return (
    <svg viewBox="0 0 220 60" className="h-[60px] w-[200px]" aria-hidden="true">
      <path
        d="M8 44c14-4 20-26 27-30 7-4 6 12 2 20-4 8-9 12-6 14 4 3 14-10 20-20 6-10 9-16 12-14 3 2-2 14-5 22-2 6-1 9 3 8 6-2 12-14 18-22 5-7 8-8 9-5 1 4-4 14-6 20-1 5 1 7 5 5 6-3 14-12 20-18 5-5 10-8 14-8 6 0 6 6 2 10"
        fill="none"
        stroke="#111827"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M150 50c14 0 40-3 62-9" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/* ── The official scoresheet (app/(sheet)/scoresheet/[gameId]) ───────────── */

export function ConsoleScoresheet({
  league,
  season,
  when,
  venue,
  homeName,
  awayName,
  homeScore,
  awayScore,
  homeLine,
  awayLine,
  rows,
  potg,
  referee,
  signedAt,
}: {
  league: string
  season: string
  when: string
  venue: string
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  homeLine: number[]
  awayLine: number[]
  /** One team's sheet rows: the roster in jersey order, marks included. */
  rows: { jersey: number; name: string; fouls: number; marks: string[]; reb: number; ast: number; pts: number; absent?: boolean }[]
  potg: string
  referee: string
  signedAt: string
}) {
  const lineRow = (label: string, line: number[], total: number) => (
    <tr>
      <td className="border border-black px-1 py-0.5 text-left text-[14px] font-bold">{label}</td>
      {line.map((n, i) => (
        <td key={i} className="border border-black px-1.5 py-0.5 text-[14px]">
          {n}
        </td>
      ))}
      <td className="border border-black px-1.5 py-0.5 text-[14px] font-bold">{total}</td>
    </tr>
  )
  return (
    <div className="h-full overflow-hidden bg-white p-1.5 text-black">
      <div className="border-2 border-black p-1.5">
        <div className="flex items-start justify-between gap-2 border-b-2 border-black pb-1">
          <div className="min-w-0">
            <h1 className="text-[16px] font-bold uppercase leading-tight">Official Scoresheet</h1>
            <p className="truncate text-[14px] leading-tight">
              {league} · {season}
            </p>
          </div>
          <div className="shrink-0 text-right text-[14px] leading-tight">
            <p>{when}</p>
            <p>{venue}</p>
          </div>
        </div>

        <div className="my-1 flex items-center justify-center">
          <table className="border-collapse text-center leading-[1.15] tabular-nums">
            <thead>
              <tr>
                <th className="border border-black px-1 py-0.5" />
                {[1, 2, 3, 4].map((p) => (
                  <th key={p} className="border border-black px-1.5 py-0.5 text-[14px]">
                    Q{p}
                  </th>
                ))}
                <th className="border border-black px-1.5 py-0.5 text-[14px]">F</th>
              </tr>
            </thead>
            <tbody>
              {lineRow("OAK", homeLine, homeScore)}
              {lineRow("TOR", awayLine, awayScore)}
            </tbody>
          </table>
        </div>

        <table className="w-full border-collapse text-[14px] leading-[1.15]">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-[1px] pr-1 font-bold" colSpan={2}>
                {awayName}
              </th>
              <th className="px-1 text-center font-bold">Fouls</th>
              <th className="border-l border-gray-400 px-1 text-right font-bold">REB</th>
              <th className="px-1 text-right font-bold">AST</th>
              <th className="px-1 text-right font-bold">PTS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // `statusOf` on the real sheet: absent, then "did not play" for a
              // rostered player the fold never touched, then the stat line.
              const dnp = !r.absent && r.pts === 0 && r.reb === 0 && r.ast === 0 && r.fouls === 0
              return (
                <tr
                  key={r.jersey}
                  className={cn("border-b border-gray-400", r.absent && "text-gray-400")}
                >
                  <td className="w-7 py-[1px] pr-1 font-bold">#{r.jersey}</td>
                  <td className="max-w-[110px] truncate py-[1px] pr-1">{r.name}</td>
                  <td className="whitespace-nowrap px-1 text-center font-mono tracking-widest">
                    {r.absent || dnp
                      ? ""
                      : Array.from({ length: 5 }, (_, i) => (i < r.fouls ? "☒" : "☐")).join("")}
                  </td>
                  {r.absent || dnp ? (
                    <td
                      colSpan={3}
                      className="border-l border-gray-400 px-1 text-center font-bold uppercase text-gray-500"
                    >
                      {r.absent ? "Absent" : "DNP"}
                    </td>
                  ) : (
                    <>
                      <td className="border-l border-gray-400 px-1 text-right">{r.reb}</td>
                      <td className="px-1 text-right">{r.ast}</td>
                      <td className="px-1 text-right font-bold">{r.pts}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        <p className="mt-1 text-[14px] font-bold">Player of the Game: {potg}</p>

        <div className="mt-1 grid grid-cols-2 gap-4 text-[14px] leading-tight">
          <div>
            <span className="block h-[18px] overflow-hidden">
              <SignatureMark />
            </span>
            <p className="border-t border-black pt-0.5">
              Referee: {referee} · signed {signedAt}
            </p>
          </div>
          <div>
            <p className="mt-[18px] border-t border-black pt-0.5">Scorekeeper</p>
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex justify-center gap-2">
        <span
          data-demo-target="download-pdf"
          className="rounded-xl bg-gray-900 px-3 py-1.5 text-[14px] font-bold text-white"
        >
          Download PDF (landscape)
        </span>

      </div>
    </div>
  )
}

/* ══ THE PARENT'S PHONE ═══════════════════════════════════════════════════ */

/**
 * The score hero, the composition the live page ships BELOW `sm`: the state
 * strip (LIVE pill, period, amber clock), then one full-width row per team, the
 * venue, and the linescore inside the stage with a dash for unplayed quarters.
 */
export function LiveHero({
  league,
  home,
  away,
  homeScore,
  awayScore,
  periodLabel,
  clockBase,
  running,
  reduced,
  final,
  venue,
  linescore,
  displayPeriods,
  tone,
}: {
  league: string
  home: PhoneTeam
  away: PhoneTeam
  homeScore: number
  awayScore: number
  periodLabel: string
  clockBase: number
  running: boolean
  reduced: boolean
  final: boolean
  venue: string
  linescore: { home: Record<number, number>; away: Record<number, number> }
  displayPeriods: number[]
  tone: PulseTone
}) {
  const rows: [PhoneTeam, number, number, "home" | "away"][] = [
    [home, homeScore, awayScore, "home"],
    [away, awayScore, homeScore, "away"],
  ]
  return (
    <div
      className="text-white"
      style={{
        backgroundImage:
          "radial-gradient(120% 150% at 50% -20%, rgba(255,255,255,0.10) 0%, transparent 60%), linear-gradient(135deg, #0b1628, #16233c)",
      }}
    >
      <div className="px-3 pb-1.5 pt-1">
        <p className="text-center text-[14px] font-semibold uppercase tracking-[0.1em] text-white/60">
          {league}
        </p>

        <div className="mt-1.5 flex items-center justify-center gap-2.5" data-demo-target="live-state">
          {final ? (
            <span className="bg-court-500 rounded-full px-3 py-[3px] text-[14px] font-bold uppercase tracking-[0.16em] text-white">
              Final
            </span>
          ) : (
            <>
              <span className="bg-live-600 inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[14px] font-bold uppercase tracking-[0.14em] text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />
                Live
              </span>
              <Pulse value={periodLabel} tone={tone}>
                <span className="text-[15px] font-bold uppercase text-white/75">{periodLabel}</span>
              </Pulse>
              <span className="text-highlight text-[22px] font-bold leading-none tabular-nums">
                <DemoClock base={clockBase} running={running} reduced={reduced} where="phone" />
              </span>
            </>
          )}
        </div>

        <div className="mt-1.5 space-y-1">
          {rows.map(([team, score, other, side]) => (
            <div key={team.name} className="flex items-center gap-2.5">
              <Crest
                name={team.name}
                surface="dark"
                sizeClassName="h-9 w-9 rounded-xl text-[14px]"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold leading-tight text-white">
                  {team.name}
                </span>
                <span className="block truncate text-[14px] font-medium uppercase tracking-[0.1em] text-white/55">
                  {team.record}
                </span>
              </span>
              <Pulse value={score} tone={tone}>
                <span
                  data-demo-target={`live-score-${side}`}
                  className={cn(
                    "min-w-[52px] text-right text-[28px] font-bold leading-none tabular-nums",
                    !final ? "text-white" : score > other ? "text-highlight" : "text-white/45"
                  )}
                >
                  {score}
                </span>
              </Pulse>
            </div>
          ))}
        </div>

        <p className="mt-1 text-center text-[14px] font-medium uppercase tracking-[0.1em] text-white/55">
          {venue}
        </p>

        <div
          data-demo-target="linescore"
          className="mt-1.5 rounded-2xl bg-white/[0.08] ring-1 ring-inset ring-white/15"
        >
          <table className="w-full text-center tabular-nums">
            <thead>
              <tr className="text-[14px] font-semibold uppercase tracking-[0.12em] text-white/50">
                <th className="py-0.5 pl-2.5 text-left" />
                {displayPeriods.map((p) => (
                  <th key={p} className="px-2 py-0.5">
                    {p}
                  </th>
                ))}
                <th className="px-2 py-0.5 pr-2.5 text-white/75">Tot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([team, score, , side]) => (
                <tr key={team.name} className="border-t border-white/10">
                  <td className="py-0.5 pl-2.5 text-left">
                    <span className="whitespace-nowrap text-[14px] font-semibold text-white/90">
                      {team.short}
                    </span>
                  </td>
                  {displayPeriods.map((p) => {
                    const v = linescore[side][p]
                    return (
                      <td key={p} className="px-2 py-0.5 text-[16px] font-medium leading-none text-white/85">
                        {v == null ? (
                          <span className="text-white/25">–</span>
                        ) : (
                          <Pulse value={v} tone={tone}>
                            <span>{v}</span>
                          </Pulse>
                        )}
                      </td>
                    )
                  })}
                  <td className="text-highlight px-2 py-0.5 pr-2.5 text-[16px] font-bold leading-none">
                    <Pulse value={score} tone={tone}>
                      <span>{score}</span>
                    </Pulse>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** The sticky score chip the page keeps when the hero scrolls away. */
export function LiveScoreChip({
  home,
  away,
  homeScore,
  awayScore,
  periodLabel,
  clockBase,
  running,
  reduced,
  final,
  tone,
}: {
  home: PhoneTeam
  away: PhoneTeam
  homeScore: number
  awayScore: number
  periodLabel: string
  clockBase: number
  running: boolean
  reduced: boolean
  final: boolean
  tone: PulseTone
}) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 bg-[#0b1628] px-3 py-1.5 text-white">
      <span className="text-[14px] font-semibold">{home.short}</span>
      <Pulse value={homeScore} tone={tone}>
        <span className="text-[18px] font-bold tabular-nums">{homeScore}</span>
      </Pulse>
      <span className="text-white/40">·</span>
      <Pulse value={awayScore} tone={tone}>
        <span className="text-[18px] font-bold tabular-nums">{awayScore}</span>
      </Pulse>
      <span className="text-[14px] font-semibold">{away.short}</span>
      <span className="ml-1 flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5">
        <span className="text-[14px] font-bold uppercase">{final ? "Final" : periodLabel}</span>
        {!final && (
          <span className="text-highlight text-[14px] font-bold tabular-nums">
            <DemoClock base={clockBase} running={running} reduced={reduced} where="phone" />
          </span>
        )}
      </span>
    </div>
  )
}

/** Game · Team stats · Play-by-play, the page's own tab strip. */
export function LiveTabs({ active }: { active: "game" | "stats" | "plays" }) {
  const tabs: [typeof active, string, string][] = [
    ["game", "Game", "phone-tab-game"],
    ["stats", "Team stats", "phone-tab-stats"],
    ["plays", "Play-by-play", "phone-tab-plays"],
  ]
  return (
    <div className="border-ink-100 mx-2.5 mt-1.5 flex shrink-0 gap-1 rounded-2xl border bg-white p-1 shadow-sm">
      {tabs.map(([key, label, id]) => (
        <span
          key={key}
          data-demo-target={id}
          className={cn(
            "flex-1 whitespace-nowrap rounded-xl px-2 py-2 text-center text-[14px] font-bold",
            active === key ? "bg-play-600 text-white shadow-sm" : "text-ink-500"
          )}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

export interface PhonePlayRow {
  key: string
  text: string
  score: string | null
  home: boolean
  period?: string
}

/** The play list, used both as "Latest plays" and as the whole feed. */
export function LivePlays({
  title,
  rows,
  freshKey,
  tone,
  filters,
  activeFilter,
  id,
}: {
  title?: string
  rows: PhonePlayRow[]
  freshKey: string
  tone: PulseTone
  filters?: string[]
  activeFilter?: string
  id?: string
}) {
  return (
    <div className="border-ink-100 overflow-hidden rounded-2xl border bg-white" {...TARGET(id)}>
      {title && (
        <div className="border-ink-100 flex items-center justify-between border-b px-3 py-1.5">
          <h3 className="text-ink-800 text-[14px] font-bold uppercase tracking-[0.14em]">{title}</h3>
          <span className="text-play-600 text-[14px] font-bold">See all plays</span>
        </div>
      )}
      {filters && (
        <div className="border-ink-100 flex items-center gap-1.5 overflow-hidden border-b px-3 py-2">
          {filters.map((f) => (
            <span
              key={f}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[14px] font-bold",
                f === activeFilter ? "bg-ink-950 text-white" : "text-ink-600 border-ink-200 border bg-white"
              )}
            >
              {f}
            </span>
          ))}
        </div>
      )}
      <ul className="divide-ink-50 divide-y">
        {rows.map((r) =>
          r.period ? (
            <li
              key={r.key}
              className="bg-ink-100 text-ink-700 px-3 py-1 text-center text-[14px] font-bold uppercase tracking-[0.16em]"
            >
              {r.period}
            </li>
          ) : (
            <li
              key={r.key}
              className={cn(
                "flex items-center gap-2 px-3 py-[3px] text-[14px] leading-snug",
                r.score ? "text-ink-950 font-semibold" : "text-ink-600",
                r.key === freshKey && `demo-pulse-${tone}`
              )}
            >
              <span
                className={cn("w-1 shrink-0 self-stretch rounded-full", r.home ? "bg-ink-400" : "bg-ink-200")}
              />
              <span className="min-w-0 flex-1 leading-snug">{r.text}</span>
              {r.score && (
                <span className="text-ink-950 shrink-0 text-[15px] font-bold tabular-nums">
                  {r.score}
                </span>
              )}
            </li>
          )
        )}
      </ul>
    </div>
  )
}

/** The box score behind its team switcher, with the page's full stat line. */
export function LiveBoxScore({
  homeName,
  awayName,
  side,
  players,
  lines,
  starters,
  onFloor,
  tone,
  highlight,
  live,
}: {
  homeName: string
  awayName: string
  side: "home" | "away"
  players: MockPlayer[]
  lines: Record<number, MockLine>
  starters: number[]
  onFloor: number[]
  tone: PulseTone
  /** Jersey to keep in view: the row the story is talking about. */
  highlight?: number
  live: boolean
}) {
  const sorted = [...players].sort((a, b) => lines[b.jersey].pts - lines[a.jersey].pts)
  const top = sorted.length > 0 && lines[sorted[0].jersey].pts > 0 ? sorted[0].jersey : null
  const starterRows = sorted.filter((p) => starters.includes(p.jersey))
  const benchRows = sorted.filter((p) => !starters.includes(p.jersey)).slice(0, 3)
  const totals = players.reduce(
    (t, p) => {
      const l = lines[p.jersey]
      return {
        pts: t.pts + l.pts,
        reb: t.reb + l.reb,
        ast: t.ast + l.ast,
        stl: t.stl + l.stl,
        blk: t.blk + l.blk,
        to: t.to + l.to,
        pf: t.pf + l.pf,
      }
    },
    { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0 }
  )

  const cell = "px-[3px] text-right"
  const row = (p: MockPlayer) => {
    const l = lines[p.jersey]
    const isTop = p.jersey === top
    return (
      <tr
        key={p.jersey}
        data-demo-target={p.jersey === highlight ? "box-highlight" : undefined}
        className="border-ink-50 border-t"
        style={isTop ? { backgroundColor: "rgba(24,24,27,0.06)", boxShadow: "inset 3px 0 0 0 #3f3f46" } : undefined}
      >
        <td className={cn("truncate py-1 pl-2 pr-0.5", isTop ? "font-bold" : "font-medium")}>
          <span className="text-ink-500 mr-1 font-normal">#{p.jersey}</span>
          <span className="text-ink-900">{p.short}</span>
          {l && onFloor.includes(p.jersey) && live ? <span className="text-court-600"> ●</span> : null}
        </td>
        <td className={cn("text-[15px] font-bold", cell)}>
          <Pulse value={l.pts} tone={tone}>
            <span>{l.pts}</span>
          </Pulse>
        </td>
        <td className={cell}>
          <Pulse value={l.reb} tone={tone}>
            <span>{l.reb}</span>
          </Pulse>
        </td>
        <td className={cell}>
          <Pulse value={l.ast} tone={tone}>
            <span>{l.ast}</span>
          </Pulse>
        </td>
        <td className={cell}>{l.stl}</td>
        <td className={cell}>{l.blk}</td>
        <td className={cell}>{l.to}</td>
        <td className={cn("pr-2", cell)}>{l.pf}</td>
      </tr>
    )
  }

  const groupHead = "bg-ink-50 text-ink-500 border-ink-100 border-y px-2.5 py-0.5 text-[14px] font-bold uppercase tracking-[0.14em]"

  return (
    <div className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
      <div className="border-ink-100 border-b px-2.5 py-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h3 className="text-ink-800 text-[14px] font-bold uppercase tracking-[0.14em]">Box score</h3>
          <span className="text-ink-400 text-[14px] font-semibold uppercase tracking-[0.1em]">
            Tap a team
          </span>
        </div>
        <div className="bg-ink-100 flex gap-1 rounded-xl p-1">
          {(
            [
              ["home", homeName],
              ["away", awayName],
            ] as const
          ).map(([key, name]) => (
            <span
              key={key}
              data-demo-target={`box-side-${key}`}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 truncate rounded-lg px-2 py-1.5 text-[14px] font-bold",
                side === key ? "bg-ink-900 text-white shadow-sm" : "text-ink-600"
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", side === key ? "bg-white" : "bg-ink-300")} />
              <span className="truncate">{name}</span>
            </span>
          ))}
        </div>
      </div>
      <table className="w-full table-fixed text-[14px] tabular-nums">
        {/* The full nine-column line at 390: the stat columns are pinned and
            the player column takes what is left, which is what keeps Pts off
            the end of a long name. */}
        <colgroup>
          <col />
          <col className="w-[32px]" />
          <col className="w-[32px]" />
          <col className="w-[32px]" />
          <col className="w-[30px]" />
          <col className="w-[30px]" />
          <col className="w-[30px]" />
          <col className="w-[32px]" />
        </colgroup>
        <thead className="text-ink-500 text-left text-[14px] uppercase tracking-[0.04em]">
          <tr>
            <th className="py-1 pl-2 pr-0.5 font-bold">Player</th>
            <th className={cn("font-bold", cell)}>Pts</th>
            <th className={cn("font-bold", cell)}>Reb</th>
            <th className={cn("font-bold", cell)}>Ast</th>
            <th className={cn("font-bold", cell)}>Stl</th>
            <th className={cn("font-bold", cell)}>Blk</th>
            <th className={cn("font-bold", cell)}>TO</th>
            <th className={cn("pr-2 font-bold", cell)}>PF</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={8} className={groupHead}>
              Starters
            </td>
          </tr>
          {starterRows.map(row)}
          <tr>
            <td colSpan={8} className={groupHead}>
              Bench
            </td>
          </tr>
          {benchRows.map(row)}
          <tr className="border-ink-200 text-ink-900 border-t-2 font-bold">
            <td className="py-1 pl-2 pr-0.5">Team</td>
            <td className={cell}>{totals.pts}</td>
            <td className={cell}>{totals.reb}</td>
            <td className={cell}>{totals.ast}</td>
            <td className={cell}>{totals.stl}</td>
            <td className={cell}>{totals.blk}</td>
            <td className={cell}>{totals.to}</td>
            <td className={cn("pr-2", cell)}>{totals.pf}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** Team stats, the page's two-sided comparison bars. */
export function LiveTeamStats({
  home,
  away,
  homeScore,
  awayScore,
  rows,
  tone,
  pulseLabel,
}: {
  home: PhoneTeam
  away: PhoneTeam
  homeScore: number
  awayScore: number
  rows: { label: string; h: number; a: number; dh?: string; da?: string }[]
  tone: PulseTone
  /** Which row flashes when the story wants the eye on it. */
  pulseLabel?: string
}) {
  return (
    <div className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
      <div className="border-ink-100 flex items-center justify-between gap-2 border-b px-3 py-2.5">
        {[
          [home, homeScore, awayScore],
          [away, awayScore, homeScore],
        ].map(([team, score, other], i) => {
          const t = team as PhoneTeam
          return (
            <div
              key={t.name}
              className={cn("flex min-w-0 flex-1 items-center gap-2", i === 1 && "flex-row-reverse text-right")}
            >
              <Crest name={t.name} surface="light" sizeClassName="h-8 w-8 rounded-xl text-[14px]" />
              <div className="min-w-0">
                <p className="text-ink-950 truncate text-[14px] font-semibold leading-tight">{t.short}</p>
                <p
                  className={cn(
                    "text-[22px] font-bold leading-none tabular-nums",
                    (score as number) >= (other as number) ? "text-ink-950" : "text-ink-400"
                  )}
                >
                  {score as number}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="divide-ink-50 divide-y">
        {rows.map((r) => {
          const total = r.h + r.a
          const hShare = total === 0 ? 50 : (r.h / total) * 100
          const hWins = r.h > r.a
          const aWins = r.a > r.h
          const num = (wins: boolean, v: number, d?: string) => (
            <span
              className={cn(
                d ? "text-[14px]" : "text-[22px] leading-none",
                "tabular-nums",
                wins ? "text-ink-950 font-bold" : "text-ink-400 font-medium"
              )}
            >
              {d ?? v}
            </span>
          )
          const body = (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                {num(hWins, r.h, r.dh)}
                <span className="text-ink-600 text-[14px] font-bold uppercase tracking-[0.12em]">
                  {r.label}
                </span>
                {num(aWins, r.a, r.da)}
              </div>
              <div className="mt-1.5 flex h-2.5 items-center gap-1">
                <div className="bg-ink-100 flex flex-1 justify-end overflow-hidden rounded-l-full">
                  <span
                    className="bg-ink-700 h-2.5 rounded-l-full transition-all duration-500"
                    style={{ width: `${hShare}%`, opacity: hWins ? 1 : 0.35 }}
                  />
                </div>
                <span className="bg-ink-300 h-2.5 w-px shrink-0" />
                <div className="bg-ink-100 flex flex-1 overflow-hidden rounded-r-full">
                  <span
                    className="bg-ink-700 h-2.5 rounded-r-full transition-all duration-500"
                    style={{ width: `${100 - hShare}%`, opacity: aWins ? 1 : 0.35 }}
                  />
                </div>
              </div>
            </div>
          )
          return r.label === pulseLabel ? (
            <Pulse key={r.label} value={`${r.h}|${r.a}`} tone={tone} className="block">
              {body}
            </Pulse>
          ) : (
            <div key={r.label}>{body}</div>
          )
        })}
      </div>
    </div>
  )
}

/** Player of the Game, final games only, exactly as the live page shows it. */
export function LivePotgCard({
  name,
  jersey,
  line,
  fresh,
}: {
  name: string
  jersey: number
  line: string
  fresh?: boolean
}) {
  return (
    <div
      data-demo-target="potg"
      className={cn(
        "border-gold-300 from-gold-50 flex items-center gap-3 rounded-2xl border bg-gradient-to-r to-white p-3",
        fresh && "live-pop"
      )}
    >
      <span className="border-gold-400 bg-gold-50 text-gold-700 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-[19px] font-extrabold tabular-nums">
        {jersey}
      </span>
      <div className="min-w-0">
        <p className="text-gold-700 text-[14px] font-bold uppercase tracking-[0.16em]">
          Player of the Game
        </p>
        <p className="text-ink-950 truncate text-[17px] font-semibold">
          #{jersey} {name}
        </p>
        <p className="text-ink-500 text-[14px] font-medium uppercase tracking-[0.08em]">{line}</p>
      </div>
    </div>
  )
}

/**
 * The recap, as a CARD (owner law 2026-07-25: news is always a card, cover
 * image plus kind chip plus title plus date, on every surface).
 */
export function LiveRecapCard({
  club,
  title,
  body,
  meta,
  fresh,
}: {
  club: string
  title: string
  body: string
  meta: string
  fresh?: boolean
}) {
  return (
    <div
      data-demo-target="recap"
      className={cn("border-ink-100 overflow-hidden rounded-2xl border bg-white", fresh && "live-pop")}
    >
      <div
        className="flex h-[74px] items-center justify-center"
        style={{ backgroundImage: "linear-gradient(135deg, #0b1628, #1f3557)" }}
      >
        <span className="text-[15px] font-bold uppercase tracking-[0.2em] text-white/70">
          {club}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <span className="bg-play-50 text-play-700 rounded-full px-2.5 py-0.5 text-[14px] font-bold uppercase tracking-[0.1em]">
          Game recap
        </span>
        <p className="text-ink-950 mt-1.5 text-[16px] font-bold leading-snug">{title}</p>
        <p className="text-ink-600 mt-1 text-[14px] leading-snug">{body}</p>
        <p className="text-ink-400 mt-1.5 text-[14px] font-semibold">{meta}</p>
      </div>
    </div>
  )
}

/** The division table, the shared StandingsTable's columns at phone width. */
export function LiveStandings({
  rows,
  movedTeam,
}: {
  rows: { rank: number; team: string; w: number; l: number; pct: string; gb: string; strk: string }[]
  movedTeam?: string
}) {
  return (
    <div
      data-demo-target="standings"
      className="border-ink-100 overflow-hidden rounded-2xl border bg-white"
    >
      <table className="w-full table-fixed text-[14px]">
        <colgroup>
          <col />
          <col className="w-[26px]" />
          <col className="w-[26px]" />
          <col className="w-[42px]" />
          <col className="w-[34px]" />
          <col className="w-[46px]" />
        </colgroup>
        <thead>
          <tr className="border-ink-100 text-ink-500 border-b text-left text-[14px] uppercase tracking-[0.06em]">
            <th className="px-2 py-1.5 font-extrabold">Team</th>
            <th className="px-0 py-1.5 text-center font-extrabold">W</th>
            <th className="px-0 py-1.5 text-center font-extrabold">L</th>
            <th className="px-0 py-1.5 text-center font-extrabold">PCT</th>
            <th className="px-0 py-1.5 text-center font-extrabold">GB</th>
            <th className="px-0 py-1.5 text-center font-extrabold">STRK</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const you = r.team === movedTeam
            return (
              <tr
                key={r.rank}
                className={cn("border-ink-50 border-b last:border-0", you && "bg-highlight-soft live-pop")}
              >
                <td className="px-2 py-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("w-4 shrink-0 text-right text-[14px] font-bold tabular-nums", you ? "text-gold-600" : "text-ink-400")}>
                      {r.rank}
                    </span>
                    <span className="text-ink-950 truncate font-bold">{r.team}</span>
                  </span>
                </td>
                <td className="text-energy-ink px-0 py-1.5 text-center font-extrabold tabular-nums">{r.w}</td>
                <td className="text-ink-700 px-0 py-1.5 text-center font-bold tabular-nums">{r.l}</td>
                <td className="text-ink-900 px-0 py-1.5 text-center font-bold tabular-nums">{r.pct}</td>
                <td className="text-ink-500 px-0 py-1.5 text-center tabular-nums">{r.gb}</td>
                <td className="px-0 py-1.5 text-center">
                  <span
                    className={cn(
                      "rounded-full px-1 py-0.5 text-[14px] font-extrabold",
                      r.strk.startsWith("W") ? "bg-court-100 text-court-700" : "bg-hoop-50 text-hoop-700"
                    )}
                  >
                    {r.strk}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** The end card, drawn over both handsets. */
export function MockEndCard({
  eyebrow,
  title,
  line,
  next,
}: {
  eyebrow: string
  title: string
  line: string
  next?: string
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b1628] px-5 text-white">
      <div className="live-pop text-center">
        <p className="text-gold-400 text-[14px] font-bold uppercase tracking-[0.18em]">{eyebrow}</p>
        <h3 className="font-display mt-2 text-[24px] font-extrabold leading-tight">{title}</h3>
        <p className="mt-2.5 text-[15px] leading-relaxed text-white/75">{line}</p>
        {next && <p className="mt-4 text-[14px] font-semibold text-white/50">{next}</p>}
      </div>
    </div>
  )
}
