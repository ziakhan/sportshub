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

  if (loading) return <div className="text-ink-500 py-12 text-center">Loading tournaments...</div>

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-ink-900 text-3xl font-semibold">Browse Tournaments</h1>
        <p className="text-ink-500 mt-1 text-sm">Find tournaments to enter your teams</p>
      </div>

      {tournaments.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-12 text-center">
          <h3 className="text-ink-900 mb-2 text-lg font-semibold">
            No tournaments open for registration
          </h3>
          <p className="text-ink-700">Check back soon for upcoming tournaments.</p>
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
                className="border-ink-100 hover:border-play-200 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)] transition hover:shadow-[0_20px_60px_-34px_rgba(15,23,42,0.5)]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-ink-900 text-lg font-semibold">{tournament.name}</h3>
                    <p className="text-ink-500 text-sm">
                      {tournament.city}
                      {tournament.state ? `, ${tournament.state}` : ""}
                    </p>
                  </div>
                  {isOpen && !deadlinePassed && (
                    <span className="bg-court-100 text-court-700 rounded-full px-2 py-0.5 text-xs font-medium">
                      Open
                    </span>
                  )}
                </div>

                {tournament.startDate && tournament.endDate && (
                  <p className="text-ink-400 mb-2 text-xs">
                    {format(new Date(tournament.startDate), "MMM d")} -{" "}
                    {format(new Date(tournament.endDate), "MMM d, yyyy")}
                  </p>
                )}

                {tournament.divisions.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {tournament.divisions.map((d) => (
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
                    {tournament.teamFee != null && (
                      <span>{formatCurrency(tournament.teamFee, tournament.currency)}/team</span>
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
