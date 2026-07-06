"use client"

import Link from "next/link"

import { useState, useEffect } from "react"
import { panelClass } from "./types"

export function StandingsTab({ seasonId }: { seasonId: string }) {
  const [standings, setStandings] = useState<any[]>([])
  const [standingsLoading, setStandingsLoading] = useState(false)

  const loadStandings = async () => {
    setStandingsLoading(true)
    const res = await fetch(`/api/seasons/${seasonId}/standings`)
    if (res.ok) {
      const data = await res.json()
      setStandings(data.divisions || [])
    }
    setStandingsLoading(false)
  }

  useEffect(() => {
    loadStandings()
  }, []) // eslint-disable-line

  return (
    <div className="space-y-6">
      <div className={panelClass}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-ink-900 font-semibold">Standings</h3>
            <p className="text-ink-500 mt-0.5 text-xs">
              Computed on read from completed games. Ties are broken in the order
              configured in the Tiebreakers tab.
            </p>
          </div>
          <button
            onClick={loadStandings}
            disabled={standingsLoading}
            className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {standingsLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

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
                <h4 className="text-ink-800 mb-2 text-sm font-semibold">
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
                          <tr key={row.teamId} className="border-ink-100 border-t">
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
