"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

interface Tournament {
  id: string
  name: string
  city: string
  state: string | null
  description: string | null
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700" },
  REGISTRATION: { label: "Open for Registration", color: "bg-green-100 text-green-700" },
  REGISTRATION_CLOSED: { label: "Registration Closed", color: "bg-yellow-100 text-yellow-700" },
  FINALIZED: { label: "Finalized", color: "bg-orange-100 text-orange-700" },
  IN_PROGRESS: { label: "In Progress", color: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "Completed", color: "bg-gray-100 text-gray-600" },
}

export default function ClubTournamentsPage() {
  const params = useParams()
  const clubId = params?.id as string
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/tournaments?mine=true&tenantId=${clubId}`)
      .then((res) => res.json())
      .then((data) => setTournaments(data.tournaments || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clubId])

  const togglePublish = async (tournamentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "DRAFT" ? "REGISTRATION" : "DRAFT"
    await fetch(`/api/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    setTournaments((prev) =>
      prev.map((t) => (t.id === tournamentId ? { ...t, status: newStatus } : t))
    )
  }

  if (loading) return <div className="text-gray-500 py-12 text-center p-6">Loading...</div>

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your club&apos;s tournaments</p>
        </div>
        <Link
          href={`/clubs/${clubId}/tournaments/create`}
          className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          Create Tournament
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tournaments yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first tournament to attract teams from across the region.
          </p>
          <Link
            href={`/clubs/${clubId}/tournaments/create`}
            className="inline-block rounded-md bg-orange-500 px-6 py-2 text-white font-semibold hover:bg-orange-600"
          >
            Create Your First Tournament
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tournaments.map((tournament) => {
            const status = STATUS_LABELS[tournament.status] || STATUS_LABELS.DRAFT
            return (
              <div
                key={tournament.id}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <Link
                    href={`/clubs/${clubId}/tournaments/${tournament.id}/manage`}
                    className="flex-1"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{tournament.name}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{tournament.city}{tournament.state ? `, ${tournament.state}` : ""}</p>
                    {tournament.startDate && tournament.endDate && (
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(tournament.startDate), "MMM d")} -{" "}
                        {format(new Date(tournament.endDate), "MMM d, yyyy")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tournament.divisions.map((d) => (
                        <span
                          key={d.id}
                          className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700"
                        >
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </Link>
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-600">
                        {tournament._count.teams}
                      </div>
                      <div className="text-xs text-gray-500">teams</div>
                      {tournament.teamFee != null && (
                        <div className="text-xs text-gray-400 mt-1">
                          {formatCurrency(tournament.teamFee, tournament.currency)}/team
                        </div>
                      )}
                    </div>
                    {(tournament.status === "DRAFT" || tournament.status === "REGISTRATION") && (
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          togglePublish(tournament.id, tournament.status)
                        }}
                        className={`rounded-md px-3 py-1 text-xs font-medium ${
                          tournament.status === "DRAFT"
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {tournament.status === "DRAFT" ? "Publish" : "Unpublish"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
