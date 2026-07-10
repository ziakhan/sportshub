"use client"

import type { CSSProperties, ReactNode } from "react"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { StatTile, PanelHeader, Button, Badge, AnimatedNumber } from "@/components/ui"
import type { PreflightCheck } from "./types"

/**
 * The close-out card celebrates in court green: override just the brand vars
 * the kit components inside it read (PanelHeader band + accent bar).
 */
const COURT_BRAND_VARS = {
  "--brand": "#16a34a", // court-600
  "--brand-soft": "#f0fdf0", // court-50
} as CSSProperties

export function OverviewTab({
  league,
  divisions,
  sessions,
  venues,
  preflightChecks,
  canFinalize,
  finalizeErrors,
  finalizeWarnings,
}: {
  league: any
  divisions: any[]
  sessions: any[]
  venues: any[]
  preflightChecks: PreflightCheck[] | null
  canFinalize: boolean
  finalizeErrors: string[]
  finalizeWarnings: string[]
}) {
  const params = useParams()
  const leagueId = (params?.id as string) ?? league?.league?.id
  const seasonId = (params?.seasonId as string) ?? league?.id

  const isCompleted = (league?.leagueStatus ?? league?.status) === "COMPLETED"
  // Final counts from data the tab already has — approved submissions are the
  // teams that actually played; _count.games is the season's full schedule.
  const approvedTeams = (league?.teams ?? []).filter((t: any) => t.status === "APPROVED").length
  const finalTeamCount = approvedTeams || league?._count?.teamSubmissions || 0
  const finalGameCount = league?._count?.games ?? 0

  // The manage page's tab nav is local state in the parent page (owned by a
  // separate surface) — activate its Standings tab by clicking the nav button;
  // fall back to the public page, which shows the final standings too.
  const goToStandings = () => {
    const tabButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (b) => b.textContent?.trim() === "Standings"
    )
    if (tabButton) tabButton.click()
    else window.location.assign(`/league/${seasonId}`)
  }

  return (
    <>
      {/* Season close-out — the "what now" moment once a season is COMPLETED */}
      {isCompleted && (
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
              <Button onClick={goToStandings} variant="subtle" icon={CLOSEOUT_ICONS.trophy}>
                Final standings
              </Button>
              <Button href={`/league/${seasonId}`} variant="subtle" icon={CLOSEOUT_ICONS.eye}>
                Public season page
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Finalization preflight checklist */}
      {preflightChecks && (
        <div
          className={`reveal mb-6 rounded-2xl border p-4 ${canFinalize ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}
        >
          <p
            className={`mb-2 text-sm font-semibold ${canFinalize ? "text-green-800" : "text-amber-800"}`}
          >
            {canFinalize ? "✓ Ready to finalize" : "Complete these before finalizing"}
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {preflightChecks.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-xs">
                <span className={c.ok ? "text-green-600" : "text-amber-500"}>
                  {c.ok ? "✓" : "✗"}
                </span>
                <span className={c.ok ? "text-ink-700" : "text-amber-700"}>{c.label}</span>
              </li>
            ))}
          </ul>
          {finalizeErrors.length > 0 && (
            <div className="mt-3 border-t border-amber-200 pt-2">
              <p className="text-hoop-700 mb-1 text-xs font-semibold">Could not finalize:</p>
              {finalizeErrors.map((e, i) => (
                <p key={i} className="text-hoop-600 text-xs">
                  • {e}
                </p>
              ))}
            </div>
          )}
          {finalizeWarnings.length > 0 && (
            <div className="mt-3 border-t border-amber-200 pt-2">
              <p className="text-amber-700 mb-1 text-xs font-semibold">Warnings:</p>
              {finalizeWarnings.map((w, i) => (
                <p key={i} className="text-amber-600 text-xs">
                  • {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats bar — overview only */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile value={divisions.length} label="Divisions" tone="brand" icon={TILE_ICONS.divisions} delay={0} />
        <StatTile value={league.teams?.length || 0} label="Teams" tone="court" icon={TILE_ICONS.teams} delay={70} />
        <StatTile value={sessions.length} label="Sessions" tone="hoop" icon={TILE_ICONS.sessions} delay={140} />
        <StatTile value={venues.length} label="Venues" tone="play" icon={TILE_ICONS.venues} delay={210} />
      </div>

      {/* Season Info */}
      <div
        className="reveal border-ink-100 mt-6 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
        style={{ animationDelay: "280ms" }}
      >
        <PanelHeader title="Season summary" />
        <div className="grid grid-cols-2 gap-4 text-sm">
          {league.startDate && (
            <div>
              <span className="text-ink-500">Start:</span>{" "}
              {format(new Date(league.startDate), "MMM d, yyyy")}
            </div>
          )}
          {league.endDate && (
            <div>
              <span className="text-ink-500">End:</span>{" "}
              {format(new Date(league.endDate), "MMM d, yyyy")}
            </div>
          )}
          {league.registrationDeadline && (
            <div>
              <span className="text-ink-500">Registration Deadline:</span>{" "}
              {format(new Date(league.registrationDeadline), "MMM d, yyyy")}
            </div>
          )}
          {league.teamFee && (
            <div>
              <span className="text-ink-500">Team Fee:</span>{" "}
              <span className="text-[color:var(--brand-ink)] font-semibold">
                {formatCurrency(league.teamFee)}
              </span>
            </div>
          )}
          {league.gamesGuaranteed && (
            <div>
              <span className="text-ink-500">Games Guaranteed:</span> {league.gamesGuaranteed}
            </div>
          )}
          {league.playoffFormat && (
            <div>
              <span className="text-ink-500">Playoffs:</span>{" "}
              {league.playoffFormat.replace("_", " ")}
            </div>
          )}
        </div>
      </div>
    </>
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

/** Stat-tile icons (20×20). */
const TILE_ICONS: Record<string, ReactNode> = {
  divisions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 7l9-4 9 4-9 4-9-4z" strokeLinejoin="round" />
      <path d="M3 12l9 4 9-4M3 17l9 4 9-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  teams: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  ),
  venues: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
}
