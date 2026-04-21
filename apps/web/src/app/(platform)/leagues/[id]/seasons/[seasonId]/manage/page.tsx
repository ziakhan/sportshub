"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { VenueSelector } from "@/components/venue-selector"
import { VenueEditor } from "@/components/venue-editor"

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
  const seasonId = params?.seasonId as string
  const [league, setLeague] = useState<any>(null)
  const [divisions, setDivisions] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [venues, setVenues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [teamStatusFilter, setTeamStatusFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED"
  >("ALL")
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null)

  // Division form
  const [divName, setDivName] = useState("")
  const [divAgeGroup, setDivAgeGroup] = useState("")
  const [divGender, setDivGender] = useState("MALE")
  const [divTier, setDivTier] = useState("1")
  const [divMaxTeams, setDivMaxTeams] = useState("")

  // Session form
  const [sessionLabel, setSessionLabel] = useState("")
  const [sessionDays, setSessionDays] = useState([
    { date: "", startTime: "09:00", endTime: "17:00" },
  ])

  // Venue form
  const [selectedVenueId, setSelectedVenueId] = useState("")
  const [selectedVenueName, setSelectedVenueName] = useState("")

  // Scheduling settings form
  const [schedSettings, setSchedSettings] = useState({
    gamesGuaranteed: "",
    gamesPerSession: "1",
    gameLengthMinutes: "40",
    gameSlotMinutes: "90",
    gamePeriods: "HALVES",
    periodLengthMinutes: "",
    idealGamesPerDayPerTeam: "1",
    defaultVenueOpenTime: "09:00",
    defaultVenueCloseTime: "20:00",
    defaultCourtsPerVenue: "",
  })
  const [schedSaving, setSchedSaving] = useState(false)
  const [finalizeErrors, setFinalizeErrors] = useState<string[]>([])

  const panelClass =
    "rounded-3xl border border-ink-100 bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
  const inputClass =
    "rounded-xl border border-ink-200 px-2 py-1.5 text-sm text-ink-900 focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

  const fetchAll = async () => {
    const [leagueRes, divRes, sessRes, venRes] = await Promise.all([
      fetch(`/api/seasons/${seasonId}`),
      fetch(`/api/seasons/${seasonId}/divisions`),
      fetch(`/api/seasons/${seasonId}/sessions`),
      fetch(`/api/seasons/${seasonId}/venues`),
    ])
    const seasonData = await leagueRes.json()
    const divData = await divRes.json()
    const sessData = await sessRes.json()
    const venData = await venRes.json()
    // Map new Season shape into legacy names this page already uses
    const leagueData = {
      ...seasonData,
      name: seasonData.league?.name,
      description: seasonData.league?.description,
      ownerId: seasonData.league?.ownerId,
      leagueStatus: seasonData.status,
      teams: seasonData.teamSubmissions,
      gamesPerSession: seasonData.targetGamesPerSession,
    }
    setLeague(leagueData)
    setSchedSettings({
      gamesGuaranteed: leagueData.gamesGuaranteed?.toString() ?? "",
      gamesPerSession: leagueData.gamesPerSession?.toString() ?? "1",
      gameLengthMinutes: leagueData.gameLengthMinutes?.toString() ?? "40",
      gameSlotMinutes: leagueData.gameSlotMinutes?.toString() ?? "90",
      gamePeriods: leagueData.gamePeriods ?? "HALVES",
      periodLengthMinutes: leagueData.periodLengthMinutes?.toString() ?? "",
      idealGamesPerDayPerTeam: leagueData.idealGamesPerDayPerTeam?.toString() ?? "1",
      defaultVenueOpenTime: leagueData.defaultVenueOpenTime ?? "09:00",
      defaultVenueCloseTime: leagueData.defaultVenueCloseTime ?? "20:00",
      defaultCourtsPerVenue: "",
    })
    setDivisions(divData.divisions || [])
    setSessions(sessData.sessions || [])
    setVenues(venData.venues || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [leagueId]) // eslint-disable-line

  const handleStatusChange = async (newStatus: string) => {
    const res = await fetch(`/api/seasons/${seasonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.status === 422) {
      const data = await res.json()
      setFinalizeErrors(data.missing || [data.error])
      return
    }
    setFinalizeErrors([])
    fetchAll()
  }

  const saveSchedulingSettings = async () => {
    setSchedSaving(true)
    await fetch(`/api/seasons/${seasonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gamesGuaranteed: schedSettings.gamesGuaranteed
          ? parseInt(schedSettings.gamesGuaranteed)
          : null,
        targetGamesPerSession: parseInt(schedSettings.gamesPerSession) || 1,
        gameLengthMinutes: parseInt(schedSettings.gameLengthMinutes) || 40,
        gameSlotMinutes: parseInt(schedSettings.gameSlotMinutes) || 90,
        gamePeriods: schedSettings.gamePeriods,
        periodLengthMinutes: schedSettings.periodLengthMinutes
          ? parseInt(schedSettings.periodLengthMinutes)
          : null,
        idealGamesPerDayPerTeam: parseInt(schedSettings.idealGamesPerDayPerTeam) || 1,
        defaultVenueOpenTime: schedSettings.defaultVenueOpenTime,
        defaultVenueCloseTime: schedSettings.defaultVenueCloseTime,
      }),
    })
    setSchedSaving(false)
    fetchAll()
  }

  const addDivision = async () => {
    if (!divName || !divAgeGroup) return
    await fetch(`/api/seasons/${seasonId}/divisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: divName,
        ageGroup: divAgeGroup,
        gender: divGender || undefined,
        tier: parseInt(divTier),
        maxTeams: divMaxTeams ? parseInt(divMaxTeams) : undefined,
      }),
    })
    setDivName("")
    setDivAgeGroup("")
    setDivGender("")
    setDivTier("1")
    setDivMaxTeams("")
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
    await fetch(`/api/seasons/${seasonId}/sessions`, {
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
    await fetch(`/api/seasons/${seasonId}/venues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId: selectedVenueId }),
    })
    setSelectedVenueId("")
    setSelectedVenueName("")
    fetchAll()
  }

  const updateTeamStatus = async (leagueTeamId: string, status: "APPROVED" | "REJECTED") => {
    await fetch(`/api/seasons/${seasonId}/teams/${leagueTeamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    fetchAll()
  }

  if (loading) return <div className="text-ink-500 p-6 py-12 text-center">Loading...</div>
  if (!league) return <div className="text-ink-500 p-6 py-12 text-center">League not found.</div>

  const currentIdx = STATUS_FLOW.indexOf(league.leagueStatus)
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null
  const allTeams = league.teams || []
  const filteredTeams =
    teamStatusFilter === "ALL"
      ? allTeams
      : allTeams.filter((t: any) => t.status === teamStatusFilter)

  const preflightChecks =
    nextStatus === "FINALIZED"
      ? [
          { label: "At least one division created", ok: divisions.length > 0 },
          { label: "At least one game session scheduled", ok: sessions.length > 0 },
          { label: "At least one venue assigned", ok: venues.length > 0 },
          {
            label: "No teams pending approval",
            ok: allTeams.filter((t: any) => t.status === "PENDING").length === 0,
          },
          { label: "Max games per season defined", ok: !!league.gamesGuaranteed },
          { label: "Period / half length defined", ok: !!league.periodLengthMinutes },
        ]
      : null
  const canFinalize = !preflightChecks || preflightChecks.every((c) => c.ok)

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/leagues/${leagueId}`}
          className="text-play-700 text-sm font-medium hover:underline"
        >
          &larr; Back to {league.name}
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-ink-900 text-2xl font-semibold">{league.label}</h1>
          <p className="text-ink-500 text-sm">{league.name}</p>
          <span className="bg-play-100 text-play-700 mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-medium">
            {STATUS_LABELS[league.leagueStatus]}
          </span>
        </div>
        {nextStatus && (
          <button
            onClick={() => handleStatusChange(nextStatus)}
            disabled={nextStatus === "FINALIZED" && !canFinalize}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* Finalization preflight checklist */}
      {preflightChecks && (
        <div
          className={`mb-6 rounded-2xl border p-4 ${canFinalize ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}
        >
          <p
            className={`mb-2 text-sm font-semibold ${canFinalize ? "text-green-800" : "text-amber-800"}`}
          >
            {canFinalize ? "✓ Ready to finalize" : "Complete these before finalizing"}
          </p>
          <ul className="grid gap-1 sm:grid-cols-2">
            {preflightChecks.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-xs">
                <span className={c.ok ? "text-green-600" : "text-amber-500"}>
                  {c.ok ? "✓" : "✗"}
                </span>
                <span className={c.ok ? "text-ink-700" : "text-amber-700"}>{c.label}</span>
              </li>
            ))}
          </ul>
          {finalizeErrors.length > 0 && (
            <div className="mt-3 border-t border-amber-200 pt-2">
              <p className="text-hoop-700 mb-1 text-xs font-semibold">Could not finalize:</p>
              {finalizeErrors.map((e, i) => (
                <p key={i} className="text-hoop-600 text-xs">
                  • {e}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

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
                {d.maxTeams ? (
                  <div className="text-ink-500 mt-0.5 text-xs">
                    Capacity: {d._count?.teams || 0}/{d.maxTeams}
                  </div>
                ) : (
                  <div className="text-ink-400 mt-0.5 text-xs">Capacity: unlimited</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-ink-400 text-xs">{d._count?.teams || 0} teams</span>
                <button
                  onClick={async () => {
                    await fetch(`/api/seasons/${seasonId}/divisions?divisionId=${d.id}`, {
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
            <input
              type="number"
              min="1"
              max="128"
              value={divMaxTeams}
              onChange={(e) => setDivMaxTeams(e.target.value)}
              placeholder="Max teams (optional)"
              className={inputClass}
            />
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
                      await fetch(`/api/seasons/${seasonId}/sessions?sessionId=${s.id}`, {
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
          {venues.map((v: any) => {
            const expanded = expandedVenueId === v.id
            const courtCount = v.venue.courtList?.length ?? 0
            return (
              <div
                key={v.id}
                className="border-court-100 bg-court-50 mb-2 rounded-xl border px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-ink-900 font-medium">{v.venue.name}</span>
                    <span className="text-ink-500 ml-2 text-xs">
                      {v.venue.address}, {v.venue.city}
                    </span>
                    <div className="text-ink-400 mt-0.5 text-xs">
                      {courtCount > 0
                        ? `${courtCount} court${courtCount !== 1 ? "s" : ""}`
                        : "No courts defined"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedVenueId(expanded ? null : v.id)}
                      className="text-play-700 hover:text-play-800 text-xs font-semibold"
                    >
                      {expanded ? "Close" : "Edit courts & hours"}
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(
                          `/api/seasons/${seasonId}/venues?leagueVenueId=${v.id}`,
                          { method: "DELETE" }
                        )
                        fetchAll()
                      }}
                      className="hover:text-hoop-700 text-xs text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="border-ink-200 mt-3 border-t pt-3">
                    <VenueEditor
                      venueId={v.venue.id}
                      venueName={v.venue.name}
                      courts={v.venue.courtList ?? []}
                      hours={v.venue.venueHours ?? []}
                      onChange={fetchAll}
                    />
                  </div>
                )}
              </div>
            )
          })}
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
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-ink-900 font-semibold">Registered Teams</h3>
            <div className="flex flex-wrap items-center gap-1">
              {[
                { key: "ALL", label: `All (${allTeams.length})` },
                {
                  key: "PENDING",
                  label: `Pending (${allTeams.filter((t: any) => t.status === "PENDING").length})`,
                },
                {
                  key: "APPROVED",
                  label: `Approved (${allTeams.filter((t: any) => t.status === "APPROVED").length})`,
                },
                {
                  key: "REJECTED",
                  label: `Rejected (${allTeams.filter((t: any) => t.status === "REJECTED").length})`,
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setTeamStatusFilter(opt.key as any)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    teamStatusFilter === opt.key
                      ? "bg-play-100 text-play-700"
                      : "bg-ink-50 text-ink-500 hover:bg-court-100"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {!league.teams || league.teams.length === 0 ? (
            <p className="text-ink-500 text-sm">No teams registered yet.</p>
          ) : filteredTeams.length === 0 ? (
            <p className="text-ink-500 text-sm">No teams match the selected status.</p>
          ) : (
            filteredTeams.map((t: any) => (
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
                <div className="flex items-center gap-2">
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
                  {t.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => updateTeamStatus(t.id, "APPROVED")}
                        className="bg-court-600 hover:bg-court-700 rounded-lg px-2 py-1 text-xs font-semibold text-white"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateTeamStatus(t.id, "REJECTED")}
                        className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 rounded-lg border px-2 py-1 text-xs font-semibold"
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
      </div>

      {/* Scheduling Settings */}
      <div className="border-ink-100 mt-6 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-ink-900 font-semibold">Scheduling Settings</h3>
            <p className="text-ink-400 mt-0.5 text-xs">
              Fields marked <span className="text-hoop-600 font-semibold">*</span> are required
              before the league can be finalized
            </p>
          </div>
          <button
            onClick={saveSchedulingSettings}
            disabled={schedSaving}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
          >
            {schedSaving ? "Saving…" : "Save Settings"}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Max games per season */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Max games per team per season <span className="text-hoop-600">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={schedSettings.gamesGuaranteed}
              onChange={(e) => setSchedSettings((s) => ({ ...s, gamesGuaranteed: e.target.value }))}
              placeholder="e.g. 10"
              className={inputClass + " w-full"}
            />
          </div>
          {/* Games per session */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Games per session per team
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={schedSettings.gamesPerSession}
              onChange={(e) => setSchedSettings((s) => ({ ...s, gamesPerSession: e.target.value }))}
              className={inputClass + " w-full"}
            />
          </div>
          {/* Ideal games per day */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Ideal games per day per team
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={schedSettings.idealGamesPerDayPerTeam}
              onChange={(e) =>
                setSchedSettings((s) => ({ ...s, idealGamesPerDayPerTeam: e.target.value }))
              }
              className={inputClass + " w-full"}
            />
            <p className="text-ink-400 mt-0.5 text-[10px]">
              Scheduler only exceeds this if unavoidable
            </p>
          </div>

          {/* Game format — periods */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">Game format</label>
            <select
              value={schedSettings.gamePeriods}
              onChange={(e) => setSchedSettings((s) => ({ ...s, gamePeriods: e.target.value }))}
              className={inputClass + " w-full"}
            >
              <option value="HALVES">2 Halves</option>
              <option value="QUARTERS">4 Quarters</option>
            </select>
          </div>
          {/* Period / half length */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Half / quarter length (min) <span className="text-hoop-600">*</span>
            </label>
            <input
              type="number"
              min="5"
              max="30"
              value={schedSettings.periodLengthMinutes}
              onChange={(e) =>
                setSchedSettings((s) => ({ ...s, periodLengthMinutes: e.target.value }))
              }
              placeholder="e.g. 20 for halves, 10 for quarters"
              className={inputClass + " w-full"}
            />
          </div>
          {/* Total game length */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">Game length (min)</label>
            <input
              type="number"
              min="20"
              max="60"
              value={schedSettings.gameLengthMinutes}
              onChange={(e) =>
                setSchedSettings((s) => ({ ...s, gameLengthMinutes: e.target.value }))
              }
              className={inputClass + " w-full"}
            />
          </div>

          {/* Game slot */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Game slot length (min)
            </label>
            <input
              type="number"
              min="30"
              max="180"
              value={schedSettings.gameSlotMinutes}
              onChange={(e) => setSchedSettings((s) => ({ ...s, gameSlotMinutes: e.target.value }))}
              className={inputClass + " w-full"}
            />
            <p className="text-ink-400 mt-0.5 text-[10px]">Includes warmup + transition buffer</p>
          </div>
          {/* Default courts per venue */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Default courts per venue <span className="text-hoop-600">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={schedSettings.defaultCourtsPerVenue}
              onChange={(e) =>
                setSchedSettings((s) => ({ ...s, defaultCourtsPerVenue: e.target.value }))
              }
              placeholder="e.g. 2"
              className={inputClass + " w-full"}
            />
            <p className="text-ink-400 mt-0.5 text-[10px]">
              Can be overridden per venue in the Venues panel
            </p>
          </div>
          {/* Venue hours */}
          <div>
            <label className="text-ink-700 mb-1 block text-xs font-medium">
              Default venue hours
            </label>
            <div className="flex items-center gap-1">
              <input
                type="time"
                value={schedSettings.defaultVenueOpenTime}
                onChange={(e) =>
                  setSchedSettings((s) => ({ ...s, defaultVenueOpenTime: e.target.value }))
                }
                className={inputClass + " flex-1"}
              />
              <span className="text-ink-400 text-xs">–</span>
              <input
                type="time"
                value={schedSettings.defaultVenueCloseTime}
                onChange={(e) =>
                  setSchedSettings((s) => ({ ...s, defaultVenueCloseTime: e.target.value }))
                }
                className={inputClass + " flex-1"}
              />
            </div>
            <p className="text-ink-400 mt-0.5 text-[10px]">
              Session-day times override these defaults
            </p>
          </div>
        </div>

        {/* Playoff settings */}
        <div className="border-ink-100 mt-5 border-t pt-4">
          <p className="text-ink-600 mb-3 text-xs font-medium">
            Playoffs (optional — can be set later)
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-ink-700 mb-1 block text-xs font-medium">Playoff format</label>
              <select
                value={league.playoffFormat || ""}
                onChange={async (e) => {
                  await fetch(`/api/seasons/${seasonId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ playoffFormat: e.target.value || null }),
                  })
                  fetchAll()
                }}
                className={inputClass + " w-full"}
              >
                <option value="">None / TBD</option>
                <option value="SINGLE_ELIMINATION">Single Elimination</option>
                <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                <option value="ROUND_ROBIN">Round Robin</option>
              </select>
            </div>
            <div>
              <label className="text-ink-700 mb-1 block text-xs font-medium">
                Teams advancing to playoffs
              </label>
              <input
                type="number"
                min="2"
                max="64"
                defaultValue={league.playoffTeams || ""}
                placeholder="e.g. 8"
                onBlur={async (e) => {
                  await fetch(`/api/seasons/${seasonId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      playoffTeams: e.target.value ? parseInt(e.target.value) : null,
                    }),
                  })
                  fetchAll()
                }}
                className={inputClass + " w-full"}
              />
            </div>
          </div>
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
