"use client"

import { useMemo, useState } from "react"
import { Badge, PanelHeader } from "@/components/ui"
import { inputClass } from "./types"
import type { ScheduleFairnessReport, TeamFairness } from "@/lib/scheduler/report"

/**
 * Summary-first results (owner plan, planning-stages-2026-08-07.md, stage
 * 2): at 140-team scale a flat games table is not a way to check a
 * schedule. The verdict answers "is this run healthy" in one glance; the
 * fairness table answers "which teams need a look," worst first. The full
 * games list stays one click away for verification, never the first thing
 * read.
 */

/** How many games short of the season's guarantee, floored at zero. Zero
 *  target (no guarantee configured) means the number never applies. */
function gamesShort(t: TeamFairness, gamesTarget: number): number {
  return gamesTarget > 0 ? Math.max(0, gamesTarget - t.games) : 0
}

/**
 * Burden score weights (owner 2026-08-07 hierarchy). A split day with no
 * time to drive between the gyms is the worst thing a schedule can do to a
 * family (they cannot attend both games) — it stacks ON TOP of the split's
 * own weight. Then the split itself and being short of the games
 * guarantee; a 5hr+ "monster" wait between games is next; then a
 * back-to-back; a milder 3-4 slot "mid" wait is the least severe.
 * Re-weight here if the owner's priorities shift — nothing else should
 * hardcode these numbers.
 */
export const BURDEN_WEIGHTS = {
  tightSplits: 30,
  splitVenueDays: 20,
  gamesShort: 20,
  // Owner's ladder 2026-08-08 (scheduler v2): a back-to-back is
  // forbidden-tier; a 5+ slot wait prices like a two-date weekend (6); a
  // 3-4 slot gap is inside the PREFERRED breather (2-4 slots) — free.
  backToBacks: 50,
  monsterWaits: 6,
  midWaits: 0,
} as const

/** One weighted penalty score per team. Lower is better; 0 is a perfect
 *  schedule for that team. */
export function burdenScore(t: TeamFairness, gamesTarget: number): number {
  return (
    BURDEN_WEIGHTS.tightSplits * t.tightSplitDays +
    BURDEN_WEIGHTS.splitVenueDays * t.splitVenueDays +
    BURDEN_WEIGHTS.gamesShort * gamesShort(t, gamesTarget) +
    BURDEN_WEIGHTS.monsterWaits * t.monsterGapDays +
    BURDEN_WEIGHTS.backToBacks * t.backToBacks +
    BURDEN_WEIGHTS.midWaits * t.midGapDays
  )
}

export function redFlagTeamCount(report: ScheduleFairnessReport, gamesTarget: number): number {
  return report.teams.filter((t) => burdenScore(t, gamesTarget) > 0).length
}

const ISSUES_COLLAPSED_LIMIT = 5

/**
 * Verdict header: teams, games scheduled vs expected, red-flag teams, and
 * open issues, in one row. Tone escalates from clean to "something needs a
 * look" to "games couldn't be placed." Issues past the first five collapse
 * behind a toggle — per-team games-short lines never reach this list at
 * all, they live in the fairness table's "Games short" column instead.
 */
export function ScheduleVerdictHeader({
  report,
  scheduledCount,
  expectedCount,
  gamesTarget,
  warnings,
}: {
  report: ScheduleFairnessReport
  scheduledCount: number
  expectedCount: number
  gamesTarget: number
  warnings: string[]
}) {
  const [expanded, setExpanded] = useState(false)
  const unscheduledCount = Math.max(0, expectedCount - scheduledCount)
  const redFlagCount = redFlagTeamCount(report, gamesTarget)
  const issueCount = warnings.length
  const tone =
    unscheduledCount > 0 ? "hoop" : redFlagCount > 0 || issueCount > 0 ? "gold" : "court"
  const toneClass =
    tone === "hoop"
      ? "border-hoop-200 bg-hoop-50"
      : tone === "gold"
        ? "border-gold-200 bg-gold-50"
        : "border-court-200 bg-court-50"
  const shownWarnings =
    expanded || warnings.length <= ISSUES_COLLAPSED_LIMIT
      ? warnings
      : warnings.slice(0, ISSUES_COLLAPSED_LIMIT)

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
        <>
          <ul className="mt-2 space-y-0.5">
            {shownWarnings.map((w, i) => (
              <li key={i} className="text-amber-700 text-xs">
                • {w}
              </li>
            ))}
          </ul>
          {warnings.length > ISSUES_COLLAPSED_LIMIT && (
            <button
              type="button"
              data-testid="issues-toggle"
              onClick={() => setExpanded((v) => !v)}
              className="text-amber-800 mt-1 text-xs font-semibold hover:underline"
            >
              {expanded ? "Show fewer" : `Show all ${warnings.length} issues`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** Downward-pointing when sorted descending, flipped for ascending — never
 *  an emoji, so it stays crisp at 145+ header clicks and any zoom level. */
function SortArrow({ direction }: { direction: "asc" | "desc" }) {
  return (
    <svg
      viewBox="0 0 10 6"
      aria-hidden="true"
      className={`inline-block h-[6px] w-2.5 shrink-0 fill-current transition-transform ${
        direction === "asc" ? "rotate-180" : ""
      }`}
    >
      <path d="M0 0L10 0L5 6Z" />
    </svg>
  )
}

type ColumnKey =
  | "team"
  | "burden"
  | "games"
  | "gamesShort"
  | "backToBacks"
  | "earlyGames"
  | "lastGames"
  | "midWaits"
  | "monsterWaits"
  | "splitVenueDays"
  | "tightSplits"
  | "preferenceMisses"
  | "requestMisses"
  | "topCourtShare"

interface Row {
  team: TeamFairness
  division: string | null
  burden: number
  gamesShortVal: number
  preferenceMisses: number | null
  requestMisses: number | null
}

const tintNonzero = (n: number) => (n > 0 ? "text-amber-700 font-semibold" : "")

/**
 * Per-team fairness table, every column sortable, worst-first on Burden by
 * default. Built for 145-160 rows: sticky header inside its own scroll
 * container, a name search, and division chips (reusing the same division
 * labels the board view already carries) so the operator narrows before
 * scanning instead of scrolling the whole league.
 */
export function FairnessSummaryTable({
  report,
  gamesTarget,
  divisionByTeam,
  onSelectTeam,
}: {
  report: ScheduleFairnessReport
  gamesTarget: number
  /** teamId -> division/grade label, reused from the board view's own
   *  lookup — the fairness report itself doesn't carry division. */
  divisionByTeam?: Map<string, string>
  onSelectTeam: (teamId: string) => void
}) {
  const hasPreference = report.teams.some((t) => t.preferenceHonored)
  // Only present when the schedule commits this crime at all — the engine's
  // job is to make this column disappear (owner ruling 2026-08-07).
  const hasTightSplits = report.teams.some((t) => t.tightSplitDays > 0)
  const hasRequests = report.teams.some((t) => t.requestsHonored)
  const showGamesShort = gamesTarget > 0

  const [search, setSearch] = useState("")
  const [divisionFilter, setDivisionFilter] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<ColumnKey>("burden")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const toggleSort = (key: ColumnKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const rows: Row[] = useMemo(
    () =>
      report.teams.map((t) => ({
        team: t,
        division: divisionByTeam?.get(t.teamId) ?? null,
        burden: burdenScore(t, gamesTarget),
        gamesShortVal: gamesShort(t, gamesTarget),
        preferenceMisses: t.preferenceHonored
          ? t.preferenceHonored.total - t.preferenceHonored.ok
          : null,
        requestMisses: t.requestsHonored ? t.requestsHonored.total - t.requestsHonored.ok : null,
      })),
    [report.teams, gamesTarget, divisionByTeam]
  )

  const divisions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.division) set.add(r.division)
    return [...set].sort()
  }, [rows])

  const columnValue = (r: Row, key: ColumnKey): number | string => {
    switch (key) {
      case "team":
        return r.team.teamName
      case "burden":
        return r.burden
      case "games":
        return r.team.games
      case "gamesShort":
        return r.gamesShortVal
      case "backToBacks":
        return r.team.backToBacks
      case "earlyGames":
        return r.team.earlyGames
      case "lastGames":
        return r.team.lastGames
      case "midWaits":
        return r.team.midGapDays
      case "monsterWaits":
        return r.team.monsterGapDays
      case "splitVenueDays":
        return r.team.splitVenueDays
      case "tightSplits":
        return r.team.tightSplitDays
      case "preferenceMisses":
        return r.preferenceMisses ?? -1
      case "requestMisses":
        return r.requestMisses ?? -1
      case "topCourtShare":
        return r.team.topCourtShare
    }
  }

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      if (q && !r.team.teamName.toLowerCase().includes(q)) return false
      if (divisionFilter && r.division !== divisionFilter) return false
      return true
    })
    const sign = sortDir === "desc" ? -1 : 1
    return [...filtered].sort((a, b) => {
      const av = columnValue(a, sortKey)
      const bv = columnValue(b, sortKey)
      const cmp =
        typeof av === "string" || typeof bv === "string"
          ? String(av).localeCompare(String(bv))
          : (av as number) - (bv as number)
      return cmp !== 0 ? sign * cmp : a.team.teamName.localeCompare(b.team.teamName)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, divisionFilter, sortKey, sortDir])

  const columns: Array<{
    key: ColumnKey
    label: string
    align: "left" | "right"
    show: boolean
    tooltip?: string
  }> = [
    { key: "team", label: "Team", align: "left", show: true },
    {
      key: "burden",
      label: "Burden",
      align: "right",
      show: true,
      tooltip: "Penalty points. 0 is a perfect schedule.",
    },
    { key: "games", label: "Games", align: "right", show: true },
    { key: "gamesShort", label: "Games short", align: "right", show: showGamesShort },
    { key: "backToBacks", label: "Back-to-backs", align: "right", show: true },
    { key: "earlyGames", label: "Early starts", align: "right", show: true },
    { key: "lastGames", label: "Late endings", align: "right", show: true },
    {
      key: "midWaits",
      label: "Waits (3-4)",
      align: "right",
      show: true,
      tooltip: "3-4 empty slots between games. Inside the preferred 2+ slot breather - no penalty.",
    },
    { key: "monsterWaits", label: "5hr+ waits", align: "right", show: true },
    { key: "splitVenueDays", label: "Same day, 2 gyms", align: "right", show: true },
    {
      key: "tightSplits",
      label: "No time to drive",
      align: "right",
      show: hasTightSplits,
      tooltip: "Split days where the gap between gyms is too short to drive it.",
    },
    { key: "preferenceMisses", label: "Preference misses", align: "right", show: hasPreference },
    { key: "requestMisses", label: "Request misses", align: "right", show: hasRequests },
    { key: "topCourtShare", label: "Top court %", align: "right", show: true },
  ]

  const headerCell = (col: (typeof columns)[number]) => {
    const active = sortKey === col.key
    return (
      <th
        key={col.key}
        scope="col"
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        title={col.tooltip}
        onClick={() => toggleSort(col.key)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggleSort(col.key)
          }
        }}
        className={`cursor-pointer select-none whitespace-nowrap px-2 py-1.5 ${
          col.align === "left" ? "text-left" : "text-right"
        } ${active ? "text-ink-900" : "text-ink-500"} hover:text-ink-900`}
      >
        <span
          className={`inline-flex items-center gap-1 ${col.align === "right" ? "flex-row-reverse" : ""}`}
        >
          {col.label}
          {active && <SortArrow direction={sortDir} />}
        </span>
      </th>
    )
  }

  return (
    <div>
      <PanelHeader title="Fairness by team" />
      <p className="text-ink-500 -mt-2 mb-3 text-xs">
        Worst first by burden. Click a column to sort, click a team to check its full schedule.
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          data-testid="team-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team name…"
          className={`${inputClass} w-48`}
        />
        {divisions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDivisionFilter(null)}
              aria-pressed={divisionFilter === null}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                divisionFilter === null
                  ? "border-play-500 bg-play-600 text-white"
                  : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
              }`}
            >
              All
            </button>
            {divisions.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDivisionFilter((cur) => (cur === d ? null : d))}
                aria-pressed={divisionFilter === d}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  divisionFilter === d
                    ? "border-play-500 bg-play-600 text-white"
                    : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
        {(search || divisionFilter) && (
          <span className="text-ink-400 text-[11px]">
            {visibleRows.length} of {rows.length} teams
          </span>
        )}
      </div>
      <div
        data-testid="fairness-summary"
        className="max-h-[70vh] overflow-auto rounded-xl border border-ink-100"
      >
        <table className="text-ink-700 w-full text-xs">
          <thead className="bg-ink-50 text-[10px] uppercase tracking-wide sticky top-0 z-10">
            <tr>{columns.filter((c) => c.show).map(headerCell)}</tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const t = r.team
              const flagged = r.burden > 0
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
                  <td className="text-ink-900 break-words px-2 py-2 font-medium">{t.teamName}</td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${
                      r.burden === 0
                        ? "text-court-600"
                        : r.burden <= 20
                          ? "text-gold-700 font-semibold"
                          : "text-hoop-700 font-semibold"
                    }`}
                  >
                    {r.burden}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{t.games}</td>
                  {showGamesShort && (
                    <td
                      className={`px-2 py-2 text-right tabular-nums ${r.gamesShortVal > 0 ? "text-hoop-700 font-semibold" : ""}`}
                    >
                      {r.gamesShortVal}
                    </td>
                  )}
                  <td className={`px-2 py-2 text-right tabular-nums ${tintNonzero(t.backToBacks)}`}>
                    {t.backToBacks}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{t.earlyGames}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{t.lastGames}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${tintNonzero(t.midGapDays)}`}>
                    {t.midGapDays}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${tintNonzero(t.monsterGapDays)}`}
                  >
                    {t.monsterGapDays}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${tintNonzero(t.splitVenueDays)}`}
                  >
                    {t.splitVenueDays}
                  </td>
                  {hasTightSplits && (
                    <td
                      className={`px-2 py-2 text-right tabular-nums ${t.tightSplitDays > 0 ? "text-hoop-700 font-semibold" : ""}`}
                    >
                      {t.tightSplitDays}
                    </td>
                  )}
                  {hasPreference && (
                    <td
                      className={`px-2 py-2 text-right tabular-nums ${r.preferenceMisses ? "text-amber-700 font-semibold" : ""}`}
                    >
                      {r.preferenceMisses ?? "—"}
                    </td>
                  )}
                  {hasRequests && (
                    <td
                      className={`px-2 py-2 text-right tabular-nums ${r.requestMisses ? "text-amber-700 font-semibold" : ""}`}
                    >
                      {r.requestMisses ?? "—"}
                    </td>
                  )}
                  <td className="px-2 py-2 text-right tabular-nums">
                    {Math.round(t.topCourtShare * 100)}%
                    {t.topCourtName && <span className="text-ink-400"> · {t.topCourtName}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visibleRows.length === 0 && (
          <p className="text-ink-500 px-2 py-3 text-xs">
            {rows.length === 0 ? "No games to check yet." : "No teams match your search."}
          </p>
        )}
      </div>
    </div>
  )
}
