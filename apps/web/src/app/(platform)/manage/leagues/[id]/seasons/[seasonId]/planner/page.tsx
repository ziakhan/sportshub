"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Button, SmartBack } from "@/components/ui"
import {
  currentAssignment,
  weekendDemand,
  type PlannerLever,
  type PlannerState,
  type PlannerSuggestion,
} from "@/lib/scheduler/planner-core"

/**
 * Season planner board (owner 2026-08-02): drag grades between weekends,
 * court math recomputes live, levers propose deterministic alternatives
 * (balance / compact / spread), Apply persists to SeasonSession.unitKeys.
 * Nothing here calls a model — the solver is exact and instant by ruling.
 */

interface DragPayload {
  unitKey: string
  fromSessionId: string | null
}

export default function SeasonPlannerPage() {
  const params = useParams()
  const leagueId = params?.id as string
  const seasonId = params?.seasonId as string

  const [state, setState] = useState<PlannerState | null>(null)
  const [assignment, setAssignment] = useState<Record<string, string[]>>({})
  const [suggestions, setSuggestions] = useState<PlannerSuggestion[]>([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editingExpected, setEditingExpected] = useState(false)
  const [expectedDraft, setExpectedDraft] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    const res = await fetch(`/api/seasons/${seasonId}/planner`).catch(() => null)
    if (!res?.ok) {
      setNotice("Couldn't load the planner")
      return
    }
    const data = await res.json()
    setState(data.state)
    setAssignment(currentAssignment(data.state))
    setSuggestions(data.suggestions ?? [])
    setDirty(false)
  }, [seasonId])

  useEffect(() => {
    load()
  }, [load])

  const propose = async (lever: PlannerLever) => {
    setBusy(lever)
    setNotice(null)
    const res = await fetch(`/api/seasons/${seasonId}/planner/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lever }),
    }).catch(() => null)
    setBusy(null)
    if (!res?.ok) {
      setNotice("Proposal failed")
      return
    }
    const data = await res.json()
    setAssignment(data.assignment)
    setSuggestions(data.suggestions ?? [])
    setDirty(true)
    setNotice(
      lever === "balance"
        ? "Proposed: flattest weekends. Drag anything you'd do differently, then apply."
        : lever === "compact"
          ? "Proposed: fewest weekends in use. Apply to keep it."
          : "Proposed: every weekend in use. Apply to keep it."
    )
  }

  const apply = async () => {
    setBusy("apply")
    const res = await fetch(`/api/seasons/${seasonId}/planner/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment }),
    }).catch(() => null)
    setBusy(null)
    if (!res?.ok) {
      setNotice("Couldn't save the plan")
      return
    }
    const data = await res.json()
    setState(data.state)
    setAssignment(currentAssignment(data.state))
    setSuggestions(data.suggestions ?? [])
    setDirty(false)
    setNotice("Plan saved. The schedule generator now follows it.")
  }

  const saveExpected = async () => {
    if (!state) return
    setBusy("expected")
    // Cluster estimates split evenly across the cluster's divisions — it's
    // a pre-registration estimate; per-division precision isn't the point.
    const updates: Array<{ divisionId: string; expectedTeams: number }> = []
    for (const u of state.units) {
      const v = expectedDraft[u.key]
      if (v === undefined) continue
      const per = Math.floor(v / u.divisionIds.length)
      let remainder = v - per * u.divisionIds.length
      for (const id of u.divisionIds) {
        updates.push({ divisionId: id, expectedTeams: per + (remainder > 0 ? 1 : 0) })
        remainder--
      }
    }
    if (updates.length === 0) {
      setBusy(null)
      setEditingExpected(false)
      return
    }
    const res = await fetch(`/api/seasons/${seasonId}/planner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expected: updates }),
    }).catch(() => null)
    setBusy(null)
    setEditingExpected(false)
    if (!res?.ok) {
      setNotice("Couldn't save expected teams")
      return
    }
    const data = await res.json()
    setState(data.state)
    setNotice("Expected teams saved.")
  }

  const moveUnit = (unitKey: string, fromSessionId: string | null, toSessionId: string) => {
    setAssignment((prev) => {
      const next: Record<string, string[]> = {}
      for (const [sid, keys] of Object.entries(prev)) {
        next[sid] =
          sid === fromSessionId ? keys.filter((k) => k !== unitKey) : [...keys]
      }
      next[toSessionId] = [...new Set([...(next[toSessionId] ?? []), unitKey])]
      return next
    })
    setDirty(true)
  }

  const removeUnit = (unitKey: string, fromSessionId: string) => {
    setAssignment((prev) => ({
      ...prev,
      [fromSessionId]: (prev[fromSessionId] ?? []).filter((k) => k !== unitKey),
    }))
    setDirty(true)
  }

  const onDrop = (e: React.DragEvent, toSessionId: string) => {
    e.preventDefault()
    try {
      const payload: DragPayload = JSON.parse(e.dataTransfer.getData("text/plain"))
      if (!payload.unitKey || payload.fromSessionId === toSessionId) return
      moveUnit(payload.unitKey, payload.fromSessionId, toSessionId)
    } catch {
      /* not our drag */
    }
  }

  const unitByKey = useMemo(
    () => new Map((state?.units ?? []).map((u) => [u.key, u])),
    [state]
  )

  if (!state) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-ink-500 text-sm">{notice ?? "Loading the planner…"}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <SmartBack
        fallback={`/manage/leagues/${leagueId}/seasons/${seasonId}/manage?tab=schedule`}
        fallbackLabel="Back to Schedule"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-ink-900 text-xl font-bold">Season planner</h1>
          <p className="text-ink-500 text-sm">
            Drag a grade to a different weekend and the court math updates as you go. Apply
            saves the plan the schedule generator follows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => propose("balance")}>
            Balance
          </Button>
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => propose("compact")}>
            Compact
          </Button>
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => propose("spread")}>
            Spread
          </Button>
          {dirty && (
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={load}>
              Reset
            </Button>
          )}
          <Button size="sm" tone="court" disabled={busy !== null || !dirty} onClick={apply}>
            {busy === "apply" ? "Saving…" : "Apply plan"}
          </Button>
        </div>
      </div>

      {notice && <p className="text-ink-600 mt-3 text-sm">{notice}</p>}
      {state.errors.length > 0 && (
        <p className="text-hoop-700 mt-3 text-sm">{state.errors.join(" · ")}</p>
      )}

      {/* Grades strip: team counts feeding the math (+ expected-team editing
          for pre-registration planning). */}
      <div className="border-ink-100 shadow-soft mt-5 rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-ink-700 text-sm font-semibold">Grades and team counts</p>
          {editingExpected ? (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEditingExpected(false)}>
                Cancel
              </Button>
              <Button size="sm" tone="court" disabled={busy === "expected"} onClick={saveExpected}>
                Save estimates
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => {
              setExpectedDraft(Object.fromEntries(state.units.map((u) => [u.key, u.teams])))
              setEditingExpected(true)
            }}>
              Edit expected teams
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {state.units.map((u) => (
            <span
              key={u.key}
              className="border-ink-100 bg-ink-50 text-ink-800 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
            >
              <b>{u.label}</b>
              {editingExpected ? (
                <input
                  type="number"
                  min={0}
                  className="border-ink-200 w-16 rounded-md border px-1 py-0.5 text-sm"
                  value={expectedDraft[u.key] ?? u.teams}
                  onChange={(e) =>
                    setExpectedDraft((d) => ({ ...d, [u.key]: Number(e.target.value) }))
                  }
                  aria-label={`Expected teams for ${u.label}`}
                />
              ) : (
                <span className="text-ink-500">
                  {u.teams} teams
                  {u.source === "expected" && <span className="text-gold-700"> · estimate</span>}
                  {u.source === "none" && <span className="text-hoop-700"> · no count yet</span>}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Suggestion rail */}
      {suggestions.length > 0 && (
        <div className="mt-4 space-y-2">
          {suggestions.map((s, i) => (
            <div
              key={`${s.sessionId}-${s.kind}-${i}`}
              className={`rounded-xl border px-4 py-2.5 text-sm ${
                s.kind === "overflow"
                  ? "border-hoop-200 bg-hoop-50 text-hoop-900"
                  : s.kind === "idle-weekend"
                    ? "border-ink-100 bg-ink-50 text-ink-600"
                    : "border-gold-200 bg-gold-50 text-gold-900"
              }`}
            >
              {s.text}
            </div>
          ))}
        </div>
      )}

      {/* The board */}
      <div className="mt-5 overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: `${state.windows.length * 260}px` }}>
          {state.windows.map((win) => {
            const inWindow = new Set(win.weekends.flatMap((w) => assignment[w.sessionId] ?? []))
            const missing = state.units.filter((u) => u.teams > 0 && !inWindow.has(u.key))
            return (
              <section key={win.label} className="w-[260px] shrink-0">
                <h2 className="text-ink-500 px-1 text-xs font-bold uppercase tracking-wide">
                  {win.label}
                </h2>
                <div className="mt-2 space-y-2">
                  {win.weekends.map((w) => {
                    const keys = assignment[w.sessionId] ?? []
                    const demand = weekendDemand(state.units, w, keys)
                    const over = demand > w.capacityGames
                    const hot = !over && w.capacityGames > 0 && demand / w.capacityGames >= 0.85
                    const twoGyms = demand > w.largestVenueCapacity && w.venues.length > 1
                    return (
                      <div
                        key={w.sessionId}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDrop(e, w.sessionId)}
                        className={`rounded-2xl border bg-white p-3 shadow-soft ${
                          over
                            ? "border-hoop-300"
                            : hot
                              ? "border-gold-300"
                              : "border-ink-100"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-ink-900 text-sm font-bold">{w.label}</p>
                          <p
                            className={`text-xs font-semibold ${
                              over ? "text-hoop-700" : hot ? "text-gold-700" : "text-ink-500"
                            }`}
                          >
                            {demand}/{w.capacityGames}
                          </p>
                        </div>
                        <div className="bg-ink-100 mt-1.5 h-1.5 overflow-hidden rounded-full">
                          <div
                            className={`h-full rounded-full ${
                              over ? "bg-hoop-500" : hot ? "bg-gold-500" : "bg-court-500"
                            }`}
                            style={{
                              width: `${
                                w.capacityGames > 0
                                  ? Math.min(100, (demand / w.capacityGames) * 100)
                                  : 100
                              }%`,
                            }}
                          />
                        </div>
                        <p className="text-ink-400 mt-1 truncate text-[11px]">
                          {w.venues.map((v) => v.name).join(" + ") || "No venue attached"}
                          {twoGyms && <span className="text-gold-700"> · two gyms</span>}
                        </p>
                        <div className="mt-2 flex min-h-[26px] flex-wrap gap-1.5">
                          {keys.map((k) => {
                            const u = unitByKey.get(k)
                            if (!u) return null
                            return (
                              <span
                                key={k}
                                draggable
                                onDragStart={(e) =>
                                  e.dataTransfer.setData(
                                    "text/plain",
                                    JSON.stringify({ unitKey: k, fromSessionId: w.sessionId })
                                  )
                                }
                                className="border-court-200 bg-court-50 text-court-800 inline-flex cursor-grab items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold active:cursor-grabbing"
                              >
                                {u.label}
                                <button
                                  onClick={() => removeUnit(k, w.sessionId)}
                                  aria-label={`Remove ${u.label} from ${w.label}`}
                                  className="text-court-600 hover:text-hoop-700 cursor-pointer"
                                >
                                  ×
                                </button>
                              </span>
                            )
                          })}
                          {keys.length === 0 && (
                            <span className="text-ink-300 text-xs">Drop a grade here</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {missing.length > 0 && (
                    <div className="border-ink-100 rounded-xl border border-dashed p-2.5">
                      <p className="text-ink-400 text-[11px] font-semibold uppercase tracking-wide">
                        Not playing this month
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {missing.map((u) => (
                          <span
                            key={u.key}
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData(
                                "text/plain",
                                JSON.stringify({ unitKey: u.key, fromSessionId: null })
                              )
                            }
                            className="border-ink-200 bg-ink-50 text-ink-500 inline-flex cursor-grab rounded-lg border px-2 py-0.5 text-xs font-semibold"
                          >
                            {u.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
