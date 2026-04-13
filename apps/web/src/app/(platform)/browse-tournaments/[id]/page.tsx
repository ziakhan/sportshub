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

  if (loading) return <div className="text-ink-500 py-12 text-center">Loading...</div>
  if (!tournament)
    return <div className="text-ink-500 py-12 text-center">Tournament not found.</div>

  const isOpen = tournament.status === "REGISTRATION"
  const deadlinePassed =
    tournament.registrationDeadline && new Date(tournament.registrationDeadline) < new Date()
  const canRegister = isOpen && !deadlinePassed
  const registeredTeams = tournament.teams || []

  // Filter out teams already submitted
  const registeredTeamIds = new Set(registeredTeams.map((t: any) => t.teamId))
  const availableTeams = myTeams.filter((t: any) => !registeredTeamIds.has(t.id))

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <div className="mb-6">
        <Link
          href="/browse-tournaments"
          className="text-play-700 text-sm font-medium hover:underline"
        >
          &larr; Back to Tournaments
        </Link>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-md p-4 text-sm ${
            message.type === "success"
              ? "bg-court-50 text-court-700 border-court-200 border"
              : "bg-hoop-50 text-hoop-700 border-hoop-200 border"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tournament Info — Left 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
            <div className="mb-3 flex items-center gap-3">
              {canRegister && (
                <span className="text-court-700 rounded-full bg-green-100 px-3 py-1 text-sm font-medium">
                  Open
                </span>
              )}
            </div>
            <h1 className="text-ink-900 mb-2 text-2xl font-semibold">{tournament.name}</h1>
            <p className="text-ink-500 mb-3 text-sm">
              {tournament.city}
              {tournament.state ? `, ${tournament.state}` : ""}
            </p>
            {tournament.description && (
              <p className="text-ink-700 mb-4">{tournament.description}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {tournament.startDate && (
                <div className="border-court-100 bg-court-50 rounded-xl border p-3">
                  <div className="text-ink-500 text-xs font-medium">Dates</div>
                  <div className="text-ink-900 text-sm">
                    {format(new Date(tournament.startDate), "MMM d")} -{" "}
                    {tournament.endDate
                      ? format(new Date(tournament.endDate), "MMM d, yyyy")
                      : "TBD"}
                  </div>
                </div>
              )}
              {tournament.gamesGuaranteed && (
                <div className="border-court-100 bg-court-50 rounded-xl border p-3">
                  <div className="text-ink-500 text-xs font-medium">Games Guaranteed</div>
                  <div className="text-ink-900 text-sm">{tournament.gamesGuaranteed} games</div>
                </div>
              )}
              {tournament.registrationDeadline && (
                <div className="border-court-100 bg-court-50 rounded-xl border p-3">
                  <div className="text-ink-500 text-xs font-medium">Registration Deadline</div>
                  <div className={`text-sm ${deadlinePassed ? "text-red-600" : "text-ink-900"}`}>
                    {format(new Date(tournament.registrationDeadline), "MMM d, yyyy")}
                  </div>
                </div>
              )}
              {tournament.gameSlotMinutes && (
                <div className="border-court-100 bg-court-50 rounded-xl border p-3">
                  <div className="text-ink-500 text-xs font-medium">Game Format</div>
                  <div className="text-ink-900 text-sm">
                    {tournament.gameLengthMinutes}min (
                    {tournament.gamePeriods === "QUARTERS" ? "4 quarters" : "2 halves"})
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Divisions */}
          {tournament.divisions?.length > 0 && (
            <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
              <h2 className="text-ink-900 mb-3 font-semibold">Divisions</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {tournament.divisions.map((d: any) => (
                  <div key={d.id} className="border-court-100 bg-court-50 rounded-xl border p-3">
                    <span className="text-ink-900 font-medium">{d.name}</span>
                    <span className="text-ink-500 ml-2 text-xs">
                      {d.ageGroup}
                      {d.gender ? ` \u2022 ${d.gender}` : ""}
                    </span>
                    {d.maxTeams && (
                      <span className="text-ink-400 ml-2 text-xs">(max {d.maxTeams} teams)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Registered Teams */}
          {registeredTeams.length > 0 && (
            <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
              <h2 className="text-ink-900 mb-3 font-semibold">
                Registered Teams ({registeredTeams.length})
              </h2>
              {registeredTeams.map((t: any) => (
                <div
                  key={t.id}
                  className="border-court-100 bg-court-50 mb-1 flex items-center justify-between rounded-xl border px-3 py-2"
                >
                  <div>
                    <span className="text-ink-900 font-medium">{t.team?.name || "Unknown"}</span>
                    <span className="text-ink-500 ml-2 text-xs">{t.team?.tenant?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.division && <span className="text-play-700 text-xs">{t.division.name}</span>}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.status === "APPROVED"
                          ? "bg-court-100 text-court-700"
                          : "bg-hoop-100 text-hoop-700"
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
          <div className="border-ink-100 sticky top-4 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
            {tournament.teamFee != null && (
              <div className="mb-4 text-center">
                <div className="text-play-700 text-3xl font-bold">
                  {formatCurrency(tournament.teamFee, tournament.currency)}
                </div>
                <p className="text-ink-500 text-xs">per team</p>
              </div>
            )}

            {canRegister ? (
              <div className="space-y-3">
                <h3 className="text-ink-900 font-semibold">Submit Your Team</h3>

                {availableTeams.length === 0 ? (
                  <p className="text-ink-500 text-sm">
                    {myTeams.length === 0
                      ? "You don't have any teams yet. Create a team first."
                      : "All your teams are already submitted."}
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="text-ink-600 mb-1 block text-xs font-medium">
                        Select Team
                      </label>
                      <select
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                        className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
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
                      <label className="text-ink-600 mb-1 block text-xs font-medium">
                        Select Division
                      </label>
                      <select
                        value={selectedDivision}
                        onChange={(e) => setSelectedDivision(e.target.value)}
                        className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2"
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
                      className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
                    >
                      {submitting ? "Submitting..." : "Submit Team"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-ink-100 text-ink-600 rounded-xl p-4 text-center text-sm">
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
