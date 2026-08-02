import { SectionHeader } from "@/components/ui"
import { buildPlannerState } from "@/lib/scheduler/planner"
import { currentAssignment, seasonCalendarMonths } from "@/lib/scheduler/planner-core"

/**
 * The published season calendar, living on the league's own page (plan
 * wizard step 4, owner-approved mock 2026-08-02): "publishing puts the
 * calendar where clubs and families already look — on the platform it's a
 * living view, not a poster."
 *
 * Same data as the downloadable card, through the same seasonCalendarMonths()
 * — the poster and the page can never disagree. The caller gates on
 * Season.planPublishedAt; this component never renders for an unpublished
 * plan because it is never called for one.
 */
export async function SeasonCalendarSection({ seasonId }: { seasonId: string }) {
  const state = await buildPlannerState(seasonId)
  const months = seasonCalendarMonths(state, currentAssignment(state))
  if (months.length === 0) return null

  return (
    <section id="season-calendar" className="scroll-mt-20">
      <SectionHeader title="Season calendar" accent="court" className="mb-5" />
      <p className="text-ink-500 -mt-2 mb-4 text-xs">
        Which grades play which weekend. Game times land here once the schedule is out.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {months.map((m, i) => (
          <div key={`${m.month}-${i}`} className="border-ink-100 rounded-2xl border bg-white p-4">
            <h3 className="text-ink-400 mb-2.5 text-xs font-bold uppercase tracking-[0.14em]">
              {m.month}
            </h3>
            <ul className="space-y-2.5">
              {m.weekends.map((w) => (
                <li key={w.sessionId}>
                  <p className="text-ink-950 text-sm font-semibold tabular-nums">{w.days}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {w.gradeList.map((g) => (
                      <span
                        key={g}
                        className="bg-court-50 text-court-800 rounded-lg px-1.5 py-0.5 text-[11px] font-bold"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
