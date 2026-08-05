"use client"

import { Suspense, useCallback, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { SmartBack } from "@/components/ui"
import { CalendarStep } from "./calendar-step"
import { GymsWeekendsStep } from "./gyms-weekends-step"
import { PublishStep } from "./publish-step"
import { ScheduleStep } from "./schedule-step"
import { TeamsStep, type PlanHeaderInfo } from "./teams-step"

/**
 * Plan your season (owner-approved mock, 2026-08-02). One guided flow that
 * mirrors how a league operator already works: confirm what we already know,
 * answer the one thing we cannot know, get the calendar, publish, then
 * schedule when registration locks.
 *
 * The rail is always visible and every step stays clickable, because after
 * setup these same five steps become the season's home page. All five are
 * built for real: teams, gyms and weekends, the calendar, publish, and the
 * registration watch screen that opens scheduling.
 */

// Hints carry real apostrophes: they render as JS expressions, not JSX text,
// so react/no-unescaped-entities does not apply and nothing needs escaping.
const STEPS = [
  { n: 1, label: "Teams", hint: "who's coming" },
  { n: 2, label: "Gyms & weekends", hint: "where and when" },
  { n: 3, label: "Your calendar", hint: "we compute it" },
  { n: 4, label: "Publish", hint: "post the card" },
  { n: 5, label: "Schedule", hint: "when you're ready" },
] as const

// useSearchParams requires a Suspense boundary in Next 14 (same pattern as
// manage/leagues/[id]/page.tsx).
export default function SeasonPlanWizardPage() {
  return (
    <Suspense fallback={<div className="text-ink-500 p-6 py-12 text-center">Loading…</div>}>
      <PlanWizard />
    </Suspense>
  )
}

function PlanWizard() {
  const params = useParams()
  const searchParams = useSearchParams()
  const leagueId = params?.id as string
  const seasonId = params?.seasonId as string

  const fromUrl = Number(searchParams?.get("step") ?? "")
  const [step, setStep] = useState(fromUrl >= 1 && fromUrl <= 5 ? fromUrl : 1)
  const [header, setHeader] = useState<PlanHeaderInfo | null>(null)

  // Whichever step loads first names the season in the page header.
  const onLoaded = useCallback((info: PlanHeaderInfo) => setHeader(info), [])

  const seasonLine = [header?.leagueName, header?.seasonLabel].filter(Boolean).join(" · ")

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <SmartBack
        fallback={`/manage/leagues/${leagueId}/seasons/${seasonId}/manage?tab=plan`}
        fallbackLabel="Back to Plan Your Season"
      />

      <div className="mt-2">
        <h1 className="text-ink-900 text-2xl font-bold">Plan your season</h1>
        <p className="text-ink-500 text-sm">
          {seasonLine || "Five steps: teams, gyms, calendar, publish, schedule."}
        </p>
      </div>

      {/* The rail, always visible. */}
      <ol className="border-ink-100 shadow-soft mt-5 flex items-center gap-0 overflow-x-auto rounded-2xl border bg-white px-5 py-4">
        {STEPS.map((s, i) => {
          // Every step is a real screen now, so the only distinction the rail
          // draws is the one the operator is standing on.
          const current = s.n === step
          return (
            <li key={s.n} className="flex flex-none items-center">
              <button
                type="button"
                onClick={() => setStep(s.n)}
                className="brand-focus flex cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl px-1 py-1"
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-xs font-bold ${
                    current ? "bg-court-600 text-white" : "bg-court-100 text-court-700"
                  }`}
                >
                  {s.n}
                </span>
                <span className="text-left">
                  <span
                    className={`block text-sm font-semibold ${
                      current ? "text-ink-900" : "text-ink-600"
                    }`}
                  >
                    {s.label}
                  </span>
                  <span className="text-ink-400 block text-[11.5px]">{s.hint}</span>
                </span>
              </button>
              {i < STEPS.length - 1 && <span className="bg-ink-200 mx-3 h-px w-6 flex-none" aria-hidden />}
            </li>
          )
        })}
      </ol>
      <p className="text-ink-400 mt-2.5 px-1 text-xs">
        Going back to edit a step never loses the work after it. It recomputes it.
      </p>

      <div className="mt-6">
        {step === 1 ? (
          <TeamsStep seasonId={seasonId} onLoaded={onLoaded} />
        ) : step === 2 ? (
          <GymsWeekendsStep seasonId={seasonId} onLoaded={onLoaded} />
        ) : step === 3 ? (
          <CalendarStep seasonId={seasonId} onLoaded={onLoaded} />
        ) : step === 4 ? (
          <PublishStep seasonId={seasonId} onLoaded={onLoaded} onGoToStep={setStep} />
        ) : (
          <ScheduleStep
            seasonId={seasonId}
            leagueId={leagueId}
            onLoaded={onLoaded}
            onGoToStep={setStep}
          />
        )}
      </div>
    </div>
  )
}
