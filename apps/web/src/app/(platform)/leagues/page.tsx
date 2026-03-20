"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

interface League {
  id: string
  name: string
  season: string
  leagueStatus: string
  startDate: string | null
  endDate: string | null
  registrationDeadline: string | null
  teamFee: number | null
  gamesGuaranteed: number | null
  _count: { teams: number; games: number }
  divisions: { id: string; name: string; ageGroup: string }[]
  owner?: { name: string; email: string }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  REGISTRATION: { label: "Open for Registration", color: "bg-green-100 text-green-700" },
  REGISTRATION_CLOSED: { label: "Registration Closed", color: "bg-yellow-100 text-yellow-700" },
  FINALIZED: { label: "Finalized", color: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "In Progress", color: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "Completed", color: "bg-gray-100 text-gray-600" },
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/leagues?mine=true")
      .then((res) => res.json())
      .then((data) => setLeagues(data.leagues || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500 py-12 text-center p-6">Loading...</div>

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Leagues</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your league seasons</p>
        </div>
        <Link href="/leagues/create"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Create Season
        </Link>
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No leagues yet</h3>
          <p className="text-gray-600 mb-6">Create your first league season to get started.</p>
          <Link href="/leagues/create"
            className="inline-block rounded-md bg-blue-600 px-6 py-2 text-white font-semibold hover:bg-blue-700">
            Create Your First Season
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {leagues.map((league) => {
            const status = STATUS_LABELS[league.leagueStatus] || STATUS_LABELS.DRAFT
            return (
              <Link key={league.id} href={`/leagues/${league.id}/manage`}
                className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{league.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{league.season}</p>
                    {league.owner && (
                      <p className="text-xs text-gray-400">Owner: {league.owner.name} ({league.owner.email})</p>
                    )}
                    {league.startDate && league.endDate && (
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(league.startDate), "MMM d")} - {format(new Date(league.endDate), "MMM d, yyyy")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {league.divisions.map((d) => (
                        <span key={d.id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">{league._count.teams}</div>
                    <div className="text-xs text-gray-500">teams</div>
                    {league.teamFee && (
                      <div className="text-xs text-gray-400 mt-1">{formatCurrency(league.teamFee)}/team</div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
