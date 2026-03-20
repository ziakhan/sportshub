"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { VenueSelector } from "@/components/venue-selector"

const STATUS_FLOW = ["DRAFT", "REGISTRATION", "REGISTRATION_CLOSED", "FINALIZED", "IN_PROGRESS", "COMPLETED"]
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", REGISTRATION: "Open for Registration", REGISTRATION_CLOSED: "Registration Closed",
  FINALIZED: "Finalized", IN_PROGRESS: "In Progress", COMPLETED: "Completed",
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

  useEffect(() => { fetchAll() }, [leagueId]) // eslint-disable-line

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
      body: JSON.stringify({ name: divName, ageGroup: divAgeGroup, gender: divGender || undefined, tier: parseInt(divTier) }),
    })
    setDivName(""); setDivAgeGroup(""); setDivGender(""); setDivTier("1")
    fetchAll()
  }

  const addSessionDay = () => {
    setSessionDays([...sessionDays, { date: "", startTime: "09:00", endTime: "17:00" }])
  }

  const updateSessionDay = (idx: number, field: string, value: string) => {
    setSessionDays(sessionDays.map((d, i) => i === idx ? { ...d, [field]: value } : d))
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

  if (loading) return <div className="text-gray-500 py-12 text-center p-6">Loading...</div>
  if (!league) return <div className="text-gray-500 py-12 text-center p-6">League not found.</div>

  const currentIdx = STATUS_FLOW.indexOf(league.leagueStatus)
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/leagues" className="text-sm text-orange-600 hover:underline">&larr; Back to Leagues</Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{league.name}</h1>
          <p className="text-sm text-gray-500">{league.season}</p>
          <span className="mt-1 inline-block rounded-full bg-orange-100 px-3 py-0.5 text-xs font-medium text-orange-700">
            {STATUS_LABELS[league.leagueStatus]}
          </span>
        </div>
        {nextStatus && (
          <button onClick={() => updateStatus(nextStatus)}
            className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">
            {nextStatus === "REGISTRATION" ? "Open Registration" :
             nextStatus === "REGISTRATION_CLOSED" ? "Close Registration" :
             nextStatus === "FINALIZED" ? "Finalize Season" :
             nextStatus === "IN_PROGRESS" ? "Start Season" :
             "Mark Completed"}
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{divisions.length}</div>
          <div className="text-xs text-gray-500">Divisions</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{league.teams?.length || 0}</div>
          <div className="text-xs text-gray-500">Teams</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{sessions.length}</div>
          <div className="text-xs text-gray-500">Sessions</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{venues.length}</div>
          <div className="text-xs text-gray-500">Venues</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Divisions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Divisions</h3>
          {divisions.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 mb-2">
              <div>
                <span className="font-medium text-gray-900">{d.name}</span>
                <span className="ml-2 text-xs text-gray-500">{d.ageGroup}{d.gender ? ` \u2022 ${d.gender}` : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{d._count?.teams || 0} teams</span>
                <button onClick={async () => {
                  await fetch(`/api/leagues/${leagueId}/divisions?divisionId=${d.id}`, { method: "DELETE" })
                  fetchAll()
                }} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            </div>
          ))}
          <div className="mt-4 space-y-2 border-t pt-4">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={divName} onChange={(e) => setDivName(e.target.value)}
                placeholder="Division name" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
              <select value={divAgeGroup} onChange={(e) => setDivAgeGroup(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                <option value="">Age group...</option>
                {["U10", "U12", "U14", "U16", "U18", "U19", "Junior", "Senior"].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={divGender} onChange={(e) => setDivGender(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                <option value="MALE">Boys</option>
                <option value="FEMALE">Girls</option>
                <option value="">Co-ed</option>
              </select>
              <select value={divTier} onChange={(e) => setDivTier(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                <option value="1">Tier 1 (Top)</option>
                <option value="2">Tier 2</option>
                <option value="3">Tier 3</option>
              </select>
            </div>
            <button onClick={addDivision} className="w-full rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">
              Add Division
            </button>
          </div>
        </div>

        {/* Sessions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Sessions (Game Days)</h3>
          {sessions.map((s: any) => (
            <div key={s.id} className="rounded-md bg-gray-50 px-3 py-2 mb-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{s.label || "Session"}</span>
                <div className="flex items-center gap-2">
                  {s.venue && <span className="text-xs text-gray-400">{s.venue.name}</span>}
                  <button onClick={async () => {
                    await fetch(`/api/leagues/${leagueId}/sessions?sessionId=${s.id}`, { method: "DELETE" })
                    fetchAll()
                  }} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              </div>
              {s.days?.map((d: any) => (
                <div key={d.id} className="text-xs text-gray-500 ml-2">
                  {format(new Date(d.date), "EEE, MMM d")} {d.startTime}-{d.endTime}
                </div>
              ))}
            </div>
          ))}
          <div className="mt-4 space-y-2 border-t pt-4">
            <input type="text" value={sessionLabel} onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="Label (e.g. Week 1)" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            {sessionDays.map((day, idx) => (
              <div key={idx} className="flex gap-1 items-center">
                <input type="date" value={day.date} onChange={(e) => updateSessionDay(idx, "date", e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs" />
                <input type="time" value={day.startTime} onChange={(e) => updateSessionDay(idx, "startTime", e.target.value)}
                  className="w-20 rounded-md border border-gray-300 px-1 py-1 text-xs" />
                <span className="text-xs text-gray-400">-</span>
                <input type="time" value={day.endTime} onChange={(e) => updateSessionDay(idx, "endTime", e.target.value)}
                  className="w-20 rounded-md border border-gray-300 px-1 py-1 text-xs" />
                {sessionDays.length > 1 && (
                  <button onClick={() => removeSessionDay(idx)} className="text-xs text-red-500 hover:text-red-700">x</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addSessionDay} className="text-xs text-orange-600 hover:underline">+ Add another day</button>
            <button onClick={addSession} className="w-full rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">
              Add Session
            </button>
          </div>
        </div>

        {/* Venues */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Venues</h3>
          {venues.map((v: any) => (
            <div key={v.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 mb-2">
              <div>
                <span className="font-medium text-gray-900">{v.venue.name}</span>
                <span className="ml-2 text-xs text-gray-500">{v.venue.address}, {v.venue.city}</span>
              </div>
              <button onClick={async () => {
                await fetch(`/api/leagues/${leagueId}/venues?leagueVenueId=${v.id}`, { method: "DELETE" })
                fetchAll()
              }} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
          ))}
          <div className="mt-4 space-y-2 border-t pt-4">
            <VenueSelector
              value={selectedVenueId}
              venueName={selectedVenueName}
              onSelect={(v) => { setSelectedVenueId(v.id); setSelectedVenueName(v.name) }}
              onClear={() => { setSelectedVenueId(""); setSelectedVenueName("") }}
            />
            {selectedVenueId && (
              <button onClick={addVenue} className="w-full rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600">
                Add to League
              </button>
            )}
          </div>
        </div>

        {/* Registered Teams */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Registered Teams</h3>
          {(!league.teams || league.teams.length === 0) ? (
            <p className="text-sm text-gray-500">No teams registered yet.</p>
          ) : (
            league.teams.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 mb-2">
                <div>
                  <span className="font-medium text-gray-900">{t.team.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{t.team.tenant?.name}</span>
                  {t.division && <span className="ml-2 text-xs text-orange-600">{t.division.name}</span>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  t.status === "APPROVED" ? "bg-green-100 text-green-700" :
                  t.status === "REJECTED" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {t.status.toLowerCase()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Season Info */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Season Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {league.startDate && <div><span className="text-gray-500">Start:</span> {format(new Date(league.startDate), "MMM d, yyyy")}</div>}
          {league.endDate && <div><span className="text-gray-500">End:</span> {format(new Date(league.endDate), "MMM d, yyyy")}</div>}
          {league.registrationDeadline && <div><span className="text-gray-500">Registration Deadline:</span> {format(new Date(league.registrationDeadline), "MMM d, yyyy")}</div>}
          {league.teamFee && <div><span className="text-gray-500">Team Fee:</span> {formatCurrency(league.teamFee)}</div>}
          {league.gamesGuaranteed && <div><span className="text-gray-500">Games Guaranteed:</span> {league.gamesGuaranteed}</div>}
          {league.playoffFormat && <div><span className="text-gray-500">Playoffs:</span> {league.playoffFormat.replace("_", " ")}</div>}
        </div>
      </div>
    </div>
  )
}
