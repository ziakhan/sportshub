"use client"

import Link from "next/link"
import { totalRebounds, type PlayerLine } from "@/lib/scoring/fold"
import { FlashNum } from "@/components/scoring/flash-num"
import { SECTION_HEADING } from "./ui-bits"
import type { GameModel } from "./model"

/**
 * Box score — one team at a time behind a colour-filled switcher (owner call:
 * keep the swap on phones; desktop keeps it too so the table never shrinks to
 * half a column). Starters above a divider, bench below, team totals last.
 *
 * The switcher is STICKY under the header on phones (2026-08-14): a 12-deep
 * roster runs past a phone screen, and swapping teams should not mean
 * scrolling back up to find the control.
 *
 * Phones carry the FULL stat line (owner 2026-08-14: "I want it to have all
 * the information") — Blk and PF used to be dropped below sm. They fit at
 * 390px on a tightened column rhythm, and the card keeps its own horizontal
 * scroller for the rare long name.
 */

export function BoxScore({
  model,
  side,
  onSide,
  /**
   * Sticky offset for the switcher on phones — the site header's real height
   * (64px bar + 49px pill row = 113px measured 2026-08-14). At 104 the top of
   * the switcher slid under the header.
   */
  stickyTopClass = "top-[113px]",
}: {
  model: GameModel
  side: "home" | "away"
  onSide: (side: "home" | "away") => void
  stickyTopClass?: string
}) {
  const { game } = model
  const teamId = side === "home" ? game.homeTeamId : game.awayTeamId

  return (
    // No `overflow-hidden` on the card: it would turn this section into a
    // scroll container and kill the sticky switcher. The two ends carry the
    // rounding instead.
    <section className="border-ink-100 rounded-2xl border bg-white">
      <div
        className={`border-ink-100 sticky z-20 rounded-t-2xl border-b bg-white/95 px-3 py-2.5 backdrop-blur lg:static ${stickyTopClass}`}
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h3 className={SECTION_HEADING}>Box score</h3>
          <span className="text-ink-400 text-[10.5px] font-semibold uppercase tracking-[0.14em]">
            Tap a team
          </span>
        </div>
        <div className="bg-ink-100 flex gap-1 rounded-xl p-1">
          {(["home", "away"] as const).map((s) => {
            const tid = s === "home" ? game.homeTeamId : game.awayTeamId
            const tname = s === "home" ? game.homeTeamName : game.awayTeamName
            const on = side === s
            return (
              <button
                key={s}
                onClick={() => onSide(s)}
                aria-pressed={on}
                className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 truncate rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors sm:px-3 sm:text-[13.5px] ${
                  on ? "bg-ink-900 text-white shadow-sm" : "text-ink-600 hover:bg-white/70"
                }`}
              >
                {/* The score is dropped — it is already large in the hero right
                    above. The SELECTED state does the identifying: a solid ink
                    fill, not a club colour (owner ruling 2026-08-14). */}
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    on ? "bg-white" : "bg-ink-300"
                  }`}
                />
                {/* Full name, not an abbreviation — this switcher decides which
                    roster you are looking at, so it must be plain. */}
                <span className="truncate">{tname}</span>
              </button>
            )
          })}
        </div>
      </div>
      <StatsTable model={model} teamId={teamId} />
    </section>
  )
}

/**
 * One stat cell. The rhythm is tight enough for the FULL nine-column line to
 * land inside 390px — px-1 on phones, the roomier px-1.5 from sm up.
 */
const CELL = "px-1 text-right sm:px-1.5"

function StatRow({
  model,
  l,
  isTop,
  showMin,
}: {
  model: GameModel
  l: PlayerLine
  isTop: boolean
  showMin: boolean
}) {
  const { jerseyOf, shortName, live } = model
  return (
    <tr
      className="border-ink-50 hover:bg-ink-50 md:even:bg-ink-50/60 md:hover:bg-ink-100/70 border-t transition-colors"
      // The leading scorer's row is the one a parent scans for. A wash alone
      // was losing to the even-row zebra on desktop (audit 2026-08-14), so it
      // also carries a rail and bolder type — ink, not the club's colour
      // (owner ruling 2026-08-14).
      style={
        isTop
          ? { backgroundColor: "rgba(24,24,27,0.06)", boxShadow: "inset 3px 0 0 0 #3f3f46" }
          : undefined
      }
    >
      <td
        className={`text-ink-900 whitespace-nowrap py-2 pl-3 pr-1.5 sm:pl-4 sm:pr-2 ${
          isTop ? "font-bold" : "font-medium"
        }`}
      >
        <span className="text-ink-500 mr-1 font-normal">#{jerseyOf(l.playerId)}</span>
        <Link href={`/player/${l.playerId}`} className="hover:text-play-600 transition-colors">
          {shortName(l.playerId)}
        </Link>
        {l.onFloor && live ? <span className="text-court-600"> ●</span> : null}
        {isTop && (
          <span className="bg-highlight text-highlight-on ml-1.5 rounded px-1 py-0.5 align-[2px] text-[9px] font-bold tracking-[0.1em]">
            TOP
          </span>
        )}
      </td>
      {showMin && <td className={CELL}>{Math.round(l.secondsPlayed / 60)}</td>}
      <td className={`text-energy-ink text-[15px] font-bold ${CELL}`}>
        <FlashNum value={l.points} />
      </td>
      <td className={CELL}>
        <FlashNum value={totalRebounds(l)} />
      </td>
      <td className={CELL}>
        <FlashNum value={l.assists} />
      </td>
      <td className={CELL}>
        <FlashNum value={l.steals} />
      </td>
      <td className={CELL}>{l.blocks}</td>
      <td className={CELL}>
        <FlashNum value={l.turnovers} />
      </td>
      <td className={`pr-3 sm:pr-4 ${CELL}`}>
        {l.fouls}
        {l.technicalFouls > 0 ? "T" : ""}
      </td>
    </tr>
  )
}

export function StatsTable({ model, teamId }: { model: GameModel; teamId: string }) {
  const { teamLines, starterIds } = model
  const lines = teamLines(teamId)
  const showMinutes = lines.some((l) => l.secondsPlayed > 0)
  // Starters stay starters forever (owner 2026-07-16 v2) — the green on-court
  // dot carries "who's on the floor right now" during live games.
  const groupSet = starterIds.get(teamId)
  const starterLines = groupSet ? lines.filter((l) => groupSet.has(l.playerId)) : []
  const benchLines = groupSet ? lines.filter((l) => !groupSet.has(l.playerId)) : lines
  const topId = lines.length > 0 && lines[0].points > 0 ? lines[0].playerId : null
  const totals = lines.reduce(
    (t, l) => ({
      pts: t.pts + l.points,
      reb: t.reb + totalRebounds(l),
      ast: t.ast + l.assists,
      stl: t.stl + l.steals,
      blk: t.blk + l.blocks,
      to: t.to + l.turnovers,
      pf: t.pf + l.fouls,
    }),
    { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0 }
  )
  const cols = showMinutes ? 9 : 8
  const groupHead =
    "bg-ink-50 text-ink-500 border-ink-100 md:bg-ink-100 md:text-ink-700 md:border-ink-200 border-y px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] md:px-4 md:py-2 md:text-[12px]"

  return (
    <div className="overflow-x-auto rounded-b-2xl">
      <table className="w-full text-[13.5px] tabular-nums sm:text-[15px]">
        {/* PHONES keep the original light head (tester 2026-08-13). The
            boundary is `md` (768px), not `lg` — an iPad is not a phone. */}
        <thead className="text-ink-500 md:bg-ink-50 md:text-ink-700 md:border-ink-200 text-left text-[10px] uppercase tracking-[0.1em] md:border-b md:text-[12px]">
          <tr>
            <th className="py-2 pl-3 pr-1.5 font-semibold sm:pl-4 sm:pr-2 md:py-2.5">Player</th>
            {showMinutes && <th className={`font-semibold ${CELL}`}>Min</th>}
            <th className={`font-semibold ${CELL}`}>Pts</th>
            <th className={`font-semibold ${CELL}`}>Reb</th>
            <th className={`font-semibold ${CELL}`}>Ast</th>
            <th className={`font-semibold ${CELL}`}>Stl</th>
            <th className={`font-semibold ${CELL}`}>Blk</th>
            <th className={`font-semibold ${CELL}`}>TO</th>
            <th className={`pr-3 font-semibold sm:pr-4 ${CELL}`}>PF</th>
          </tr>
        </thead>
        <tbody>
          {groupSet && starterLines.length > 0 && (
            <tr>
              <td colSpan={cols} className={groupHead}>
                Starters
              </td>
            </tr>
          )}
          {starterLines.map((l) => (
            <StatRow
              key={l.playerId}
              model={model}
              l={l}
              isTop={l.playerId === topId}
              showMin={showMinutes}
            />
          ))}
          {groupSet && benchLines.length > 0 && (
            <tr>
              <td colSpan={cols} className={groupHead}>
                Bench
              </td>
            </tr>
          )}
          {benchLines.map((l) => (
            <StatRow
              key={l.playerId}
              model={model}
              l={l}
              isTop={l.playerId === topId}
              showMin={showMinutes}
            />
          ))}
          <tr className="border-ink-200 text-ink-900 border-t-2 font-semibold">
            <td className="py-2 pl-3 pr-1.5 sm:pl-4 sm:pr-2">Team</td>
            {showMinutes && <td />}
            <td className={CELL}>{totals.pts}</td>
            <td className={CELL}>{totals.reb}</td>
            <td className={CELL}>{totals.ast}</td>
            <td className={CELL}>{totals.stl}</td>
            <td className={CELL}>{totals.blk}</td>
            <td className={CELL}>{totals.to}</td>
            <td className={`pr-3 sm:pr-4 ${CELL}`}>{totals.pf}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
