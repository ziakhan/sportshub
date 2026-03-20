"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

export default function PublicTournamentPage() {
  const params = useParams()
  const id = params?.id as string
  const [tournament, setTournament] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/tournaments/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.id) setTournament(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading...</div>
  if (!tournament) return <div className="text-gray-500 py-12 text-center">Tournament not found.</div>

  const isOpen = tournament.status === "REGISTRATION"
  const deadlinePassed =
    tournament.registrationDeadline && new Date(tournament.registrationDeadline) < new Date()
  const canRegister = isOpen && !deadlinePassed
  const approvedTeams = (tournament.teams || []).filter((t: any) => t.status === "APPROVED")

  return (
    <>
      {/* Banner */}
      <div className="bg-navy-900 border-b border-navy-700">
        <div className="container mx-auto px-4 py-6">
          <Link href="/events" className="mb-2 inline-block text-sm text-gray-400 hover:text-white">
            &larr; Back to Events
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">{tournament.name}</h2>
            {canRegister && (
              <span className="rounded-full bg-green-500/20 px-3 py-0.5 text-xs font-medium text-green-400">
                Open for Registration
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">
            {tournament.city}{tournament.state ? `, ${tournament.state}` : ""}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-lg bg-white p-8 shadow border border-gray-200">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{tournament.name}</h1>
              <p className="text-gray-500 mb-4">
                {tournament.city}{tournament.state ? `, ${tournament.state}` : ""}
              </p>

              {tournament.description && (
                <p className="text-gray-700 mb-6">{tournament.description}</p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {tournament.startDate && (
                  <div className="rounded-md bg-gray-50 p-4">
                    <div className="text-sm font-medium text-gray-500 mb-1">Dates</div>
                    <div className="text-gray-900">
                      {format(new Date(tournament.startDate), "MMM d")} -{" "}
                      {tournament.endDate ? format(new Date(tournament.endDate), "MMM d, yyyy") : "TBD"}
                    </div>
                  </div>
                )}
                {tournament.gamesGuaranteed && (
                  <div className="rounded-md bg-gray-50 p-4">
                    <div className="text-sm font-medium text-gray-500 mb-1">Games Guaranteed</div>
                    <div className="text-gray-900">{tournament.gamesGuaranteed} games</div>
                  </div>
                )}
                {tournament.registrationDeadline && (
                  <div className="rounded-md bg-gray-50 p-4">
                    <div className="text-sm font-medium text-gray-500 mb-1">Registration Deadline</div>
                    <div className={`${deadlinePassed ? "text-red-600" : "text-gray-900"}`}>
                      {format(new Date(tournament.registrationDeadline), "MMM d, yyyy")}
                    </div>
                  </div>
                )}
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Game Format</div>
                  <div className="text-gray-900">
                    {tournament.gameLengthMinutes || 40}min ({tournament.gamePeriods === "QUARTERS" ? "4 quarters" : "2 halves"})
                  </div>
                </div>
              </div>
            </div>

            {/* Divisions */}
            {tournament.divisions?.length > 0 && (
              <div className="rounded-lg bg-white p-8 shadow border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Divisions</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tournament.divisions.map((d: any) => (
                    <div key={d.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                      <span className="font-medium text-gray-900">{d.name}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {d.ageGroup}{d.gender ? ` \u2022 ${d.gender}` : ""}
                      </span>
                      {d.maxTeams && (
                        <span className="ml-2 text-xs text-gray-400">(max {d.maxTeams})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Registered Teams */}
            {approvedTeams.length > 0 && (
              <div className="rounded-lg bg-white p-8 shadow border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Registered Teams ({approvedTeams.length})
                </h2>
                {approvedTeams.map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 mb-1"
                  >
                    <div>
                      <span className="font-medium text-gray-900">{t.team?.name || "Unknown"}</span>
                      <span className="ml-2 text-xs text-gray-500">{t.team?.tenant?.name}</span>
                    </div>
                    {t.division && (
                      <span className="text-xs text-orange-600">{t.division.name}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            <div className="rounded-lg bg-white p-6 shadow border border-gray-200 sticky top-4">
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-orange-600">
                  {tournament.teamFee != null
                    ? formatCurrency(Number(tournament.teamFee), tournament.currency || "CAD")
                    : "TBD"}
                </div>
                <p className="text-xs text-gray-500 mt-1">per team</p>
              </div>

              {canRegister ? (
                <Link
                  href={`/sign-in?callbackUrl=/browse-tournaments/${tournament.id}`}
                  className="block w-full rounded-md bg-orange-500 px-4 py-3 text-center font-semibold text-white hover:bg-orange-600"
                >
                  Register Your Team
                </Link>
              ) : (
                <div className="rounded-md bg-gray-100 p-4 text-center text-sm text-gray-600">
                  {deadlinePassed ? "Registration deadline has passed." : "Registration is not open yet."}
                </div>
              )}

              {tournament.playoffFormat && (
                <div className="mt-4 pt-4 border-t text-center">
                  <div className="text-xs text-gray-500">Playoffs</div>
                  <div className="text-sm font-medium text-gray-900">
                    {tournament.playoffFormat.replace(/_/g, " ")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
