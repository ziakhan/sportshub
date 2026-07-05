"use client"

import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
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
          className={`mb-6 rounded-2xl border p-4 ${canFinalize ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}
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
      <div className="mb-8 grid grid-cols-4 gap-4">
        <div className="border-ink-100 rounded-2xl border bg-white p-4 text-center shadow-sm">
          <div className="text-play-700 text-2xl font-bold">{divisions.length}</div>
          <div className="text-ink-500 text-xs">Divisions</div>
        </div>
        <div className="border-ink-100 rounded-2xl border bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-600">{league.teams?.length || 0}</div>
          <div className="text-ink-500 text-xs">Teams</div>
        </div>
        <div className="border-ink-100 rounded-2xl border bg-white p-4 text-center shadow-sm">
          <div className="text-hoop-600 text-2xl font-bold">{sessions.length}</div>
          <div className="text-ink-500 text-xs">Sessions</div>
        </div>
        <div className="border-ink-100 rounded-2xl border bg-white p-4 text-center shadow-sm">
          <div className="text-play-700 text-2xl font-bold">{venues.length}</div>
          <div className="text-ink-500 text-xs">Venues</div>
        </div>
      </div>

      {/* Season Info */}
      <div className="border-ink-100 mt-6 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
        <h3 className="text-ink-900 mb-3 font-semibold">Season Summary</h3>
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
              <span className="text-ink-500">Team Fee:</span> {formatCurrency(league.teamFee)}
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
