"use client"

import Link from "next/link"
import React from "react"
import { monogram } from "@/lib/content/matchup-cover"
import { FlashNum } from "@/components/scoring/flash-num"
import { VenueLink } from "@/components/venues/venue-link"
import { toneForStatus } from "@/components/ui"
import type { BadgeTone } from "@/components/ui/badge"
import { Crest } from "./ui-bits"
import type { GameModel } from "./model"
import type { TeamRecord } from "./types"

/**
 * Score hero — the broadcast-dark stage (Energy Pass), carrying the
 * quarter-by-quarter linescore.
 *
 * TWO compositions, not one shrunk down (owner 2026-08-14, phone review):
 * - Phones (<sm): each team owns a FULL-WIDTH ROW — crest, real team name,
 *   record, score right-aligned — with the game state on its own strip above.
 *   The old three-column face-off gave a team name 84px at 390 and everything
 *   in it squished; a row gives it ~225px, so the full club name fits.
 * - sm and up: the owner-approved face-off (crest → name → record → score,
 *   game state in the middle column) is untouched in structure.
 *
 * TYPE (owner: "too fat… I just want it to be sleek"): nothing on this page
 * asks for a weight the loaded font actually has to synthesise. Work Sans
 * ships 300–700 and Barlow Condensed 500–700, so `font-extrabold`/`font-black`
 * were rendering as FAUX bold — thick, smeared edges. The scale here tops out
 * at 700, leans on tracking and tabular-nums for the scoreboard feel, and
 * keeps records/meta as muted small caps.
 */

/** Status pills follow the canonical tone map, translated for a navy stage. */
const PILL_ON_STAGE: Record<BadgeTone, string> = {
  neutral: "bg-white text-ink-950",
  play: "bg-play-500 text-white",
  hoop: "bg-hoop-500 text-white",
  court: "bg-court-500 text-white",
  gold: "bg-gold-400 text-gold-950",
  live: "bg-live-600 text-white",
  success: "bg-court-500 text-white",
  warning: "bg-amber-400 text-amber-950",
  danger: "bg-red-500 text-white",
}

/** Muted small-caps meta — records, venue, period labels. */
const META = "text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/55"

export function ScoreHero({
  model,
  heroRef,
  clockDisplay,
}: {
  model: GameModel
  heroRef: React.RefObject<HTMLDivElement>
  /** Seconds left in the period, when the league runs a clock. */
  clockDisplay: number | null
}) {
  const {
    game,
    fold,
    shortTeam,
    live,
    final,
    homeScore,
    awayScore,
    periods,
    displayPeriods,
    playedPeriods,
    periodLabel,
    periodPoints,
  } = model

  const pill = PILL_ON_STAGE[toneForStatus(game.status)]
  const clockText =
    clockDisplay != null
      ? `${Math.floor(clockDisplay / 60)}:${String(clockDisplay % 60).padStart(2, "0")}`
      : null
  const tipoff = new Date(game.scheduledAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

  const teams = [
    [game.homeTeamId, game.homeTeamName, game.homeRecord, homeScore, awayScore],
    [game.awayTeamId, game.awayTeamName, game.awayRecord, awayScore, homeScore],
  ] as Array<[string, string, TeamRecord | null, number, number]>

  /** Amber for the winner of a finished game, dimmed for the loser. */
  const scoreTone = (score: number, other: number) =>
    !final ? "text-white" : score > other ? "text-highlight" : "text-white/45"

  return (
    <div
      ref={heroRef}
      data-hero
      // The stage used to be washed with each club's colour from its own
      // corner. Those colours were assigned at import, not chosen, so the wash
      // said nothing and fought the scoreboard (owner ruling 2026-08-14). The
      // arena stays navy, lit from above.
      className="from-stage to-stage-2 bg-gradient-to-br text-white"
      style={{
        backgroundImage:
          "radial-gradient(120% 150% at 50% -20%, rgba(255,255,255,0.10) 0%, transparent 60%), linear-gradient(135deg, var(--stage), var(--stage-2))",
      }}
    >
      {/* Hero content shares the tabs' column (2026-08-13) — it used to run to
          1760px while everything below sat narrower, so nothing lined up. The
          BAND itself is edge to edge at every width (owner 2026-08-14). */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-4 lg:pb-6 lg:pt-5">
        <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/55 sm:text-xs sm:tracking-[0.1em]">
          {game.seasonId && game.leagueName ? (
            <Link href={`/league/${game.seasonId}`} className="text-highlight hover:underline">
              {game.leagueName}
            </Link>
          ) : (
            game.leagueName
          )}
          {game.seasonName ? ` · ${game.seasonName}` : ""}
        </p>

        {/* ---------------- phones: state strip + one row per team ---------- */}
        <div className="mt-2.5 sm:hidden">
          <div className="flex items-center justify-center gap-2.5">
            {live && (
              <>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.16em] ${pill}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />
                  Live
                </span>
                {/* Period stays in the BODY face: Barlow Condensed's Q reads
                    as a zero at this size, so "Q3" looked like "03". */}
                <span className="text-[12px] font-bold uppercase tracking-[0.04em] text-white/70">
                  {periodLabel(fold.period)}
                </span>
                {clockText && (
                  <span className="font-condensed text-highlight text-[22px] font-semibold leading-none tabular-nums">
                    {clockText}
                  </span>
                )}
              </>
            )}
            {final && (
              <span
                className={`rounded-full px-3 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.18em] ${pill}`}
              >
                Final
              </span>
            )}
            {!live && !final && <span className={META}>{tipoff}</span>}
          </div>

          <div className="mt-2.5 space-y-1.5">
            {teams.map(([tid, tname, rec, score, other]) => (
              <div key={tid} className="flex items-center gap-3">
                <Crest
                  size="h-11 w-11 text-[15px] shadow-lg"
                  text={monogram(tname)}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/team/${tid}`}
                    className="block truncate text-[14.5px] font-semibold leading-tight text-white hover:underline"
                    title={tname}
                  >
                    {tname}
                  </Link>
                  {rec && (
                    <p className={`truncate ${META}`}>
                      {rec.record}
                      {rec.divisionName ? ` · ${rec.divisionName}` : ""}
                    </p>
                  )}
                </div>
                <p
                  className={`font-condensed min-w-[62px] text-right text-[42px] font-semibold leading-none tracking-[-0.01em] tabular-nums ${scoreTone(
                    score,
                    other
                  )}`}
                >
                  <FlashNum value={score} />
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- sm and up: the face-off (owner spec) ------------ */}
        <div className="mt-2.5 hidden grid-cols-[minmax(84px,1fr)_auto_minmax(84px,1fr)] items-center gap-2 sm:grid sm:gap-6">
          {teams.map(([tid, tname, rec, score, other], i) => (
            <div key={tid} className={`text-center ${i === 1 ? "order-3" : "order-1"}`}>
              <Crest
                size="mx-auto h-16 w-16 text-xl shadow-lg lg:h-20 lg:w-20 lg:text-2xl"
                text={monogram(tname)}
              />
              <Link
                href={`/team/${tid}`}
                className="mt-1.5 block text-[13px] font-semibold leading-tight text-white hover:underline lg:text-base"
                title={tname}
              >
                {shortTeam(tname)}
              </Link>
              {rec && <p className={`mt-0.5 ${META}`}>{rec.record}</p>}
              <p
                className={`font-condensed mt-1 text-6xl font-semibold leading-none tracking-[-0.01em] tabular-nums lg:text-7xl ${scoreTone(
                  score,
                  other
                )}`}
              >
                <FlashNum value={score} />
              </p>
            </div>
          ))}

          {/* centre: game state. Ticking clock only when the league runs one. */}
          <div className="order-2 min-w-0 self-center text-center">
            {live && (
              <>
                {/* Clock sits ABOVE the LIVE pill (tester 2026-08-13) — time
                    remaining is the thing you look for first on a live game. */}
                {clockText && (
                  <p className="font-condensed text-highlight mb-1.5 text-4xl font-semibold leading-none tabular-nums lg:text-5xl">
                    {clockText}
                  </p>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${pill}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" />
                  Live
                </span>
                <p className="mt-1.5 text-[15px] font-bold uppercase tracking-[0.04em] text-white/75">
                  {periodLabel(fold.period)}
                </p>
              </>
            )}
            {final && (
              <span
                className={`rounded-full px-4 py-1.5 text-[13px] font-bold uppercase tracking-[0.18em] ${pill}`}
              >
                Final
              </span>
            )}
            {!live && !final && (
              <p className="text-sm font-semibold text-white/80">{tipoff}</p>
            )}
          </div>
        </div>

        {game.venueName && (
          <p className={`mt-2 text-center ${META}`}>
            <VenueLink
              venueId={game.venueId}
              name={game.venueName}
              className="hover:text-white/80 hover:underline"
            />
          </p>
        )}

        {/* ---------- linescore, inside the stage (2026-08-14) ----------
            Every quarter of the game in one strip, directly under the score
            it explains. Frosted glass so it reads as part of the scoreboard
            rather than a table that wandered in. Phones get tighter columns
            and a lighter number face; the strip scrolls inside itself if a
            game runs to overtime. */}
        {periods.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-2xl bg-white/[0.08] ring-1 ring-inset ring-white/15 sm:mt-4">
            <table className="w-full text-center tabular-nums">
              <caption className="sr-only">Scoring by period</caption>
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  <th className="py-1.5 pl-3 text-left" />
                  {displayPeriods.map((p) => (
                    <th key={p} className="px-2 py-1.5 sm:px-4">
                      {p <= 4 ? p : periodLabel(p)}
                    </th>
                  ))}
                  <th className="px-2.5 py-1.5 pr-3 text-white/75 sm:px-3 sm:pr-3.5">Tot</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(([tid, tname, , total]) => (
                  <tr key={tid} className="border-t border-white/10">
                    <td className="py-1.5 pl-3 text-left">
                      <span className="flex items-center gap-2">
                        <Crest
                          size="h-5 w-5 text-[9px] sm:h-6 sm:w-6 sm:text-[10px]"
                          text={monogram(tname)}
                        />
                        <span className="whitespace-nowrap text-[12px] font-semibold text-white/90 sm:text-[13px]">
                          {shortTeam(tname)}
                        </span>
                      </span>
                    </td>
                    {displayPeriods.map((p) => (
                      <td
                        key={p}
                        className="font-condensed px-2 py-1.5 text-[17px] font-medium leading-none text-white/85 sm:px-4 sm:text-[19px]"
                      >
                        {playedPeriods.has(p) ? (
                          <FlashNum value={periodPoints(tid, p)} />
                        ) : (
                          <span className="text-white/25">–</span>
                        )}
                      </td>
                    ))}
                    <td className="font-condensed text-highlight px-2.5 py-1.5 pr-3 text-[19px] font-bold leading-none sm:px-3 sm:pr-3.5 sm:text-[21px]">
                      <FlashNum value={total} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
