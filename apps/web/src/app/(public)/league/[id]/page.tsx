"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

export default function PublicLeaguePage() {
  const params = useParams()
  const id = params?.id as string
  const [league, setLeague] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/leagues/${id}`)
      .then((res) => res.json())
      .then((data) => { if (data.id) setLeague(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading...</div>
  if (!league) return <div className="text-gray-500 py-12 text-center">League not found.</div>

  const isOpen = league.leagueStatus === "REGISTRATION"
  const deadlinePassed = league.registrationDeadline && new Date(league.registrationDeadline) < new Date()
  const registeredTeams = league.teams?.filter((t: any) => t.status === "APPROVED") || []

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/events" className="text-sm text-orange-600 hover:underline">&larr; Back to Events</Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="rounded-lg bg-white p-8 shadow border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              {isOpen && <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">Open for Registration</span>}
              {league.leagueStatus === "IN_PROGRESS" && <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">In Progress</span>}
              {league.season && <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">{league.season}</span>}
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">{league.name}</h1>
            {league.description && <p className="text-gray-700 mb-4">{league.description}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              {league.startDate && (
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Season</div>
                  <div className="text-gray-900">
                    {format(new Date(league.startDate), "MMM d")} - {league.endDate ? format(new Date(league.endDate), "MMM d, yyyy") : "TBD"}
                  </div>
                </div>
              )}
              {league.gamesGuaranteed && (
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Games Guaranteed</div>
                  <div className="text-gray-900">{league.gamesGuaranteed} regular season games</div>
                </div>
              )}
              {league.registrationDeadline && (
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Registration Deadline</div>
                  <div className={`${deadlinePassed ? "text-red-600" : "text-gray-900"}`}>
                    {format(new Date(league.registrationDeadline), "MMM d, yyyy")}
                    {deadlinePassed && " (Closed)"}
                  </div>
                </div>
              )}
              {league.playoffFormat && (
                <div className="rounded-md bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-500 mb-1">Playoffs</div>
                  <div className="text-gray-900">
                    {league.playoffFormat.replace(/_/g, " ")}
                    {league.playoffTeams ? ` (Top ${league.playoffTeams})` : ""}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Divisions */}
          {league.divisions?.length > 0 && (
            <div className="rounded-lg bg-white p-8 shadow border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Divisions</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {league.divisions.map((d: any) => (
                  <div key={d.id} className="rounded-md border border-gray-100 bg-gray-50 p-4">
                    <h3 className="font-medium text-gray-900">{d.name}</h3>
                    <p className="text-sm text-gray-500">
                      {d.ageGroup}{d.gender ? ` \u2022 ${d.gender}` : ""}
                      {d.tier > 1 ? ` \u2022 Tier ${d.tier}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Registered Teams */}
          {registeredTeams.length > 0 && (
            <div className="rounded-lg bg-white p-8 shadow border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Registered Teams ({registeredTeams.length})</h2>
              <div className="space-y-2">
                {registeredTeams.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between rounded-md bg-gray-50 px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">{t.team.name}</span>
                      {t.team.tenant && (
                        <Link href={`/club/${t.team.tenant.slug}`} className="ml-2 text-xs text-orange-600 hover:underline">
                          {t.team.tenant.name}
                        </Link>
                      )}
                    </div>
                    {t.division && <span className="text-xs text-gray-500">{t.division.name}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div className="rounded-lg bg-white p-6 shadow border border-gray-200 sticky top-4">
            {league.teamFee && (
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-orange-600">{formatCurrency(league.teamFee)}</div>
                <p className="text-xs text-gray-500">per team</p>
              </div>
            )}

            {isOpen && !deadlinePassed ? (
              <Link href={`/browse-leagues/${id}`}
                className="block w-full rounded-md bg-orange-500 px-4 py-3 text-center font-semibold text-white hover:bg-orange-600">
                Register Your Team
              </Link>
            ) : (
              <div className="rounded-md bg-gray-100 p-4 text-center text-sm text-gray-600">
                {deadlinePassed ? "Registration is closed." : "Registration is not open yet."}
              </div>
            )}

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Teams Registered</span>
                <span className="font-medium">{league._count?.teams || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Divisions</span>
                <span className="font-medium">{league.divisions?.length || 0}</span>
              </div>
              {league._count?.sessions > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Game Days</span>
                  <span className="font-medium">{league._count.sessions}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
