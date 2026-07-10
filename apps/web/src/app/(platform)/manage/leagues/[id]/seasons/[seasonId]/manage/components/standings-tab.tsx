"use client"

import Link from "next/link"

import { useState, useEffect } from "react"
import { Button, PanelHeader } from "@/components/ui"
import { panelClass } from "./types"

export function StandingsTab({ seasonId }: { seasonId: string }) {
  const [standings, setStandings] = useState<any[]>([])
  const [standingsLoading, setStandingsLoading] = useState(false)

  const loadStandings = async () => {
    setStandingsLoading(true)
    try {
      const res = await fetch(`/api/seasons/${seasonId}/standings`)
      if (res.ok) {
        const data = await res.json()
        setStandings(data.divisions || [])
      }
    } catch {
      // Swallow — Refresh stays enabled so the operator can retry.
    } finally {
      // Previously a thrown fetch left standingsLoading=true forever, bricking
      // the tab AND its disabled={standingsLoading} Refresh button (gap-audit).
      setStandingsLoading(false)
    }
  }

  useEffect(() => {
    loadStandings()
  }, []) // eslint-disable-line

  return (
    <div className="space-y-6">
      <div className={`reveal ${panelClass}`}>
        <PanelHeader
          className="mb-1"
          title="Standings"
          action={
            <Button size="sm" variant="subtle" onClick={loadStandings} disabled={standingsLoading}>
              {standingsLoading ? "Loading…" : "Refresh"}
            </Button>
          }
        />
        <p className="text-ink-500 mb-4 text-xs">
          Computed on read from completed games. Ties are broken in the order
          configured in the Tiebreakers tab.
        </p>

        {standingsLoading && standings.length === 0 ? (
          <p className="text-ink-500 text-sm">Loading…</p>
        ) : standings.length === 0 ? (
          <p className="text-ink-500 text-sm">
            No standings yet. Standings become meaningful once games are completed.
          </p>
        ) : (
          <div className="space-y-6">
            {standings.map((div: any) => (
              <div key={div.divisionId}>
                <h4 className="font-condensed text-ink-800 mb-2 text-sm font-bold uppercase tracking-wide">
                  {div.divisionName}
                </h4>
                {div.rows.length === 0 ? (
                  <p className="text-ink-500 text-xs">No teams in this division.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-ink-100">
                    <table className="text-ink-700 w-full text-xs">
                      <thead className="bg-ink-50 text-ink-500 text-[10px] uppercase tracking-wide">
                        <tr>
                          <th className="px-3 py-1.5 text-left">#</th>
                          <th className="px-3 py-1.5 text-left">Team</th>
                          <th className="px-3 py-1.5 text-right">GP</th>
                          <th className="px-3 py-1.5 text-right">W</th>
                          <th className="px-3 py-1.5 text-right">L</th>
                          <th className="px-3 py-1.5 text-right">T</th>
                          <th className="px-3 py-1.5 text-right">PF</th>
                          <th className="px-3 py-1.5 text-right">PA</th>
                          <th className="px-3 py-1.5 text-right">Diff</th>
                          <th className="px-3 py-1.5 text-right">Win%</th>
                          <th className="px-3 py-1.5 text-left">Tiebreakers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {div.rows.map((row: any, idx: number) => (
                          <tr
                            key={row.teamId}
                            className="border-ink-100 hover:bg-ink-50/60 border-t transition-colors"
                          >
                            <td className="px-3 py-1.5 font-mono text-[10px] text-ink-400">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-1.5 text-ink-900 font-medium">
                              <Link href={`/team/${row.teamId}`} className="hover:text-play-600 transition-colors">{row.name}</Link>
                            </td>
                            <td className="px-3 py-1.5 text-right">{row.gamesPlayed}</td>
                            <td className="px-3 py-1.5 text-right">{row.wins}</td>
                            <td className="px-3 py-1.5 text-right">{row.losses}</td>
                            <td className="px-3 py-1.5 text-right">{row.ties}</td>
                            <td className="px-3 py-1.5 text-right">{row.pointsFor}</td>
                            <td className="px-3 py-1.5 text-right">{row.pointsAgainst}</td>
                            <td
                              className={`px-3 py-1.5 text-right font-mono text-[11px] ${
                                row.differential > 0
                                  ? "text-court-700"
                                  : row.differential < 0
                                    ? "text-hoop-600"
                                    : "text-ink-500"
                              }`}
                            >
                              {row.differential > 0 ? "+" : ""}
                              {row.differential}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {(row.winPct * 100).toFixed(0)}%
                            </td>
                            <td className="px-3 py-1.5 text-ink-500 text-[10px]">
                              {row.appliedTiebreakers.length > 0
                                ? row.appliedTiebreakers.join(", ")
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
