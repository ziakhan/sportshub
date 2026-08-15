/**
 * Season progress — ONE derivation of the 13-step season pipeline, shared by
 * the league console's Season checklist (client) and the dashboard command
 * hero (server, 2026-08-14 operator-dashboard rebuild).
 *
 * The checklist owns the copy, the details and the buttons; this module owns
 * the question "is a step done, actionable, blocked or still ahead". It is
 * lifted verbatim from the checklist's own derivation so the hero can never
 * disagree with the list it deep-links into.
 *
 * Pure on purpose: no prisma, no fetch, no JSX — it is imported by a "use
 * client" component and by server components alike. The prisma loader lives
 * in ./season-progress-server.
 */

export const SEASON_STATUS_FLOW = [
  "DRAFT",
  "REGISTRATION",
  "REGISTRATION_CLOSED",
  "FINALIZED",
  "IN_PROGRESS",
  "COMPLETED",
] as const

/** Status wording, shared by the console, the dashboard and My leagues. */
export const SEASON_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  REGISTRATION: "Open for registration",
  REGISTRATION_CLOSED: "Registration closed",
  FINALIZED: "Finalized",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
}

export function seasonStatusLabel(status: string): string {
  return SEASON_STATUS_LABELS[status] ?? status
}

/** The lifecycle statuses that mean "this season is still being built". */
export const SEASON_SETUP_STATUSES = [
  "DRAFT",
  "REGISTRATION",
  "REGISTRATION_CLOSED",
  "FINALIZED",
] as const

export type SeasonStepState = "done" | "action" | "blocked" | "todo" | "optional"

export type SeasonStepKey =
  | "basics"
  | "divisions"
  | "venues"
  | "regconfig"
  | "open"
  | "review"
  | "close"
  | "finalize"
  | "schedule"
  | "publish"
  | "start"
  | "playoffs"
  | "complete"

/** Step titles are user-facing copy — the hero shows the next one by name. */
export const SEASON_STEP_TITLES: Record<SeasonStepKey, string> = {
  basics: "Season basics set",
  divisions: "Divisions created",
  venues: "Venues allocated & sessions built",
  regconfig: "Registration configured",
  open: "Registration opened",
  review: "Clubs & teams reviewed",
  close: "Registration closed",
  finalize: "Season finalized",
  schedule: "Schedule generated",
  publish: "Schedule published",
  start: "Season underway",
  playoffs: "Playoffs generated",
  complete: "Season completed",
}

export const SEASON_STEP_ORDER: SeasonStepKey[] = [
  "basics",
  "divisions",
  "venues",
  "regconfig",
  "open",
  "review",
  "close",
  "finalize",
  "schedule",
  "publish",
  "start",
  "playoffs",
  "complete",
]

export interface SeasonStep {
  key: SeasonStepKey
  title: string
  state: SeasonStepState
}

/** A session is usable when some day has a venue with at least one court. */
export interface SeasonSessionShape {
  days?: Array<{ dayVenues?: Array<{ courts?: unknown[] | null }> | null }> | null
}

export interface SeasonProgressInput {
  /** Season lifecycle status (DRAFT … COMPLETED). */
  status: string
  /** Season basics: dates + the team entry fee. */
  startDate?: unknown
  endDate?: unknown
  teamFee?: unknown
  /** Registration config (either one counts as configured). */
  depositPct?: unknown
  applicationQuestions?: unknown
  /** Finalize preflight inputs. */
  gamesGuaranteed?: unknown
  periodLengthMinutes?: unknown
  tiebreakerOrder?: unknown
  /** Teams-per-division, one entry per division. */
  divisionTeamCounts: number[]
  sessions: SeasonSessionShape[]
  venueCount: number
  /** TeamSubmission statuses for the season. */
  submissionStatuses: string[]
  /** Club entries (level-1 registration) still awaiting a decision. */
  pendingEntries: number
  games: { total: number; draft: number; completed: number }
  /** Playoff brackets already generated (playoff-phase sessions). */
  bracketCount: number
  /** Scheduler supply vs demand, when known. Null = not loaded yet. */
  capacity?: { needed: number; provided: number } | null
}

export interface SeasonFacts {
  status: string
  basicsDone: boolean
  divisionCount: number
  divisionsDone: boolean
  sessionCount: number
  sessionsUsable: boolean
  venueCount: number
  venuesDone: boolean
  regConfigured: boolean
  pendingSubs: number
  approvedSubs: number
  pendingEntries: number
  pendingTotal: number
  thinDivisionCount: number
  scheduleGames: number
  draftGames: number
  publishedGames: number
  completedGames: number
  bracketCount: number
  capacityShort: boolean
  preflight: Array<{ label: string; ok: boolean }>
  canFinalize: boolean
}

export function seasonStatusReached(status: string, target: string): boolean {
  const flow = SEASON_STATUS_FLOW as readonly string[]
  return flow.indexOf(status) >= flow.indexOf(target)
}

/** A session counts once one of its days has a venue with a court on it. */
export function sessionHasUsableDay(session: SeasonSessionShape): boolean {
  return (session.days ?? []).some((day) =>
    (day?.dayVenues ?? []).some((dv) => (dv?.courts ?? []).length > 0)
  )
}

/** Everything the pipeline reads, derived once from the raw season data. */
export function seasonFacts(input: SeasonProgressInput): SeasonFacts {
  const basicsDone = !!input.startDate && !!input.endDate && input.teamFee != null
  const divisionCount = input.divisionTeamCounts.length
  const divisionsDone = divisionCount > 0
  const sessionCount = input.sessions.length
  const sessionsUsable = sessionCount > 0 && input.sessions.every(sessionHasUsableDay)
  const venuesDone = input.venueCount > 0 && sessionsUsable
  const regConfigured =
    input.depositPct != null ||
    (Array.isArray(input.applicationQuestions) && input.applicationQuestions.length > 0)

  const pendingSubs = input.submissionStatuses.filter((s) => s === "PENDING").length
  const approvedSubs = input.submissionStatuses.filter((s) => s === "APPROVED").length
  const pendingTotal = pendingSubs + input.pendingEntries
  const thinDivisionCount = input.divisionTeamCounts.filter((n) => n < 2).length
  const capacityShort = !!input.capacity && input.capacity.provided < input.capacity.needed

  const preflight = [
    { label: "At least one division created", ok: divisionsDone },
    { label: "At least one game session scheduled", ok: sessionCount > 0 },
    { label: "Every session has a day with venue + court", ok: sessionsUsable },
    { label: "At least one venue assigned", ok: input.venueCount > 0 },
    { label: "No teams pending approval", ok: pendingSubs === 0 },
    { label: "Max games per season defined", ok: !!input.gamesGuaranteed },
    { label: "Period / half length defined", ok: !!input.periodLengthMinutes },
    {
      label: "Tiebreaker order configured",
      ok: Array.isArray(input.tiebreakerOrder) && input.tiebreakerOrder.length > 0,
    },
  ]

  return {
    status: input.status,
    basicsDone,
    divisionCount,
    divisionsDone,
    sessionCount,
    sessionsUsable,
    venueCount: input.venueCount,
    venuesDone,
    regConfigured,
    pendingSubs,
    approvedSubs,
    pendingEntries: input.pendingEntries,
    pendingTotal,
    thinDivisionCount,
    scheduleGames: input.games.total,
    draftGames: input.games.draft,
    publishedGames: input.games.total - input.games.draft,
    completedGames: input.games.completed,
    bracketCount: input.bracketCount,
    capacityShort,
    preflight,
    canFinalize: preflight.every((c) => c.ok),
  }
}

/** The 13 steps with their state, in pipeline order. */
export function deriveSeasonSteps(f: SeasonFacts): SeasonStep[] {
  const reached = (s: string) => seasonStatusReached(f.status, s)
  const openGateBlocked = !f.basicsDone || !f.divisionsDone
  // The schedule step's own blockers, minus the "must be finalized" one the
  // status test below already covers.
  const scheduleDataBlocked = f.thinDivisionCount > 0 || f.capacityShort

  const state: Record<SeasonStepKey, SeasonStepState> = {
    basics: f.basicsDone ? "done" : "action",
    divisions: f.divisionsDone ? "done" : "action",
    venues: f.venuesDone ? "done" : "action",
    regconfig: f.regConfigured ? "done" : "optional",
    open: reached("REGISTRATION") ? "done" : openGateBlocked ? "blocked" : "action",
    review: !reached("REGISTRATION") ? "todo" : f.pendingTotal === 0 ? "done" : "action",
    close: reached("REGISTRATION_CLOSED")
      ? "done"
      : f.status !== "REGISTRATION"
        ? "todo"
        : f.pendingTotal > 0
          ? "blocked"
          : "action",
    finalize: reached("FINALIZED")
      ? "done"
      : f.status !== "REGISTRATION_CLOSED"
        ? "todo"
        : f.canFinalize
          ? "action"
          : "blocked",
    schedule:
      f.scheduleGames > 0
        ? "done"
        : reached("FINALIZED") && !scheduleDataBlocked
          ? "action"
          : reached("REGISTRATION_CLOSED")
            ? "blocked"
            : "todo",
    publish:
      f.scheduleGames > 0 && f.draftGames === 0 ? "done" : f.draftGames > 0 ? "action" : "todo",
    start: reached("IN_PROGRESS") ? "done" : f.status === "FINALIZED" ? "action" : "todo",
    playoffs:
      f.bracketCount > 0
        ? "done"
        : !reached("IN_PROGRESS")
          ? "todo"
          : f.completedGames === 0
            ? "blocked"
            : "action",
    complete: f.status === "COMPLETED" ? "done" : f.status === "IN_PROGRESS" ? "action" : "todo",
  }

  return SEASON_STEP_ORDER.map((key) => ({
    key,
    title: SEASON_STEP_TITLES[key],
    state: state[key],
  }))
}

export interface SeasonProgressSummary {
  done: number
  total: number
  /** The one thing to do next: the first actionable step, else the first
   *  blocked one, else the first step still ahead. Optional steps never
   *  become "next" — they are nice-to-have, not a gate. */
  next: SeasonStep | null
  steps: SeasonStep[]
}

export function summarizeSeasonProgress(steps: SeasonStep[]): SeasonProgressSummary {
  const next =
    steps.find((s) => s.state === "action") ??
    steps.find((s) => s.state === "blocked") ??
    steps.find((s) => s.state === "todo") ??
    null
  return {
    done: steps.filter((s) => s.state === "done").length,
    total: steps.length,
    next,
    steps,
  }
}

/** One call: raw season data in, progress summary out. */
export function seasonProgress(input: SeasonProgressInput): SeasonProgressSummary {
  return summarizeSeasonProgress(deriveSeasonSteps(seasonFacts(input)))
}
