"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { VenueSelector } from "@/components/venue-selector"

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

export default function LeagueManagePage() {
  const params = useParams()
  const leagueId = params?.id as string
  const [league, setLeague] = useState<any>(null)
  const [divisions, setDivisions] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [venues, setVenues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Division form
  const [divName, setDivName] = useState("")
  const [divAgeGroup, setDivAgeGroup] = useState("")
  const [divGender, setDivGender] = useState("MALE")
  const [divTier, setDivTier] = useState("1")

  // Session form
  const [sessionLabel, setSessionLabel] = useState("")
  const [sessionDays, setSessionDays] = useState([
    { date: "", startTime: "09:00", endTime: "17:00" },
  ])

  // Venue form
  const [selectedVenueId, setSelectedVenueId] = useState("")
  const [selectedVenueName, setSelectedVenueName] = useState("")
  const panelClass =
    "rounded-3xl border border-ink-100 bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
  const inputClass =
    "rounded-xl border border-ink-200 px-2 py-1.5 text-sm text-ink-900 focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

  const fetchAll = async () => {
    const [leagueRes, divRes, sessRes, venRes] = await Promise.all([
      fetch(`/api/leagues/${leagueId}`),
      fetch(`/api/leagues/${leagueId}/divisions`),
      fetch(`/api/leagues/${leagueId}/sessions`),
      fetch(`/api/leagues/${leagueId}/venues`),
    ])
    const leagueData = await leagueRes.json()
    const divData = await divRes.json()
    const sessData = await sessRes.json()
    const venData = await venRes.json()
    setLeague(leagueData)
    setDivisions(divData.divisions || [])
    setSessions(sessData.sessions || [])
    setVenues(venData.venues || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [leagueId]) // eslint-disable-line

  const updateStatus = async (newStatus: string) => {
    await fetch(`/api/leagues/${leagueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leagueStatus: newStatus }),
    })
    fetchAll()
  }

  const addDivision = async () => {
    if (!divName || !divAgeGroup) return
    await fetch(`/api/leagues/${leagueId}/divisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: divName,
        ageGroup: divAgeGroup,
        gender: divGender || undefined,
        tier: parseInt(divTier),
      }),
    })
    setDivName("")
    setDivAgeGroup("")
    setDivGender("")
    setDivTier("1")
    fetchAll()
  }

  const addSessionDay = () => {
    setSessionDays([...sessionDays, { date: "", startTime: "09:00", endTime: "17:00" }])
  }

  const updateSessionDay = (idx: number, field: string, value: string) => {
    setSessionDays(sessionDays.map((d, i) => (i === idx ? { ...d, [field]: value } : d)))
  }

  const removeSessionDay = (idx: number) => {
    if (sessionDays.length > 1) setSessionDays(sessionDays.filter((_, i) => i !== idx))
  }

  const addSession = async () => {
    const validDays = sessionDays.filter((d) => d.date)
    if (validDays.length === 0) return
    await fetch(`/api/leagues/${leagueId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: sessionLabel || undefined,
        days: validDays.map((d) => ({
          date: new Date(d.date).toISOString(),
          startTime: d.startTime,
          endTime: d.endTime,
        })),
      }),
    })
    setSessionLabel("")
    setSessionDays([{ date: "", startTime: "09:00", endTime: "17:00" }])
    fetchAll()
  }

  const addVenue = async () => {
    if (!selectedVenueId) return
    await fetch(`/api/leagues/${leagueId}/venues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId: selectedVenueId }),
    })
    setSelectedVenueId("")
    setSelectedVenueName("")
    fetchAll()
  }

  const approveTeam = async (leagueTeamId: string) => {
    // Direct DB update via league PATCH isn't ideal — for now use a simple approach
    // In production, create a dedicated endpoint
    alert("Team approved! (Endpoint to be wired)")
  }

  if (loading) return <div className="text-ink-500 p-6 py-12 text-center">Loading...</div>
  if (!league) return <div className="text-ink-500 p-6 py-12 text-center">League not found.</div>

  const currentIdx = STATUS_FLOW.indexOf(league.leagueStatus)
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/leagues" className="text-play-700 text-sm font-medium hover:underline">
          &larr; Back to Leagues
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-ink-900 text-2xl font-semibold">{league.name}</h1>
          <p className="text-ink-500 text-sm">{league.season}</p>
          <span className="bg-play-100 text-play-700 mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-medium">
            {STATUS_LABELS[league.leagueStatus]}
          </span>
        </div>
        {nextStatus && (
          <button
            onClick={() => updateStatus(nextStatus)}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white transition"
          >
            {nextStatus === "REGISTRATION"
              ? "Open Registration"
              : nextStatus === "REGISTRATION_CLOSED"
                ? "Close Registration"
                : nextStatus === "FINALIZED"
                  ? "Finalize Season"
                  : nextStatus === "IN_PROGRESS"
                    ? "Start Season"
                    : "Mark Completed"}
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <div className="border-ink-100 rounded-2xl border bg-white p-4 text-center shadow-sm">
          <div className="text-play-700 text-2xl font-bold">{divisions.length}</div>
          <div className="text-ink-500 text-xs">Divisions</div>
        </div>
        <div className="border-ink-100 rounded-2xl border bg-white p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-600">{league.teams?.length || 0}</div>
          <div className="text-ink-500 text-xs">Teams</div>
        </div>
        <div className="border-ink-100 rounded-2xl border bg-white p-4 text-center shadow-sm">
          <div className="text-hoop-600 text-2xl font-bold">{sessions.length}</div>
          <div className="text-ink-500 text-xs">Sessions</div>
        </div>
        <div className="border-ink-100 rounded-2xl border bg-white p-4 text-center shadow-sm">
          <div className="text-play-700 text-2xl font-bold">{venues.length}</div>
          <div className="text-ink-500 text-xs">Venues</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Divisions */}
        <div className={panelClass}>
          <h3 className="text-ink-900 mb-4 font-semibold">Divisions</h3>
          {divisions.map((d: any) => (
            <div
              key={d.id}
              className="border-court-100 bg-court-50 mb-2 flex items-center justify-between rounded-xl border px-3 py-2"
            >
              <div>
                <span className="text-ink-900 font-medium">{d.name}</span>
                <span className="text-ink-500 ml-2 text-xs">
                  {d.ageGroup}
                  {d.gender ? ` \u2022 ${d.gender}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-ink-400 text-xs">{d._count?.teams || 0} teams</span>
                <button
                  onClick={async () => {
                    await fetch(`/api/leagues/${leagueId}/divisions?divisionId=${d.id}`, {
                      method: "DELETE",
                    })
                    fetchAll()
                  }}
                  className="hover:text-hoop-700 text-xs text-red-500"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="border-ink-200 mt-4 space-y-2 border-t pt-4">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={divName}
                onChange={(e) => setDivName(e.target.value)}
                placeholder="Division name"
                className={inputClass}
              />
              <select
                value={divAgeGroup}
                onChange={(e) => setDivAgeGroup(e.target.value)}
                className={inputClass}
              >
                <option value="">Age group...</option>
                {["U10", "U12", "U14", "U16", "U18", "U19", "Junior", "Senior"].map((a) => (
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
                className={inputClass}
              >
                <option value="MALE">Boys</option>
                <option value="FEMALE">Girls</option>
                <option value="">Co-ed</option>
              </select>
              <select
                value={divTier}
                onChange={(e) => setDivTier(e.target.value)}
                className={inputClass}
              >
                <option value="1">Tier 1 (Top)</option>
                <option value="2">Tier 2</option>
                <option value="3">Tier 3</option>
              </select>
            </div>
            <button
              onClick={addDivision}
              className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition"
            >
              Add Division
            </button>
          </div>
        </div>

        {/* Sessions */}
        <div className={panelClass}>
          <h3 className="text-ink-900 mb-4 font-semibold">Sessions (Game Days)</h3>
          {sessions.map((s: any) => (
            <div
              key={s.id}
              className="border-court-100 bg-court-50 mb-2 rounded-xl border px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-ink-900 font-medium">{s.label || "Session"}</span>
                <div className="flex items-center gap-2">
                  {s.venue && <span className="text-ink-400 text-xs">{s.venue.name}</span>}
                  <button
                    onClick={async () => {
                      await fetch(`/api/leagues/${leagueId}/sessions?sessionId=${s.id}`, {
                        method: "DELETE",
                      })
                      fetchAll()
                    }}
                    className="hover:text-hoop-700 text-xs text-red-500"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {s.days?.map((d: any) => (
                <div key={d.id} className="text-ink-500 ml-2 text-xs">
                  {format(new Date(d.date), "EEE, MMM d")} {d.startTime}-{d.endTime}
                </div>
              ))}
            </div>
          ))}
          <div className="border-ink-200 mt-4 space-y-2 border-t pt-4">
            <input
              type="text"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="Label (e.g. Week 1)"
              className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 w-full rounded-xl border px-2 py-1.5 text-sm focus:outline-none focus:ring-2"
            />
            {sessionDays.map((day, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <input
                  type="date"
                  value={day.date}
                  onChange={(e) => updateSessionDay(idx, "date", e.target.value)}
                  className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 flex-1 rounded-xl border px-2 py-1 text-xs focus:outline-none focus:ring-2"
                />
                <input
                  type="time"
                  value={day.startTime}
                  onChange={(e) => updateSessionDay(idx, "startTime", e.target.value)}
                  className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 w-20 rounded-xl border px-1 py-1 text-xs focus:outline-none focus:ring-2"
                />
                <span className="text-ink-400 text-xs">-</span>
                <input
                  type="time"
                  value={day.endTime}
                  onChange={(e) => updateSessionDay(idx, "endTime", e.target.value)}
                  className="border-ink-200 text-ink-900 focus:border-play-500 focus:ring-play-500/20 w-20 rounded-xl border px-1 py-1 text-xs focus:outline-none focus:ring-2"
                />
                {sessionDays.length > 1 && (
                  <button
                    onClick={() => removeSessionDay(idx)}
                    className="hover:text-hoop-700 text-xs text-red-500"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addSessionDay}
              className="text-play-700 text-xs font-medium hover:underline"
            >
              + Add another day
            </button>
            <button
              onClick={addSession}
              className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition"
            >
              Add Session
            </button>
          </div>
        </div>

        {/* Venues */}
        <div className={panelClass}>
          <h3 className="text-ink-900 mb-4 font-semibold">Venues</h3>
          {venues.map((v: any) => (
            <div
              key={v.id}
              className="border-court-100 bg-court-50 mb-2 flex items-center justify-between rounded-xl border px-3 py-2"
            >
              <div>
                <span className="text-ink-900 font-medium">{v.venue.name}</span>
                <span className="text-ink-500 ml-2 text-xs">
                  {v.venue.address}, {v.venue.city}
                </span>
              </div>
              <button
                onClick={async () => {
                  await fetch(`/api/leagues/${leagueId}/venues?leagueVenueId=${v.id}`, {
                    method: "DELETE",
                  })
                  fetchAll()
                }}
                className="hover:text-hoop-700 text-xs text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
          <div className="border-ink-200 mt-4 space-y-2 border-t pt-4">
            <VenueSelector
              value={selectedVenueId}
              venueName={selectedVenueName}
              onSelect={(v) => {
                setSelectedVenueId(v.id)
                setSelectedVenueName(v.name)
              }}
              onClear={() => {
                setSelectedVenueId("")
                setSelectedVenueName("")
              }}
            />
            {selectedVenueId && (
              <button
                onClick={addVenue}
                className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition"
              >
                Add to League
              </button>
            )}
          </div>
        </div>

        {/* Registered Teams */}
        <div className={panelClass}>
          <h3 className="text-ink-900 mb-4 font-semibold">Registered Teams</h3>
          {!league.teams || league.teams.length === 0 ? (
            <p className="text-ink-500 text-sm">No teams registered yet.</p>
          ) : (
            league.teams.map((t: any) => (
              <div
                key={t.id}
                className="border-court-100 bg-court-50 mb-2 flex items-center justify-between rounded-xl border px-3 py-2"
              >
                <div>
                  <span className="text-ink-900 font-medium">{t.team.name}</span>
                  <span className="text-ink-500 ml-2 text-xs">{t.team.tenant?.name}</span>
                  {t.division && (
                    <span className="text-play-700 ml-2 text-xs">{t.division.name}</span>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.status === "APPROVED"
                      ? "bg-court-100 text-court-700"
                      : t.status === "REJECTED"
                        ? "bg-hoop-100 text-hoop-700"
                        : "bg-hoop-100 text-hoop-700"
                  }`}
                >
                  {t.status.toLowerCase()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Season Info */}
      <div className="border-ink-100 mt-6 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
        <h3 className="text-ink-900 mb-3 font-semibold">Season Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {league.startDate && (
            <div>
              <span className="text-ink-500">Start:</span>{" "}
              {format(new Date(league.startDate), "MMM d, yyyy")}
            </div>
          )}
          {league.endDate && (
            <div>
              <span className="text-ink-500">End:</span>{" "}
              {format(new Date(league.endDate), "MMM d, yyyy")}
            </div>
          )}
          {league.registrationDeadline && (
            <div>
              <span className="text-ink-500">Registration Deadline:</span>{" "}
              {format(new Date(league.registrationDeadline), "MMM d, yyyy")}
            </div>
          )}
          {league.teamFee && (
            <div>
              <span className="text-ink-500">Team Fee:</span> {formatCurrency(league.teamFee)}
            </div>
          )}
          {league.gamesGuaranteed && (
            <div>
              <span className="text-ink-500">Games Guaranteed:</span> {league.gamesGuaranteed}
            </div>
          )}
          {league.playoffFormat && (
            <div>
              <span className="text-ink-500">Playoffs:</span>{" "}
              {league.playoffFormat.replace("_", " ")}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
