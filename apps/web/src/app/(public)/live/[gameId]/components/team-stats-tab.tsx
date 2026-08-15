"use client"

import { monogram } from "@/lib/content/matchup-cover"
import { FlashNum } from "@/components/scoring/flash-num"
import { Crest } from "./ui-bits"
import type { GameModel } from "./model"

/**
 * Team stats — its own view, so the comparison bars get room. Two-sided bars
 * grow from the centre (2026-08-13): a 1.5px split rail made every stat look
 * the same, and now the mismatch is legible at a glance.
 */

function CompareRow({
  label,
  h,
  a,
  displayH,
  displayA,
}: {
  label: string
  h: number
  a: number
  displayH?: string
  displayA?: string
}) {
  const total = h + a
  const hShare = total === 0 ? 50 : (h / total) * 100
  const hWins = h > a
  const aWins = a > h
  // Shooting rows pass a STRING ("12-25 · 48%"), which at 26px condensed was
  // far too wide for the slot and read as a font glitch. Strings get a
  // smaller, plainer treatment; raw counts keep the big score face.
  const num = (wins: boolean, value: number, display?: string) =>
    display ? (
      <span
        className={`text-[14px] tabular-nums sm:text-[15px] ${
          wins ? "text-ink-950 font-bold" : "text-ink-400 font-medium"
        }`}
      >
        {display}
      </span>
    ) : (
      <span
        className={`font-condensed text-[26px] leading-none tracking-[-0.01em] tabular-nums sm:text-[28px] ${
          wins ? "text-ink-950 font-bold" : "text-ink-400 font-medium"
        }`}
      >
        <FlashNum value={value} />
      </span>
    )
  return (
    <div className="px-3.5 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {num(hWins, h, displayH)}
        <span className="text-ink-600 text-[11px] font-bold uppercase tracking-[0.16em] sm:text-[12.5px]">
          {label}
        </span>
        {num(aWins, a, displayA)}
      </div>
      {/* Each side sits on its own grey track, so a lopsided stat reads as
          "measured against a scale" instead of leaving an empty gutter
          (tester 2026-08-13). */}
      <div className="mt-2 flex h-3 items-center gap-1">
        <div className="bg-ink-100 flex flex-1 justify-end overflow-hidden rounded-l-full">
          <span
            className="bg-ink-700 h-3 rounded-l-full transition-all duration-500"
            style={{ width: `${hShare}%`, opacity: hWins ? 1 : 0.35 }}
          />
        </div>
        <span className="bg-ink-300 h-3 w-px shrink-0" />
        <div className="bg-ink-100 flex flex-1 overflow-hidden rounded-r-full">
          <span
            className="bg-ink-700 h-3 rounded-r-full transition-all duration-500"
            style={{ width: `${100 - hShare}%`, opacity: aWins ? 1 : 0.35 }}
          />
        </div>
      </div>
    </div>
  )
}

const shooting = (m: number, at: number) =>
  at === 0 ? "0-0" : `${m}-${at} · ${Math.round((m / at) * 100)}%`

export function TeamStatsTab({ model }: { model: GameModel }) {
  const { game, teamAgg, homeScore, awayScore } = model
  const H = teamAgg(game.homeTeamId)
  const A = teamAgg(game.awayTeamId)
  const pct = (m: number, at: number) => (at === 0 ? 0 : m / at)
  const row = (label: string, h: number, a: number, dh?: string, da?: string) => (
    <CompareRow key={label} label={label} h={h} a={a} displayH={dh} displayA={da} />
  )

  return (
    <div className="border-ink-100 overflow-hidden rounded-2xl border bg-white">
      {/* Full team name, not the abbreviation, and given real height — this
          header anchors both columns so it reads like a matchup bar rather
          than a caption (tester 2026-08-13). */}
      <div className="border-ink-100 flex items-center justify-between gap-3 border-b px-4 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Crest
            size="h-10 w-10 text-[13px]"
            surface="light"
            text={monogram(game.homeTeamName)}
          />
          <div className="min-w-0">
            <p className="text-ink-950 truncate text-[14.5px] font-semibold leading-tight">
              {game.homeTeamName}
            </p>
            <p
              className={`font-condensed text-[24px] font-bold leading-none tracking-[-0.01em] tabular-nums ${
                homeScore >= awayScore ? "text-ink-950" : "text-ink-400"
              }`}
            >
              {homeScore}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-2.5 text-right">
          <Crest
            size="h-10 w-10 text-[13px]"
            surface="light"
            text={monogram(game.awayTeamName)}
          />
          <div className="min-w-0">
            <p className="text-ink-950 truncate text-[14.5px] font-semibold leading-tight">
              {game.awayTeamName}
            </p>
            <p
              className={`font-condensed text-[24px] font-bold leading-none tracking-[-0.01em] tabular-nums ${
                awayScore >= homeScore ? "text-ink-950" : "text-ink-400"
              }`}
            >
              {awayScore}
            </p>
          </div>
        </div>
      </div>
      <div className="divide-ink-50 divide-y">
        {row("Field goals", pct(H.fgm, H.fga), pct(A.fgm, A.fga), shooting(H.fgm, H.fga), shooting(A.fgm, A.fga))}
        {row("3-pointers", pct(H.tpm, H.tpa), pct(A.tpm, A.tpa), shooting(H.tpm, H.tpa), shooting(A.tpm, A.tpa))}
        {row("Free throws", pct(H.ftm, H.fta), pct(A.ftm, A.fta), shooting(H.ftm, H.fta), shooting(A.ftm, A.fta))}
        {row("Rebounds", H.reb, A.reb)}
        {row("Assists", H.ast, A.ast)}
        {row("Steals", H.stl, A.stl)}
        {row("Blocks", H.blk, A.blk)}
        {row("Turnovers", H.to, A.to)}
        {row("Fouls", H.pf, A.pf)}
      </div>
    </div>
  )
}
