"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PanelHeader } from "@/components/ui"
import { panelClass } from "./types"

const money = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n)

/** Per-club season report: registrations + money, on the Overview tab. */
export function SeasonReport({
  leagueId,
  seasonId,
}: {
  leagueId: string
  seasonId: string
}) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/seasons/${seasonId}/report`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setData(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [seasonId])

  if (!data || (data.clubs ?? []).length === 0) return null

  return (
    <div className={`reveal ${panelClass} mb-6`}>
      <PanelHeader
        title="Season report"
        action={
          <Link
            href={`/manage/leagues/${leagueId}/accounting`}
            className="text-play-600 hover:text-play-700 text-xs font-semibold"
          >
            League accounting &rarr;
          </Link>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ink-400 border-ink-100 border-b text-left text-xs uppercase">
              <th className="py-1.5 pr-2">Club</th>
              <th className="py-1.5 pr-2">Teams</th>
              <th className="py-1.5 pr-2">Approved</th>
              <th className="py-1.5 pr-2">Players</th>
              <th className="py-1.5 pr-2">Fees received</th>
              <th className="py-1.5 pr-2">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {data.clubs.map((c: any) => (
              <tr key={c.tenantId} className="border-ink-50 border-b">
                <td className="py-1.5 pr-2">
                  <Link
                    href={`/manage/leagues/${leagueId}/seasons/${seasonId}/clubs/${c.tenantId}`}
                    className="text-ink-900 hover:text-play-600 font-medium"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="text-ink-600 py-1.5 pr-2">{c.teams}</td>
                <td className="text-ink-600 py-1.5 pr-2">{c.approved}</td>
                <td className="text-ink-600 py-1.5 pr-2">{c.players}</td>
                <td className="text-ink-600 py-1.5 pr-2">{money(c.received)}</td>
                <td className={`py-1.5 pr-2 ${c.overdue > 0 ? "text-hoop-600 font-semibold" : "text-ink-600"}`}>
                  {money(Math.max(0, c.owed - c.received))}
                  {c.overdue > 0 ? " · overdue" : ""}
                </td>
              </tr>
            ))}
            <tr className="text-ink-900 font-semibold">
              <td className="py-2 pr-2">Total</td>
              <td className="py-2 pr-2">{data.totals.teams}</td>
              <td className="py-2 pr-2">{data.totals.approved}</td>
              <td className="py-2 pr-2">{data.totals.players}</td>
              <td className="py-2 pr-2">{money(data.totals.received)}</td>
              <td className="py-2 pr-2">{money(Math.max(0, data.totals.owed - data.totals.received))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
