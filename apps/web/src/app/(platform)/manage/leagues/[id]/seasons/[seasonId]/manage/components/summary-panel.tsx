"use client"

import { Badge, PanelHeader } from "@/components/ui"
import type { ScheduleFairnessReport, TeamFairness } from "@/lib/scheduler/report"

/**
 * Summary-first results (owner plan, planning-stages-2026-08-07.md, stage
 * 2): at 140-team scale a flat games table is not a way to check a
 * schedule. The verdict answers "is this run healthy" in one glance; the
 * fairness table answers "which teams need a look," worst first. The full
 * games list stays one click away for verification, never the first thing
 * read.
 */

/**
 * A team's problem count: the fairness signals that are unambiguously bad
 * (back-to-backs, big gaps, split-venue days, and any preference/request
 * misses). Court concentration and early/late tip-off counts are
 * informational, not counted here, since having some early or late games
 * is not itself a problem for a team.
 */
function problemCount(t: TeamFairness): number {
  const preferenceMisses = t.preferenceHonored
    ? t.preferenceHonored.total - t.preferenceHonored.ok
    : 0
  const requestMisses = t.requestsHonored
    ? t.requestsHonored.total - t.requestsHonored.ok
    : 0
  return t.backToBacks + t.bigGapDays + t.splitVenueDays + preferenceMisses + requestMisses
}

export function redFlagTeamCount(report: ScheduleFairnessReport): number {
  return report.teams.filter((t) => problemCount(t) > 0).length
}

/**
 * Verdict header: teams, games scheduled vs expected, red-flag teams, and
 * open issues, in one row. Tone escalates from clean to "something needs a
 * look" to "games couldn't be placed."
 */
export function ScheduleVerdictHeader({
  report,
  scheduledCount,
  expectedCount,
  warnings,
}: {
  report: ScheduleFairnessReport
  scheduledCount: number
  expectedCount: number
  warnings: string[]
}) {
  const unscheduledCount = Math.max(0, expectedCount - scheduledCount)
  const redFlagCount = redFlagTeamCount(report)
  const issueCount = warnings.length
  const tone =
    unscheduledCount > 0 ? "hoop" : redFlagCount > 0 || issueCount > 0 ? "gold" : "court"
  const toneClass =
    tone === "hoop"
      ? "border-hoop-200 bg-hoop-50"
      : tone === "gold"
        ? "border-gold-200 bg-gold-50"
        : "border-court-200 bg-court-50"

  return (
    <div data-testid="schedule-verdict" className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">
          {report.totals.teams} team{report.totals.teams === 1 ? "" : "s"}
        </Badge>
        <Badge tone={unscheduledCount > 0 ? "hoop" : "court"}>
          {scheduledCount} of {expectedCount} game{expectedCount === 1 ? "" : "s"} scheduled
        </Badge>
        <Badge tone={redFlagCount > 0 ? "gold" : "court"}>
          {redFlagCount} team{redFlagCount === 1 ? "" : "s"} flagged
        </Badge>
        <Badge tone={issueCount > 0 ? "gold" : "court"}>
          {issueCount} issue{issueCount === 1 ? "" : "s"}
        </Badge>
      </div>
      {warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {warnings.map((w, i) => (
            <li key={i} className="text-amber-700 text-xs">
              • {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Per-team fairness counts, worst first. Every numeric column the report
 * computes per team; preference/request columns only appear when the
 * report actually carries that data (most reports don't have requests
 * wired up yet).
 */
export function FairnessSummaryTable({
  report,
  onSelectTeam,
}: {
  report: ScheduleFairnessReport
  onSelectTeam: (teamId: string) => void
}) {
  const hasPreference = report.teams.some((t) => t.preferenceHonored)
  const hasRequests = report.teams.some((t) => t.requestsHonored)
  const rows = [...report.teams].sort(
    (a, b) => problemCount(b) - problemCount(a) || a.teamName.localeCompare(b.teamName)
  )

  return (
    <div>
      <PanelHeader title="Fairness by team" />
      <p className="text-ink-500 -mt-2 mb-3 text-xs">
        Worst first. Click a team to check its full schedule.
      </p>
      <div data-testid="fairness-summary" className="overflow-x-auto">
        <table className="text-ink-700 w-full text-xs">
          <thead className="bg-ink-50 text-ink-500 text-[10px] uppercase tracking-wide">
            <tr>
              <th className="px-2 py-1.5 text-left">Team</th>
              <th className="px-2 py-1.5 text-right">Games</th>
              <th className="px-2 py-1.5 text-right">Back-to-backs</th>
              <th className="px-2 py-1.5 text-right">Early starts</th>
              <th className="px-2 py-1.5 text-right">Late endings</th>
              <th className="px-2 py-1.5 text-right">Big gaps</th>
              <th className="px-2 py-1.5 text-right">Two-gym days</th>
              {hasPreference && <th className="px-2 py-1.5 text-right">Preference misses</th>}
              {hasRequests && <th className="px-2 py-1.5 text-right">Request misses</th>}
              <th className="px-2 py-1.5 text-right">Top court %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const flagged = problemCount(t) > 0
              const preferenceMisses = t.preferenceHonored
                ? t.preferenceHonored.total - t.preferenceHonored.ok
                : null
              const requestMisses = t.requestsHonored
                ? t.requestsHonored.total - t.requestsHonored.ok
                : null
              return (
                <tr
                  key={t.teamId}
                  onClick={() => onSelectTeam(t.teamId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelectTeam(t.teamId)
                  }}
                  className={`border-ink-100 hover:bg-ink-50 cursor-pointer border-t transition-colors ${
                    flagged ? "bg-gold-50/40" : ""
                  }`}
                >
                  <td className="text-ink-900 px-2 py-1 font-medium">{t.teamName}</td>
                  <td className="px-2 py-1 text-right">{t.games}</td>
                  <td
                    className={`px-2 py-1 text-right ${t.backToBacks > 0 ? "text-amber-700 font-semibold" : ""}`}
                  >
                    {t.backToBacks}
                  </td>
                  <td className="px-2 py-1 text-right">{t.earlyGames}</td>
                  <td className="px-2 py-1 text-right">{t.lastGames}</td>
                  <td
                    className={`px-2 py-1 text-right ${t.bigGapDays > 0 ? "text-amber-700 font-semibold" : ""}`}
                  >
                    {t.bigGapDays}
                  </td>
                  <td
                    className={`px-2 py-1 text-right ${t.splitVenueDays > 0 ? "text-amber-700 font-semibold" : ""}`}
                  >
                    {t.splitVenueDays}
                  </td>
                  {hasPreference && (
                    <td
                      className={`px-2 py-1 text-right ${preferenceMisses ? "text-amber-700 font-semibold" : ""}`}
                    >
                      {preferenceMisses ?? "—"}
                    </td>
                  )}
                  {hasRequests && (
                    <td
                      className={`px-2 py-1 text-right ${requestMisses ? "text-amber-700 font-semibold" : ""}`}
                    >
                      {requestMisses ?? "—"}
                    </td>
                  )}
                  <td className="px-2 py-1 text-right">
                    {Math.round(t.topCourtShare * 100)}%
                    {t.topCourtName && <span className="text-ink-400"> · {t.topCourtName}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-ink-500 px-2 py-3 text-xs">No games to check yet.</p>}
      </div>
    </div>
  )
}
