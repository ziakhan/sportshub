"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button, PanelHeader, BrandListbox, ChipGroup } from "@/components/ui"
import {
  BracketBoard,
  BracketLegend,
  sectionizeBracket,
  type BracketMatch,
  type BracketSlot,
  type BracketSlotKind,
} from "@/components/bracket"
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
   names... make it a standard." Owner 2026-08-16, the ruling that produced
   the rebuild: "They're converging on top and there are no lines in between.
   There's no dark boldness for the teams that are there: winner of this,
   winner of that, loser of this, loser of that, the consolation."

   The geometry now lives in ONE place — @/components/bracket — shared with
   every other surface that draws a bracket. This file only translates a plan
   game into that model. */

const WHEN = (iso: string): string =>
  new Date(iso).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

const SLOT_KINDS: BracketSlotKind[] = ["SEED", "WINNER", "LOSER", "POOL", "BEST2ND", "TEAM"]

/** One side of a planned playoff game. Scores/outcomes are read defensively:
 *  the plan does not carry them today, and the card shows them the moment it
 *  does — no rendering change needed here. */
function planSlot(ref: any, label: string, teamId: string | null, score: unknown, won: unknown): BracketSlot {
  const kind: BracketSlotKind = SLOT_KINDS.includes(ref?.type) ? ref.type : "SEED"
  const seedish = kind === "SEED" && /^\d+$/.test(String(ref?.ref ?? ""))
  return {
    kind,
    seed: seedish ? Number(ref.ref) : null,
    from: kind === "WINNER" || kind === "LOSER" ? String(ref.ref) : null,
    teamName: teamId ? label : null,
    ghostLabel: label,
    score: typeof score === "number" ? score : null,
    outcome: typeof won === "boolean" ? (won ? "WON" : "LOST") : null,
  }
}

function planToMatches(games: any[]): BracketMatch[] {
  return games.map((g) => {
    const played = typeof g.homeScore === "number" && typeof g.awayScore === "number"
    return {
      id: String(g.structId),
      code: String(g.structId).toUpperCase(),
      round: String(g.round ?? ""),
      tier: Number(g.tier ?? 0),
      whenLabel: g.startIso ? WHEN(g.startIso) : null,
      status: played ? ("FINAL" as const) : null,
      home: planSlot(g.home, g.homeLabel, g.homeTeamId ?? null, g.homeScore, played ? g.homeScore > g.awayScore : undefined),
      away: planSlot(g.away, g.awayLabel, g.awayTeamId ?? null, g.awayScore, played ? g.awayScore > g.homeScore : undefined),
    }
  })
}

/** One grade's whole playoff picture: the championship tree, the third-place
 *  game, and the consolation tree the bottom of the field plays — each its own
 *  labelled section, all on the same converging geometry. */
function PlanBracket({ unit, games }: { unit: string; games: any[] }) {
  const sections = useMemo(() => sectionizeBracket(planToMatches(games)), [games])
  const champion = useMemo(() => {
    const final = sections.find((s) => s.kind === "CHAMPIONSHIP")?.matches.find((m) => /^(gold )?final$/i.test(m.round))
    if (!final) return null
    const won = [final.home, final.away].find((s) => s.outcome === "WON")
    return won?.teamName ?? null
  }, [sections])

  if (sections.length === 0) return null
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-ink-900 text-xs font-bold uppercase tracking-[0.14em]">{unit}</p>
        <BracketLegend />
      </div>
      <BracketBoard sections={sections} championLabel={champion} />
    </div>
  )
}

function PlayoffPlanSection({ seasonId, seasonStatus }: { seasonId: string; seasonStatus: string }) {
  const [data, setData] = useState<any | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [errs, setErrs] = useState<string[]>([])
  const [view, setView] = useState<"bracket" | "schedule">("bracket")
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
                    className={`focus-visible:ring-play-500/50 px-2.5 py-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-700 w-32 font-semibold">Who makes it?</span>
                    <BrandListbox
                      className="w-48"
                      ariaLabel="Who makes it?"
                      value={String(c.qualifiers)}
                      onChange={(v) =>
                        void updateConfig(d.id, {
                          qualifiers: v === "all" ? "all" : Number(v),
                        })
                      }
                      options={[
                        { value: "all", label: `Everybody (${d.teams})` },
                        ...[4, 6, 8, 10, 12, 14, 16, 20, 24]
                          .filter((n) => n < d.teams)
                          .map((n) => ({ value: String(n), label: `Top ${n}` })),
                      ]}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-700 w-32 font-semibold">Every team plays</span>
                    <ChipGroup
                      ariaLabel="Every team plays"
                      value={String(c.guaranteedGames)}
                      onChange={(v) => void updateConfig(d.id, { guaranteedGames: Number(v) })}
                      options={[1, 2, 3, 4].map((n) => ({
                        value: String(n),
                        label: `at least ${n} game${n === 1 ? "" : "s"}`,
                      }))}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-700 w-32 font-semibold">Which weekend?</span>
                    <BrandListbox
                      className="w-56"
                      ariaLabel="Which weekend?"
                      placeholder="Choose a weekend"
                      value={c.weekendId ?? ""}
                      onChange={(v) => void updateConfig(d.id, { weekendId: v || null })}
                      options={data.weekends.map((w: any) => ({
                        value: w.id,
                        label: w.label ?? "Playoff weekend",
                      }))}
                    />
                  </div>
                  <details>
                    <summary className="text-ink-500 cursor-pointer font-semibold">Advanced</summary>
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-ink-700 w-32 font-semibold">Format</span>
                        <ChipGroup
                          ariaLabel="Format"
                          value={c.formatOverride ?? ""}
                          onChange={(v) => void updateConfig(d.id, { formatOverride: v || null })}
                          options={[
                            { value: "", label: "Automatic" },
                            { value: "BRACKET", label: "Knockout bracket" },
                            { value: "POOLS", label: "Pools, then medal games" },
                            { value: "PLACEMENT", label: "Everyone plays a set number, standings decide" },
                          ]}
                        />
                      </div>
                      {d.divisionCount > 1 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-ink-700 w-32 font-semibold">Opening round</span>
                          <ChipGroup
                            ariaLabel="Opening round"
                            value={c.openingRound ?? "SEEDED"}
                            onChange={(v) => void updateConfig(d.id, { openingRound: v })}
                            options={[
                              { value: "SEEDED", label: "by seeding" },
                              { value: "DIVISION_FIRST", label: "within divisions first (NPH day 1)" },
                            ]}
                          />
                        </div>
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

      {/* ONE GRADE AT A TIME (owner 2026-08-10): grade tabs on top, the views
          below scoped to the chosen grade — never one huge scrolling page.
          Consolation is no longer a separate view (owner 2026-08-16): it is a
          labelled section inside the bracket, drawn on the same tree. */}
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
                className={`focus-visible:ring-play-500/50 rounded-lg px-3 py-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 ${
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
            {(["bracket", "schedule"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`focus-visible:ring-play-500/50 px-3 py-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${
                  view === v ? "bg-play-600 text-white" : "text-ink-600 bg-white"
                }`}
              >
                {v === "bracket" ? "Bracket" : "Schedule"}
              </button>
            ))}
          </div>
        </div>
      )}
      {planGames.length > 0 && view === "bracket" && (
        <div className="mt-3">
          {(() => {
            const units = [...new Set(planGames.map((g) => g.divisionId))].sort()
            const u = unitTab && units.includes(unitTab) ? unitTab : units[0]
            return <PlanBracket unit={u} games={planGames.filter((g) => g.divisionId === u)} />
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
