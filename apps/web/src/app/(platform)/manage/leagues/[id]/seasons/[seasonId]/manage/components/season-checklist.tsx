"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Button, PanelHeader } from "@/components/ui"
import {
  seasonFacts,
  deriveSeasonSteps,
  summarizeSeasonProgress,
  seasonStatusReached,
  SEASON_STEP_TITLES,
  type SeasonStepKey,
  type SeasonStepState,
} from "@/lib/leagues/season-progress"
import { panelClass } from "./types"

interface Step {
  key: SeasonStepKey
  title: string
  state: SeasonStepState
  /** One line under the title: what this step means or why it's blocked. */
  detail?: ReactNode
  /** Right-hand side: a status button or a jump button. */
  action?: ReactNode
}

/**
 * The season checklist (IA redesign 2026-07-30 §3) — the mistake-proofing
 * engine. An ordered, always-visible pipeline on Overview; every step is
 * done / actionable / blocked WITH the reason and a link to the unblocking
 * step. Derived from data on every render — no stored state. This is the
 * ONLY place season-status buttons live (they used to float in the header,
 * one stray click from disaster).
 *
 * 2026-08-14: the done/not-done derivation moved to lib/leagues/season-progress
 * so the dashboard command hero shows the SAME progress and the SAME next
 * step; this file owns the copy, the buttons and the layout. Every action is
 * a kit button now: solid for the one next step, outline for the rest.
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
  const reached = (s: string) => seasonStatusReached(status, s)

  // --- Derived facts (shared with the dashboard hero) -------------------
  const facts = seasonFacts({
    status,
    startDate: league?.startDate,
    endDate: league?.endDate,
    teamFee: league?.teamFee,
    depositPct: league?.depositPct,
    applicationQuestions: league?.applicationQuestions,
    gamesGuaranteed: league?.gamesGuaranteed,
    periodLengthMinutes: league?.periodLengthMinutes,
    tiebreakerOrder: league?.tiebreakerOrder,
    divisionTeamCounts: divisions.map((d: any) => d._count?.teams ?? 0),
    sessions,
    venueCount: venues.length,
    submissionStatuses: (league?.teams ?? []).map((t: any) => t.status),
    pendingEntries,
    games: {
      total: scheduleGames.length,
      draft: scheduleGames.filter((g: any) => !g.publishedAt).length,
      completed: scheduleGames.filter((g: any) => g.status === "COMPLETED").length,
    },
    bracketCount: bracketCount ?? 0,
    capacity,
  })
  const derived = deriveSeasonSteps(facts)
  const summary = summarizeSeasonProgress(derived)
  const nextKey = summary.next?.key ?? null
  const stateOf = (key: SeasonStepKey): SeasonStepState =>
    derived.find((s) => s.key === key)?.state ?? "todo"

  const { pendingSubs, approvedSubs, pendingTotal, preflight, canFinalize } = facts
  const thinDivisions = divisions.filter((d: any) => (d._count?.teams ?? 0) < 2)

  /** Jump to another tab. Solid when it IS the next step, outline otherwise. */
  const jump = (key: SeasonStepKey, tab: string, anchor: string | undefined, label: string) => (
    <Button
      size="sm"
      variant={key === nextKey ? "primary" : "subtle"}
      tone="play"
      icon={ARROW_ICON}
      onClick={() => onGoToTab(tab, anchor)}
    >
      {label}
    </Button>
  )

  /** Status-advance button, same rule. */
  const advance = (key: SeasonStepKey, to: string, label: string, tone: "play" | "ink" = "play") => (
    <Button
      size="sm"
      variant={key === nextKey ? "primary" : "subtle"}
      tone={tone}
      onClick={() => onStatusChange(to)}
    >
      {label}
    </Button>
  )

  // --- The pipeline ----------------------------------------------------
  const steps: Step[] = []

  steps.push({
    key: "basics",
    title: SEASON_STEP_TITLES.basics,
    state: stateOf("basics"),
    detail: facts.basicsDone
      ? undefined
      : "Dates and the team entry fee are missing. Clubs can't plan around a season without them.",
    action: facts.basicsDone ? undefined : jump("basics", "settings", "basics", "Set up"),
  })

  steps.push({
    key: "divisions",
    title: SEASON_STEP_TITLES.divisions,
    state: stateOf("divisions"),
    detail: facts.divisionsDone
      ? `${divisions.length} division${divisions.length === 1 ? "" : "s"}`
      : "Create at least one division so teams have a bracket to enter.",
    action: facts.divisionsDone
      ? undefined
      : jump("divisions", "settings", "divisions", "Create"),
  })

  steps.push({
    key: "venues",
    title: SEASON_STEP_TITLES.venues,
    state: stateOf("venues"),
    detail: facts.venuesDone ? (
      `${venues.length} venue${venues.length === 1 ? "" : "s"} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`
    ) : venues.length === 0 ? (
      "Add the venue(s) you'll play at, then build game-day sessions."
    ) : sessions.length === 0 ? (
      "Venues are in. Now build the game-day sessions."
    ) : (
      "Every session day needs a venue with at least one court."
    ),
    action: facts.venuesDone ? undefined : jump("venues", "schedule", undefined, "Set up"),
  })

  steps.push({
    key: "regconfig",
    title: SEASON_STEP_TITLES.regconfig,
    state: stateOf("regconfig"),
    detail: facts.regConfigured
      ? undefined
      : "Optional: deposit split, application questions and the club agreement make entries smoother.",
    action: facts.regConfigured
      ? undefined
      : jump("regconfig", "settings", "registration", "Configure"),
  })

  const openGateMissing: string[] = []
  if (!facts.basicsDone) openGateMissing.push("season basics")
  if (!facts.divisionsDone) openGateMissing.push("at least one division")
  steps.push({
    key: "open",
    title: SEASON_STEP_TITLES.open,
    state: stateOf("open"),
    detail: reached("REGISTRATION") ? undefined : openGateMissing.length > 0 ? (
      <>Blocked: set up {openGateMissing.join(" and ")} first (steps above).</>
    ) : (
      "Clubs can enter the season the moment you open."
    ),
    action:
      !reached("REGISTRATION") && openGateMissing.length === 0 ? (
        advance("open", "REGISTRATION", "Open registration")
      ) : reached("REGISTRATION") ? (
        // Registration is open, so the next thing families need is the
        // season calendar (plan wizard step 4, 2026-08-02). A link, not a
        // status button: this checklist stays the only place status changes.
        <Button
          size="sm"
          variant="subtle"
          tone="play"
          icon={ARROW_ICON}
          href={`/manage/leagues/${league?.leagueId}/seasons/${seasonId}/plan?step=4`}
        >
          Publish calendar
        </Button>
      ) : undefined,
  })

  steps.push({
    key: "review",
    title: SEASON_STEP_TITLES.review,
    state: stateOf("review"),
    detail: !reached("REGISTRATION") ? (
      "Entries and team applications land here once registration is open."
    ) : pendingTotal === 0 ? (
      `${approvedSubs} team${approvedSubs === 1 ? "" : "s"} approved. Nothing waiting.`
    ) : (
      <>
        {pendingEntries > 0 && (
          <>
            {pendingEntries} club entr{pendingEntries === 1 ? "y" : "ies"} pending
            {pendingSubs > 0 && " · "}
          </>
        )}
        {pendingSubs > 0 && (
          <>
            {pendingSubs} team application{pendingSubs === 1 ? "" : "s"} pending
          </>
        )}
      </>
    ),
    action:
      pendingTotal > 0 && reached("REGISTRATION")
        ? pendingEntries > 0
          ? jump("review", "clubs", undefined, "Review clubs")
          : jump("review", "teams", undefined, "Review teams")
        : undefined,
  })

  steps.push({
    key: "close",
    title: SEASON_STEP_TITLES.close,
    state: stateOf("close"),
    detail: reached("REGISTRATION_CLOSED") ? undefined : status !== "REGISTRATION" ? (
      "Comes after registration opens."
    ) : pendingTotal > 0 ? (
      <>
        Blocked: {pendingTotal} pending review{pendingTotal === 1 ? "" : "s"}. Decide them first
        (step above). Closing anyway strands undecided clubs.
      </>
    ) : (
      "No new entries after this. One way only: closing can't be undone."
    ),
    action:
      status === "REGISTRATION" ? (
        pendingTotal > 0 ? (
          <Button
            size="sm"
            variant="subtle"
            onClick={() => onStatusChange("REGISTRATION_CLOSED")}
            title="Closes with reviews still pending, so those clubs stay undecided"
          >
            Close anyway
          </Button>
        ) : (
          advance("close", "REGISTRATION_CLOSED", "Close registration")
        )
      ) : undefined,
  })

  steps.push({
    key: "finalize",
    title: SEASON_STEP_TITLES.finalize,
    state: stateOf("finalize"),
    detail: reached("FINALIZED") ? undefined : (
      <>
        {status === "REGISTRATION_CLOSED" && !canFinalize && (
          <span className="block">Blocked, complete these first:</span>
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
        <Button
          size="sm"
          variant={nextKey === "finalize" && canFinalize ? "primary" : "subtle"}
          tone="play"
          onClick={() => onStatusChange("FINALIZED")}
          disabled={!canFinalize}
        >
          Finalize season
        </Button>
      ) : undefined,
  })

  const scheduleDone = facts.scheduleGames > 0
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
    title: SEASON_STEP_TITLES.schedule,
    state: stateOf("schedule"),
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
    action: scheduleDone
      ? undefined
      : jump("schedule", "schedule", undefined, "Open scheduler"),
  })

  // Draft → publish (owner 2026-07-31): committing saves drafts only the
  // operator sees; publishing is the moment clubs and families hear.
  const draftGames = facts.draftGames
  const publishedGames = facts.publishedGames
  steps.push({
    key: "publish",
    title: SEASON_STEP_TITLES.publish,
    state: stateOf("publish"),
    detail:
      scheduleGames.length === 0
        ? "Comes after games are committed (step above)."
        : draftGames === 0
          ? `${publishedGames} game${publishedGames === 1 ? "" : "s"} live for clubs and families`
          : `${draftGames} draft game${draftGames === 1 ? "" : "s"} only you can see. Publishing sends one notification per team circle.`,
    action:
      draftGames > 0 ? jump("publish", "schedule", undefined, "Review & publish") : undefined,
  })

  steps.push({
    key: "start",
    title: SEASON_STEP_TITLES.start,
    state: stateOf("start"),
    detail: reached("IN_PROGRESS")
      ? undefined
      : status === "FINALIZED"
        ? scheduleDone
          ? "Everything's in place. Start when the first games are ready."
          : "You can start now, but no games are committed yet (step above)."
        : "Comes after the season is finalized.",
    action: status === "FINALIZED" ? advance("start", "IN_PROGRESS", "Start season") : undefined,
  })

  steps.push({
    key: "playoffs",
    title: SEASON_STEP_TITLES.playoffs,
    state: stateOf("playoffs"),
    detail:
      (bracketCount ?? 0) > 0
        ? `${bracketCount} bracket${bracketCount === 1 ? "" : "s"}`
        : !reached("IN_PROGRESS")
          ? "Comes once the season is underway."
          : facts.completedGames === 0
            ? "Blocked: no completed games yet. Seeds and eligibility come from played games."
            : "Standings have data. Generate brackets per division.",
    action:
      (bracketCount ?? 0) === 0 && reached("IN_PROGRESS") && facts.completedGames > 0
        ? jump("playoffs", "playoffs", undefined, "Generate")
        : undefined,
  })

  steps.push({
    key: "complete",
    title: SEASON_STEP_TITLES.complete,
    state: stateOf("complete"),
    detail:
      status === "COMPLETED"
        ? undefined
        : status === "IN_PROGRESS"
          ? "Wraps up the season. Results and standings lock in and stay browsable."
          : "The final step.",
    action:
      status === "IN_PROGRESS"
        ? advance("complete", "COMPLETED", "Mark completed", "ink")
        : undefined,
  })

  return (
    <div id="season-checklist" className={`reveal ${panelClass} mb-6`}>
      <PanelHeader
        title="Season checklist"
        action={
          <span className="text-ink-500 text-xs font-semibold">
            {summary.done} of {summary.total} done
          </span>
        }
      />
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={`flex flex-wrap items-start justify-between gap-3 rounded-xl px-3 py-2 ${
              s.state === "action"
                ? "bg-play-50 border-play-100 border"
                : s.state === "blocked"
                  ? "bg-amber-50/60"
                  : ""
            }`}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
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

/** Unsized SVG for the kit Button (it sizes the icon per `size`). */
const ARROW_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function StepMark({ state, n }: { state: SeasonStepState; n: number }) {
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
