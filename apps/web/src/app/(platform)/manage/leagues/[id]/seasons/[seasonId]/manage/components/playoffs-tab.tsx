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
function PlayoffPlanSection({ seasonId }: { seasonId: string }) {
  const [data, setData] = useState<any | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [errs, setErrs] = useState<string[]>([])

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

export function PlayoffsTab({ seasonId, divisions, seasonStatus }: Props) {
  const [brackets, setBrackets] = useState<any[]>([])
  const [divisionId, setDivisionId] = useState("")
  const [qualifying, setQualifying] = useState("")
  const [options, setOptions] = useState<any[] | null>(null)
  const [seedPreview, setSeedPreview] = useState<any[] | null>(null)
  const [format, setFormat] = useState("")
  const [startDate, setStartDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const canGenerate = ["IN_PROGRESS", "COMPLETED"].includes(seasonStatus)

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

  // The guided step: division + qualifying count → the formats that fit
  useEffect(() => {
    const q = parseInt(qualifying, 10)
    if (!divisionId || !Number.isFinite(q) || q < 2) {
      setOptions(null)
      setSeedPreview(null)
      return
    }
    let cancelled = false
    fetch(`/api/seasons/${seasonId}/playoffs?divisionId=${divisionId}&qualifying=${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setOptions(data.options)
        setSeedPreview(data.seedPreview)
        setFormat("")
      })
    return () => {
      cancelled = true
    }
  }, [seasonId, divisionId, qualifying])

  const generate = async () => {
    setBusy(true)
    setError("")
    const res = await fetch(`/api/seasons/${seasonId}/playoffs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        divisionId,
        qualifying: parseInt(qualifying, 10),
        format,
        startDate,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error || "Could not generate the bracket")
      return
    }
    setDivisionId("")
    setQualifying("")
    setOptions(null)
    setSeedPreview(null)
    setFormat("")
    loadBrackets()
  }

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

  const usedDivisionIds = new Set(brackets.map((b) => b.playoffPlan?.divisionId))

  return (
    <div className="space-y-6">
      <PlayoffPlanSection seasonId={seasonId} />
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

      {/* Wizard */}
      <div className={`reveal ${panelClass}`}>
        <PanelHeader className="mb-1" title="Generate playoffs" />
        {!canGenerate ? (
          <p className="text-ink-500 text-sm">
            Playoffs can be generated once the season is in progress.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-ink-500 text-xs">
              Pick a division and how many teams qualify — you&apos;ll only be offered formats
              that work for that number. Seeds come from the current standings. Eligibility
              rules (minimum games played) live under Settings &rsaquo; Rules.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-ink-700 mb-1 block text-xs font-semibold">Division</span>
                <select
                  value={divisionId}
                  onChange={(e) => setDivisionId(e.target.value)}
                  className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {divisions.map((d: any) => (
                    <option key={d.id} value={d.id} disabled={usedDivisionIds.has(d.id)}>
                      {d.name}
                      {usedDivisionIds.has(d.id) ? " (bracket exists)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-ink-700 mb-1 block text-xs font-semibold">
                  Teams qualifying
                </span>
                <input
                  type="number"
                  min={2}
                  max={64}
                  value={qualifying}
                  onChange={(e) => setQualifying(e.target.value)}
                  className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. 4"
                />
              </label>
              <label className="block">
                <span className="text-ink-700 mb-1 block text-xs font-semibold">
                  First round date
                </span>
                <DateTimePicker mode="date" value={startDate} onChange={setStartDate} />
              </label>
            </div>

            {options && options.length === 0 && (
              <p className="text-hoop-600 text-sm">
                No formats fit that number — try a different qualifying count.
              </p>
            )}

            {options && options.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {options.map((o: any) => (
                  <button
                    key={o.key + o.label}
                    type="button"
                    onClick={() => setFormat(o.key)}
                    aria-pressed={format === o.key}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      format === o.key
                        ? "border-play-500 bg-play-50"
                        : "border-ink-100 hover:border-ink-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-ink-900 text-sm font-semibold">{o.label}</span>
                      {o.recommended && <Badge tone="play">Recommended</Badge>}
                    </div>
                    <p className="text-ink-500 mt-1 text-xs">{o.description}</p>
                    <p className="text-ink-400 mt-1 text-[11px]">
                      {o.games} games · {o.rounds} round{o.rounds > 1 ? "s" : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {seedPreview && seedPreview.length > 0 && (
              <div>
                <h4 className="font-condensed text-ink-800 mb-2 text-sm font-bold uppercase tracking-wide">
                  Seeds (current standings)
                </h4>
                <ol className="text-ink-700 grid gap-1 text-sm sm:grid-cols-2">
                  {seedPreview.map((s: any) => (
                    <li key={s.teamId} className="flex items-baseline gap-2">
                      <span className="text-ink-400 w-5 font-mono text-xs">#{s.seed}</span>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-ink-400 text-xs">{s.record}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {error && <p className="text-hoop-600 text-sm">{error}</p>}

            <Button
              onClick={generate}
              disabled={busy || !divisionId || !format || !startDate}
            >
              {busy ? "Generating…" : "Generate bracket"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
