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

  if (loading) return <div className="text-ink-500 py-12 text-center">Loading leagues...</div>

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-ink-900 text-3xl font-semibold">Browse Leagues</h1>
        <p className="text-ink-500 mt-1 text-sm">Find leagues to register your teams</p>
      </div>

      {leagues.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="text-ink-900 mb-2 text-lg font-semibold">
            No leagues open for registration
          </h3>
          <p className="text-ink-700">Check back soon for upcoming league seasons.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {leagues.map((league) => {
            const isOpen = league.leagueStatus === "REGISTRATION"
            const deadlinePassed =
              league.registrationDeadline && new Date(league.registrationDeadline) < new Date()

            return (
              <Link
                key={league.id}
                href={`/browse-leagues/${league.id}`}
                className="border-ink-100 hover:border-play-200 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)] transition hover:shadow-[0_20px_60px_-34px_rgba(15,23,42,0.5)]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-ink-900 text-lg font-semibold">{league.name}</h3>
                    <p className="text-ink-500 text-sm">{league.season}</p>
                  </div>
                  {isOpen && !deadlinePassed && (
                    <span className="bg-court-100 text-court-700 rounded-full px-2 py-0.5 text-xs font-medium">
                      Open
                    </span>
                  )}
                </div>

                {league.divisions.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {league.divisions.map((d) => (
                      <span
                        key={d.id}
                        className="bg-play-50 text-play-700 rounded-full px-2 py-0.5 text-xs"
                      >
                        {d.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-ink-500 flex items-center justify-between text-sm">
                  <div className="flex gap-4">
                    {league.teamFee && (
                      <span>{formatCurrency(league.teamFee, league.currency)}/team</span>
                    )}
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
