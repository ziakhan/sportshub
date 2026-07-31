"use client"

import { useMemo, useState } from "react"
import { Badge, PanelHeader, toneForStatus } from "@/components/ui"
import { panelClass } from "./types"

/**
 * Team check (owner 2026-07-31): "how could you trust a big grid?" — the
 * per-team verification list. Every approved team gets a row with a
 * checkmark and its scheduled-game count vs the season target; clicking a
 * team opens their actual schedule — when, who, where — so the operator
 * can verify each team instead of eyeballing a grid.
 */
export function TeamCheck({
  league,
  scheduleGames,
  sessionFilterId,
  sessionLabel,
  previewing = false,
}: {
  league: any
  scheduleGames: any[]
  /** When set (session-by-session mode), counts split into session + season. */
  sessionFilterId?: string | null
  sessionLabel?: string | null
  /** True while an unsaved preview is folded into scheduleGames. */
  previewing?: boolean
}) {
  const [openTeamId, setOpenTeamId] = useState<string | null>(null)

  const target: number = league?.gamesGuaranteed ?? 0
  const approved = useMemo(
    () =>
      ((league?.teams ?? []) as any[])
        .filter((t) => t.status === "APPROVED")
        .map((t) => ({ id: t.team.id, name: t.team.name, division: t.division?.name ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [league]
  )

  const activeGames = useMemo(
    () => scheduleGames.filter((g: any) => g.status !== "CANCELLED"),
    [scheduleGames]
  )
  const gamesByTeam = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const g of activeGames) {
      for (const id of [g.homeTeamId, g.awayTeamId]) {
        if (!map.has(id)) map.set(id, [])
        map.get(id)!.push(g)
      }
    }
    for (const list of map.values())
      list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    return map
  }, [activeGames])

  if (approved.length === 0) return null

  const allGood = target > 0 && approved.every((t) => (gamesByTeam.get(t.id)?.length ?? 0) >= target)

  return (
    <div className={`reveal ${panelClass}`}>
      <PanelHeader
        title="Team check"
        action={
          allGood ? (
            <Badge tone="court" dot>
              Every team has {target} games
            </Badge>
          ) : (
            <span className="text-ink-500 text-xs font-semibold">
              {approved.filter((t) => (gamesByTeam.get(t.id)?.length ?? 0) >= target).length} of{" "}
              {approved.length} teams fully scheduled
            </span>
          )
        }
      />
      {previewing && (
        <div className="border-play-200 bg-play-50 -mt-1 mb-3 rounded-xl border px-3 py-1.5">
          <p className="text-play-700 text-xs font-semibold">
            Showing the preview — nothing is saved yet. Commit to keep this plan.
          </p>
        </div>
      )}
      <p className="text-ink-500 -mt-2 mb-3 text-xs">
        Click a team to see its schedule — when they play, who they play, and where.
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {approved.map((t) => {
          const games = gamesByTeam.get(t.id) ?? []
          const inSession = sessionFilterId
            ? games.filter((g: any) => g.sessionId === sessionFilterId).length
            : null
          const done = target > 0 && games.length >= target
          const open = openTeamId === t.id
          return (
            <div
              key={t.id}
              className={`rounded-xl border transition-colors ${
                done ? "border-court-200 bg-court-50/60" : games.length > 0 ? "border-amber-200 bg-amber-50/50" : "border-ink-200 bg-white"
              } ${open ? "sm:col-span-2" : ""}`}
            >
              <button
                onClick={() => setOpenTeamId(open ? null : t.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      done ? "bg-court-600 text-white" : games.length > 0 ? "bg-amber-400 text-white" : "bg-ink-200 text-ink-500"
                    }`}
                  >
                    {done ? "✓" : games.length}
                  </span>
                  <span className="text-ink-900 truncate text-sm font-medium">{t.name}</span>
                  {t.division && (
                    <span className="text-ink-400 hidden truncate text-xs sm:inline">{t.division}</span>
                  )}
                </span>
                <span className="text-ink-600 shrink-0 text-xs font-semibold">
                  {games.length}
                  {target > 0 ? ` / ${target}` : ""} games
                  {inSession !== null && (
                    <span className="text-ink-400 font-normal"> · {inSession} in {sessionLabel || "this session"}</span>
                  )}
                  <span className="text-ink-300 ml-1.5">{open ? "▴" : "▾"}</span>
                </span>
              </button>
              {open && (
                <div className="border-ink-100 border-t px-3 py-2">
                  {games.length === 0 ? (
                    <p className="text-ink-500 py-1 text-xs">No games scheduled yet.</p>
                  ) : (
                    <ul className="divide-ink-50 divide-y">
                      {games.map((g: any) => {
                        const home = g.homeTeamId === t.id
                        const opponent = home
                          ? g.awayTeam?.name ?? g.awayTeamId
                          : g.homeTeam?.name ?? g.homeTeamId
                        return (
                          <li key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 text-xs">
                            <span className="text-ink-700 w-36 whitespace-nowrap">
                              {new Date(g.scheduledAt).toLocaleString("en-CA", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className="text-ink-900 min-w-0 flex-1 truncate font-medium">
                              {home ? "vs" : "@"} {opponent}
                            </span>
                            <span className="text-ink-500 truncate">
                              {g.venue?.name ?? "—"}
                              {g.court?.name ? ` · ${g.court.name}` : ""}
                            </span>
                            {g.status === "PREVIEW" ? (
                              <Badge tone="play">preview</Badge>
                            ) : (
                              <>
                                {!g.publishedAt && <Badge tone="gold">draft</Badge>}
                                <Badge tone={toneForStatus(g.status)}>{g.status.toLowerCase()}</Badge>
                              </>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
