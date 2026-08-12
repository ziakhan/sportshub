"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { Button, PanelHeader } from "@/components/ui"

/**
 * The Schedule tab's PLAN DOOR (owner-approved design 2026-08-10):
 * Schedule is always driven by exactly one named plan. With none chosen the
 * tab asks — "Which plan drives this schedule?" — offering the operator's
 * real plans, a one-dialog QUICK SETUP for the league that just wants games
 * on a calendar (creates a real plan behind the scenes, no estimates, real
 * registrations), and the full planner for the league that wants capacity
 * math. With one chosen, the header always answers "where am I":
 * Built on plan X, change. The journey strip shows the whole road.
 */

interface PlanRowLite {
  id: string
  name: string
  source: string
  isActive: boolean
}

export function usePlanDoor(seasonId: string) {
  const [plans, setPlans] = useState<PlanRowLite[] | null>(null)
  const load = useCallback(async () => {
    const res = await fetch(`/api/seasons/${seasonId}/plans`).catch(() => null)
    if (res?.ok) setPlans(((await res.json()).plans ?? []) as PlanRowLite[])
    else setPlans([])
  }, [seasonId])
  useEffect(() => {
    void load()
  }, [load])
  const active = (plans ?? []).find((p) => p.isActive) ?? null
  return { plans, active, loading: plans === null, reload: load }
}

/* ------------------------------ journey strip ------------------------------ */

const STAGES = ["Plan", "Divisions", "Generate", "Publish"] as const

export function JourneyStrip({ stage }: { stage: number }) {
  return (
    <div data-testid="journey-strip" className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
      {STAGES.map((label, i) => (
        <span key={label} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-ink-300">→</span>}
          <span
            className={`rounded-full border px-2.5 py-0.5 ${
              i < stage
                ? "border-court-200 bg-court-50 text-court-700"
                : i === stage
                  ? "border-play-600 bg-play-600 text-white"
                  : "border-ink-200 bg-ink-50 text-ink-400"
            }`}
          >
            {i < stage ? "✓ " : ""}
            {label}
          </span>
        </span>
      ))}
    </div>
  )
}

/* -------------------------------- the door -------------------------------- */

export function PlanDoor({
  seasonId,
  leagueId,
  plans,
  onChosen,
}: {
  seasonId: string
  leagueId: string
  plans: PlanRowLite[]
  onChosen: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const real = plans.filter((p) => p.source !== "imported")

  const useplan = async (id: string) => {
    setBusy(id)
    setError(null)
    const res = await fetch(`/api/seasons/${seasonId}/plans/${id}/activate`, { method: "POST" }).catch(
      () => null
    )
    setBusy(null)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      setError(data?.error ?? "That didn't work. Try again.")
      return
    }
    onChosen()
  }

  return (
    <div className="border-play-200 bg-play-50/60 mb-4 rounded-2xl border p-4">
      <PanelHeader title="Which plan drives this schedule?" />
      <p className="text-ink-600 -mt-2 text-xs">
        The schedule is built from one plan: its gyms, weekends and hours. Pick one, set up in two
        minutes, or plan it properly first.
      </p>
      {real.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {real.map((p) => (
            <div
              key={p.id}
              className="border-ink-200 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2"
            >
              <span className="text-ink-900 text-sm font-semibold">{p.name}</span>
              <Button size="sm" onClick={() => void useplan(p.id)} disabled={busy !== null}>
                {busy === p.id ? "Choosing…" : "Use this plan"}
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setQuickOpen(true)}>
          Quick setup: gym, dates, go
        </Button>
        <Link
          href={`/manage/leagues/${leagueId}/seasons/${seasonId}/plan`}
          className="text-play-700 hover:text-play-800 text-xs font-semibold"
        >
          Plan it properly (capacity, scenarios) →
        </Link>
      </div>
      {error && <p className="text-hoop-700 mt-2 text-xs font-semibold">{error}</p>}
      {quickOpen && (
        <QuickSetupDialog
          seasonId={seasonId}
          onClose={() => setQuickOpen(false)}
          onDone={onChosen}
        />
      )}
    </div>
  )
}

/* ------------------------------- quick setup ------------------------------- */

interface VenueLite {
  venueId: string
  name: string
  courtIds: string[]
}

interface WeekendChoice {
  date: string
  twoDays: boolean
}

export function QuickSetupDialog({
  seasonId,
  onClose,
  onDone,
}: {
  seasonId: string
  onClose: () => void
  onDone: () => void
}) {
  const [venues, setVenues] = useState<VenueLite[] | null>(null)
  const [chosenVenues, setChosenVenues] = useState<Record<string, boolean>>({})
  const [weekends, setWeekends] = useState<WeekendChoice[]>([{ date: "", twoDays: true }])
  const [start, setStart] = useState("09:00")
  const [end, setEnd] = useState("17:00")
  const [gamesPerTeam, setGamesPerTeam] = useState(8)
  /**
   * The Fridays declaration (owner design 2026-08-11, QA T-018): "Can games
   * run on Fridays?" Default No — nobody likes Fridays (work, school,
   * travel); capacity pressure is the only honest reason, so the engine never
   * fills a Friday that Sat+Sun could absorb. Prefilled with the season's
   * current answer so quick setup never silently clears an earlier Yes.
   */
  const [fridayPolicy, setFridayPolicy] = useState<"IF_NEEDED" | "REGULAR" | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/seasons/${seasonId}/venues`).catch(() => null)
      const data = res?.ok ? await res.json() : null
      const rows = (data?.venues ?? data ?? []) as any[]
      setVenues(
        rows.map((sv: any) => ({
          venueId: sv.venue?.id ?? sv.venueId,
          name: sv.venue?.name ?? "Gym",
          courtIds: (sv.venue?.courtList ?? []).map((c: any) => c.id),
        }))
      )
      const seasonRes = await fetch(`/api/seasons/${seasonId}`).catch(() => null)
      const seasonData = seasonRes?.ok ? await seasonRes.json() : null
      const declared = seasonData?.season?.fridayPolicy ?? seasonData?.fridayPolicy ?? null
      if (declared === "IF_NEEDED" || declared === "REGULAR") setFridayPolicy(declared)
    })()
  }, [seasonId])

  const chosen = (venues ?? []).filter((v) => chosenVenues[v.venueId])
  const validWeekends = weekends.filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w.date))
  const ready = chosen.length > 0 && validWeekends.length > 0 && start < end && gamesPerTeam > 0

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      // The Fridays declaration lands on the SEASON first (owner design
      // 2026-08-11, QA T-018), so the plan created below inherits it and the
      // draw obeys it from the first solve.
      const declareRes = await fetch(`/api/seasons/${seasonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fridayPolicy }),
      })
      if (!declareRes.ok) {
        const data = await declareRes.json().catch(() => null)
        throw new Error(data?.error ?? "Couldn't save the Fridays answer.")
      }
      const perWeekend = Math.max(1, Math.min(10, Math.ceil(gamesPerTeam / validWeekends.length)))
      for (const [i, w] of validWeekends.entries()) {
        const dates = [w.date]
        if (w.twoDays) {
          const d = new Date(`${w.date}T12:00:00Z`)
          d.setUTCDate(d.getUTCDate() + 1)
          dates.push(d.toISOString().slice(0, 10))
        }
        const res = await fetch(`/api/seasons/${seasonId}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: `Weekend ${i + 1}`,
            days: dates.map((date) => ({ date, startTime: start, endTime: end })),
            venues: chosen.map((v) => ({ venueId: v.venueId, courtIds: v.courtIds })),
            targetGamesPerTeam: perWeekend,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error ?? `Couldn't book weekend ${i + 1}.`)
        }
      }
      const label = new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric" })
      const planRes = await fetch(`/api/seasons/${seasonId}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Quick setup · ${label}` }),
      })
      const planData = await planRes.json().catch(() => null)
      if (!planRes.ok || !planData?.plan?.id) throw new Error(planData?.error ?? "Couldn't save the plan.")
      const act = await fetch(`/api/seasons/${seasonId}/plans/${planData.plan.id}/activate`, {
        method: "POST",
      })
      if (!act.ok) {
        const data = await act.json().catch(() => null)
        throw new Error(data?.error ?? "Couldn't make it the scheduling plan.")
      }
      onDone()
    } catch (e: any) {
      setBusy(false)
      setError(e?.message ?? "That didn't work. Try again.")
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-start justify-center p-4 pt-[6vh]">
        <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
          <p className="text-ink-900 text-sm font-semibold">Quick setup</p>
          <p className="text-ink-500 mt-0.5 text-xs">
            Where, when, how much. Your registered teams do the rest. This becomes a real plan you
            can open in the planner later.
          </p>

          <p className="text-ink-800 mt-4 text-sm font-semibold">Where do you play?</p>
          {venues === null ? (
            <p className="text-ink-400 mt-1 text-xs">Loading your gyms…</p>
          ) : venues.length === 0 ? (
            <p className="text-hoop-700 mt-1 text-xs">
              No gyms are linked to this season yet — add one under Settings › Venues first.
            </p>
          ) : (
            <div className="mt-1.5 space-y-1.5">
              {venues.map((v) => (
                <label
                  key={v.venueId}
                  className="border-ink-200 bg-ink-50 hover:border-play-400 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!!chosenVenues[v.venueId]}
                    onChange={(e) =>
                      setChosenVenues((c) => ({ ...c, [v.venueId]: e.target.checked }))
                    }
                  />
                  <span className="text-ink-900 font-semibold">{v.name}</span>
                  <span className="text-ink-500 text-xs">· {v.courtIds.length || 1} court{v.courtIds.length === 1 ? "" : "s"}</span>
                </label>
              ))}
            </div>
          )}

          <p className="text-ink-800 mt-4 text-sm font-semibold">When?</p>
          <div className="mt-1.5 space-y-1.5">
            {weekends.map((w, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  aria-label={`Weekend ${i + 1} date`}
                  className="border-ink-200 bg-ink-50 rounded-lg border px-2 py-1 text-sm"
                  value={w.date}
                  onChange={(e) =>
                    setWeekends((ws) => ws.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))
                  }
                />
                <div className="border-ink-200 inline-flex overflow-hidden rounded-lg border text-xs">
                  {[
                    { v: false, label: "One day" },
                    { v: true, label: "Sat + Sun" },
                  ].map((o) => (
                    <button
                      key={String(o.v)}
                      type="button"
                      aria-pressed={w.twoDays === o.v}
                      onClick={() =>
                        setWeekends((ws) => ws.map((x, j) => (j === i ? { ...x, twoDays: o.v } : x)))
                      }
                      className={`px-2 py-1 font-semibold ${
                        w.twoDays === o.v ? "bg-play-600 text-white" : "text-ink-600 bg-white"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {weekends.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove weekend ${i + 1}`}
                    onClick={() => setWeekends((ws) => ws.filter((_, j) => j !== i))}
                    className="text-ink-400 hover:text-ink-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setWeekends((ws) => [...ws, { date: "", twoDays: true }])}
              className="text-play-700 hover:text-play-800 text-xs font-semibold"
            >
              + Add a weekend
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="text-sm">
              <span className="text-ink-800 mr-2 font-semibold">Hours</span>
              <input
                type="time"
                aria-label="Start time"
                className="border-ink-200 bg-ink-50 rounded-lg border px-2 py-1 text-sm"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <span className="text-ink-500 mx-1">to</span>
              <input
                type="time"
                aria-label="End time"
                className="border-ink-200 bg-ink-50 rounded-lg border px-2 py-1 text-sm"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-ink-800 mr-2 font-semibold">Games per team</span>
              <input
                type="number"
                min={1}
                max={40}
                aria-label="Games per team"
                className="border-ink-200 bg-ink-50 w-16 rounded-lg border px-2 py-1 text-sm"
                value={gamesPerTeam}
                onChange={(e) => setGamesPerTeam(Number(e.target.value))}
              />
            </label>
          </div>

          {/* THE FRIDAYS QUESTION (owner design 2026-08-11, QA T-018): one
              question, default No, one follow-up choice on Yes. */}
          <div className="mt-4" data-testid="quick-friday-declaration">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-ink-800 text-sm font-semibold">Can games run on Fridays?</p>
              <div className="border-ink-200 inline-flex overflow-hidden rounded-lg border text-xs">
                {[
                  { v: null, label: "No" },
                  { v: "IF_NEEDED" as const, label: "Yes" },
                ].map((o) => {
                  const active = o.v === null ? fridayPolicy === null : fridayPolicy !== null
                  return (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={active}
                      data-testid={o.v === null ? "quick-friday-no" : "quick-friday-yes"}
                      onClick={() => setFridayPolicy(o.v)}
                      className={`px-3 py-1 font-semibold ${
                        active ? "bg-play-600 text-white" : "text-ink-600 bg-white"
                      }`}
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {fridayPolicy !== null && (
              <div className="mt-2 space-y-1.5">
                {[
                  {
                    v: "IF_NEEDED" as const,
                    label: "Only when a weekend can't fit otherwise",
                    detail: "Saturday and Sunday fill first. A Friday evening is used only where a weekend would run out of room.",
                  },
                  {
                    v: "REGULAR" as const,
                    label: "Fridays are regular game days",
                    detail: "Friday evenings count as normal capacity in the draw.",
                  },
                ].map((o) => (
                  <label
                    key={o.v}
                    className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                      fridayPolicy === o.v ? "border-play-300 bg-play-50/60" : "border-ink-200 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quick-friday-mode"
                      checked={fridayPolicy === o.v}
                      onChange={() => setFridayPolicy(o.v)}
                      className="mt-0.5 accent-play-600"
                    />
                    <span className="min-w-0">
                      <span className="text-ink-900 block text-xs font-semibold">{o.label}</span>
                      <span className="text-ink-500 block text-[11px]">{o.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-hoop-700 mt-3 text-xs font-semibold">{error}</p>}
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={onClose} className="text-ink-400 hover:text-ink-600 text-xs">
              Cancel
            </button>
            <Button size="sm" onClick={() => void run()} disabled={busy || !ready}>
              {busy ? "Setting up…" : "Create & continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
