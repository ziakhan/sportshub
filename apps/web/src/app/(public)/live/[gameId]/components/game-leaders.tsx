"use client"

import Link from "next/link"
import { monogram } from "@/lib/content/matchup-cover"
import { FlashNum } from "@/components/scoring/flash-num"
import type { PlayerLine } from "@/lib/scoring/fold"
import { SECTION_HEADING } from "./ui-bits"
import type { GameModel } from "./model"
import type { LeaderEntry } from "./types"

/**
 * Game leaders as face-off cards, not list rows. A youth game page is the
 * keepsake a parent opens after the final buzzer — the kid's line deserves a
 * scoreboard-sized number and their team's colour, not 13px body text.
 * `won` gets a stronger tint so the better line reads first.
 *
 * The two players always sit SIDE BY SIDE (2026-08-14): stacked cards cost
 * ~400px of phone scroll and pushed the box score, which is what parents
 * actually came for, below the fold. From md up the category label moves
 * between them and the away card mirrors, so the pair reads as a head-to-head.
 */

function LeaderCell({
  model,
  entry,
  teamId,
  sub,
  won,
  /** Away side mirrors from md up, so the two cards face each other. */
  mirror = false,
}: {
  model: GameModel
  entry: LeaderEntry | null
  teamId: string
  sub: (l: PlayerLine) => string
  won: boolean
  mirror?: boolean
}) {
  const { colorOf, jerseyOf, shortName } = model
  const color = colorOf(teamId)
  if (!entry) {
    return (
      <div className="border-ink-100 text-ink-300 flex min-w-0 flex-1 items-center justify-center rounded-2xl border border-dashed py-6 text-xs">
        —
      </div>
    )
  }
  return (
    <div
      // Tint history: 8%/3% read as almost nothing, 17%/9% was a touch hot.
      // Settled at 14%/8% (tester 2026-08-13, "ever so slightly" dimmer).
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl p-2 md:gap-3 md:p-3 ${
        mirror ? "md:flex-row-reverse md:text-right" : ""
      }`}
      style={{ backgroundColor: `${color}${won ? "24" : "14"}` }}
    >
      {/* The badge stands in for a headshot: players have no photo field, and
          the platform's own rule is "real mark, else branded monogram". The
          jersey number is how you identify a kid from the stands anyway — and
          if photos ever ship, this circle becomes the photo slot unchanged. */}
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-md ring-2 ring-white/60 md:h-12 md:w-12 md:text-[15px]"
        style={{ backgroundColor: color }}
      >
        {jerseyOf(entry.l.playerId)
          ? `${jerseyOf(entry.l.playerId)}`
          : monogram(shortName(entry.l.playerId))}
      </span>
      <div className="min-w-0 flex-1">
        {/* Platform law: every rendered entity is clickable. */}
        <Link
          href={`/player/${entry.l.playerId}`}
          className="text-ink-950 hover:text-play-600 block truncate text-[13px] font-semibold leading-tight transition-colors md:text-[15px]"
        >
          {shortName(entry.l.playerId)}
        </Link>
        <div className={`mt-0.5 flex items-end gap-1 ${mirror ? "md:justify-end" : ""}`}>
          <span className="font-condensed text-ink-950 text-[1.7rem] font-semibold leading-[0.85] tracking-[-0.01em] tabular-nums md:text-[2.2rem]">
            <FlashNum value={entry.value} />
          </span>
          <span className="text-ink-500 pb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] md:text-[12px]">
            {entry.unit}
          </span>
        </div>
        <p className="text-ink-500 mt-0.5 truncate text-[10.5px] font-medium uppercase tracking-[0.08em] md:text-[12px]">
          {sub(entry.l)}
        </p>
      </div>
    </div>
  )
}

export function GameLeaders({ model }: { model: GameModel }) {
  const { game, leaderSections } = model
  return (
    <section>
      <h3 className={`${SECTION_HEADING} mb-2 px-1`}>Game leaders</h3>
      <div className="space-y-2">
        {leaderSections.map((sec) => {
          const h = sec.pick(game.homeTeamId)
          const a = sec.pick(game.awayTeamId)
          if (!h && !a) return null
          const hWins = (h?.value ?? -1) >= (a?.value ?? -1)
          return (
            // The category label lives BETWEEN the two players from md up — a
            // shared centre axis is the head-to-head pattern and it buys back
            // the vertical space the old label row used. Phones keep the label
            // on top: there is no room for a third column at 390px.
            <div
              key={sec.label}
              className="border-ink-100 flex flex-col gap-1 rounded-2xl border bg-white p-1.5 md:flex-row md:items-center md:gap-2"
            >
              <span className="text-ink-600 order-1 w-full shrink-0 pt-1 text-center text-[10px] font-bold uppercase leading-tight tracking-[0.18em] md:order-2 md:w-20 md:pt-0 md:text-[11.5px]">
                {sec.label}
              </span>
              <div className="order-2 flex min-w-0 gap-1.5 md:contents">
                <div className="flex min-w-0 flex-1 md:order-1">
                  <LeaderCell
                    model={model}
                    entry={h}
                    teamId={game.homeTeamId}
                    sub={sec.sub}
                    won={hWins}
                  />
                </div>
                <div className="flex min-w-0 flex-1 md:order-3">
                  <LeaderCell
                    model={model}
                    entry={a}
                    teamId={game.awayTeamId}
                    sub={sec.sub}
                    won={!hWins}
                    mirror
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
