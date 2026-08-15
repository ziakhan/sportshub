"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Crest } from "@/components/ui/crest"
import { PlayerMug } from "@/components/ui/player-mug"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"

/**
 * Game-day kit for the demo directory (story 4, 2026-08-15).
 *
 * Two surfaces, mocked column for column against the ones that ship today:
 *
 *  · THE CONSOLE — components/scoring/scoring-console.tsx. The score header
 *    with each team's period fouls, the mono clock button that starts and
 *    stops, "End Q1", the event ticker with the synced pill, BOX, Rows and the
 *    red UNDO. Under it the two fives as tiles (big jersey, foul dots, name)
 *    with "SUBS ⇄ (n on bench)", and the action pad whose status strip really
 *    does read "Tap an action, then a player" and then names the pending half
 *    of the pair. The pad carries EXACTLY the buttons this league's console
 *    carries: +2, +3, FT ✓, 2 ✗, 3 ✗, FT ✗, REB, AST, FOUL. No steals, no
 *    blocks, no turnovers: the hustle set is off for this league, so recording
 *    them is not something the table can do tonight.
 *
 *  · THE PHONE — app/(public)/live/[gameId]. The navy stage hero with the
 *    linescore inside it, the sticky mini score chip, the Game / Team stats /
 *    Play-by-play tabs, the box score behind its team switcher with the full
 *    Pts Reb Ast Stl Blk TO PF line, and the play rows with their neutral rail
 *    and running score.
 *
 * TWO DELIBERATE DEPARTURES, both noted here rather than hidden:
 *  1. The product's play-by-play joins a miss to its rebound with an em-dash.
 *     House copy rule forbids one, so the demo uses a middot.
 *  2. The real mini score chip carries score and period. Here it also carries
 *     the clock, because the phone frame cannot scroll and the chip is the
 *     only header the box and plays views get: score, quarter and time have to
 *     stay together on every view (owner law).
 *
 * THE CLOCK IS ONE VALUE. Both frames read `useDemoClock`, which is a single
 * module-level store with a single ticker, so the console and the phone cannot
 * drift apart by even a frame: they are literally rendering the same number.
 */

/* ── One clock, both frames ──────────────────────────────────────────────── */

interface ClockState {
  key: string
  base: number
  running: boolean
  startedAt: number
}

const clock: ClockState = { key: "", base: 0, running: false, startedAt: 0 }
const listeners = new Set<() => void>()
let ticker: ReturnType<typeof setInterval> | null = null

/** Seconds the whole demo agrees the period has left. */
function readClock(): number {
  if (!clock.running) return clock.base
  const elapsed = Math.floor((Date.now() - clock.startedAt) / 1000)
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
    clock.startedAt = Date.now()
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
 * reads: console and phone are asserted equal on the same beat.
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
 * Flashes its box whenever `value` changes. This is the phone side of the
 * owner's sync law: the element that CHANGED is the element that pulses, and
 * the tone says what kind of change it was.
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
  /** "Amara B." — the abbreviation every score surface uses. */
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

const TARGET = (id?: string) => (id ? { "data-demo-target": id } : {})

/* ── Console: the scorer's table ─────────────────────────────────────────── */

/** The score header: fouls, the clock, and the button that ends the period. */
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
  ticker: ticks,
  tone,
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
  /** Regulation is over: the header offers "End game" beside the next period. */
  ended?: boolean
  /** The last three events, as the console's undo chips. */
  ticker: string[]
  tone: PulseTone
}) {
  const side = (
    name: string,
    score: number,
    fouls: number,
    align: "left" | "right",
    dot: string
  ) => (
    <div className={cn("min-w-0 flex-1", align === "left" ? "text-left" : "text-right")}>
      <div className="truncate text-[11px]">
        {align === "left" && (
          <span className={cn("mr-1 inline-block h-2 w-2 rounded-full align-middle", dot)} />
        )}
        <span className="text-ink-500">{name}</span>
        {align === "right" && (
          <span className={cn("ml-1 inline-block h-2 w-2 rounded-full align-middle", dot)} />
        )}
      </div>
      <div className="text-ink-950 text-3xl font-bold tabular-nums">
        <Pulse value={score} tone={tone}>
          {score}
        </Pulse>
      </div>
      <div className="text-ink-400 text-[10px]">
        fouls{" "}
        <Pulse value={fouls} tone="red">
          {fouls}
        </Pulse>
        {fouls >= 7 ? " · bonus" : ""}
      </div>
    </div>
  )

  return (
    <div className="border-ink-200 rounded-2xl border bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        {side(homeName, homeScore, homeFouls, "left", "bg-play-400")}

        <div className="text-center">
          <div className="text-ink-900 text-sm font-bold">{periodLabel}</div>
          <span
            {...TARGET("console-clock")}
            className={cn(
              "mt-0.5 inline-block rounded-lg px-3 py-1 font-mono text-2xl font-bold transition-all duration-200",
              running ? "bg-court-50 text-court-700" : "bg-ink-100 text-ink-700",
              "data-[demo-hover=true]:brightness-95 data-[demo-press=true]:scale-[0.97]"
            )}
          >
            <DemoClock base={clockBase} running={running} reduced={reduced} where="console" />{" "}
            <span className="text-[10px]">{running ? "⏸" : "▶"}</span>
          </span>
          <span className="border-ink-200 text-ink-500 ml-1 inline-block rounded-lg border px-2 py-1 text-xs font-semibold">
            ✎
          </span>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            {periodOpen ? (
              <span
                {...TARGET("end-period")}
                className={cn(
                  "border-ink-200 text-ink-600 inline-block rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-all duration-200",
                  "data-[demo-hover=true]:bg-ink-50 data-[demo-press=true]:scale-[0.97]"
                )}
              >
                End {periodLabel}
              </span>
            ) : (
              <>
                <span className="bg-play-600 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white">
                  Start OT1
                </span>
                {ended && (
                  <span
                    {...TARGET("end-game")}
                    className={cn(
                      "bg-court-600 inline-block rounded-lg px-2 py-0.5 text-[10px] font-semibold text-white transition-all duration-200",
                      "data-[demo-hover=true]:brightness-110 data-[demo-press=true]:scale-[0.97]"
                    )}
                  >
                    End game →
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {side(awayName, awayScore, awayFouls, "right", "bg-court-400")}
      </div>

      {/* ticker + sync + undo */}
      <div className="border-ink-100 mt-2 flex items-center justify-between gap-2 border-t pt-2">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
          {ticks.map((t) => (
            <span
              key={t}
              className="bg-ink-50 text-ink-600 live-row-in shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px]"
            >
              {t} ✕
            </span>
          ))}
        </div>
        <span className="bg-court-50 text-court-700 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold">
          synced
        </span>
        <span className="border-ink-200 text-ink-600 rounded-xl border px-2.5 py-2 text-xs font-semibold">
          BOX
        </span>
        <span className="border-ink-200 text-ink-600 rounded-xl border px-2.5 py-2 text-xs font-semibold">
          Rows
        </span>
        <span
          {...TARGET("undo")}
          className={cn(
            "bg-hoop-600 inline-block rounded-xl px-4 py-2 text-sm font-bold text-white transition-all duration-200",
            "data-[demo-hover=true]:brightness-110 data-[demo-press=true]:scale-[0.97]"
          )}
        >
          UNDO
        </span>
      </div>
    </div>
  )
}

/** One team's five, as the table sees them: number, foul dots, name. */
export function ConsoleFloor({
  side,
  players,
  onFloor,
  fouls,
  selected,
  armed,
  benchCount,
}: {
  side: "home" | "away"
  players: MockPlayer[]
  onFloor: number[]
  /** Personal fouls by jersey, drawn as the console's dots. */
  fouls: Record<number, number>
  /** Jersey the pointer has already picked, if the pair started that way. */
  selected?: number | null
  /** An action is waiting for a player: every tile invites the tap. */
  armed?: boolean
  benchCount: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {onFloor.map((jersey) => {
        const p = players.find((x) => x.jersey === jersey)
        if (!p) return null
        const isSelected = selected === jersey
        return (
          <span
            key={jersey}
            {...TARGET(`floor-${side}-${jersey}`)}
            className={cn(
              "block rounded-xl border p-2 text-left transition-all duration-200",
              isSelected
                ? "border-play-500 bg-play-100"
                : armed
                  ? "border-play-300 motion-safe:animate-pulse bg-white"
                  : "border-ink-200 bg-white",
              "data-[demo-hover=true]:border-play-400 data-[demo-press=true]:scale-[0.97]"
            )}
          >
            <span className="flex items-baseline justify-between">
              <span className="text-ink-950 text-xl font-bold">#{jersey}</span>
              <span className="text-hoop-600 text-[10px]">
                {"•".repeat(Math.min(fouls[jersey] ?? 0, 5))}
              </span>
            </span>
            <span className="text-ink-600 block truncate text-[11px]">{p.name}</span>
          </span>
        )
      })}
      <span
        {...TARGET(`subs-${side}`)}
        className={cn(
          "border-ink-300 text-ink-600 mt-1 block rounded-xl border border-dashed px-2 py-1.5 text-center text-xs font-semibold transition-all duration-200",
          "data-[demo-hover=true]:bg-ink-50 data-[demo-press=true]:scale-[0.97]"
        )}
      >
        SUBS ⇄ ({benchCount} on bench)
      </span>
    </div>
  )
}

/**
 * The action pad. The status strip is a FIXED height that swaps its contents,
 * exactly as the console's does, so nothing on the screen moves when the
 * prompt changes.
 */
export function ConsoleActionPad({
  pending,
  pendingPlayer,
  assistFor,
  assistOptions,
}: {
  /** Label of the action waiting for a player, e.g. "+2" or "3 ✗". */
  pending?: string | null
  /** Jersey waiting for an action, when the table tapped the player first. */
  pendingPlayer?: number | null
  /** Shooter's jersey while the console asks who assisted. */
  assistFor?: number | null
  assistOptions?: number[]
}) {
  const btn = (label: string, tone: string, id: string) => (
    <span
      {...TARGET(id)}
      className={cn(
        "min-w-0 flex-1 rounded-xl px-1 py-3 text-center text-sm font-bold transition-all duration-200",
        tone,
        pending === label ? "ring-play-500 ring-2" : "",
        "data-[demo-hover=true]:brightness-110 data-[demo-press=true]:scale-[0.96]"
      )}
    >
      {label}
    </span>
  )

  return (
    <div className="border-ink-200 rounded-2xl border bg-white p-2 shadow-sm">
      <div className="mb-1.5 flex min-h-[52px] items-center justify-center gap-2 px-1">
        {assistFor ? (
          <>
            <span className="text-play-800 whitespace-nowrap text-xs font-semibold">Assist by?</span>
            {(assistOptions ?? []).map((j) => (
              <span
                key={j}
                {...TARGET(`assist-${j}`)}
                className={cn(
                  "border-play-300 text-play-800 inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border bg-white text-sm font-bold transition-all duration-200",
                  "data-[demo-hover=true]:bg-play-50 data-[demo-press=true]:scale-[0.95]"
                )}
              >
                #{j}
              </span>
            ))}
            <span className="text-ink-600 whitespace-nowrap px-2 text-sm">skip</span>
          </>
        ) : pending ? (
          <p className="text-play-700 text-xs font-semibold">{pending} · now tap the player</p>
        ) : pendingPlayer ? (
          <p className="text-play-700 text-xs font-semibold">
            #{pendingPlayer} · now tap an action
          </p>
        ) : (
          <p className="text-ink-400 text-xs">Tap an action, then a player. Either order works.</p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {btn("+2", "bg-court-600 text-white", "act-2")}
        {btn("+3", "bg-court-600 text-white", "act-3")}
        {btn("FT ✓", "bg-court-500 text-white", "act-ft")}
        {btn("2 ✗", "bg-ink-100 text-ink-700", "act-miss2")}
        {btn("3 ✗", "bg-ink-100 text-ink-700", "act-miss3")}
        {btn("FT ✗", "bg-ink-100 text-ink-700", "act-missft")}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {btn("REB", "bg-play-50 text-play-700", "act-reb")}
        {btn("AST", "bg-play-50 text-play-700", "act-ast")}
        {btn("FOUL", "bg-amber-100 text-amber-800", "act-foul")}
      </div>
    </div>
  )
}

/** The substitutions drawer: who comes out, who goes in, then apply. */
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
  out?: number | null
  staged: Array<{ out: number; in: number }>
}) {
  const nameOf = (j: number) => players.find((p) => p.jersey === j)?.name ?? ""
  const cell = (j: number, id: string, state: "floor" | "bench", stagedCell?: boolean) => (
    <span
      key={j}
      {...TARGET(id)}
      className={cn(
        "block rounded-lg border p-2 text-left text-sm transition-all duration-200",
        stagedCell
          ? "border-play-300 bg-play-50 text-play-700"
          : state === "floor" && out === j
            ? "border-hoop-400 bg-hoop-50 text-ink-800"
            : state === "bench" && out
              ? "border-court-300 bg-white text-ink-800"
              : state === "bench"
                ? "border-ink-200 text-ink-400 bg-white"
                : "border-ink-200 text-ink-800 bg-white",
        "data-[demo-hover=true]:bg-ink-50 data-[demo-press=true]:scale-[0.97]"
      )}
    >
      <span className="font-bold">#{j}</span> {nameOf(j)}
      {stagedCell ? " (staged)" : ""}
    </span>
  )

  return (
    <div className="live-pop border-ink-100 absolute left-1/2 top-1/2 z-30 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-4 shadow-[0_50px_120px_-40px_rgba(15,23,42,0.65)]">
      <h3 className="text-ink-900 text-sm font-semibold">Substitutions · {teamName}</h3>
      <p className="text-ink-500 mt-0.5 text-xs">
        Tap who comes OUT, then who goes IN. Stage as many swaps as you need, then apply.
      </p>

      <p className="text-ink-400 mt-3 text-[10px] font-semibold uppercase">On the floor</p>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {onFloor
          .filter((j) => !staged.some((s) => s.out === j))
          .map((j) => cell(j, `sub-out-${j}`, "floor"))}
      </div>

      {/* The product drops a staged player out of the bench grid. The demo
          keeps the tile and marks it staged, so the swap can be read back off
          the drawer while it is still open. */}
      <p className="text-ink-400 mt-3 text-[10px] font-semibold uppercase">Bench</p>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {bench.map((j) =>
          cell(j, `sub-in-${j}`, "bench", staged.some((s) => s.in === j))
        )}
      </div>

      {staged.length > 0 && (
        <div className="bg-ink-50 live-row-in mt-3 rounded-xl p-2">
          {staged.map((s) => (
            <div key={`${s.out}-${s.in}`} className="text-ink-700 py-0.5 text-xs">
              #{s.out} out → #{s.in} in
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <span className="border-ink-200 text-ink-700 flex-1 rounded-xl border px-3 py-2 text-center text-sm font-semibold">
          Cancel
        </span>
        <span
          {...TARGET("sub-apply")}
          className={cn(
            "bg-play-600 flex-1 rounded-xl px-3 py-2 text-center text-sm font-bold text-white transition-all duration-200",
            staged.length === 0 && "opacity-40",
            "data-[demo-hover=true]:brightness-110 data-[demo-press=true]:scale-[0.97]"
          )}
        >
          Apply {staged.length || ""} swap{staged.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  )
}

/** The pre-game checklist, the first thing the console shows a scorer. */
export function ConsoleChecklist({
  scorekeeper,
  referee,
  clockChoice,
}: {
  scorekeeper: string
  referee: string
  clockChoice: boolean | null
}) {
  const row = (label: string, value: string) => (
    <div className="border-court-200 bg-court-50 flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
      <span className="text-ink-800 font-medium">{label}</span>
      <span className="text-court-700">{value}</span>
    </div>
  )
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b1628]/35">
      <div className="live-pop w-[420px] rounded-3xl bg-white p-6 shadow-[0_50px_120px_-40px_rgba(15,23,42,0.65)]">
        <p className="text-play-600 text-xs font-bold uppercase tracking-[0.18em]">
          Before tip-off
        </p>
        <h2 className="text-ink-950 mt-1 text-lg font-bold">Game-day checklist</h2>
        <div className="mt-4 space-y-2">
          {row("Scorekeeper", scorekeeper)}
          {row("Referee", referee)}
        </div>
        <div className="border-ink-100 mt-3 rounded-xl border p-3">
          <p className="text-ink-800 text-sm font-semibold">Run the game clock?</p>
          <p className="text-ink-500 mt-0.5 text-xs">
            Only choose Yes if you will operate start and stop during play, otherwise minutes
            count wrongly. Most games just use the arena clock.
          </p>
          <div className="mt-2 flex gap-2">
            <span
              {...TARGET("clock-yes")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-1.5 text-center text-xs font-bold transition-all duration-200",
                clockChoice === true
                  ? "border-court-600 bg-court-600 text-white"
                  : "border-ink-200 text-ink-600",
                "data-[demo-hover=true]:border-court-400 data-[demo-press=true]:scale-[0.97]"
              )}
            >
              Yes, I will run it
            </span>
            <span className="border-ink-200 text-ink-600 flex-1 rounded-lg border px-3 py-1.5 text-center text-xs font-bold">
              No clock
            </span>
          </div>
        </div>
        <span
          {...TARGET("checklist-go")}
          className={cn(
            "text-ink-600 mt-4 block w-full rounded-xl py-2 text-center text-sm font-semibold transition-all duration-200",
            "data-[demo-hover=true]:text-ink-950 data-[demo-press=true]:scale-[0.98]"
          )}
        >
          Continue to attendance and scoring →
        </span>
      </div>
    </div>
  )
}

/** Starting fives, picked before the ball goes up. */
export function ConsoleLineup({
  homeName,
  awayName,
  league,
  venue,
  homePlayers,
  awayPlayers,
  homeStarters,
  awayStarters,
}: {
  homeName: string
  awayName: string
  league: string
  venue: string
  homePlayers: MockPlayer[]
  awayPlayers: MockPlayer[]
  homeStarters: number[]
  awayStarters: number[]
}) {
  const list = (name: string, players: MockPlayer[], starters: number[], side: string) => (
    <div className="border-ink-200 flex-1 rounded-xl border bg-white p-4">
      <h3 className="text-ink-900 text-sm font-semibold">
        {name}
        <span className="text-ink-600 ml-2 text-sm tabular-nums">
          {starters.length} of 5 picked
        </span>
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {players.map((p) => {
          const on = starters.includes(p.jersey)
          return (
            <span
              key={p.jersey}
              {...TARGET(`start-${side}-${p.jersey}`)}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2 text-left text-sm transition-all duration-200",
                on ? "border-court-500 bg-court-50" : "border-ink-200 bg-white"
              )}
            >
              <PlayerMug
                name={p.name}
                accentKey={`${side}-${p.jersey}`}
                jerseyNumber={String(p.jersey)}
                sizeClassName="h-8 w-8 rounded-full"
              />
              <span className="min-w-0">
                <span className="text-ink-950 block text-[13px] font-bold leading-tight">
                  #{p.jersey} {p.name}
                </span>
                <span
                  className={cn(
                    "block text-[10px] font-semibold uppercase",
                    on ? "text-court-700" : "text-ink-400"
                  )}
                >
                  {on ? "starting" : "bench"}
                </span>
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-5">
      <div>
        <h2 className="text-ink-950 text-lg font-bold">
          {homeName} vs {awayName}
        </h2>
        <p className="text-ink-600 text-sm">
          {league} · {venue} · pick each starting five, then start the game
        </p>
      </div>
      <div className="flex gap-4">
        {list(homeName, homePlayers, homeStarters, "home")}
        {list(awayName, awayPlayers, awayStarters, "away")}
      </div>
      <div className="flex gap-3">
        <span className="border-ink-200 text-ink-700 rounded-xl border px-4 py-3 text-sm font-semibold">
          ← Attendance
        </span>
        <span
          {...TARGET("start-game")}
          className={cn(
            "bg-court-600 flex-1 rounded-xl px-4 py-3 text-center text-sm font-bold text-white transition-all duration-200",
            "data-[demo-hover=true]:brightness-110 data-[demo-press=true]:scale-[0.98]"
          )}
        >
          Start game
        </span>
      </div>
    </div>
  )
}

/**
 * Review and sign off. The referee approval block is the console's own: the
 * Signature / Referee PIN switch, the signed pad, the printed name, and the
 * Mark final button that stays disabled until the referee has approved.
 */
export function ConsoleReview({
  homeName,
  awayName,
  homeScore,
  awayScore,
  potg,
  potgLine,
  mode,
  signed,
  refereeName,
  sheets,
}: {
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  potg: string
  potgLine: string
  mode: "sign" | "pin"
  signed: boolean
  refereeName: string
  /** Both teams' lines, read back before anything is made official. */
  sheets: Array<{
    name: string
    players: MockPlayer[]
    lines: Record<number, MockLine>
  }>
}) {
  const sheet = (s: {
    name: string
    players: MockPlayer[]
    lines: Record<number, MockLine>
  }) => {
    const rows = [...s.players]
      .sort((a, b) => (s.lines[b.jersey]?.pts ?? 0) - (s.lines[a.jersey]?.pts ?? 0))
      .slice(0, 5)
    return (
      <div key={s.name} className="border-ink-200 flex-1 overflow-hidden rounded-xl border bg-white">
        <p className="border-ink-100 text-ink-700 border-b px-2.5 py-1 text-[11px] font-semibold">
          {s.name}
        </p>
        <table className="text-ink-700 w-full text-[11px] tabular-nums">
          <thead className="text-ink-400 text-[9px] uppercase tracking-[0.12em]">
            <tr>
              <th className="py-0.5 pl-2.5 text-left font-semibold">Player</th>
              <th className="px-1 text-right font-semibold">Pts</th>
              <th className="px-1 text-right font-semibold">Reb</th>
              <th className="px-1 text-right font-semibold">Ast</th>
              <th className="pr-2.5 text-right font-semibold">PF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const l = s.lines[p.jersey]
              return (
                <tr key={p.jersey} className="border-ink-50 border-t">
                  <td className="text-ink-900 py-[3px] pl-2.5 font-medium">
                    <span className="text-ink-400 mr-1 font-normal">#{p.jersey}</span>
                    {p.short}
                  </td>
                  <td className="text-ink-950 px-1 text-right font-bold">{l?.pts ?? 0}</td>
                  <td className="px-1 text-right">{l?.reb ?? 0}</td>
                  <td className="px-1 text-right">{l?.ast ?? 0}</td>
                  <td className="pr-2.5 text-right">{l?.pf ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-2 p-3">
      <h2 className="text-ink-950 text-center text-base font-bold">
        Review: {homeName} {homeScore} · {awayScore} {awayName}
      </h2>

      <div className="flex gap-3">{sheets.map(sheet)}</div>

      <div className="border-play-200 bg-play-50 rounded-xl border p-3">
        <p className="text-play-800 text-[13px] font-semibold">
          Player of the Game (optional)
          <span className="text-play-600 ml-1.5 font-normal">· top scorer suggested</span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="border-play-500 bg-play-100 text-play-900 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold">
            <PlayerMug
              name={potg}
              accentKey="home-23"
              jerseyNumber="23"
              sizeClassName="h-7 w-7 rounded-full"
            />
            {potg} · {potgLine}
          </span>
          <span className="border-ink-200 text-ink-700 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold">
            📷 Snap their photo (optional)
          </span>
        </div>
      </div>

      <div className="border-amber-300 bg-amber-50 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-amber-800 text-[13px] font-semibold">
            Referee approval (required by this league)
          </p>
          <div className="flex rounded-lg bg-white p-0.5">
            <span
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold",
                mode === "sign" ? "bg-amber-100 text-amber-900" : "text-ink-500"
              )}
            >
              Signature
            </span>
            <span
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-semibold",
                mode === "pin" ? "bg-amber-100 text-amber-900" : "text-ink-500"
              )}
            >
              Referee PIN
            </span>
          </div>
        </div>

        <div className="mt-2 space-y-2">
          <span
            {...TARGET("sign-pad")}
            className={cn(
              "border-amber-300 block h-[68px] w-full rounded-lg border-2 border-dashed bg-white transition-all duration-200",
              "data-[demo-hover=true]:border-amber-500"
            )}
          >
            {signed ? (
              <svg viewBox="0 0 320 90" className="h-full w-full" aria-hidden="true">
                <path
                  d="M22 66 C40 26, 58 24, 66 48 C72 66, 84 66, 92 44 C100 22, 116 26, 120 52 C124 74, 140 70, 152 44 C160 26, 176 30, 178 54 C180 72, 196 70, 208 50 C218 34, 236 36, 244 56 C250 70, 262 68, 276 48"
                  fill="none"
                  stroke="#0b1628"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  className="demo-sign-in"
                />
              </svg>
            ) : (
              <span className="text-ink-400 flex h-full items-center justify-center text-xs font-semibold">
                Referee signs here
              </span>
            )}
          </span>
          <span className="border-amber-300 text-ink-800 block w-full rounded-lg border bg-white px-3 py-2 text-sm">
            {refereeName || (
              <span className="text-ink-400">Referee&apos;s printed name (optional with a signature)</span>
            )}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <span className="border-ink-200 text-ink-700 flex-1 rounded-xl border px-4 py-3 text-center text-sm font-semibold">
          ← Back to scoring
        </span>
        <span
          {...TARGET("mark-final")}
          className={cn(
            "bg-court-600 flex-1 rounded-xl px-4 py-3 text-center text-sm font-bold text-white transition-all duration-200",
            !signed && "opacity-40",
            "data-[demo-hover=true]:brightness-110 data-[demo-press=true]:scale-[0.98]"
          )}
        >
          Mark final
        </span>
      </div>
    </div>
  )
}

/** What the table sees once the result is official. */
export function ConsoleFinal({
  homeName,
  awayName,
  homeScore,
  awayScore,
  referee,
}: {
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  referee: string
}) {
  return (
    <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center p-8 text-center">
      <span className="bg-court-50 text-court-700 ring-court-200 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ring-1 ring-inset">
        Final
      </span>
      <p className="text-ink-950 mt-3 text-3xl font-bold">
        {homeName} {homeScore} · {awayScore} {awayName}
      </p>
      <p className="text-ink-500 mt-2 text-sm">
        Approved by {referee}, signature on the scoresheet.
      </p>
      <div className="mt-4 flex justify-center gap-4">
        <span className="text-play-600 text-sm font-semibold">Official scoresheet (print) →</span>
        <span className="text-play-600 text-sm font-semibold">Public box score →</span>
      </div>
    </div>
  )
}

/* ── Phone: what the family sees ─────────────────────────────────────────── */

export interface PhoneTeam {
  name: string
  short: string
  record: string
}

/** The navy stage: state, both teams, and the linescore inside it. */
export function PhoneScoreHero({
  league,
  home,
  away,
  homeScore,
  awayScore,
  period,
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
  period: number
  periodLabel: string
  clockBase: number
  running: boolean
  reduced: boolean
  final: boolean
  venue: string
  /** Points by period, home then away. Undefined means not played yet. */
  linescore: { home: Record<number, number>; away: Record<number, number> }
  displayPeriods: number[]
  tone: PulseTone
}) {
  const META = "text-[9.5px] font-medium uppercase tracking-[0.14em] text-white/55"
  const rows: Array<[PhoneTeam, number, number]> = [
    [home, homeScore, awayScore],
    [away, awayScore, homeScore],
  ]
  const scoreTone = (s: number, o: number) =>
    !final ? "text-white" : s > o ? "text-gold-400" : "text-white/45"

  return (
    <div
      className="relative isolate overflow-hidden px-3 pb-2.5 pt-2 text-white"
      style={{
        backgroundImage:
          "radial-gradient(120% 150% at 50% -20%, rgba(255,255,255,0.10) 0%, transparent 60%), linear-gradient(135deg, #0b1628, #12233d)",
      }}
    >
      <p className="text-center text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
        {league}
      </p>

      <div className="mt-1.5 flex items-center justify-center gap-2">
        {final ? (
          <span className="bg-court-500 rounded-full px-3 py-[3px] text-[10px] font-bold uppercase tracking-[0.18em] text-white">
            Final
          </span>
        ) : (
          <>
            <span className="bg-live-600 inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-[0.16em] text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />
              Live
            </span>
            <Pulse value={period} tone="amber">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.04em] text-white/70">
                {periodLabel}
              </span>
            </Pulse>
            <span className="font-condensed text-gold-400 text-[20px] font-semibold leading-none">
              <DemoClock base={clockBase} running={running} reduced={reduced} where="phone" />
            </span>
          </>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        {rows.map(([t, score, other]) => (
          <div key={t.name} className="flex items-center gap-2.5">
            <Crest name={t.name} surface="dark" sizeClassName="h-9 w-9 rounded-xl text-[12px]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold leading-tight text-white">
                {t.name}
              </p>
              <p className={cn("truncate", META)}>{t.record}</p>
            </div>
            <p
              className={cn(
                "font-condensed min-w-[52px] text-right text-[34px] font-semibold leading-none tabular-nums",
                scoreTone(score, other)
              )}
            >
              <Pulse value={score} tone={tone}>
                {score}
              </Pulse>
            </p>
          </div>
        ))}
      </div>

      <p className={cn("mt-1.5 text-center", META)}>{venue}</p>

      <div className="mt-2 rounded-xl bg-white/[0.08] ring-1 ring-inset ring-white/15">
        <table className="w-full text-center tabular-nums">
          <thead>
            <tr className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50">
              <th className="py-1 pl-2 text-left" />
              {displayPeriods.map((p) => (
                <th key={p} className="px-1.5 py-1">
                  {p <= 4 ? p : `OT${p - 4}`}
                </th>
              ))}
              <th className="px-2 py-1 pr-2 text-white/75">Tot</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                [home, linescore.home, homeScore],
                [away, linescore.away, awayScore],
              ] as Array<[PhoneTeam, Record<number, number>, number]>
            ).map(([t, pts, total]) => (
              <tr key={t.name} className="border-t border-white/10">
                <td className="py-1 pl-2 text-left">
                  <span className="whitespace-nowrap text-[10.5px] font-semibold text-white/90">
                    {t.short}
                  </span>
                </td>
                {displayPeriods.map((p) => (
                  <td
                    key={p}
                    className="font-condensed px-1.5 py-1 text-[14px] font-medium leading-none text-white/85"
                  >
                    {pts[p] == null ? (
                      <span className="text-white/25">–</span>
                    ) : (
                      <Pulse value={pts[p]} tone={tone}>
                        {pts[p]}
                      </Pulse>
                    )}
                  </td>
                ))}
                <td className="font-condensed text-gold-400 px-2 py-1 pr-2 text-[16px] font-bold leading-none">
                  <Pulse value={total} tone={tone}>
                    {total}
                  </Pulse>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * The sticky mini score chip. On the real page it appears once the hero
 * scrolls away; here it is the header for every view that is not the hero,
 * and it carries the clock as well so score, quarter and time never separate.
 */
export function PhoneMiniScore({
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
    <div
      className="flex items-center justify-center gap-2 px-3 py-1.5 text-white"
      style={{ background: "linear-gradient(120deg, #0b1628, #12233d)" }}
    >
      <Crest name={home.name} surface="dark" sizeClassName="h-5 w-5 rounded-md text-[9px]" />
      <span className="font-condensed text-[19px] font-semibold leading-none tabular-nums">
        <Pulse value={homeScore} tone={tone}>
          {homeScore}
        </Pulse>
      </span>
      <span className="min-w-[92px] text-center text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/75">
        {final ? (
          "Final"
        ) : (
          <>
            Live · {periodLabel} ·{" "}
            <DemoClock base={clockBase} running={running} reduced={reduced} where="phone" />
          </>
        )}
      </span>
      <span className="font-condensed text-[19px] font-semibold leading-none tabular-nums">
        <Pulse value={awayScore} tone={tone}>
          {awayScore}
        </Pulse>
      </span>
      <Crest name={away.name} surface="dark" sizeClassName="h-5 w-5 rounded-md text-[9px]" />
    </div>
  )
}

/** Game | Team stats | Play-by-play, the real page's own switcher. */
export function PhoneGameTabs({ active }: { active: "game" | "stats" | "plays" }) {
  const tabs: Array<[typeof active, string]> = [
    ["game", "Game"],
    ["stats", "Team stats"],
    ["plays", "Play-by-play"],
  ]
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2">
      {tabs.map(([key, label]) => (
        <span
          key={key}
          {...TARGET(`phone-tab-${key}`)}
          className={cn(
            "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-200",
            active === key
              ? "bg-ink-950 text-white shadow-sm"
              : "text-ink-600 border-ink-200 border bg-white",
            "data-[demo-press=true]:scale-[0.96]"
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

/** Play rows: neutral rail, the sentence, the running score. */
export function PhonePlayList({
  rows,
  freshKey,
  tone,
  title,
  filters,
  activeFilter,
}: {
  rows: PhonePlayRow[]
  /** The row that just landed pops in and pulses. */
  freshKey?: string
  tone: PulseTone
  title?: string
  filters?: string[]
  activeFilter?: string
}) {
  return (
    <section className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
      {title && (
        <div className="border-ink-100 flex items-center justify-between border-b px-3 py-2">
          <h3 className="text-ink-800 text-[10px] font-bold uppercase tracking-[0.18em]">
            {title}
          </h3>
          <span className="text-play-600 text-[10.5px] font-semibold">See all plays</span>
        </div>
      )}
      {filters && (
        <div className="border-ink-100 flex items-center gap-1 border-b px-2.5 py-1.5">
          {filters.map((f) => (
            <span
              key={f}
              className={cn(
                "whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
                f === activeFilter
                  ? "bg-ink-950 text-white"
                  : "text-ink-600 border-ink-200 border bg-white"
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
              className="bg-ink-50 text-ink-600 px-3 py-1 text-center text-[9.5px] font-bold uppercase tracking-[0.18em]"
            >
              {r.period}
            </li>
          ) : (
            <li
              key={r.key}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 text-[11px]",
                r.score ? "text-ink-950 font-medium" : "text-ink-600",
                r.key === freshKey && "live-row-in"
              )}
            >
              <span
                className={cn("w-1 self-stretch rounded-full", r.home ? "bg-ink-400" : "bg-ink-200")}
              />
              <span className="min-w-0 flex-1 leading-snug">
                <Pulse value={r.text} tone={r.key === freshKey ? tone : "amber"}>
                  {r.text}
                </Pulse>
              </span>
              {r.score && (
                <span className="font-condensed text-ink-950 shrink-0 text-[13px] font-semibold tabular-nums">
                  {r.score}
                </span>
              )}
            </li>
          )
        )}
      </ul>
    </section>
  )
}

/** The box score, behind its team switcher, with the full stat line. */
export function PhoneBoxScore({
  homeName,
  awayName,
  side,
  players,
  lines,
  starters,
  onFloor,
  tone,
  highlight,
}: {
  homeName: string
  awayName: string
  side: "home" | "away"
  players: MockPlayer[]
  lines: Record<number, MockLine>
  starters: number[]
  onFloor: number[]
  tone: PulseTone
  /** Jersey whose row the story is pointing at. */
  highlight?: number | null
}) {
  const ordered = [...players].sort(
    (a, b) => (lines[b.jersey]?.pts ?? 0) - (lines[a.jersey]?.pts ?? 0)
  )
  const top = ordered.length > 0 && (lines[ordered[0].jersey]?.pts ?? 0) > 0 ? ordered[0].jersey : null
  const starterRows = ordered.filter((p) => starters.includes(p.jersey))
  const benchRows = ordered.filter((p) => !starters.includes(p.jersey))
  const totals = players.reduce(
    (t, p) => {
      const l = lines[p.jersey]
      if (!l) return t
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

  const CELL = "px-[2px] text-right"
  const groupHead =
    "bg-ink-50 text-ink-500 border-ink-100 border-y px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"

  const row = (p: MockPlayer) => {
    const l = lines[p.jersey] ?? {
      jersey: p.jersey,
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      to: 0,
      pf: 0,
    }
    const isTop = p.jersey === top
    return (
      <tr
        key={p.jersey}
        className="border-ink-50 border-t"
        style={
          highlight === p.jersey
            ? { backgroundColor: "rgba(24,24,27,0.07)", boxShadow: "inset 3px 0 0 0 #3f3f46" }
            : undefined
        }
      >
        <td
          className={cn(
            "text-ink-900 whitespace-nowrap py-[5px] pl-2 pr-0.5 text-[10.5px]",
            isTop ? "font-bold" : "font-medium"
          )}
        >
          <span className="text-ink-500 mr-0.5 font-normal">#{p.jersey}</span>
          {p.short}
          {onFloor.includes(p.jersey) && <span className="text-court-600"> ●</span>}
          {isTop && (
            <span className="bg-gold-400 text-gold-950 ml-0.5 rounded px-[3px] py-px align-[1px] text-[7.5px] font-bold">
              TOP
            </span>
          )}
        </td>
        <td className={cn("text-ink-950 text-[11.5px] font-bold", CELL)}>
          <Pulse value={l.pts} tone={tone}>
            {l.pts}
          </Pulse>
        </td>
        <td className={CELL}>
          <Pulse value={l.reb} tone={tone}>
            {l.reb}
          </Pulse>
        </td>
        <td className={CELL}>
          <Pulse value={l.ast} tone={tone}>
            {l.ast}
          </Pulse>
        </td>
        <td className={CELL}>{l.stl}</td>
        <td className={CELL}>{l.blk}</td>
        <td className={CELL}>{l.to}</td>
        <td className={cn("pr-2.5", CELL)}>
          <Pulse value={l.pf} tone="red">
            {l.pf}
          </Pulse>
        </td>
      </tr>
    )
  }

  return (
    <section className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
      <div className="border-ink-100 border-b px-2 py-1.5">
        <div className="bg-ink-100 flex gap-1 rounded-lg p-0.5">
          {(
            [
              ["home", homeName],
              ["away", awayName],
            ] as Array<["home" | "away", string]>
          ).map(([key, name]) => (
            <span
              key={key}
              {...TARGET(`phone-box-${key}`)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 truncate rounded-md px-1 py-1 text-[9.5px] font-semibold transition-all duration-200",
                side === key ? "bg-ink-900 text-white shadow-sm" : "text-ink-600",
                "data-[demo-press=true]:scale-[0.97]"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  side === key ? "bg-white" : "bg-ink-300"
                )}
              />
              <span className="truncate">{name}</span>
            </span>
          ))}
        </div>
      </div>
      <table className="w-full tabular-nums">
        <thead className="text-ink-500 text-left text-[8.5px] uppercase tracking-[0.1em]">
          <tr>
            <th className="py-1 pl-2.5 pr-1 font-semibold">Player</th>
            <th className={cn("font-semibold", CELL)}>Pts</th>
            <th className={cn("font-semibold", CELL)}>Reb</th>
            <th className={cn("font-semibold", CELL)}>Ast</th>
            <th className={cn("font-semibold", CELL)}>Stl</th>
            <th className={cn("font-semibold", CELL)}>Blk</th>
            <th className={cn("font-semibold", CELL)}>TO</th>
            <th className={cn("pr-2.5 font-semibold", CELL)}>PF</th>
          </tr>
        </thead>
        {/* The demo page is a dark shell, so every panel states its own ink:
            a numeric cell that inherits colour renders white on white. */}
        <tbody className="text-ink-700 text-[10.5px]">
          <tr>
            <td colSpan={8} className={groupHead}>
              Starters
            </td>
          </tr>
          {starterRows.map(row)}
          {benchRows.length > 0 && (
            <tr>
              <td colSpan={8} className={groupHead}>
                Bench
              </td>
            </tr>
          )}
          {benchRows.map(row)}
          <tr className="border-ink-200 text-ink-900 border-t-2 text-[10.5px] font-semibold">
            <td className="py-1 pl-2.5 pr-1">Team</td>
            <td className={CELL}>{totals.pts}</td>
            <td className={CELL}>{totals.reb}</td>
            <td className={CELL}>{totals.ast}</td>
            <td className={CELL}>{totals.stl}</td>
            <td className={CELL}>{totals.blk}</td>
            <td className={CELL}>{totals.to}</td>
            <td className={cn("pr-2.5", CELL)}>{totals.pf}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

/** Team stats: the two-sided compare rows, shooting lines included. */
export function PhoneTeamStats({
  home,
  away,
  rows,
  tone,
  pulseLabel,
}: {
  home: PhoneTeam
  away: PhoneTeam
  rows: Array<{ label: string; h: number; a: number; dh?: string; da?: string }>
  tone: PulseTone
  /** Row whose numbers just moved. */
  pulseLabel?: string
}) {
  return (
    <section className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
      <div className="border-ink-100 flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-ink-950 truncate text-[11px] font-semibold">{home.short}</span>
        <span className="text-ink-400 text-[9.5px] font-bold uppercase tracking-[0.16em]">
          Team stats
        </span>
        <span className="text-ink-950 truncate text-[11px] font-semibold">{away.short}</span>
      </div>
      <div className="divide-ink-50 divide-y">
        {rows.map((r) => {
          const total = r.h + r.a
          const hShare = total === 0 ? 50 : (r.h / total) * 100
          const value = (wins: boolean, v: number, d?: string) => (
            <span
              className={cn(
                d ? "text-[11px]" : "font-condensed text-[18px] leading-none",
                "tabular-nums",
                wins ? "text-ink-950 font-bold" : "text-ink-400 font-medium"
              )}
            >
              <Pulse value={d ?? v} tone={r.label === pulseLabel ? tone : "amber"}>
                {d ?? v}
              </Pulse>
            </span>
          )
          return (
            <div key={r.label} className="px-3 py-1.5">
              <div className="flex items-center justify-between gap-2">
                {value(r.h > r.a, r.h, r.dh)}
                <span className="text-ink-600 text-[9.5px] font-bold uppercase tracking-[0.14em]">
                  {r.label}
                </span>
                {value(r.a > r.h, r.a, r.da)}
              </div>
              <div className="mt-1 flex h-2 items-center gap-1">
                <div className="bg-ink-100 flex flex-1 justify-end overflow-hidden rounded-l-full">
                  <span
                    className="bg-ink-700 h-2 rounded-l-full transition-all duration-500"
                    style={{ width: `${hShare}%`, opacity: r.h > r.a ? 1 : 0.35 }}
                  />
                </div>
                <span className="bg-ink-300 h-2 w-px shrink-0" />
                <div className="bg-ink-100 flex flex-1 overflow-hidden rounded-r-full">
                  <span
                    className="bg-ink-700 h-2 rounded-r-full transition-all duration-500"
                    style={{ width: `${100 - hShare}%`, opacity: r.a > r.h ? 1 : 0.35 }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Player of the Game, the gold card the family screenshots. */
export function PhonePotgCard({
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
      className={cn(
        "border-gold-400 from-gold-50 flex items-center gap-3 rounded-2xl border bg-gradient-to-r to-white p-2.5",
        fresh && "live-pop"
      )}
    >
      <PlayerMug
        name={name}
        accentKey={`home-${jersey}`}
        jerseyNumber={String(jersey)}
        sizeClassName="h-12 w-12 rounded-full"
        frameClassName="border-gold-400 bg-gold-50 border-2"
      />
      <div className="min-w-0">
        <p className="text-gold-600 text-[9px] font-bold uppercase tracking-[0.2em]">
          🏀 Player of the Game
        </p>
        <p className="text-ink-950 truncate text-[13px] font-semibold">
          #{jersey} {name}
        </p>
        <p className="text-ink-500 text-[10px] font-medium uppercase tracking-[0.08em]">{line}</p>
      </div>
    </div>
  )
}

/** The recap, as a card: cover, kind chip, title, date. News is never a row. */
export function PhoneRecapCard({
  club,
  kind,
  title,
  body,
  meta,
  fresh,
}: {
  club: string
  kind: string
  title: string
  body: string
  meta: string
  fresh?: boolean
}) {
  return (
    <article
      className={cn(
        "border-ink-100 overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_-18px_rgba(15,23,42,0.6)]",
        fresh && "live-row-in"
      )}
    >
      <div className="relative h-[64px] overflow-hidden bg-[#0b1628]">
        <CourtBackdropLayer variant="navy" intensity="band" />
        <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white ring-1 ring-inset ring-white/25">
          {kind}
        </span>
      </div>
      <div className="px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <Crest name={club} size="xs" />
          <span className="text-ink-500 text-[10px] font-semibold">{club}</span>
        </div>
        <h3 className="text-ink-900 mt-1 text-[12.5px] font-bold leading-snug">{title}</h3>
        <p className="text-ink-600 mt-1 text-[10.5px] leading-relaxed">{body}</p>
        <p className="text-ink-400 mt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em]">
          {meta}
        </p>
      </div>
    </article>
  )
}

/** The standings block, with one row that just moved. */
export function PhoneStandings({
  rows,
  movedTeam,
}: {
  rows: Array<{ pos: number; team: string; record: string; pts: number; you?: boolean }>
  movedTeam?: string
}) {
  return (
    <section className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
      <div className="border-ink-100 flex items-center justify-between border-b px-3 py-1.5">
        <h3 className="text-ink-800 text-[10px] font-bold uppercase tracking-[0.18em]">
          Standings
        </h3>
        <span className="text-ink-400 text-[9.5px] font-semibold uppercase tracking-[0.14em]">
          U11 Girls Rep
        </span>
      </div>
      <ul className="divide-ink-50 divide-y">
        {rows.map((r) => (
          <li
            key={r.team}
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 text-[11px] transition-all duration-500",
              r.you && "bg-ink-50/70"
            )}
          >
            <span className="text-ink-400 w-4 text-[10px] font-bold tabular-nums">{r.pos}</span>
            <Crest name={r.team} sizeClassName="h-5 w-5 rounded-md text-[8px]" />
            <span
              className={cn("min-w-0 flex-1 truncate", r.you ? "text-ink-950 font-bold" : "text-ink-700")}
            >
              {r.team}
            </span>
            <span className="text-ink-500 text-[10px] tabular-nums">{r.record}</span>
            <span className="text-ink-950 w-5 text-right text-[11px] font-bold tabular-nums">
              {r.team === movedTeam ? (
                <Pulse value={`${r.pos}-${r.pts}`} tone="green">
                  {r.pts}
                </Pulse>
              ) : (
                r.pts
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
