"use client"

import type { CSSProperties, ReactNode } from "react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { PanelHeader, Button, Badge, AnimatedNumber } from "@/components/ui"

/**
 * Season close-out — the "what now" moment once a season is COMPLETED.
 * (The rest of the old Overview tab — preflight, stat tiles, summary — was
 * absorbed by the Season checklist and Settings in the IA redesign.)
 *
 * The close-out card celebrates in court green: override just the brand vars
 * the kit components inside it read (PanelHeader band + accent bar).
 */
const COURT_BRAND_VARS = {
  "--brand": "#16a34a", // court-600
  "--brand-soft": "#f0fdf0", // court-50
} as CSSProperties

export function SeasonCloseOut({
  league,
  divisions,
  onGoToStandings,
}: {
  league: any
  divisions: any[]
  onGoToStandings: () => void
}) {
  const params = useParams()
  const leagueId = (params?.id as string) ?? league?.league?.id
  const seasonId = (params?.seasonId as string) ?? league?.id

  if ((league?.leagueStatus ?? league?.status) !== "COMPLETED") return null

  // Final counts from data the tab already has — approved submissions are the
  // teams that actually played; _count.games is the season's full schedule.
  const approvedTeams = (league?.teams ?? []).filter((t: any) => t.status === "APPROVED").length
  const finalTeamCount = approvedTeams || league?._count?.teamSubmissions || 0
  const finalGameCount = league?._count?.games ?? 0

  return (
    <div
      className="reveal border-court-200 mb-6 overflow-hidden rounded-3xl border bg-white shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
      style={COURT_BRAND_VARS}
    >
      <PanelHeader
        variant="band"
        title="Season complete"
        action={
          <Badge tone="court" dot>
            Completed
          </Badge>
        }
      />
      <div className="p-6">
        <p className="text-ink-600 max-w-2xl text-sm">
          <span className="text-ink-900 font-semibold">{league.label}</span> has wrapped up.
          Results and standings are locked in and stay browsable — when you&apos;re ready,
          start the next season with this one&apos;s setup carried over.
        </p>
        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Teams</p>
            <p className="text-ink-900 font-condensed mt-1 text-3xl font-bold leading-none">
              <AnimatedNumber value={finalTeamCount} />
            </p>
          </div>
          <div>
            <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Games</p>
            <p className="text-ink-900 font-condensed mt-1 text-3xl font-bold leading-none">
              <AnimatedNumber value={finalGameCount} />
            </p>
          </div>
          <div>
            <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Divisions</p>
            <p className="text-ink-900 font-condensed mt-1 text-3xl font-bold leading-none">
              <AnimatedNumber value={divisions.length} />
            </p>
          </div>
          {league.startDate && league.endDate && (
            <div>
              <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Ran</p>
              <p className="text-ink-900 mt-2 text-sm font-semibold">
                {format(new Date(league.startDate), "MMM d")} &ndash;{" "}
                {format(new Date(league.endDate), "MMM d, yyyy")}
              </p>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button
            href={`/manage/leagues/${leagueId}?from=${seasonId}`}
            tone="court"
            icon={CLOSEOUT_ICONS.plus}
          >
            Create next season
          </Button>
          <Button onClick={onGoToStandings} variant="subtle" icon={CLOSEOUT_ICONS.trophy}>
            Final standings
          </Button>
          <Button href={`/league/${seasonId}`} variant="subtle" icon={CLOSEOUT_ICONS.eye}>
            Public season page
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Unsized SVG icons for the kit <Button> (the button sizes them). */
const CLOSEOUT_ICONS: Record<string, ReactNode> = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 01-10 0V4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 6H4v1a4 4 0 004 4M17 6h3v1a4 4 0 01-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
}
