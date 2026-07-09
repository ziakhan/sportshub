"use client"

import type { ReactNode } from "react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { StatTile, PanelHeader } from "@/components/ui"
import type { PreflightCheck } from "./types"

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
  return (
    <>
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
