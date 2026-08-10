"use client"

import { useState, useEffect, useCallback } from "react"
import { Button, PanelHeader } from "@/components/ui"
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
/* ---------------------- the bracket, drawn properly ---------------------- */
/* Owner 2026-08-10: "everything kind of converging into the middle instead
   of everything sitting at the top... put their ranking beside their team
   names... make it a standard." Rows are computed the way every printed
   bracket is: entry games get consecutive rows, every later game sits at
   the midpoint of the two games that feed it, and the final lands mid-
   height. Connectors are one SVG elbow per feed. Consolation games live on
   their own tab; the 3rd-place game sits under the final. */

const ROW_H = 96
const BOX_W = 220
const COL_GAP = 48
const BOX_H = 82

function GameBox({ g, style }: { g: any; style?: React.CSSProperties }) {
  const resolved = g.homeTeamId && g.awayTeamId
  const seed = (slot: any) =>
    slot?.type === "SEED" && /^\d+$/.test(String(slot.ref)) ? (
      <span className="bg-ink-100 text-ink-500 mr-1 inline-block w-6 shrink-0 rounded text-center text-[10px] font-bold">
        {slot.ref}
      </span>
    ) : null
  return (
    <div
      style={style}
      className={`rounded-xl border px-2.5 py-1.5 text-xs leading-snug shadow-sm ${
        resolved ? "border-ink-200 bg-white" : "border-ink-100 bg-ink-50"
      }`}
    >
      <p className={`flex items-center truncate ${g.homeTeamId ? "text-ink-900 font-semibold" : "text-ink-400"}`}>
        {seed(g.home)}
        <span className="truncate">{g.homeLabel}</span>
      </p>
      <p className={`mt-0.5 flex items-center truncate ${g.awayTeamId ? "text-ink-900 font-semibold" : "text-ink-400"}`}>
        {seed(g.away)}
        <span className="truncate">{g.awayLabel}</span>
      </p>
      <p className="text-ink-400 mt-1 text-[11px]">
        {new Date(g.startIso).toLocaleString("en-CA", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  )
}

function BracketTree({ unit, games }: { unit: string; games: any[] }) {
  const byId = new Map(games.map((g) => [g.structId, g]))
  const isCons = (g: any) => /consolation/i.test(g.round)
  const third = games.find((g) => /3rd place/i.test(g.round)) ?? null
  const tree = games.filter((g) => !isCons(g) && g !== third)
  const fed = new Set(
    tree.flatMap((g) =>
      [g.home, g.away]
        .filter((s: any) => s?.type === "WINNER")
        .map((s: any) => String(s.ref))
    )
  )
  const finals = tree.filter((g) => !fed.has(String(g.structId)))
  const hasWinnerFlow = tree.some((g) => [g.home, g.away].some((s: any) => s?.type === "WINNER"))

  /* Pools/placement units have no winner-flow — a simple round grid reads
     better than a fake tree. */
  if (!hasWinnerFlow || finals.length !== 1) {
    const rounds = [...new Set(games.map((g) => g.round))].sort((a, b) => {
      const fa = games.filter((g) => g.round === a).map((g) => g.startIso).sort()[0]
      const fb = games.filter((g) => g.round === b).map((g) => g.startIso).sort()[0]
      return fa < fb ? -1 : 1
    })
    return (
      <div>
        <p className="text-ink-900 mb-1.5 text-xs font-bold uppercase tracking-wide">{unit}</p>
        <div className="overflow-x-auto">
          <div className="flex items-start gap-3 pb-1">
            {rounds.map((round) => (
              <div key={round} className="w-52 shrink-0">
                <p className="text-ink-500 mb-1 text-[11px] font-semibold">{round}</p>
                <div className="space-y-1.5">
                  {games
                    .filter((g) => g.round === round)
                    .sort((a, b) => (a.startIso < b.startIso ? -1 : 1))
                    .map((g) => (
                      <GameBox key={g.structId} g={g} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* Row positions: leaves in bracket order, parents at their feeders' mid. */
  const pos = new Map<string, number>()
  let leaf = 0
  const place = (g: any): number => {
    if (pos.has(g.structId)) return pos.get(g.structId)!
    const kids = [g.home, g.away]
      .filter((sl: any) => sl?.type === "WINNER")
      .map((sl: any) => byId.get(String(sl.ref)))
      .filter((k: any) => k && !isCons(k) && k !== third)
    let p: number
    if (kids.length === 0) p = leaf++
    else if (kids.length === 1) p = (place(kids[0]) + leaf++) / 2
    else p = (place(kids[0]) + place(kids[1])) / 2
    pos.set(g.structId, p)
    return p
  }
  place(finals[0])
  for (const g of tree) if (!pos.has(g.structId)) pos.set(g.structId, leaf++)

  const tiers = [...new Set(tree.map((g) => g.tier ?? 0))].sort((a, b) => a - b)
  const colOf = new Map(tiers.map((t, i) => [t, i]))
  const roundLabel = (t: number, i: number): string => {
    const names = tree.filter((g) => (g.tier ?? 0) === t).map((g) => g.round)
    const name = names.sort()[0] ?? ""
    return i === 0 ? "Opening round" : name
  }
  const rows = Math.max(leaf, 1)
  const width = tiers.length * (BOX_W + COL_GAP) + BOX_W
  const height = rows * ROW_H + (third ? BOX_H + 18 : 0)
  const x = (g: any) => (colOf.get(g.tier ?? 0) ?? 0) * (BOX_W + COL_GAP)
  const y = (g: any) => (pos.get(g.structId) ?? 0) * ROW_H

  return (
    <div>
      <p className="text-ink-900 mb-1.5 text-xs font-bold uppercase tracking-wide">{unit}</p>
      <div className="overflow-x-auto pb-1">
        <div style={{ width, minWidth: width }}>
          <div className="flex" style={{ gap: COL_GAP }}>
            {tiers.map((t, i) => (
              <p key={t} className="text-ink-500 text-[11px] font-semibold" style={{ width: BOX_W }}>
                {roundLabel(t, i)}
              </p>
            ))}
          </div>
          <div className="relative mt-1" style={{ height }}>
            <svg
              className="pointer-events-none absolute inset-0"
              width={width}
              height={height}
              aria-hidden="true"
            >
              {tree.map((g) =>
                [g.home, g.away]
                  .filter((sl: any) => sl?.type === "WINNER")
                  .map((sl: any) => {
                    const kid = byId.get(String(sl.ref))
                    if (!kid || isCons(kid) || kid === third) return null
                    const x1 = x(kid) + BOX_W
                    const y1 = y(kid) + BOX_H / 2
                    const x2 = x(g)
                    const y2 = y(g) + BOX_H / 2
                    const mid = x1 + COL_GAP / 2
                    return (
                      <path
                        key={`${g.structId}-${sl.ref}`}
                        d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}
                        fill="none"
                        stroke="#c7cdd8"
                        strokeWidth="1.5"
                      />
                    )
                  })
              )}
            </svg>
            {tree.map((g) => (
              <GameBox
                key={g.structId}
                g={g}
                style={{ position: "absolute", left: x(g), top: y(g), width: BOX_W }}
              />
            ))}
            <div
              style={{
                position: "absolute",
                left: x(finals[0]) + BOX_W + COL_GAP,
                top: y(finals[0]) + BOX_H / 2 - 16,
                width: BOX_W - 30,
              }}
              className="border-gold-300 bg-gold-50 text-gold-800 rounded-xl border px-2.5 py-1.5 text-xs font-bold"
            >
              🏆 Champion
            </div>
            {third && (
              <div style={{ position: "absolute", left: x(third), top: y(finals[0]) + BOX_H + 24, width: BOX_W }}>
                <p className="text-ink-400 mb-0.5 text-[10px] font-semibold uppercase">3rd place</p>
                <GameBox g={third} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlayoffPlanSection({ seasonId, seasonStatus }: { seasonId: string; seasonStatus: string }) {
  const [data, setData] = useState<any | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [errs, setErrs] = useState<string[]>([])
  const [view, setView] = useState<"bracket" | "consolations" | "schedule">("bracket")
  const [unitTab, setUnitTab] = useState<string | null>(null)

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
          final standings (tiebreakers live under Settings &rsaquo; Rules): you&apos;ll pick who
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
                {gp.divisions} divisions; its playoffs are
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
                      setMsg("Pooling saved. Press Plan the playoffs to rebuild the schedule.")
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

      {/* ONE GRADE AT A TIME (owner 2026-08-10): grade tabs on top, the
          three views below scoped to the chosen grade — never one huge
          scrolling page. */}
      {planGames.length > 0 && (
        <div className="border-ink-100 mt-4 flex flex-wrap gap-1 border-b pb-2">
          {[...new Set(planGames.map((g) => g.divisionId))].sort().map((u) => {
            const selected = (unitTab ?? [...new Set(planGames.map((g) => g.divisionId))].sort()[0]) === u
            return (
              <button
                key={u}
                type="button"
                onClick={() => setUnitTab(u)}
                aria-pressed={selected}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  selected ? "bg-play-600 text-white" : "text-ink-600 bg-ink-50 hover:bg-ink-100"
                }`}
              >
                {u}
              </button>
            )
          })}
        </div>
      )}
      {planGames.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="border-ink-100 inline-flex overflow-hidden rounded-lg border text-xs">
            {(["bracket", "consolations", "schedule"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`px-3 py-1 font-semibold ${view === v ? "bg-play-600 text-white" : "text-ink-600 bg-white"}`}
              >
                {v === "bracket" ? "Bracket" : v === "consolations" ? "Consolations" : "Schedule"}
              </button>
            ))}
          </div>
          {view !== "schedule" && (
            <p className="text-ink-400 text-[11px]">
              White = teams decided · gray = waiting on an earlier result · the small number is the
              seed
            </p>
          )}
        </div>
      )}
      {planGames.length > 0 && view === "bracket" && (
        <div className="mt-3">
          {(() => {
            const units = [...new Set(planGames.map((g) => g.divisionId))].sort()
            const u = unitTab && units.includes(unitTab) ? unitTab : units[0]
            return <BracketTree unit={u} games={planGames.filter((g) => g.divisionId === u)} />
          })()}
        </div>
      )}
      {planGames.length > 0 && view === "consolations" && (
        <div className="mt-3">
          {(() => {
            const units = [...new Set(planGames.map((g) => g.divisionId))].sort()
            const u = unitTab && units.includes(unitTab) ? unitTab : units[0]
            const cons = planGames.filter((g) => g.divisionId === u && /consolation/i.test(g.round))
            return cons.length === 0 ? (
              <p className="text-ink-400 text-xs">
                No consolation games; this bracket sends first-round losers home.
              </p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {cons
                  .sort((a, b) => (a.startIso < b.startIso ? -1 : 1))
                  .map((g) => (
                    <GameBox key={g.structId} g={g} />
                  ))}
              </div>
            )
          })()}
        </div>
      )}
      {planGames.length > 0 && view === "schedule" && (
        <div className="mt-4 space-y-4">
          {[...byWeekend.entries()].map(([wid, weekendGames]) => {
            const units = [...new Set(planGames.map((g: any) => g.divisionId))].sort()
            const u = unitTab && units.includes(unitTab) ? unitTab : units[0]
            const games = weekendGames.filter((g: any) => g.divisionId === u)
            if (games.length === 0) return null
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
  /* The plan section is the one playoff surface (owner 2026-08-10: the
     leftover v1 brackets list below it read as unrelated noise). */
  return (
    <div className="space-y-6">
      <PlayoffPlanSection seasonId={seasonId} seasonStatus={seasonStatus} />
    </div>
  )
}
