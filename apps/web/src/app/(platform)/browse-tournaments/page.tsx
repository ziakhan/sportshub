"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

interface Tournament {
  id: string
  name: string
  city: string
  state: string | null
  status: string
  startDate: string | null
  endDate: string | null
  registrationDeadline: string | null
  teamFee: number | null
  gamesGuaranteed: number | null
  currency: string
  divisions: { id: string; name: string; ageGroup: string; gender: string | null }[]
  _count: { teams: number }
}

export default function BrowseTournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/tournaments?public=true")
      .then((res) => res.json())
      .then((data) => setTournaments(data.tournaments || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading tournaments...</div>

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Browse Tournaments</h1>
        <p className="text-sm text-gray-500 mt-1">Find tournaments to enter your teams</p>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No tournaments open for registration
          </h3>
          <p className="text-gray-600">Check back soon for upcoming tournaments.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tournaments.map((tournament) => {
            const isOpen = tournament.status === "REGISTRATION"
            const deadlinePassed =
              tournament.registrationDeadline &&
              new Date(tournament.registrationDeadline) < new Date()

            return (
              <Link
                key={tournament.id}
                href={`/browse-tournaments/${tournament.id}`}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{tournament.name}</h3>
                    <p className="text-sm text-gray-500">
                      {tournament.city}
                      {tournament.state ? `, ${tournament.state}` : ""}
                    </p>
                  </div>
                  {isOpen && !deadlinePassed && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Open
                    </span>
                  )}
                </div>

                {tournament.startDate && tournament.endDate && (
                  <p className="text-xs text-gray-400 mb-2">
                    {format(new Date(tournament.startDate), "MMM d")} -{" "}
                    {format(new Date(tournament.endDate), "MMM d, yyyy")}
                  </p>
                )}

                {tournament.divisions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tournament.divisions.map((d) => (
                      <span
                        key={d.id}
                        className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700"
                      >
                        {d.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex gap-4">
                    {tournament.teamFee != null && (
                      <span>
                        {formatCurrency(tournament.teamFee, tournament.currency)}/team
                      </span>
                    )}
                    {tournament.gamesGuaranteed && (
                      <span>{tournament.gamesGuaranteed} games guaranteed</span>
                    )}
                    <span>{tournament._count.teams} teams</span>
                  </div>
                  {tournament.registrationDeadline && (
                    <span className={deadlinePassed ? "text-red-500" : ""}>
                      Deadline: {format(new Date(tournament.registrationDeadline), "MMM d")}
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
