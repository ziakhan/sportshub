"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { Button, Badge, PanelHeader, toneForStatus } from "@/components/ui"
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
              that work for that number. Seeds come from the current standings.
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
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border-ink-200 w-full rounded-lg border px-3 py-2 text-sm"
                />
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
