"use client"

/**
 * The public game page (/live/[gameId]), mirrored piece by piece for the
 * demos. Every class here is transcribed from live-view.tsx's phone layout:
 * the broadcast-dark score hero with team-color washes, the Game/Stats/Plays
 * tabs, the linescore, the two-sided game leaders, the team-stats comparison
 * bars, and the box score with starters/bench and totals. If live-view.tsx
 * changes, this file is the one to re-sync.
 */

import { cn } from "@/components/ui/cn"
import { GAME, LEAGUE } from "../data"

/** Green pulse on value change, same as the product's FlashNum. */
export function Flash({ on, children, className }: { on?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span key={String(children)} className={cn("inline-block tabular-nums", on && "score-flash", className)}>
      {children}
    </span>
  )
}

const crest = (color: string, size: string, text: string) => (
  <span
    className={`${size} flex shrink-0 items-center justify-center rounded-xl font-extrabold text-white shadow-sm`}
    style={{ backgroundColor: color }}
    aria-hidden="true"
  >
    {text}
  </span>
)

/** Score hero: dark stage gradient washed with both clubs' colors. */
export function GameHero({
  homeScore,
  awayScore,
  state,
  clock,
  period = "Q4",
  flashHome,
  flashAway,
}: {
  homeScore: number
  awayScore: number
  state: "live" | "final"
  clock?: string
  period?: string
  flashHome?: boolean
  flashAway?: boolean
}) {
  const final = state === "final"
  return (
    <div
      className="text-white"
      style={{
        backgroundImage: `radial-gradient(90% 140% at 0% 0%, ${GAME.homeColor}38 0%, transparent 50%), radial-gradient(90% 140% at 100% 0%, ${GAME.awayColor}38 0%, transparent 50%), linear-gradient(135deg, var(--stage), var(--stage-2))`,
      }}
    >
      <div className="px-4 pb-5 pt-4">
        <p className="text-center text-xs font-semibold text-white/60">
          <span className="text-highlight">{LEAGUE.name}</span> · {LEAGUE.season}
        </p>
        <div className="mt-3 grid grid-cols-[minmax(84px,1fr)_auto_minmax(84px,1fr)] items-center gap-2">
          {(
            [
              [GAME.homeColor, GAME.homeMono, GAME.homeShort, GAME.homeRecord, homeScore, awayScore, flashHome],
              [GAME.awayColor, GAME.awayMono, GAME.awayShort, GAME.awayRecord, awayScore, homeScore, flashAway],
            ] as Array<[string, string, string, string, number, number, boolean | undefined]>
          ).map(([color, mono, short, record, score, other, flash], i) => (
            <div key={short} className={`text-center ${i === 1 ? "order-3" : "order-1"}`}>
              {crest(color, "mx-auto h-14 w-14 text-lg", mono)}
              <p className="mt-1.5 block text-[13px] font-extrabold leading-tight text-white">{short}</p>
              <p className="text-[12.5px] font-semibold text-white/75">{record}</p>
              <p
                className={cn(
                  "font-condensed mt-0.5 text-6xl font-bold tabular-nums leading-none",
                  final && score > other ? "text-highlight" : "text-white",
                  final && score < other && "text-white/60"
                )}
              >
                <Flash on={flash}>{score}</Flash>
              </p>
            </div>
          ))}
          <div className="order-2 min-w-0 self-center text-center">
            {!final ? (
              <>
                <span className="bg-live-600 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Live
                </span>
                <p className="font-condensed mt-1.5 text-2xl font-bold text-white">{period}</p>
                {clock && <p className="text-highlight mt-0.5 text-lg font-extrabold tabular-nums">{clock}</p>}
              </>
            ) : (
              <span className="bg-energy text-energy-on rounded-full px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.18em]">
                Final
              </span>
            )}
          </div>
        </div>
        <p className="mt-2.5 text-center text-xs font-medium text-white/50">{GAME.venue}</p>
      </div>
    </div>
  )
}

/** Game | Stats | Plays pills (phone layout). */
export function GameTabs({ active, statsHoldId }: { active: "game" | "box" | "plays"; statsHoldId?: string }) {
  return (
    <div className="bg-ink-100 mt-3 flex rounded-xl p-1">
      {(
        [
          ["game", "Game"],
          ["box", "Stats"],
          ["plays", "Plays"],
        ] as Array<["game" | "box" | "plays", string]>
      ).map(([key, label]) => {
        const btn = (
          <span
            className={cn(
              "block flex-1 rounded-lg py-2 text-center text-sm font-bold transition-colors",
              active === key ? "bg-play-600 text-white shadow-sm" : "text-ink-500"
            )}
          >
            {label}
          </span>
        )
        return key === "box" && statsHoldId ? (
          <span key={key} data-live-id={statsHoldId} className="flex-1 rounded-lg">
            {btn}
          </span>
        ) : (
          <span key={key} className="flex-1">
            {btn}
          </span>
        )
      })}
    </div>
  )
}

export interface LinescoreRow {
  color: string
  short: string
  quarters: Array<number | null>
  total: number
  flashQ4?: boolean
  flashTotal?: boolean
}

export function LinescoreCard({ rows }: { rows: LinescoreRow[] }) {
  return (
    <div className="border-ink-100 overflow-x-auto rounded-2xl border bg-white">
      <table className="w-full text-center text-[15px] font-bold tabular-nums">
        <thead>
          <tr className="text-ink-600 border-ink-100 border-b text-[12px] uppercase tracking-wide">
            <th className="py-2 pl-4 text-left font-extrabold" />
            {[1, 2, 3, 4].map((p) => (
              <th key={p} className="px-2.5 py-2 font-extrabold">
                {p}
              </th>
            ))}
            <th className="text-ink-950 px-3 py-2 pr-4 font-extrabold">Tot</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.short} className="border-ink-50 border-b last:border-0">
              <td className="py-2.5 pl-4 text-left">
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: r.color }} />
                  <span className="text-ink-900 whitespace-nowrap font-extrabold">{r.short}</span>
                </span>
              </td>
              {r.quarters.map((q, i) => (
                <td key={i} className="text-ink-600 px-2.5 py-2.5">
                  {q == null ? <span className="text-ink-300">–</span> : <Flash on={i === 3 && r.flashQ4}>{q}</Flash>}
                </td>
              ))}
              <td className="text-ink-950 px-3 py-2.5 pr-4 font-extrabold">
                <Flash on={r.flashTotal}>{r.total}</Flash>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface LeaderEntry {
  jersey: number
  name: string
  value: number
  unit: string
  sub: string
  flash?: boolean
}

function LeaderCell({ entry, color, right }: { entry: LeaderEntry; color: string; right?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-2.5", right && "flex-row-reverse text-right")}>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[12px] font-extrabold text-white"
        style={{ backgroundColor: color }}
      >
        #{entry.jersey}
      </span>
      <div className="min-w-0">
        <p className="text-ink-900 truncate text-[13px] font-bold leading-tight">{entry.name}</p>
        <p className="text-ink-950 text-lg font-extrabold leading-tight tabular-nums">
          <Flash on={entry.flash}>{entry.value}</Flash>{" "}
          <span className="text-ink-600 text-[10px] font-extrabold">{entry.unit}</span>
        </p>
        <p className="text-ink-600 truncate text-[11px]">{entry.sub}</p>
      </div>
    </div>
  )
}

export function SectionH3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-ink-950 mb-2 mt-5 px-1 text-[17px] font-extrabold uppercase tracking-[0.04em]">{children}</h3>
  )
}

export function LeadersCard({ sections }: { sections: Array<{ label: string; home: LeaderEntry; away: LeaderEntry }> }) {
  return (
    <div className="border-ink-100 rounded-2xl border bg-white">
      <div className="divide-ink-50 divide-y">
        {sections.map((sec) => (
          <div key={sec.label} className="px-4 py-3">
            <p className="text-ink-600 mb-1.5 text-center text-[11.5px] font-extrabold uppercase tracking-widest">
              {sec.label}
            </p>
            <div className="flex items-center gap-3">
              <LeaderCell entry={sec.home} color={GAME.homeColor} />
              <LeaderCell entry={sec.away} color={GAME.awayColor} right />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface CompareRow {
  label: string
  home: number
  away: number
  displayHome?: string
  displayAway?: string
  flashHome?: boolean
  flashAway?: boolean
}

export function TeamStatsCard({ rows }: { rows: CompareRow[] }) {
  return (
    <div className="border-ink-100 rounded-2xl border bg-white">
      <div className="border-ink-100 flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-[13px] font-extrabold" style={{ color: GAME.homeColor }}>
          {GAME.homeShort}
        </span>
        <span className="text-[13px] font-extrabold" style={{ color: GAME.awayColor }}>
          {GAME.awayShort}
        </span>
      </div>
      <div className="divide-ink-50 divide-y">
        {rows.map((r) => {
          const total = r.home + r.away
          const hShare = total === 0 ? 50 : (r.home / total) * 100
          const hWins = r.home > r.away
          const aWins = r.away > r.home
          const num = (wins: boolean, value: number, display: string | undefined, flash: boolean | undefined) => (
            <span
              className={cn(
                "text-[15px] tabular-nums",
                wins ? "text-ink-950 font-extrabold" : "text-ink-500 font-semibold"
              )}
            >
              <Flash on={flash}>{display ?? value}</Flash>
            </span>
          )
          return (
            <div key={r.label} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                {num(hWins, r.home, r.displayHome, r.flashHome)}
                <span className="text-ink-600 text-[12px] font-extrabold uppercase tracking-wide">{r.label}</span>
                {num(aWins, r.away, r.displayAway, r.flashAway)}
              </div>
              <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                <span
                  style={{ width: `${hShare}%`, backgroundColor: GAME.homeColor, opacity: hWins ? 1 : 0.3 }}
                />
                <span className="flex-1" style={{ backgroundColor: GAME.awayColor, opacity: aWins ? 1 : 0.3 }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface BoxRow {
  jersey: number
  name: string
  pts: number
  reb: number
  ast: number
  stl: number
  to: number
  floor?: boolean
  top?: boolean
  flashPts?: boolean
  flashReb?: boolean
  flashAst?: boolean
}

/** Phone box score: team switcher + one team's table (Blk/PF fold away on phones, as in the product). */
export function BoxScoreCard({
  starters,
  bench,
  live,
  totals,
}: {
  starters: BoxRow[]
  bench: BoxRow[]
  live: boolean
  totals: { pts: number; reb: number; ast: number; stl: number; to: number }
}) {
  const teamColor = GAME.homeColor
  const statRow = (l: BoxRow) => (
    <tr
      key={l.jersey}
      className="border-ink-50 border-t transition-colors"
      style={l.top ? { backgroundColor: `${teamColor}14` } : undefined}
    >
      <td className="text-ink-900 whitespace-nowrap py-2 pl-4 pr-2 font-semibold">
        <span className="text-ink-500 mr-1.5 font-normal">#{l.jersey}</span>
        {l.name}
        {l.floor && live ? <span className="text-court-600"> ●</span> : null}
        {l.top && (
          <span
            className="bg-highlight ml-2 rounded px-1.5 py-0.5 align-[2px] text-[9.5px] font-extrabold tracking-widest"
            style={{ color: teamColor }}
          >
            TOP
          </span>
        )}
      </td>
      <td className="text-energy-ink px-1.5 text-right text-base font-extrabold">
        <Flash on={l.flashPts}>{l.pts}</Flash>
      </td>
      <td className="px-1.5 text-right">
        <Flash on={l.flashReb}>{l.reb}</Flash>
      </td>
      <td className="px-1.5 text-right">
        <Flash on={l.flashAst}>{l.ast}</Flash>
      </td>
      <td className="px-1.5 text-right">{l.stl}</td>
      <td className="px-1.5 pr-4 text-right">{l.to}</td>
    </tr>
  )
  const groupRow = (label: string) => (
    <tr>
      <td
        colSpan={6}
        className="bg-ink-50 text-ink-500 border-ink-100 border-y px-4 py-1 text-[10.5px] font-extrabold uppercase tracking-widest"
      >
        {label}
      </td>
    </tr>
  )
  return (
    <div>
      <div className="bg-ink-100 mb-2 flex rounded-xl p-1">
        {(
          [
            [GAME.home, GAME.homeColor, true],
            [GAME.away, GAME.awayColor, false],
          ] as Array<[string, string, boolean]>
        ).map(([name, color, on]) => (
          <span
            key={name}
            className={cn(
              "flex-1 truncate rounded-lg px-2 py-1.5 text-center text-xs font-bold transition-colors",
              on ? "text-white shadow-sm" : "text-ink-500"
            )}
            style={on ? { backgroundColor: color } : undefined}
          >
            {name}
          </span>
        ))}
      </div>
      <div className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px] tabular-nums">
            <thead className="text-ink-500 text-left text-[11.5px] uppercase tracking-wide">
              <tr>
                <th className="py-2 pl-4 pr-2 font-bold">Player</th>
                <th className="px-1.5 text-right font-bold">Pts</th>
                <th className="px-1.5 text-right font-bold">Reb</th>
                <th className="px-1.5 text-right font-bold">Ast</th>
                <th className="px-1.5 text-right font-bold">Stl</th>
                <th className="px-1.5 pr-4 text-right font-bold">TO</th>
              </tr>
            </thead>
            <tbody>
              {groupRow("Starters")}
              {starters.map(statRow)}
              {groupRow("Bench")}
              {bench.map(statRow)}
              <tr className="border-ink-200 text-ink-900 border-t-2 font-bold">
                <td className="py-2 pl-4 pr-2">Team</td>
                <td className="px-1.5 text-right">{totals.pts}</td>
                <td className="px-1.5 text-right">{totals.reb}</td>
                <td className="px-1.5 text-right">{totals.ast}</td>
                <td className="px-1.5 text-right">{totals.stl}</td>
                <td className="px-1.5 pr-4 text-right">{totals.to}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
