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
  currency: string
  divisions: { id: string; name: string; ageGroup: string; gender: string | null }[]
  _count: { teams: number }
}

export default function BrowseLeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/leagues?public=true")
      .then((res) => res.json())
      .then((data) => setLeagues(data.leagues || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading leagues...</div>

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Browse Leagues</h1>
        <p className="text-sm text-gray-500 mt-1">Find leagues to register your teams</p>
      </div>

      {leagues.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No leagues open for registration</h3>
          <p className="text-gray-600">Check back soon for upcoming league seasons.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {leagues.map((league) => {
            const isOpen = league.leagueStatus === "REGISTRATION"
            const deadlinePassed = league.registrationDeadline && new Date(league.registrationDeadline) < new Date()

            return (
              <Link key={league.id} href={`/browse-leagues/${league.id}`}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{league.name}</h3>
                    <p className="text-sm text-gray-500">{league.season}</p>
                  </div>
                  {isOpen && !deadlinePassed && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Open</span>
                  )}
                </div>

                {league.divisions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {league.divisions.map((d) => (
                      <span key={d.id} className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                        {d.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex gap-4">
                    {league.teamFee && <span>{formatCurrency(league.teamFee, league.currency)}/team</span>}
                    {league.gamesGuaranteed && <span>{league.gamesGuaranteed} games</span>}
                    <span>{league._count.teams} teams registered</span>
                  </div>
                  {league.registrationDeadline && (
                    <span className={deadlinePassed ? "text-red-500" : ""}>
                      Deadline: {format(new Date(league.registrationDeadline), "MMM d")}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
