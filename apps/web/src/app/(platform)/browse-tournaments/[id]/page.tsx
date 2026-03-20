"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

export default function TournamentDetailSubmitPage() {
  const params = useParams()
  const tournamentId = params?.id as string
  const [tournament, setTournament] = useState<any>(null)
  const [myTeams, setMyTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState("")
  const [selectedDivision, setSelectedDivision] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/tournaments/${tournamentId}`).then((r) => r.json()),
      fetch("/api/teams").then((r) => r.json()),
    ])
      .then(([tournamentData, teamsData]) => {
        setTournament(tournamentData)
        setMyTeams(teamsData.teams || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tournamentId])

  const handleSubmit = async () => {
    if (!selectedTeam || !selectedDivision) {
      setMessage({ type: "error", text: "Select a team and division" })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selectedTeam, divisionId: selectedDivision }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to submit")
      setMessage({ type: "success", text: data.message || "Team submitted successfully!" })
      // Refresh tournament data
      const updated = await fetch(`/api/tournaments/${tournamentId}`).then((r) => r.json())
      setTournament(updated)
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to submit" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="text-gray-500 py-12 text-center">Loading...</div>
  if (!tournament)
    return <div className="text-gray-500 py-12 text-center">Tournament not found.</div>

  const isOpen = tournament.status === "REGISTRATION"
  const deadlinePassed =
    tournament.registrationDeadline && new Date(tournament.registrationDeadline) < new Date()
  const canRegister = isOpen && !deadlinePassed
  const registeredTeams = tournament.teams || []

  // Filter out teams already submitted
  const registeredTeamIds = new Set(registeredTeams.map((t: any) => t.teamId))
  const availableTeams = myTeams.filter((t: any) => !registeredTeamIds.has(t.id))

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/browse-tournaments" className="text-sm text-orange-600 hover:underline">
          &larr; Back to Tournaments
        </Link>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-md p-4 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tournament Info — Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              {canRegister && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                  Open
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{tournament.name}</h1>
            <p className="text-sm text-gray-500 mb-3">
              {tournament.city}
              {tournament.state ? `, ${tournament.state}` : ""}
            </p>
            {tournament.description && (
              <p className="text-gray-700 mb-4">{tournament.description}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {tournament.startDate && (
                <div className="rounded-md bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Dates</div>
                  <div className="text-sm text-gray-900">
                    {format(new Date(tournament.startDate), "MMM d")} -{" "}
                    {tournament.endDate
                      ? format(new Date(tournament.endDate), "MMM d, yyyy")
                      : "TBD"}
                  </div>
                </div>
              )}
              {tournament.gamesGuaranteed && (
                <div className="rounded-md bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Games Guaranteed</div>
                  <div className="text-sm text-gray-900">{tournament.gamesGuaranteed} games</div>
                </div>
              )}
              {tournament.registrationDeadline && (
                <div className="rounded-md bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Registration Deadline</div>
                  <div
                    className={`text-sm ${deadlinePassed ? "text-red-600" : "text-gray-900"}`}
                  >
                    {format(new Date(tournament.registrationDeadline), "MMM d, yyyy")}
                  </div>
                </div>
              )}
              {tournament.gameSlotMinutes && (
                <div className="rounded-md bg-gray-50 p-3">
                  <div className="text-xs font-medium text-gray-500">Game Format</div>
                  <div className="text-sm text-gray-900">
                    {tournament.gameLengthMinutes}min (
                    {tournament.gamePeriods === "QUARTERS" ? "4 quarters" : "2 halves"})
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Divisions */}
          {tournament.divisions?.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-3">Divisions</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {tournament.divisions.map((d: any) => (
                  <div
                    key={d.id}
                    className="rounded-md border border-gray-100 bg-gray-50 p-3"
                  >
                    <span className="font-medium text-gray-900">{d.name}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {d.ageGroup}
                      {d.gender ? ` \u2022 ${d.gender}` : ""}
                    </span>
                    {d.maxTeams && (
                      <span className="ml-2 text-xs text-gray-400">
                        (max {d.maxTeams} teams)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Registered Teams */}
          {registeredTeams.length > 0 && (
            <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200">
              <h2 className="font-semibold text-gray-900 mb-3">
                Registered Teams ({registeredTeams.length})
              </h2>
              {registeredTeams.map((t: any) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 mb-1"
                >
                  <div>
                    <span className="font-medium text-gray-900">
                      {t.team?.name || "Unknown"}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">{t.team?.tenant?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.division && (
                      <span className="text-xs text-orange-600">{t.division.name}</span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.status === "APPROVED"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {t.status.toLowerCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — Submit Team (1/3) */}
        <div>
          <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-200 sticky top-4">
            {tournament.teamFee != null && (
              <div className="mb-4 text-center">
                <div className="text-3xl font-bold text-orange-600">
                  {formatCurrency(tournament.teamFee, tournament.currency)}
                </div>
                <p className="text-xs text-gray-500">per team</p>
              </div>
            )}

            {canRegister ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Submit Your Team</h3>

                {availableTeams.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {myTeams.length === 0
                      ? "You don't have any teams yet. Create a team first."
                      : "All your teams are already submitted."}
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Select Team
                      </label>
                      <select
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        <option value="">Choose team...</option>
                        {availableTeams.map((t: any) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.ageGroup}
                            {t.gender ? ` ${t.gender}` : ""})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Select Division
                      </label>
                      <select
                        value={selectedDivision}
                        onChange={(e) => setSelectedDivision(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500"
                      >
                        <option value="">Choose division...</option>
                        {tournament.divisions?.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.ageGroup})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={submitting || !selectedTeam || !selectedDivision}
                      className="w-full rounded-md bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      {submitting ? "Submitting..." : "Submit Team"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-md bg-gray-100 p-4 text-center text-sm text-gray-600">
                {deadlinePassed
                  ? "Registration deadline has passed."
                  : "Registration is not open yet."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
