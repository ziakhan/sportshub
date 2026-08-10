"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { Button, Badge, PanelHeader, toneForStatus, DateTimePicker } from "@/components/ui"
import { panelClass } from "./types"

/**
 * Playoff wizard (owner 2026-07-18) — GUIDED FLOW: the owner picks a division
 * and how many teams qualify; the system offers only the formats that make
 * sense for that count, with game totals. Single games only. Later rounds
 * appear automatically as results come in.
 */

interface Props {
  seasonId: string
  divisions: any[]
  seasonStatus: string
}


/**
 * Playoff plan (owner-approved redesign 2026-08-09): one card per GRADE,
 * collapsed to plain sentences — who's in, what's promised, does it fit.
 * The three real questions live behind "Change"; format and byes are
 * derived and EXPLAINED, never configured (byes appear only as "the top
 * N teams skip round 1"). One button plans everything; the result renders
 * as the actual weekend with placeholder names in gray until the regular
 * season decides them.
 */
function PlayoffPlanSection({ seasonId, seasonStatus }: { seasonId: string; seasonStatus: string }) {
  const [data, setData] = useState<any | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [errs, setErrs] = useState<string[]>([])
  const [view, setView] = useState<"bracket" | "schedule">("bracket")

  const load = useCallback(async () => {
    const res = await fetch(`/api/seasons/${seasonId}/playoff-plan`)
    if (res.ok) setData(await res.json())
  }, [seasonId])
  useEffect(() => {
    void load()
  }, [load])

  const updateConfig = async (unitId: string, patch: Record<string, any>) => {
    if (!data) return
    const configs: Record<string, any> = {}
    for (const d of data.divisions) {
      configs[d.id] = d.id === unitId ? { ...d.config, ...patch } : d.config
    }
    await fetch(`/api/seasons/${seasonId}/playoff-plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configs }),
    })
    await load()
  }

  const generate = async () => {
    setBusy(true)
    setMsg(null)
    setErrs([])
    const res = await fetch(`/api/seasons/${seasonId}/playoff-plan`, { method: "POST" })
    const body = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) {
      setErrs(Array.isArray(body?.errors) ? body.errors : [body?.error ?? "Couldn't plan the playoffs."])
      return
    }
    setMsg(
      body.placeholders > 0
        ? `${body.games} playoff games planned. ${body.placeholders} show placeholders until the regular season decides the teams.`
        : `${body.games} playoff games planned with real teams.`
    )
    await load()
  }

  // Playoffs are a season-END event (owner 2026-08-09): before the season
  // is underway the tab stays calm — no config noise.
  if (!["IN_PROGRESS", "COMPLETED"].includes(seasonStatus)) {
    return (
      <div className={panelClass}>
        <PanelHeader title="Playoffs" />
        <p className="text-ink-500 mt-1 text-sm">
          Playoffs are planned once the season is underway. The plan takes your divisions and the
          final standings (tiebreakers live under Settings &rsaquo; Rules) — you&apos;ll pick who
          qualifies, how many games everyone is guaranteed, and how brackets pool.
        </p>
      </div>
    )
  }

  if (!data) return null

  const planGames: any[] = data.plan?.games ?? []
  const byWeekend = new Map<string, any[]>()
  for (const g of planGames) {
    if (!byWeekend.has(g.weekendId)) byWeekend.set(g.weekendId, [])
    byWeekend.get(g.weekendId)!.push(g)
  }
  const weekendLabel = (id: string) => data.weekends.find((w: any) => w.id === id)?.label ?? "Playoff weekend"

  return (
    <div className={panelClass}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <PanelHeader title="Playoff plan" />
        <Button size="sm" onClick={() => void generate()} disabled={busy || data.weekends.length === 0}>
          {busy ? "Planning…" : "Plan the playoffs"}
        </Button>
      </div>
      <p className="text-ink-500 -mt-2 mb-3 text-xs">
        The whole playoff schedule is planned now; team names fill in automatically as the
        regular season finishes.
      </p>
      {data.weekends.length === 0 && (
        <p className="text-hoop-700 mb-3 text-xs font-semibold">
          No playoff weekends are booked yet — add a playoff session with gym time in Planning.
        </p>
      )}

      {/* Grades that run as divisions choose their bracket pooling HERE —
          a playoff-time decision, not a season-start one (owner 2026-08-09). */}
      {(data.gradePooling ?? []).length > 0 && (
        <div className="border-ink-100 bg-ink-50/50 mb-3 space-y-2 rounded-xl border p-3">
          {(data.gradePooling ?? []).map((gp: any) => (
            <div key={gp.ageGroup} className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-ink-700 text-xs">
                <span className="text-ink-900 font-semibold">{gp.ageGroup}</span> runs as{" "}
                {gp.divisions} divisions — its playoffs are
              </p>
              <div className="border-ink-200 inline-flex overflow-hidden rounded-lg border text-xs">
                {(
                  [
                    { v: "GRADE", label: "one championship" },
                    { v: "DIVISION", label: "a bracket per division" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    aria-pressed={gp.pooling === o.v}
                    onClick={async () => {
                      await fetch(`/api/seasons/${seasonId}/playoff-plan`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ageGroup: gp.ageGroup, pooling: o.v }),
                      })
                      setMsg("Pooling saved — press Plan the playoffs to rebuild the schedule.")
                      await load()
                    }}
                    className={`px-2.5 py-1 font-semibold ${
                      gp.pooling === o.v ? "bg-play-600 text-white" : "text-ink-600 bg-white"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {data.divisions.map((d: any) => {
          const c = d.config
          const isOpen = !!open[d.id]
          const inSentence =
            c.qualifiers === "all"
              ? `All ${d.teams} teams make the playoffs.`
              : `Top ${Math.min(c.qualifiers, d.teams)} of ${d.teams} teams make the playoffs.`
          const promiseSentence = `Everyone plays at least ${d.preview.guaranteedGames} game${
            d.preview.guaranteedGames === 1 ? "" : "s"
          }; champion crowned ${d.preview.finalDayName}.`
          return (
            <div key={d.id} className="border-ink-100 rounded-xl border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-ink-900 text-sm font-semibold">{d.name}</p>
                  <p className="text-ink-700 mt-0.5 text-xs">
                    {inSentence} {promiseSentence}
                  </p>
                  {d.preview.byes > 0 && (
                    <p className="text-ink-500 mt-0.5 text-xs">
                      The top {d.preview.byes} team{d.preview.byes === 1 ? "" : "s"} skip round 1.
                    </p>
                  )}
                  <p
                    className={`mt-0.5 text-xs font-semibold ${d.preview.fit.ok ? "text-court-700" : "text-hoop-700"}`}
                  >
                    {d.preview.fit.ok ? "✓ " : ""}
                    {d.preview.fit.text}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-play-600 hover:text-play-700 text-xs font-semibold"
                  onClick={() => setOpen((o) => ({ ...o, [d.id]: !isOpen }))}
                >
                  {isOpen ? "Done" : "Change"}
                </button>
              </div>
              {isOpen && (
                <div className="border-ink-100 mt-2 space-y-2 border-t pt-2 text-xs">
                  <label className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-700 w-32 font-semibold">Who makes it?</span>
                    <select
                      className="border-ink-200 rounded-lg border px-2 py-1"
                      value={String(c.qualifiers)}
                      onChange={(e) =>
                        void updateConfig(d.id, {
                          qualifiers: e.target.value === "all" ? "all" : Number(e.target.value),
                        })
                      }
                    >
                      <option value="all">Everybody ({d.teams})</option>
                      {[4, 6, 8, 10, 12, 14, 16, 20, 24].filter((n) => n < d.teams).map((n) => (
                        <option key={n} value={n}>
                          Top {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-700 w-32 font-semibold">Every team plays</span>
                    <select
                      className="border-ink-200 rounded-lg border px-2 py-1"
                      value={String(c.guaranteedGames)}
                      onChange={(e) => void updateConfig(d.id, { guaranteedGames: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          at least {n} game{n === 1 ? "" : "s"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-700 w-32 font-semibold">Which weekend?</span>
                    <select
                      className="border-ink-200 rounded-lg border px-2 py-1"
                      value={c.weekendId ?? ""}
                      onChange={(e) => void updateConfig(d.id, { weekendId: e.target.value || null })}
                    >
                      {data.weekends.map((w: any) => (
                        <option key={w.id} value={w.id}>
                          {w.label ?? "Playoff weekend"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <details>
                    <summary className="text-ink-500 cursor-pointer font-semibold">Advanced</summary>
                    <div className="mt-2 space-y-2">
                      <label className="flex flex-wrap items-center gap-2">
                        <span className="text-ink-700 w-32 font-semibold">Format</span>
                        <select
                          className="border-ink-200 rounded-lg border px-2 py-1"
                          value={c.formatOverride ?? ""}
                          onChange={(e) => void updateConfig(d.id, { formatOverride: e.target.value || null })}
                        >
                          <option value="">Automatic</option>
                          <option value="BRACKET">Knockout bracket</option>
                          <option value="POOLS">Pools, then medal games</option>
                          <option value="PLACEMENT">Everyone plays a set number, standings decide</option>
                        </select>
                      </label>
                      {d.divisionCount > 1 && (
                        <label className="flex flex-wrap items-center gap-2">
                          <span className="text-ink-700 w-32 font-semibold">Opening round</span>
                          <select
                            className="border-ink-200 rounded-lg border px-2 py-1"
                            value={c.openingRound ?? "SEEDED"}
                            onChange={(e) => void updateConfig(d.id, { openingRound: e.target.value })}
                          >
                            <option value="SEEDED">by seeding</option>
                            <option value="DIVISION_FIRST">within divisions first (NPH day 1)</option>
                          </select>
                        </label>
                      )}
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!c.thirdPlace}
                          onChange={(e) => void updateConfig(d.id, { thirdPlace: e.target.checked })}
                        />
                        <span className="text-ink-700">Play a 3rd-place game</span>
                      </label>
                    </div>
                  </details>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {msg && <p className="text-court-700 mt-3 text-xs font-semibold">{msg}</p>}
      {errs.length > 0 && (
        <div className="border-hoop-200 bg-hoop-50 mt-3 rounded-xl border px-3 py-2">
          {errs.map((e, i) => (
            <p key={i} className="text-hoop-700 text-xs">
              {e}
            </p>
          ))}
        </div>
      )}

      {planGames.length > 0 && (
        <div className="border-ink-100 mt-4 inline-flex overflow-hidden rounded-lg border text-xs">
          {(["bracket", "schedule"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-3 py-1 font-semibold ${view === v ? "bg-play-600 text-white" : "text-ink-600 bg-white"}`}
            >
              {v === "bracket" ? "Bracket" : "Schedule"}
            </button>
          ))}
        </div>
      )}
      {planGames.length > 0 && view === "bracket" && (
        <div className="mt-3 space-y-5">
          {[...new Set(planGames.map((g) => g.divisionId))].sort().map((unit) => {
            const unitGames = planGames.filter((g) => g.divisionId === unit)
            const roundOrder = [...new Set(unitGames.map((g) => g.round))].sort((a, b) => {
              const fa = unitGames.filter((g) => g.round === a).map((g) => g.startIso).sort()[0]
              const fb = unitGames.filter((g) => g.round === b).map((g) => g.startIso).sort()[0]
              return fa < fb ? -1 : 1
            })
            return (
              <div key={unit}>
                <p className="text-ink-900 mb-1.5 text-xs font-bold uppercase tracking-wide">{unit}</p>
                <div className="overflow-x-auto">
                  <div className="flex items-start gap-3 pb-1">
                    {roundOrder.map((round) => (
                      <div key={round} className="w-52 shrink-0">
                        <p className="text-ink-500 mb-1 text-[11px] font-semibold">{round}</p>
                        <div className="space-y-1.5">
                          {unitGames
                            .filter((g) => g.round === round)
                            .sort((a, b) => (a.startIso < b.startIso ? -1 : 1))
                            .map((g) => {
                              const resolved = g.homeTeamId && g.awayTeamId
                              return (
                                <div
                                  key={g.structId}
                                  className={`rounded-lg border px-2 py-1.5 text-[11px] ${resolved ? "border-ink-200 bg-white" : "border-ink-100 bg-ink-50"}`}
                                >
                                  <p className={resolved ? "text-ink-900 font-semibold" : "text-ink-400"}>
                                    {g.homeLabel}
                                  </p>
                                  <p className={resolved ? "text-ink-900 font-semibold" : "text-ink-400"}>
                                    {g.awayLabel}
                                  </p>
                                  <p className="text-ink-400 mt-0.5">
                                    {new Date(g.startIso).toLocaleString("en-CA", {
                                      weekday: "short",
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {planGames.length > 0 && view === "schedule" && (
        <div className="mt-4 space-y-4">
          {[...byWeekend.entries()].map(([wid, games]) => {
            const byDay = new Map<string, any[]>()
            for (const g of games) {
              const day = new Date(g.startIso).toLocaleDateString("en-CA", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })
              if (!byDay.has(day)) byDay.set(day, [])
              byDay.get(day)!.push(g)
            }
            return (
              <div key={wid}>
                <p className="text-ink-900 mb-1 text-xs font-bold uppercase tracking-wide">
                  {weekendLabel(wid)}
                </p>
                {[...byDay.entries()].map(([day, dayGames]) => (
                  <div key={day} className="mb-2">
                    <p className="text-ink-500 mb-1 text-[11px] font-semibold">{day}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <tbody>
                          {[...dayGames]
                            .sort((a, b) => (a.startIso < b.startIso ? -1 : 1))
                            .map((g) => {
                              const resolved = g.homeTeamId && g.awayTeamId
                              return (
                                <tr key={g.structId + g.divisionId} className="border-ink-50 border-b">
                                  <td className="text-ink-500 py-1 pr-2 whitespace-nowrap">
                                    {new Date(g.startIso).toLocaleTimeString("en-CA", {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </td>
                                  <td className="text-ink-400 py-1 pr-2 whitespace-nowrap">{g.divisionId}</td>
                                  <td className="text-ink-500 py-1 pr-2">{g.round}</td>
                                  <td className={`py-1 ${resolved ? "text-ink-900 font-semibold" : "text-ink-400"}`}>
                                    {g.homeLabel} <span className="text-ink-300 font-normal">vs</span>{" "}
                                    {g.awayLabel}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PlayoffsTab({ seasonId, seasonStatus }: Props) {
  const [brackets, setBrackets] = useState<any[]>([])
  const [error, setError] = useState("")

  const loadBrackets = useCallback(async () => {
    const res = await fetch(`/api/seasons/${seasonId}/playoffs`)
    if (res.ok) {
      const data = await res.json()
      setBrackets(data.brackets || [])
    }
  }, [seasonId])

  useEffect(() => {
    loadBrackets()
  }, [loadBrackets])

  const removeBracket = async (sessionId: string) => {
    if (!confirm("Delete this bracket and its unplayed games?")) return
    const res = await fetch(`/api/seasons/${seasonId}/playoffs?sessionId=${sessionId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Could not delete the bracket")
      return
    }
    loadBrackets()
  }


  return (
    <div className="space-y-6">
      <PlayoffPlanSection seasonId={seasonId} seasonStatus={seasonStatus} />
      {/* Existing brackets */}
      {brackets.map((bracket) => {
        const rounds = new Map<number, any[]>()
        for (const g of bracket.games) {
          const list = rounds.get(g.playoffRound) ?? []
          list.push(g)
          rounds.set(g.playoffRound, list)
        }
        const plan = bracket.playoffPlan ?? {}
        const labelFor = (g: any) =>
          (plan.matchups ?? []).find(
            (m: any) => m.round === g.playoffRound && m.slot === g.playoffSlot
          )?.label
        const nothingPlayed = bracket.games.every((g: any) => g.status === "SCHEDULED")
        return (
          <div key={bracket.id} className={`reveal ${panelClass}`}>
            <PanelHeader
              className="mb-1"
              title={bracket.label ?? "Playoffs"}
              action={
                nothingPlayed ? (
                  <Button size="sm" variant="subtle" onClick={() => removeBracket(bracket.id)}>
                    Delete bracket
                  </Button>
                ) : undefined
              }
            />
            <p className="text-ink-500 mb-4 text-xs">
              {plan.qualifying} teams · single games · later rounds appear automatically as
              results are finalized.
              {plan.notes ? ` ${plan.notes}` : ""}
            </p>
            <div className="space-y-4">
              {[...rounds.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([round, games]) => (
                  <div key={round}>
                    <h4 className="font-condensed text-ink-800 mb-2 text-sm font-bold uppercase tracking-wide">
                      Round {round}
                    </h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {games.map((g: any) => (
                        <Link
                          key={g.id}
                          href={`/live/${g.id}`}
                          className="border-ink-100 hover:border-play-300 block rounded-xl border p-3 transition-colors"
                        >
                          <div className="text-ink-400 mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide">
                            <span>{labelFor(g) ?? `Game ${g.playoffSlot + 1}`}</span>
                            <Badge tone={toneForStatus(g.status)}>{g.status}</Badge>
                          </div>
                          <div className="text-ink-900 flex items-center justify-between text-sm font-medium">
                            <span>{g.homeTeam?.name}</span>
                            <span className="font-mono tabular-nums">{g.homeScore ?? ""}</span>
                          </div>
                          <div className="text-ink-900 flex items-center justify-between text-sm font-medium">
                            <span>{g.awayTeam?.name}</span>
                            <span className="font-mono tabular-nums">{g.awayScore ?? ""}</span>
                          </div>
                          <div className="text-ink-500 mt-1 text-[11px]">
                            {new Date(g.scheduledAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )
      })}

      {error && <p className="text-hoop-600 text-sm">{error}</p>}
    </div>
  )
}
