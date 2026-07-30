"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { Button, PanelHeader } from "@/components/ui"
import { panelClass } from "./types"

const STATUS_FLOW = [
  "DRAFT",
  "REGISTRATION",
  "REGISTRATION_CLOSED",
  "FINALIZED",
  "IN_PROGRESS",
  "COMPLETED",
]

type StepState = "done" | "action" | "blocked" | "todo" | "optional"

interface Step {
  key: string
  title: string
  state: StepState
  /** One line under the title: what this step means or why it's blocked. */
  detail?: ReactNode
  /** Right-hand side: a status button or a jump link. */
  action?: ReactNode
}

/**
 * The season checklist (IA redesign 2026-07-30 §3) — the mistake-proofing
 * engine. An ordered, always-visible pipeline on Overview; every step is
 * done / actionable / blocked WITH the reason and a link to the unblocking
 * step. Derived from data on every render — no stored state. This is the
 * ONLY place season-status buttons live (they used to float in the header,
 * one stray click from disaster).
 */
export function SeasonChecklist({
  seasonId,
  league,
  divisions,
  sessions,
  venues,
  scheduleGames,
  finalizeErrors,
  finalizeWarnings,
  onGoToTab,
  onStatusChange,
}: {
  seasonId: string
  league: any
  divisions: any[]
  sessions: any[]
  venues: any[]
  scheduleGames: any[]
  finalizeErrors: string[]
  finalizeWarnings: string[]
  onGoToTab: (tab: string, anchor?: string) => void
  onStatusChange: (status: string) => void
}) {
  const [pendingEntries, setPendingEntries] = useState(0)
  const [bracketCount, setBracketCount] = useState<number | null>(null)
  const [capacity, setCapacity] = useState<{ needed: number; provided: number } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [entriesRes, playoffRes, capRes] = await Promise.all([
        fetch(`/api/seasons/${seasonId}/entries`).catch(() => null),
        fetch(`/api/seasons/${seasonId}/playoffs`).catch(() => null),
        fetch(`/api/seasons/${seasonId}/schedule/capacity`).catch(() => null),
      ])
      if (!alive) return
      if (entriesRes?.ok) {
        const data = await entriesRes.json()
        setPendingEntries(
          (data.entries ?? []).filter((e: any) => e.status === "PENDING").length
        )
      }
      if (playoffRes?.ok) {
        const data = await playoffRes.json()
        setBracketCount((data.brackets ?? []).length)
      }
      if (capRes?.ok) {
        const data = await capRes.json()
        const sessionsCap: any[] = data?.sessions ?? []
        if (sessionsCap.length > 0) {
          setCapacity({
            needed: sessionsCap.reduce((sum, s) => sum + (s.gamesNeededAll ?? 0), 0),
            provided: sessionsCap.reduce((sum, s) => sum + (s.slotsTotal ?? 0), 0),
          })
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [seasonId, league?.leagueStatus, scheduleGames.length])

  const status: string = league?.leagueStatus ?? "DRAFT"
  const statusIdx = STATUS_FLOW.indexOf(status)
  const reached = (s: string) => statusIdx >= STATUS_FLOW.indexOf(s)

  const jump = (tab: string, anchor?: string, label = "Go") => (
    <button
      onClick={() => onGoToTab(tab, anchor)}
      className="text-play-600 hover:text-play-700 shrink-0 text-xs font-semibold"
    >
      {label} &rarr;
    </button>
  )

  // --- Derived facts ---------------------------------------------------
  const basicsDone = !!league?.startDate && !!league?.endDate && league?.teamFee != null
  const divisionsDone = divisions.length > 0
  const sessionHasUsableDay = (s: any) =>
    (s.days ?? []).some((d: any) => (d.dayVenues ?? []).some((dv: any) => (dv.courts ?? []).length > 0))
  const sessionsUsable = sessions.length > 0 && sessions.every(sessionHasUsableDay)
  const venuesDone = venues.length > 0 && sessionsUsable
  const regConfigured =
    league?.depositPct != null ||
    (Array.isArray(league?.applicationQuestions) && league.applicationQuestions.length > 0)

  const subs: any[] = league?.teams ?? []
  const pendingSubs = subs.filter((t: any) => t.status === "PENDING").length
  const approvedSubs = subs.filter((t: any) => t.status === "APPROVED")
  const pendingTotal = pendingSubs + pendingEntries

  const thinDivisions = divisions.filter((d: any) => (d._count?.teams ?? 0) < 2)
  const completedGames = scheduleGames.filter((g: any) => g.status === "COMPLETED").length

  // Generalized finalize preflight (the old FINALIZED-only header check).
  const preflight: Array<{ label: string; ok: boolean }> = [
    { label: "At least one division created", ok: divisionsDone },
    { label: "At least one game session scheduled", ok: sessions.length > 0 },
    { label: "Every session has a day with venue + court", ok: sessionsUsable },
    { label: "At least one venue assigned", ok: venues.length > 0 },
    { label: "No teams pending approval", ok: pendingSubs === 0 },
    { label: "Max games per season defined", ok: !!league?.gamesGuaranteed },
    { label: "Period / half length defined", ok: !!league?.periodLengthMinutes },
    {
      label: "Tiebreaker order configured",
      ok: Array.isArray(league?.tiebreakerOrder) && league.tiebreakerOrder.length > 0,
    },
  ]
  const canFinalize = preflight.every((c) => c.ok)

  // --- The pipeline ----------------------------------------------------
  const steps: Step[] = []

  steps.push({
    key: "basics",
    title: "Season basics set",
    state: basicsDone ? "done" : "action",
    detail: basicsDone
      ? undefined
      : "Dates and the team entry fee are missing — clubs can't plan around a season without them.",
    action: basicsDone ? undefined : jump("settings", "basics", "Set up"),
  })

  steps.push({
    key: "divisions",
    title: "Divisions created",
    state: divisionsDone ? "done" : "action",
    detail: divisionsDone
      ? `${divisions.length} division${divisions.length === 1 ? "" : "s"}`
      : "Create at least one division so teams have a bracket to enter.",
    action: divisionsDone ? undefined : jump("settings", "divisions", "Create"),
  })

  steps.push({
    key: "venues",
    title: "Venues allocated & sessions built",
    state: venuesDone ? "done" : "action",
    detail: venuesDone ? (
      `${venues.length} venue${venues.length === 1 ? "" : "s"} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`
    ) : venues.length === 0 ? (
      "Add the venue(s) you'll play at, then build game-day sessions."
    ) : sessions.length === 0 ? (
      "Venues are in — now build the game-day sessions."
    ) : (
      "Every session day needs a venue with at least one court."
    ),
    action: venuesDone ? undefined : jump("schedule", undefined, "Set up"),
  })

  steps.push({
    key: "regconfig",
    title: "Registration configured",
    state: regConfigured ? "done" : "optional",
    detail: regConfigured
      ? undefined
      : "Optional: deposit split, application questions and the club agreement make entries smoother.",
    action: regConfigured ? undefined : jump("settings", "registration", "Configure"),
  })

  const openGateMissing: string[] = []
  if (!basicsDone) openGateMissing.push("season basics")
  if (!divisionsDone) openGateMissing.push("at least one division")
  steps.push({
    key: "open",
    title: "Registration opened",
    state: reached("REGISTRATION")
      ? "done"
      : openGateMissing.length > 0
        ? "blocked"
        : "action",
    detail: reached("REGISTRATION") ? undefined : openGateMissing.length > 0 ? (
      <>Blocked: set up {openGateMissing.join(" and ")} first (steps above).</>
    ) : (
      "Clubs can enter the season the moment you open."
    ),
    action:
      !reached("REGISTRATION") && openGateMissing.length === 0 ? (
        <Button size="sm" onClick={() => onStatusChange("REGISTRATION")}>
          Open registration
        </Button>
      ) : undefined,
  })

  steps.push({
    key: "review",
    title: "Clubs & teams reviewed",
    state: !reached("REGISTRATION")
      ? "todo"
      : pendingTotal === 0
        ? "done"
        : "action",
    detail: !reached("REGISTRATION") ? (
      "Entries and team applications land here once registration is open."
    ) : pendingTotal === 0 ? (
      `${approvedSubs.length} team${approvedSubs.length === 1 ? "" : "s"} approved — nothing waiting.`
    ) : (
      <>
        {pendingEntries > 0 && (
          <>
            {pendingEntries} club entr{pendingEntries === 1 ? "y" : "ies"} pending{" "}
            <button onClick={() => onGoToTab("clubs")} className="text-play-600 font-semibold hover:underline">
              review clubs &rarr;
            </button>
            {pendingSubs > 0 && " · "}
          </>
        )}
        {pendingSubs > 0 && (
          <>
            {pendingSubs} team application{pendingSubs === 1 ? "" : "s"} pending{" "}
            <button onClick={() => onGoToTab("teams")} className="text-play-600 font-semibold hover:underline">
              review teams &rarr;
            </button>
          </>
        )}
      </>
    ),
  })

  steps.push({
    key: "close",
    title: "Registration closed",
    state: reached("REGISTRATION_CLOSED")
      ? "done"
      : status !== "REGISTRATION"
        ? "todo"
        : pendingTotal > 0
          ? "blocked"
          : "action",
    detail: reached("REGISTRATION_CLOSED") ? undefined : status !== "REGISTRATION" ? (
      "Comes after registration opens."
    ) : pendingTotal > 0 ? (
      <>
        Blocked: {pendingTotal} pending review{pendingTotal === 1 ? "" : "s"} — decide them
        first (step above). Closing anyway strands undecided clubs.
      </>
    ) : (
      "No new entries after this. One-way — closing can't be undone."
    ),
    action:
      status === "REGISTRATION" ? (
        pendingTotal > 0 ? (
          <button
            onClick={() => onStatusChange("REGISTRATION_CLOSED")}
            className="text-ink-400 hover:text-hoop-600 shrink-0 text-xs font-semibold underline"
            title="Closes with reviews still pending — those clubs stay undecided"
          >
            Close anyway
          </button>
        ) : (
          <Button size="sm" onClick={() => onStatusChange("REGISTRATION_CLOSED")}>
            Close registration
          </Button>
        )
      ) : undefined,
  })

  steps.push({
    key: "finalize",
    title: "Season finalized",
    state: reached("FINALIZED")
      ? "done"
      : status !== "REGISTRATION_CLOSED"
        ? "todo"
        : canFinalize
          ? "action"
          : "blocked",
    detail: reached("FINALIZED") ? undefined : (
      <>
        {status === "REGISTRATION_CLOSED" && !canFinalize && (
          <span className="block">Blocked — complete these first:</span>
        )}
        {status === "REGISTRATION_CLOSED" ? (
          <span className="mt-1 grid gap-0.5 sm:grid-cols-2">
            {preflight.map((c) => (
              <span key={c.label} className="flex items-center gap-1.5 text-xs">
                <span className={c.ok ? "text-court-600" : "text-amber-500"}>{c.ok ? "✓" : "✗"}</span>
                <span className={c.ok ? "text-ink-500" : "text-amber-700"}>{c.label}</span>
              </span>
            ))}
          </span>
        ) : (
          "Locks the structure so the schedule can be committed. Comes after registration closes."
        )}
        {finalizeErrors.length > 0 && (
          <span className="text-hoop-600 mt-1 block text-xs">
            Could not finalize: {finalizeErrors.join(" · ")}
          </span>
        )}
        {finalizeWarnings.length > 0 && (
          <span className="text-amber-600 mt-1 block text-xs">
            {finalizeWarnings.join(" · ")}
          </span>
        )}
      </>
    ),
    action:
      status === "REGISTRATION_CLOSED" ? (
        <Button size="sm" onClick={() => onStatusChange("FINALIZED")} disabled={!canFinalize}>
          Finalize season
        </Button>
      ) : undefined,
  })

  const scheduleDone = scheduleGames.length > 0
  const scheduleBlockers: ReactNode[] = []
  if (!reached("FINALIZED"))
    scheduleBlockers.push("season must be finalized before a schedule can be committed")
  if (thinDivisions.length > 0)
    scheduleBlockers.push(
      `${thinDivisions.map((d: any) => d.name).join(", ")} ${thinDivisions.length === 1 ? "has" : "have"} fewer than 2 teams`
    )
  if (capacity && capacity.provided < capacity.needed)
    scheduleBlockers.push(
      `sessions provide ${capacity.provided} slots but divisions need ${capacity.needed}`
    )
  steps.push({
    key: "schedule",
    title: "Schedule generated",
    state: scheduleDone ? "done" : reached("FINALIZED") && scheduleBlockers.length === 0 ? "action" : reached("REGISTRATION_CLOSED") ? "blocked" : "todo",
    detail: scheduleDone ? (
      `${scheduleGames.length} game${scheduleGames.length === 1 ? "" : "s"} committed${capacity ? ` · sessions provide ${capacity.provided} slots for ${capacity.needed} needed` : ""}`
    ) : scheduleBlockers.length > 0 && reached("REGISTRATION_CLOSED") ? (
      <>Blocked: {scheduleBlockers.map((b, i) => <span key={i}>{i > 0 && " · "}{b}</span>)}</>
    ) : reached("FINALIZED") ? (
      <>
        {capacity
          ? `Sessions provide ${capacity.provided} slots; your divisions need ${capacity.needed}. `
          : ""}
        Preview the scheduler&apos;s proposal, then commit.
      </>
    ) : (
      "Preview any time; committing needs a finalized season."
    ),
    action: scheduleDone ? undefined : jump("schedule", undefined, "Open scheduler"),
  })

  steps.push({
    key: "start",
    title: "Season underway",
    state: reached("IN_PROGRESS") ? "done" : status === "FINALIZED" ? "action" : "todo",
    detail: reached("IN_PROGRESS")
      ? undefined
      : status === "FINALIZED"
        ? scheduleDone
          ? "Everything's in place — start when the first games are ready."
          : "You can start now, but no games are committed yet (step above)."
        : "Comes after the season is finalized.",
    action:
      status === "FINALIZED" ? (
        <Button size="sm" onClick={() => onStatusChange("IN_PROGRESS")}>
          Start season
        </Button>
      ) : undefined,
  })

  steps.push({
    key: "playoffs",
    title: "Playoffs generated",
    state:
      (bracketCount ?? 0) > 0
        ? "done"
        : !reached("IN_PROGRESS")
          ? "todo"
          : completedGames === 0
            ? "blocked"
            : "action",
    detail:
      (bracketCount ?? 0) > 0
        ? `${bracketCount} bracket${bracketCount === 1 ? "" : "s"}`
        : !reached("IN_PROGRESS")
          ? "Comes once the season is underway."
          : completedGames === 0
            ? "Blocked: no completed games yet — seeds and eligibility come from played games."
            : "Standings have data — generate brackets per division.",
    action:
      (bracketCount ?? 0) === 0 && reached("IN_PROGRESS") && completedGames > 0
        ? jump("playoffs", undefined, "Generate")
        : undefined,
  })

  steps.push({
    key: "complete",
    title: "Season completed",
    state: status === "COMPLETED" ? "done" : status === "IN_PROGRESS" ? "action" : "todo",
    detail:
      status === "COMPLETED"
        ? undefined
        : status === "IN_PROGRESS"
          ? "Wraps up the season — results and standings lock in and stay browsable."
          : "The final step.",
    action:
      status === "IN_PROGRESS" ? (
        <Button size="sm" variant="subtle" onClick={() => onStatusChange("COMPLETED")}>
          Mark completed
        </Button>
      ) : undefined,
  })

  const doneCount = steps.filter((s) => s.state === "done").length

  return (
    <div className={`reveal ${panelClass} mb-6`}>
      <PanelHeader
        title="Season checklist"
        action={
          <span className="text-ink-500 text-xs font-semibold">
            {doneCount} of {steps.length} done
          </span>
        }
      />
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={`flex items-start justify-between gap-3 rounded-xl px-3 py-2 ${
              s.state === "action"
                ? "bg-play-50 border-play-100 border"
                : s.state === "blocked"
                  ? "bg-amber-50/60"
                  : ""
            }`}
          >
            <div className="flex min-w-0 items-start gap-3">
              <StepMark state={s.state} n={i + 1} />
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    s.state === "done"
                      ? "text-ink-400"
                      : s.state === "todo"
                        ? "text-ink-500"
                        : "text-ink-900"
                  }`}
                >
                  {s.title}
                  {s.state === "optional" && (
                    <span className="text-ink-400 ml-2 text-[10px] font-medium uppercase tracking-wide">
                      optional
                    </span>
                  )}
                </p>
                {s.detail && <div className="text-ink-500 mt-0.5 text-xs">{s.detail}</div>}
              </div>
            </div>
            {s.action && <div className="shrink-0 pt-0.5">{s.action}</div>}
          </li>
        ))}
      </ol>
    </div>
  )
}

function StepMark({ state, n }: { state: StepState; n: number }) {
  if (state === "done")
    return (
      <span className="bg-court-100 text-court-700 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
        ✓
      </span>
    )
  if (state === "blocked")
    return (
      <span className="bg-amber-100 text-amber-700 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
    )
  return (
    <span
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
        state === "action" ? "bg-play-600 text-white" : "bg-ink-100 text-ink-500"
      }`}
    >
      {n}
    </span>
  )
}
