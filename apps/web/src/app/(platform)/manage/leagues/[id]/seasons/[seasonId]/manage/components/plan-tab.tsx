"use client"

import Link from "next/link"
import { format } from "date-fns"
import { Badge, Button, PanelHeader } from "@/components/ui"
import { panelClass } from "./types"

/**
 * Plan your season (owner ruling 2026-08-02): planning is its own tab beside
 * Schedule, not something buried inside it. "I want the whole planning and
 * scheduling to be a flow and you should be able to pause it and then
 * continue based on the plan and make tweaks."
 *
 * So this tab is deliberately NOT a second wizard. It is the flow's home
 * screen: where the season stands right now, one place to resume, and the
 * two or three numbers that say whether the plan still matches reality.
 *
 * Five stages, exactly one "you are here". Every stage is derived from data
 * on every render, the same way the season checklist works, so pausing for a
 * month and coming back always lands on the truth. Nothing is stored.
 *
 * Distinct from the season checklist on Overview: the checklist is the whole
 * season's 12-step operating pipeline (and the only place season status
 * changes). This rail covers ONE arc, plan to live, and its only job is to
 * hand back the thread the operator dropped.
 */

/** The rail, in order. Each stage owns a wizard step so "continue" is real. */
const STAGES = [
  { key: "plan", label: "Plan", hint: "teams, gyms, calendar" },
  { key: "publish", label: "Publish", hint: "post the calendar" },
  { key: "watch", label: "Watch registration", hint: "teams sign up" },
  { key: "schedule", label: "Schedule", hint: "games on the board" },
  { key: "live", label: "Live", hint: "the season runs" },
] as const

type StageState = "done" | "current" | "upcoming"

export function PlanTab({
  leagueId,
  seasonId,
  league,
  divisions,
  sessions,
  scheduleGames,
  onGoToTab,
}: {
  leagueId: string
  seasonId: string
  league: any
  divisions: any[]
  sessions: any[]
  scheduleGames: any[]
  onGoToTab: (tab: string) => void
}) {
  const planHref = (step: number) =>
    `/manage/leagues/${leagueId}/seasons/${seasonId}/plan?step=${step}`

  // --- The facts the stages are derived from ---------------------------
  // All of it comes from what the console already loaded: no extra fetch, no
  // buildPlannerState (which is heavy and returns nothing before teams are
  // approved, exactly when this tab matters most).

  // Step 1's output: the operator's pre-registration estimate per grade.
  const gradesTotal = divisions.length
  const gradesEstimated = divisions.filter((d: any) => (d.expectedTeams ?? 0) > 0).length
  const estimatedTeams = divisions.reduce((sum: number, d: any) => sum + (d.expectedTeams ?? 0), 0)

  // Step 2's output: a weekend "has a gym" when one of its days has a venue
  // with at least one court wired in. Same test the season checklist uses,
  // and the same attachment the gyms-and-weekends grid writes.
  const regularSessions = sessions.filter((s: any) => (s.phase ?? "REGULAR") === "REGULAR")
  const weekendsTotal = regularSessions.length
  const weekendsWithGym = regularSessions.filter((s: any) =>
    (s.days ?? []).some((d: any) =>
      (d.dayVenues ?? []).some((dv: any) => (dv.courts ?? []).length > 0)
    )
  ).length

  const publishedAt: string | null = league?.planPublishedAt ?? null
  const status: string = league?.leagueStatus ?? "DRAFT"
  const submissions: any[] = league?.teams ?? []
  const approvedTeams = submissions.filter((t: any) => t.status === "APPROVED").length
  const gamesTotal = scheduleGames.length
  // "Live" starts the moment a game stops being a plan: tip-off or a final.
  const gamesPlayed = scheduleGames.filter(
    (g: any) => g.status === "LIVE" || g.status === "COMPLETED"
  ).length

  // --- Stage states -----------------------------------------------------
  const raw = [
    gradesEstimated > 0 && weekendsWithGym > 0, // Plan
    !!publishedAt, // Publish
    !!publishedAt && submissions.length > 0, // Watch registration
    gamesTotal > 0, // Schedule
    gamesPlayed > 0, // Live
  ]
  // A later stage proves the earlier ones, even when they were never done
  // here (a season scheduled before this tab existed has no saved plan but
  // is obviously past planning). Otherwise the rail would send an operator
  // mid-season back to step 1.
  const done = raw.map((_, i) => raw.slice(i).some(Boolean))
  const firstOpen = done.findIndex((d) => !d)
  const currentIndex = firstOpen === -1 ? STAGES.length - 1 : firstOpen

  const stageState = (i: number): StageState =>
    i === currentIndex ? "current" : done[i] ? "done" : "upcoming"

  // Where "continue" drops you: the first step whose work is missing.
  // Step 1 when no grade carries an estimate, step 2 when no weekend has a
  // gym on it, otherwise step 3, which is where the calendar gets kept.
  const resumeStep = gradesEstimated === 0 ? 1 : weekendsWithGym === 0 ? 2 : 3
  const planStarted = gradesEstimated > 0 || weekendsWithGym > 0

  // --- What the current stage asks of you -------------------------------
  const stage = STAGES[currentIndex].key
  let headline = ""
  let detail = ""
  let primary: { label: string; href?: string; onClick?: () => void } = { label: "" }
  const secondary: Array<{ label: string; href?: string; onClick?: () => void }> = []

  if (stage === "plan") {
    headline = planStarted ? "Pick up where you left off" : "Nothing planned yet"
    detail = planStarted
      ? gradesEstimated === 0
        ? "Your gyms are in. Say how many teams you expect in each grade and the calendar can size itself."
        : weekendsWithGym === 0
          ? "Your team estimates are saved. Next, choose which gyms run on which weekends."
          : "Your teams and gyms are in. Step 3 turns them into the season calendar."
      : "Start with how many teams you expect in each grade. Everything after that is computed, and you can change it later."
    primary = { label: planStarted ? "Continue planning" : "Start planning", href: planHref(resumeStep) }
    if (planStarted) secondary.push({ label: "Open the plan from the top", href: planHref(1) })
  } else if (stage === "publish") {
    headline = "Your calendar is ready to post"
    detail =
      "Publishing puts the weekend calendar on the public season page, so clubs and families can see the dates before they commit."
    primary = { label: "Publish your plan", href: planHref(4) }
    secondary.push({ label: "Review the calendar first", href: planHref(3) })
  } else if (stage === "watch") {
    headline = "Your plan is public"
    detail =
      status === "DRAFT" || status === "REGISTRATION"
        ? "Teams register against these dates. Registration status lives on the season checklist under Overview."
        : "Teams are in against these dates. Tweak the plan any time before you generate games."
    primary = { label: "Watch registration", href: planHref(5) }
    secondary.push({ label: "Open your published plan", href: planHref(4) })
    if (status === "DRAFT") secondary.push({ label: "Season checklist", onClick: () => onGoToTab("overview") })
  } else if (stage === "schedule") {
    headline = "Ready to turn the plan into games"
    detail =
      "The generator uses the plan you kept. Anything the plan got wrong you can still fix here first."
    primary = { label: "Generate the schedule", href: planHref(5) }
    secondary.push({ label: "Open your published plan", href: planHref(publishedAt ? 4 : 3) })
  } else {
    headline = gamesPlayed > 0 ? "The season is running" : "Games are on the board"
    detail =
      gamesPlayed > 0
        ? `${gamesPlayed} game${gamesPlayed === 1 ? " has" : "s have"} tipped off. Changes from here belong on the schedule, not the plan.`
        : "Every game is committed. Publishing, edits and rescheduling all live on the Schedule tab."
    primary = { label: "See the schedule", onClick: () => onGoToTab("schedule") }
    if (publishedAt) secondary.push({ label: "Open your published plan", href: planHref(4) })
  }

  // --- The quiet facts under the rail -----------------------------------
  const facts: string[] = []
  if (gradesTotal > 0) {
    facts.push(
      `Grades estimated: ${gradesEstimated} of ${gradesTotal}${
        estimatedTeams > 0 ? ` (${estimatedTeams} teams expected)` : ""
      }`
    )
  }
  facts.push(
    weekendsTotal === 0
      ? "Weekends with a gym: none set up yet"
      : `Weekends with a gym: ${weekendsWithGym} of ${weekendsTotal}`
  )
  if (publishedAt) {
    facts.push(`Plan published ${format(new Date(publishedAt), "MMM d, yyyy")}`)
  }
  if (submissions.length > 0 || estimatedTeams > 0) {
    // The registered-vs-estimated comparison is only honest when every grade
    // carries an estimate. Half-estimated seasons would read as "145 approved
    // against 20 estimated", which compares 22 grades of reality to 2 of plan.
    const allEstimated = gradesTotal > 0 && gradesEstimated === gradesTotal
    facts.push(
      `Teams registered: ${approvedTeams} approved${
        allEstimated ? ` against ${estimatedTeams} estimated` : ""
      }`
    )
  }

  return (
    <div className={`reveal ${panelClass}`}>
      <PanelHeader
        title="Plan your season"
        action={
          <Badge tone={currentIndex === STAGES.length - 1 && done[4] ? "court" : "play"}>
            {STAGES[currentIndex].label}
          </Badge>
        }
      />
      <p className="text-ink-600 max-w-2xl text-sm">
        Planning and scheduling are one flow. Stop whenever you like, come back, and pick up from
        the plan you already saved.
      </p>

      {/* The rail. Every stage stays clickable, because after setup this is
          how the operator navigates back into the flow. */}
      <ol
        data-testid="plan-tab-rail"
        className="border-ink-100 bg-ink-50/50 mt-4 flex items-center gap-0 overflow-x-auto rounded-2xl border px-4 py-3"
      >
        {STAGES.map((s, i) => {
          const state = stageState(i)
          const inner = (
            <>
              <span
                className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[11px] font-bold ${
                  state === "current"
                    ? "bg-play-600 text-white"
                    : state === "done"
                      ? "bg-court-100 text-court-700"
                      : "bg-ink-100 text-ink-500"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className="text-left">
                <span
                  className={`block text-[13px] font-semibold ${
                    state === "current"
                      ? "text-ink-900"
                      : state === "done"
                        ? "text-ink-400"
                        : "text-ink-500"
                  }`}
                >
                  {s.label}
                </span>
                <span className="text-ink-400 block text-[11px]">{s.hint}</span>
              </span>
            </>
          )
          const cls =
            "brand-focus flex items-center gap-2 whitespace-nowrap rounded-xl px-1.5 py-1 hover:bg-white"
          return (
            <li key={s.key} className="flex flex-none items-center">
              {s.key === "live" ? (
                <button
                  type="button"
                  className={cls}
                  aria-current={state === "current" ? "step" : undefined}
                  onClick={() => onGoToTab("schedule")}
                >
                  {inner}
                </button>
              ) : (
                <Link
                  href={planHref(s.key === "plan" ? resumeStep : s.key === "publish" ? 4 : 5)}
                  className={cls}
                  aria-current={state === "current" ? "step" : undefined}
                >
                  {inner}
                </Link>
              )}
              {i < STAGES.length - 1 && (
                <span className="bg-ink-200 mx-2 h-px w-4 flex-none" aria-hidden />
              )}
            </li>
          )
        })}
      </ol>

      {/* The one thing to do next. */}
      <div className="border-play-100 bg-play-50 mt-4 rounded-2xl border p-4">
        <p className="text-ink-900 text-sm font-semibold">{headline}</p>
        <p className="text-ink-600 mt-1 max-w-2xl text-xs">{detail}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* The kit Button takes no arbitrary attributes, so the test hook
              rides on a shrink-wrapped span around it. */}
          <span data-testid="plan-tab-cta" className="inline-flex">
            {primary.href ? (
              <Button href={primary.href} tone="play" size="sm">
                {primary.label}
              </Button>
            ) : (
              <Button onClick={primary.onClick} tone="play" size="sm">
                {primary.label}
              </Button>
            )}
          </span>
          {secondary.map((a) =>
            a.href ? (
              <Link
                key={a.label}
                href={a.href}
                className="text-play-600 hover:text-play-700 text-xs font-semibold"
              >
                {a.label} &rarr;
              </Link>
            ) : (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className="text-play-600 hover:text-play-700 text-xs font-semibold"
              >
                {a.label} &rarr;
              </button>
            )
          )}
        </div>
      </div>

      <ul className="text-ink-500 mt-4 space-y-1 text-xs">
        {facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  )
}
