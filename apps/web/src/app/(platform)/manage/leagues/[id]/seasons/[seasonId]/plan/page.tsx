"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { SmartBack } from "@/components/ui"
import { CalendarStep } from "./calendar-step"
import { GymsWeekendsStep } from "./gyms-weekends-step"
import { PlanSessionProvider } from "./plan-session"
import { BTN_LG, BTN_PRIMARY, BTN_SECONDARY } from "./plan-shared"
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
 * built for real: teams, your buildings, the calendar, publish, and the
 * registration watch screen that opens scheduling.
 *
 * Step 2 stopped being "gyms and weekends" on 2026-08-06: painting a gym onto
 * each Saturday moved to the board, so the step is a roster of buildings and the
 * rail says so.
 */

// Hints carry real apostrophes: they render as JS expressions, not JSX text,
// so react/no-unescaped-entities does not apply and nothing needs escaping.
const STEPS = [
  { n: 1, label: "Teams", hint: "who's coming" },
  { n: 2, label: "Your buildings", hint: "gyms, courts, hours" },
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

  /**
   * THE WALK STARTS AT STEP 1, ALWAYS (owner ruling 2026-08-05, repeated).
   * A launch from outside — the Plan Your Season tab, a bookmark, any link with
   * no explicit ?step= on it — opens on teams, never on the board. Choosing or
   * creating the plan document happens at step 1 too, so the order is: pick the
   * plan, say who is coming, say where and when, then look at the calendar.
   */
  const fromUrl = Number(searchParams?.get("step") ?? "")
  const [step, setStep] = useState(fromUrl >= 1 && fromUrl <= 5 ? fromUrl : 1)
  const [header, setHeader] = useState<PlanHeaderInfo | null>(null)

  /** The plan named in the address, restored by the session below (owner's
   *  2026-08-06 analysis, B1: the URL carries the plan on every step). */
  const planFromUrl = searchParams?.get("plan") ?? null

  /**
   * AND THE STEP IS KEPT IN IT, the same way: a reload lands on the step the
   * operator was standing on, not back at the top of the walk. replaceState,
   * because nothing navigates — the address is simply kept true.
   */
  useEffect(() => {
    const url = new URL(window.location.href)
    if (String(step) === (url.searchParams.get("step") ?? "")) return
    url.searchParams.set("step", String(step))
    window.history.replaceState(window.history.state, "", url)
  }, [step])

  // Whichever step loads first names the season in the page header.
  const onLoaded = useCallback((info: PlanHeaderInfo) => setHeader(info), [])

  const seasonLine = [header?.leagueName, header?.seasonLabel].filter(Boolean).join(" · ")

  /**
   * THE BOARD TAKES THE WHOLE SCREEN (owner ruling 2026-08-04). Step 3 is a
   * five-month calendar with a work rail beside it, so on that step the page
   * drops its own reading width and the app folds its sidebar away.
   *
   * A body attribute rather than a context: the sidebar lives in a server
   * layout two levels up with no client provider between here and there, and
   * one attribute the CSS keys on beats threading state through a layout that
   * every other route shares. It is removed on the way out of the step and on
   * unmount, so no other screen can ever inherit it.
   */
  const wide = step === 3
  useEffect(() => {
    if (!wide) return
    document.body.dataset.plannerStage = "board"
    return () => {
      delete document.body.dataset.plannerStage
    }
  }, [wide])

  return (
    <PlanSessionProvider seasonId={seasonId} initialPlanId={planFromUrl}>
      <div className={wide ? "w-full px-3 py-3" : "mx-auto max-w-5xl px-4 py-6"}>
        {/* The Plan tab is a door straight into this wizard now (owner
            2026-08-07, the double-rail collapse), so falling back to it
            would bounce right back here. Cold entry lands on the season. */}
        <SmartBack
          fallback={`/manage/leagues/${leagueId}/seasons/${seasonId}/manage?tab=overview`}
          fallbackLabel="Back to the season"
        />

        {/* On the board step the title and the step rail share one line, so the
          calendar starts near the top of the screen instead of below a
          letterhead. Everywhere else the page keeps its ordinary heading. */}
        <div className={wide ? "mt-1 flex flex-wrap items-center gap-x-5 gap-y-2" : ""}>
          <div className={wide ? "" : "mt-2"}>
            <h1 className={`text-ink-900 font-bold ${wide ? "text-base" : "text-2xl"}`}>
              Plan your season
            </h1>
            <p className={`text-ink-500 ${wide ? "text-[11.5px]" : "text-sm"}`}>
              {seasonLine || "Five steps: teams, buildings, calendar, publish, schedule."}
            </p>
          </div>

          {/* The rail, always visible. */}
          <ol
            className={`border-ink-100 shadow-soft flex items-center gap-0 overflow-x-auto rounded-2xl border bg-white ${
              wide ? "px-3 py-1.5" : "mt-5 w-full px-5 py-4"
            }`}
          >
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
                      className={`flex flex-none items-center justify-center rounded-full font-bold ${
                        wide ? "h-[22px] w-[22px] text-[11px]" : "h-[26px] w-[26px] text-xs"
                      } ${current ? "bg-court-600 text-white" : "bg-court-100 text-court-700"}`}
                    >
                      {s.n}
                    </span>
                    <span className="text-left">
                      <span
                        className={`block font-semibold ${wide ? "text-[12.5px]" : "text-sm"} ${
                          current ? "text-ink-900" : "text-ink-600"
                        }`}
                      >
                        {s.label}
                      </span>
                      {/* The hint is orientation for somebody arriving; on the
                        board it is a second line of chrome above the work. */}
                      {!wide && <span className="text-ink-400 block text-[11.5px]">{s.hint}</span>}
                    </span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <span
                      className={`bg-ink-200 h-px flex-none ${wide ? "mx-2 w-4" : "mx-3 w-6"}`}
                      aria-hidden
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </div>
        {!wide && (
          <p className="text-ink-400 mt-2.5 px-1 text-xs">
            Going back to edit a step never loses the work after it. It recomputes it.
          </p>
        )}

        <div className={wide ? "mt-3" : "mt-6"}>
          {step === 1 ? (
            <TeamsStep seasonId={seasonId} onLoaded={onLoaded} />
          ) : step === 2 ? (
            <GymsWeekendsStep seasonId={seasonId} onLoaded={onLoaded} onGoToStep={setStep} />
          ) : step === 3 ? (
            <CalendarStep seasonId={seasonId} onLoaded={onLoaded} onGoToStep={setStep} />
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

        {/**
         * ONE WAY FORWARD, ON EVERY STEP (owner ruling 2026-08-06).
         *
         * The rail at the top is for JUMPING — it always was, and it stays — but
         * a five-step wizard also has an order, and the operator finishing a step
         * should not have to go back up and across to take the next one. Both
         * buttons name where they go, because "Next" alone makes somebody guess
         * what they are agreeing to.
         *
         * It rides the bottom of the viewport so it is in reach on the board,
         * which is four months wide and scrolls in both directions.
         */}
        <div
          data-testid="wizard-nav"
          className="border-ink-200 bg-white/95 sticky bottom-0 z-40 mt-4 flex items-center justify-between gap-3 rounded-t-2xl border px-3 py-2 shadow-lg backdrop-blur"
        >
          {step > 1 ? (
            <button
              type="button"
              data-testid="wizard-prev"
              onClick={() => setStep(step - 1)}
              className={`${BTN_SECONDARY} ${BTN_LG} rounded-xl`}
            >
              <span aria-hidden>←</span>
              Back: {STEPS[step - 2].label}
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length ? (
            <button
              type="button"
              data-testid="wizard-next"
              onClick={() => setStep(step + 1)}
              className={`${BTN_PRIMARY} ${BTN_LG} rounded-xl`}
            >
              Next: {STEPS[step].label}
              <span aria-hidden>→</span>
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </PlanSessionProvider>
  )
}
