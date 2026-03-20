"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"

const STATUS_FLOW = [
  "DRAFT",
  "REGISTRATION",
  "REGISTRATION_CLOSED",
  "FINALIZED",
  "IN_PROGRESS",
  "COMPLETED",
]
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  REGISTRATION: "Open for Registration",
  REGISTRATION_CLOSED: "Registration Closed",
  FINALIZED: "Finalized",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
}

const AGE_GROUPS = [
  "U5", "U6", "U7", "U8", "U9", "U10", "U11", "U12",
  "U13", "U14", "U15", "U16", "U17", "U18",
]

export default function TournamentManagePage() {
  const params = useParams()
  const clubId = params?.id as string
  const tournamentId = params?.tournamentId as string
  const [tournament, setTournament] = useState<any>(null)
  const [divisions, setDivisions] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [venues, setVenues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Division form
  const [divName, setDivName] = useState("")
  const [divAgeGroup, setDivAgeGroup] = useState("")
  const [divGender, setDivGender] = useState("MALE")
  const [divMaxTeams, setDivMaxTeams] = useState("")

  // Venue form
  const [venueName, setVenueName] = useState("")
  const [venueAddress, setVenueAddress] = useState("")
  const [venueCity, setVenueCity] = useState("")

  const fetchAll = async () => {
    try {
      const [tournamentRes, divRes, teamsRes, venuesRes] = await Promise.all([
        fetch(`/api/tournaments/${tournamentId}`),
        fetch(`/api/tournaments/${tournamentId}/divisions`),
        fetch(`/api/tournaments/${tournamentId}/teams`),
        fetch(`/api/tournaments/${tournamentId}/venues`),
      ])
      const tournamentData = await tournamentRes.json()
      const divData = await divRes.json()
      const teamsData = await teamsRes.json()
      const venuesData = await venuesRes.json()
      setTournament(tournamentData)
      setDivisions(divData.divisions || [])
      setTeams(teamsData.teams || [])
      setVenues(venuesData.venues || [])
    } catch {
      // handle silently
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [tournamentId]) // eslint-disable-line

  const updateStatus = async (newStatus: string) => {
    await fetch(`/api/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchAll()
  }

  const addDivision = async () => {
    if (!divName || !divAgeGroup) return
    await fetch(`/api/tournaments/${tournamentId}/divisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: divName,
        ageGroup: divAgeGroup,
        gender: divGender || undefined,
        maxTeams: divMaxTeams ? parseInt(divMaxTeams) : undefined,
      }),
    })
    setDivName("")
    setDivAgeGroup("")
    setDivGender("MALE")
    setDivMaxTeams("")
    fetchAll()
  }

  const removeDivision = async (divisionId: string) => {
    await fetch(`/api/tournaments/${tournamentId}/divisions?divisionId=${divisionId}`, {
      method: "DELETE",
    })
    fetchAll()
  }

  const updateTeamStatus = async (tournamentTeamId: string, status: string) => {
    await fetch(`/api/tournaments/${tournamentId}/teams`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tournamentTeamId, status }),
    })
    fetchAll()
  }

  const addVenue = async () => {
    if (!venueName || !venueCity) return
    await fetch(`/api/tournaments/${tournamentId}/venues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: venueName,
        address: venueAddress || undefined,
        city: venueCity,
      }),
    })
    setVenueName("")
    setVenueAddress("")
    setVenueCity("")
    fetchAll()
  }

  const removeVenue = async (venueId: string) => {
    await fetch(`/api/tournaments/${tournamentId}/venues?venueId=${venueId}`, {
      method: "DELETE",
    })
    fetchAll()
  }

  if (loading) return <div className="text-gray-500 py-12 text-center p-6">Loading...</div>
  if (!tournament)
    return <div className="text-gray-500 py-12 text-center p-6">Tournament not found.</div>

  const currentIdx = STATUS_FLOW.indexOf(tournament.status)
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null

  const nextButtonLabel = (status: string) => {
    switch (status) {
      case "REGISTRATION":
        return "Open Registration"
      case "REGISTRATION_CLOSED":
        return "Close Registration"
      case "FINALIZED":
        return "Finalize Tournament"
      case "IN_PROGRESS":
        return "Start Tournament"
      case "COMPLETED":
        return "Mark Completed"
      default:
        return "Next"
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href={`/clubs/${clubId}/tournaments`}
          className="text-sm text-orange-600 hover:underline"
        >
          &larr; Back to Tournaments
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-sm text-gray-500">
            {tournament.city}
            {tournament.state ? `, ${tournament.state}` : ""}
          </p>
          <span className="mt-1 inline-block rounded-full bg-orange-100 px-3 py-0.5 text-xs font-medium text-orange-700">
            {STATUS_LABELS[tournament.status]}
          </span>
          {tournament.startDate && tournament.endDate && (
            <p className="text-xs text-gray-400 mt-1">
              {format(new Date(tournament.startDate), "MMM d")} -{" "}
              {format(new Date(tournament.endDate), "MMM d, yyyy")}
            </p>
          )}
        </div>
        {nextStatus && (
          <button
            onClick={() => updateStatus(nextStatus)}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            {nextButtonLabel(nextStatus)}
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{divisions.length}</div>
          <div className="text-xs text-gray-500">Divisions</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{teams.length}</div>
          <div className="text-xs text-gray-500">Teams</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{venues.length}</div>
          <div className="text-xs text-gray-500">Venues</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Divisions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Divisions</h3>
          {divisions.length === 0 && (
            <p className="text-sm text-gray-500 mb-4">No divisions added yet.</p>
          )}
          {divisions.map((d: any) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 mb-2"
            >
              <div>
                <span className="font-medium text-gray-900">{d.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {d.ageGroup}
                  {d.gender ? ` \u2022 ${d.gender}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {d.maxTeams && (
                  <span className="text-xs text-gray-400">max {d.maxTeams}</span>
                )}
                <span className="text-xs text-gray-400">
                  {d._count?.teams || 0} teams
                </span>
                <button
                  onClick={() => removeDivision(d.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="mt-4 space-y-2 border-t pt-4">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={divName}
                onChange={(e) => setDivName(e.target.value)}
                placeholder="Division name"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500"
              />
              <select
                value={divAgeGroup}
                onChange={(e) => setDivAgeGroup(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500"
              >
                <option value="">Age group...</option>
                {AGE_GROUPS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={divGender}
                onChange={(e) => setDivGender(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500"
              >
                <option value="MALE">Boys</option>
                <option value="FEMALE">Girls</option>
                <option value="">Co-ed</option>
              </select>
              <input
                type="number"
                min="2"
                value={divMaxTeams}
                onChange={(e) => setDivMaxTeams(e.target.value)}
                placeholder="Max teams (optional)"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500"
              />
            </div>
            <button
              onClick={addDivision}
              className="w-full rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
            >
              Add Division
            </button>
          </div>
        </div>

        {/* Registered Teams */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Registered Teams</h3>
          {teams.length === 0 ? (
            <p className="text-sm text-gray-500">No teams registered yet.</p>
          ) : (
            teams.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 mb-2"
              >
                <div>
                  <span className="font-medium text-gray-900">{t.team?.name || "Unknown"}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {t.team?.tenant?.name}
                  </span>
                  {t.division && (
                    <span className="ml-2 text-xs text-orange-600">{t.division.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.status === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : t.status === "REJECTED"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {t.status.toLowerCase()}
                  </span>
                  {t.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => updateTeamStatus(t.id, "APPROVED")}
                        className="rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateTeamStatus(t.id, "REJECTED")}
                        className="rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Venues */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Venues</h3>
          {venues.length === 0 && (
            <p className="text-sm text-gray-500 mb-4">No venues added yet.</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {venues.map((v: any) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
              >
                <div>
                  <span className="font-medium text-gray-900">{v.name}</span>
                  {v.address && (
                    <span className="ml-2 text-xs text-gray-500">{v.address}</span>
                  )}
                  <span className="ml-2 text-xs text-gray-400">{v.city}</span>
                </div>
                <button
                  onClick={() => removeVenue(v.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t pt-4">
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Venue name *"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500"
              />
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="Address (optional)"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500"
              />
              <input
                type="text"
                value={venueCity}
                onChange={(e) => setVenueCity(e.target.value)}
                placeholder="City *"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:ring-orange-500"
              />
            </div>
            <button
              onClick={addVenue}
              className="w-full rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
            >
              Add Venue
            </button>
          </div>
        </div>
      </div>

      {/* Tournament Summary */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Tournament Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {tournament.startDate && (
            <div>
              <span className="text-gray-500">Start:</span>{" "}
              {format(new Date(tournament.startDate), "MMM d, yyyy")}
            </div>
          )}
          {tournament.endDate && (
            <div>
              <span className="text-gray-500">End:</span>{" "}
              {format(new Date(tournament.endDate), "MMM d, yyyy")}
            </div>
          )}
          {tournament.registrationDeadline && (
            <div>
              <span className="text-gray-500">Registration Deadline:</span>{" "}
              {format(new Date(tournament.registrationDeadline), "MMM d, yyyy")}
            </div>
          )}
          {tournament.teamFee != null && (
            <div>
              <span className="text-gray-500">Team Fee:</span>{" "}
              {formatCurrency(tournament.teamFee, tournament.currency)}
            </div>
          )}
          {tournament.gamesGuaranteed && (
            <div>
              <span className="text-gray-500">Games Guaranteed:</span>{" "}
              {tournament.gamesGuaranteed}
            </div>
          )}
          {tournament.gameLengthMinutes && (
            <div>
              <span className="text-gray-500">Game Format:</span>{" "}
              {tournament.gameLengthMinutes}min (
              {tournament.gamePeriods === "QUARTERS" ? "4 quarters" : "2 halves"})
            </div>
          )}
          {tournament.playoffFormat && (
            <div>
              <span className="text-gray-500">Playoffs:</span>{" "}
              {tournament.playoffFormat.replace(/_/g, " ")}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
