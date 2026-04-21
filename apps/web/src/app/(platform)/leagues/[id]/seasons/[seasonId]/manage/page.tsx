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

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "divisions", label: "Divisions" },
  { key: "venues", label: "Venues" },
  { key: "sessions", label: "Sessions" },
  { key: "scheduling", label: "Scheduling" },
  { key: "tiebreakers", label: "Tiebreakers" },
  { key: "teams", label: "Teams" },
  { key: "schedule", label: "Schedule" },
  { key: "standings", label: "Standings" },
] as const

type TabKey = (typeof TABS)[number]["key"]

const TIEBREAKER_OPTIONS: { key: string; label: string }[] = [
  { key: "HEAD_TO_HEAD", label: "Head-to-head record" },
  { key: "POINT_DIFFERENTIAL", label: "Point differential" },
  { key: "POINTS_SCORED", label: "Points scored" },
  { key: "POINTS_ALLOWED", label: "Points allowed (fewest)" },
  { key: "WINS", label: "Total wins" },
  { key: "COIN_FLIP", label: "Coin flip (last resort)" },
]

export default function LeagueManagePage() {
  const params = useParams()
  const leagueId = params?.id as string
  const seasonId = params?.seasonId as string
  const [league, setLeague] = useState<any>(null)
  const [divisions, setDivisions] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [venues, setVenues] = useState<any[]>([])
  const [schedulingGroups, setSchedulingGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
  const [teamStatusFilter, setTeamStatusFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED"
  >("ALL")
  const [teamPaymentFilter, setTeamPaymentFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL")
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null)

  // Scheduling group form
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupDivisionIds, setNewGroupDivisionIds] = useState<string[]>([])
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState("")
  const [editGroupDivisionIds, setEditGroupDivisionIds] = useState<string[]>([])

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
  const [finalizeWarnings, setFinalizeWarnings] = useState<string[]>([])

  // Schedule state
  const [scheduleGames, setScheduleGames] = useState<any[]>([])
  const [preview, setPreview] = useState<{
    games: any[]
    unscheduled: any[]
    warnings: string[]
    utilization: any
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [openGameId, setOpenGameId] = useState<string | null>(null)
  const [suggestionsFor, setSuggestionsFor] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [standings, setStandings] = useState<any[]>([])
  const [standingsLoading, setStandingsLoading] = useState(false)

  const panelClass =
    "rounded-3xl border border-ink-100 bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"
  const inputClass =
    "rounded-xl border border-ink-200 px-2 py-1.5 text-sm text-ink-900 focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

  const fetchAll = async () => {
    const [leagueRes, divRes, sessRes, venRes, groupRes, schedRes] = await Promise.all([
      fetch(`/api/seasons/${seasonId}`),
      fetch(`/api/seasons/${seasonId}/divisions`),
      fetch(`/api/seasons/${seasonId}/sessions`),
      fetch(`/api/seasons/${seasonId}/venues`),
      fetch(`/api/seasons/${seasonId}/scheduling-groups`),
      fetch(`/api/seasons/${seasonId}/schedule`),
    ])
    const seasonData = await leagueRes.json()
    const divData = await divRes.json()
    const sessData = await sessRes.json()
    const venData = await venRes.json()
    const groupData = groupRes.ok ? await groupRes.json() : { groups: [] }
    const schedData = schedRes.ok ? await schedRes.json() : { games: [] }
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
    setSchedulingGroups(groupData.groups || [])
    setScheduleGames(schedData.games || [])
    setLoading(false)
  }

  const runPreview = async () => {
    setPreviewLoading(true)
    setScheduleError(null)
    const res = await fetch(`/api/seasons/${seasonId}/schedule/preview`, { method: "POST" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(
        Array.isArray(err?.errors) ? err.errors.join("; ") : err?.error || "Preview failed"
      )
      setPreview(null)
    } else {
      setPreview(await res.json())
    }
    setPreviewLoading(false)
  }

  const commitSchedule = async () => {
    if (!confirm("Commit this schedule? Existing SCHEDULED games will be replaced.")) return
    setCommitting(true)
    setScheduleError(null)
    const res = await fetch(`/api/seasons/${seasonId}/schedule/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replaceExisting: true }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(
        Array.isArray(err?.errors) ? err.errors.join("; ") : err?.error || "Commit failed"
      )
    } else {
      setPreview(null)
    }
    setCommitting(false)
    fetchAll()
  }

  const wipeSchedule = async () => {
    if (!confirm("Delete all scheduled games? (games that have moved past SCHEDULED are kept)"))
      return
    const res = await fetch(`/api/seasons/${seasonId}/schedule`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(err?.error || "Delete failed")
    }
    fetchAll()
  }

  const patchGame = async (gameId: string, body: Record<string, any>) => {
    setScheduleError(null)
    const res = await fetch(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(
        Array.isArray(err?.conflicts)
          ? err.conflicts.join("; ")
          : err?.error || "Update failed"
      )
    }
    fetchAll()
  }

  const cancelGame = async (gameId: string) => {
    if (!confirm("Cancel this game? It will be excluded from standings.")) return
    setScheduleError(null)
    const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setScheduleError(err?.error || "Cancel failed")
    }
    fetchAll()
  }

  const loadSuggestions = async (gameId: string) => {
    setSuggestionsFor(gameId)
    setSuggestionsLoading(true)
    setSuggestions([])
    const res = await fetch(`/api/games/${gameId}/reschedule-suggestions`, {
      method: "POST",
    })
    if (res.ok) {
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } else {
      const err = await res.json().catch(() => ({}))
      setScheduleError(err?.error || "Could not load suggestions")
    }
    setSuggestionsLoading(false)
  }

  const loadStandings = async () => {
    setStandingsLoading(true)
    const res = await fetch(`/api/seasons/${seasonId}/standings`)
    if (res.ok) {
      const data = await res.json()
      setStandings(data.divisions || [])
    }
    setStandingsLoading(false)
  }

  useEffect(() => {
    if (activeTab === "standings") loadStandings()
  }, [activeTab]) // eslint-disable-line

  const applySuggestion = async (gameId: string, s: any) => {
    await patchGame(gameId, {
      scheduledAt: s.startAt,
      courtId: s.courtId,
      venueId: s.venueId,
      dayId: s.dayId,
      dayVenueId: s.dayVenueId,
      sessionId: s.sessionId,
    })
    setSuggestionsFor(null)
    setSuggestions([])
    setOpenGameId(null)
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
      setFinalizeWarnings(Array.isArray(data.warnings) ? data.warnings : [])
      return
    }
    setFinalizeErrors([])
    const ok = await res.json().catch(() => ({}))
    setFinalizeWarnings(Array.isArray(ok?.warnings) ? ok.warnings : [])
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

  const patchSeason = async (body: Record<string, any>) => {
    await fetch(`/api/seasons/${seasonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    fetchAll()
  }

  const createSchedulingGroup = async () => {
    if (!newGroupName.trim()) return
    await fetch(`/api/seasons/${seasonId}/scheduling-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim(), divisionIds: newGroupDivisionIds }),
    })
    setNewGroupName("")
    setNewGroupDivisionIds([])
    fetchAll()
  }

  const startEditGroup = (group: any) => {
    setEditingGroupId(group.id)
    setEditGroupName(group.name)
    setEditGroupDivisionIds((group.divisions ?? []).map((d: any) => d.divisionId ?? d.division?.id))
  }

  const saveEditGroup = async () => {
    if (!editingGroupId) return
    await fetch(`/api/seasons/${seasonId}/scheduling-groups/${editingGroupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editGroupName, divisionIds: editGroupDivisionIds }),
    })
    setEditingGroupId(null)
    setEditGroupName("")
    setEditGroupDivisionIds([])
    fetchAll()
  }

  const deleteSchedulingGroup = async (groupId: string) => {
    if (!confirm("Remove this scheduling group?")) return
    await fetch(`/api/seasons/${seasonId}/scheduling-groups/${groupId}`, { method: "DELETE" })
    if (editingGroupId === groupId) setEditingGroupId(null)
    fetchAll()
  }

  const moveTiebreaker = (idx: number, direction: -1 | 1) => {
    const order: string[] = Array.isArray(league?.tiebreakerOrder) ? [...league.tiebreakerOrder] : []
    const target = idx + direction
    if (target < 0 || target >= order.length) return
    ;[order[idx], order[target]] = [order[target], order[idx]]
    patchSeason({ tiebreakerOrder: order })
  }

  const addTiebreaker = (key: string) => {
    const order: string[] = Array.isArray(league?.tiebreakerOrder) ? [...league.tiebreakerOrder] : []
    if (order.includes(key)) return
    order.push(key)
    patchSeason({ tiebreakerOrder: order })
  }

  const removeTiebreaker = (key: string) => {
    const order: string[] = Array.isArray(league?.tiebreakerOrder) ? [...league.tiebreakerOrder] : []
    patchSeason({ tiebreakerOrder: order.filter((k) => k !== key) })
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

  const updateTeamPayment = async (
    leagueTeamId: string,
    paymentStatus: "UNPAID" | "PAID_MANUAL" | "WAIVED"
  ) => {
    await fetch(`/api/seasons/${seasonId}/teams/${leagueTeamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus }),
    })
    fetchAll()
  }

  if (loading) return <div className="text-ink-500 p-6 py-12 text-center">Loading...</div>
  if (!league) return <div className="text-ink-500 p-6 py-12 text-center">League not found.</div>

  const currentIdx = STATUS_FLOW.indexOf(league.leagueStatus)
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null
  const allTeams = league.teams || []
  const isPaid = (t: any) => ["PAID_MANUAL", "PAID_STRIPE", "WAIVED"].includes(t.paymentStatus)
  const filteredTeams = allTeams.filter((t: any) => {
    if (teamStatusFilter !== "ALL" && t.status !== teamStatusFilter) return false
    if (teamPaymentFilter === "UNPAID" && isPaid(t)) return false
    if (teamPaymentFilter === "PAID" && !isPaid(t)) return false
    return true
  })
  const unpaidCount = allTeams.filter((t: any) => !isPaid(t)).length
  const paidCount = allTeams.length - unpaidCount

  const sessionHasUsableDay = (s: any) =>
    (s.days ?? []).some((d: any) =>
      (d.dayVenues ?? []).some((dv: any) => (dv.courts ?? []).length > 0)
    )
  const sessionsAllUsable =
    sessions.length > 0 && sessions.every((s: any) => sessionHasUsableDay(s))

  const preflightChecks =
    nextStatus === "FINALIZED"
      ? [
          { label: "At least one division created", ok: divisions.length > 0 },
          { label: "At least one game session scheduled", ok: sessions.length > 0 },
          {
            label: "Every session has a day with venue + court",
            ok: sessionsAllUsable,
          },
          { label: "At least one venue assigned", ok: venues.length > 0 },
          {
            label: "No teams pending approval",
            ok: allTeams.filter((t: any) => t.status === "PENDING").length === 0,
          },
          { label: "Max games per season defined", ok: !!league.gamesGuaranteed },
          { label: "Period / half length defined", ok: !!league.periodLengthMinutes },
          {
            label: "Tiebreaker order configured",
            ok: Array.isArray(league.tiebreakerOrder) && league.tiebreakerOrder.length > 0,
          },
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

      {/* Tab nav */}
      <div className="mb-6 flex flex-wrap gap-1 overflow-x-auto border-b border-ink-100">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? "border-play-600 text-play-700"
                : "border-transparent text-ink-500 hover:text-ink-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Finalization preflight checklist */}
      {activeTab === "overview" && preflightChecks && (
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
          {finalizeWarnings.length > 0 && (
            <div className="mt-3 border-t border-amber-200 pt-2">
              <p className="text-amber-700 mb-1 text-xs font-semibold">Warnings:</p>
              {finalizeWarnings.map((w, i) => (
                <p key={i} className="text-amber-600 text-xs">
                  • {w}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats bar — overview only */}
      {activeTab === "overview" && (
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
      )}

      {activeTab === "divisions" && (
      <div className="grid gap-6">
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
      </div>
      )}

      {activeTab === "sessions" && (
      <div className="grid gap-6">
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
      </div>
      )}

      {activeTab === "venues" && (
      <div className="grid gap-6">
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
      </div>
      )}

      {activeTab === "teams" && (
      <div className="grid gap-6">
        {/* Registered Teams */}
        <div className={panelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-ink-900 font-semibold">Registered Teams</h3>
            <div className="flex flex-col items-end gap-1">
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
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { key: "ALL", label: `Any payment` },
                  { key: "UNPAID", label: `Unpaid (${unpaidCount})` },
                  { key: "PAID", label: `Paid (${paidCount})` },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTeamPaymentFilter(opt.key as any)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                      teamPaymentFilter === opt.key
                        ? "bg-hoop-100 text-hoop-700"
                        : "bg-ink-50 text-ink-500 hover:bg-court-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {!league.teams || league.teams.length === 0 ? (
            <p className="text-ink-500 text-sm">No teams registered yet.</p>
          ) : filteredTeams.length === 0 ? (
            <p className="text-ink-500 text-sm">No teams match the selected status.</p>
          ) : (
            filteredTeams.map((t: any) => {
              const paid = isPaid(t)
              const paymentLabel: Record<string, string> = {
                UNPAID: "unpaid",
                PAID_MANUAL: "paid",
                PAID_STRIPE: "paid (stripe)",
                WAIVED: "waived",
              }
              return (
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
                  <div className="flex flex-wrap items-center gap-2">
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
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        paid
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {paymentLabel[t.paymentStatus ?? "UNPAID"] ?? "unpaid"}
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
                    {!paid ? (
                      <>
                        <button
                          onClick={() => updateTeamPayment(t.id, "PAID_MANUAL")}
                          className="border-green-300 text-green-700 hover:bg-green-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                        >
                          Mark paid
                        </button>
                        <button
                          onClick={() => updateTeamPayment(t.id, "WAIVED")}
                          className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                        >
                          Waive
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => updateTeamPayment(t.id, "UNPAID")}
                        className="border-ink-200 text-ink-500 hover:bg-ink-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                      >
                        Mark unpaid
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      )}

      {activeTab === "scheduling" && (
      <div className="space-y-6">
        {/* Philosophy + cross-division + groups */}
        <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
          <h3 className="text-ink-900 mb-4 font-semibold">Scheduling approach</h3>
          <div className="space-y-4">
            <div>
              <label className="text-ink-700 mb-2 block text-xs font-medium">Philosophy</label>
              <div className="space-y-2">
                {[
                  {
                    key: "FAMILY_FRIENDLY",
                    label: "Family-friendly",
                    hint: "Pack each team's games into fewer days so families spend less time at venues.",
                  },
                  {
                    key: "SPREAD_DAYS",
                    label: "Spread days",
                    hint: "Distribute each team's games across more session days for more player rest.",
                  },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                      league.schedulingPhilosophy === opt.key
                        ? "border-play-400 bg-play-50"
                        : "border-ink-200 hover:border-ink-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="schedulingPhilosophy"
                      value={opt.key}
                      checked={league.schedulingPhilosophy === opt.key}
                      onChange={() => patchSeason({ schedulingPhilosophy: opt.key })}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="text-ink-900 block font-medium">{opt.label}</span>
                      <span className="text-ink-500 block text-xs">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="border-ink-200 hover:border-ink-300 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition">
              <input
                type="checkbox"
                checked={!!league.allowCrossDivisionScheduling}
                onChange={(e) =>
                  patchSeason({ allowCrossDivisionScheduling: e.target.checked })
                }
                className="mt-0.5"
              />
              <span>
                <span className="text-ink-900 block font-medium">
                  Allow cross-division scheduling
                </span>
                <span className="text-ink-500 block text-xs">
                  When enabled, the scheduler may place games between teams in different
                  divisions (within a scheduling group) to fill the slate.
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Scheduling groups */}
        <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className="text-ink-900 font-semibold">Scheduling groups</h3>
              <p className="text-ink-500 mt-0.5 text-xs">
                Group divisions that can share a slate (e.g. nearby age groups). Games still
                follow division rules unless cross-division scheduling is on.
              </p>
            </div>
          </div>

          {schedulingGroups.length === 0 ? (
            <p className="text-ink-500 text-sm">No groups yet. Create one below.</p>
          ) : (
            <div className="space-y-2">
              {schedulingGroups.map((g: any) => {
                const editing = editingGroupId === g.id
                const groupDivisions = (g.divisions ?? []).map(
                  (d: any) => d.division ?? d
                ) as any[]
                return (
                  <div
                    key={g.id}
                    className="border-court-100 bg-court-50 rounded-xl border px-3 py-2"
                  >
                    {editing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editGroupName}
                          onChange={(e) => setEditGroupName(e.target.value)}
                          className={inputClass + " w-full"}
                        />
                        <div className="grid grid-cols-2 gap-1">
                          {divisions.map((d: any) => (
                            <label
                              key={d.id}
                              className="bg-white text-ink-700 flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={editGroupDivisionIds.includes(d.id)}
                                onChange={(e) =>
                                  setEditGroupDivisionIds((ids) =>
                                    e.target.checked
                                      ? [...ids, d.id]
                                      : ids.filter((x) => x !== d.id)
                                  )
                                }
                              />
                              {d.name}{" "}
                              <span className="text-ink-400">
                                ({d.ageGroup}
                                {d.gender ? `·${d.gender}` : ""})
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={saveEditGroup}
                            className="bg-play-600 hover:bg-play-700 rounded-lg px-3 py-1 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingGroupId(null)}
                            className="text-ink-500 hover:text-ink-700 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-ink-900 font-medium">{g.name}</span>
                          <div className="text-ink-500 mt-0.5 text-xs">
                            {groupDivisions.length === 0
                              ? "No divisions"
                              : groupDivisions
                                  .map((d: any) => d?.name)
                                  .filter(Boolean)
                                  .join(", ")}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => startEditGroup(g)}
                            className="text-play-700 hover:text-play-800 text-xs font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteSchedulingGroup(g.id)}
                            className="hover:text-hoop-700 text-xs text-red-500"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="border-ink-200 mt-4 space-y-2 border-t pt-4">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group name (e.g. U10 + U12 boys)"
              className={inputClass + " w-full"}
            />
            {divisions.length > 0 && (
              <div className="grid grid-cols-2 gap-1">
                {divisions.map((d: any) => (
                  <label
                    key={d.id}
                    className="bg-ink-50 text-ink-700 flex items-center gap-2 rounded-lg px-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={newGroupDivisionIds.includes(d.id)}
                      onChange={(e) =>
                        setNewGroupDivisionIds((ids) =>
                          e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id)
                        )
                      }
                    />
                    {d.name}{" "}
                    <span className="text-ink-400">
                      ({d.ageGroup}
                      {d.gender ? `·${d.gender}` : ""})
                    </span>
                  </label>
                ))}
              </div>
            )}
            <button
              onClick={createSchedulingGroup}
              disabled={!newGroupName.trim()}
              className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
            >
              Add scheduling group
            </button>
          </div>
        </div>

      {/* Scheduling Settings */}
      <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
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
      </div>
      )}

      {activeTab === "tiebreakers" && (
      <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-ink-900 font-semibold">Tiebreaker order</h3>
            <p className="text-ink-500 mt-0.5 text-xs">
              Used to rank teams with identical records. Applied top-to-bottom until one team
              wins the tiebreaker.
            </p>
          </div>
          {league.tiebreakersLockedAt && (
            <span className="bg-hoop-50 text-hoop-700 rounded-full px-3 py-1 text-xs font-medium">
              Locked {format(new Date(league.tiebreakersLockedAt), "MMM d, yyyy")}
            </span>
          )}
        </div>

        {Array.isArray(league.tiebreakerOrder) && league.tiebreakerOrder.length > 0 ? (
          <ol className="space-y-2">
            {league.tiebreakerOrder.map((key: string, idx: number) => {
              const opt = TIEBREAKER_OPTIONS.find((o) => o.key === key)
              const locked = !!league.tiebreakersLockedAt
              return (
                <li
                  key={key}
                  className="border-court-100 bg-court-50 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
                >
                  <span className="text-ink-900">
                    <span className="text-ink-400 mr-2 font-mono text-xs">{idx + 1}.</span>
                    {opt?.label ?? key}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => moveTiebreaker(idx, -1)}
                      disabled={idx === 0 || locked}
                      className="text-ink-500 hover:text-ink-700 text-xs disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveTiebreaker(idx, 1)}
                      disabled={idx === league.tiebreakerOrder.length - 1 || locked}
                      className="text-ink-500 hover:text-ink-700 text-xs disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeTiebreaker(key)}
                      disabled={locked}
                      className="text-xs text-red-500 hover:text-red-600 disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="text-ink-500 text-sm">No tiebreakers configured.</p>
        )}

        <div className="border-ink-200 mt-4 border-t pt-4">
          <p className="text-ink-600 mb-2 text-xs font-medium">Add a tiebreaker</p>
          <div className="flex flex-wrap gap-2">
            {TIEBREAKER_OPTIONS.filter(
              (o) => !(league.tiebreakerOrder ?? []).includes(o.key)
            ).map((opt) => (
              <button
                key={opt.key}
                disabled={!!league.tiebreakersLockedAt}
                onClick={() => addTiebreaker(opt.key)}
                className="border-ink-200 text-ink-700 hover:border-play-300 hover:text-play-700 rounded-full border px-3 py-1 text-xs transition disabled:opacity-50"
              >
                + {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      {activeTab === "schedule" && (
      <div className="space-y-6">
        <div className={panelClass}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-ink-900 font-semibold">Schedule</h3>
              <p className="text-ink-500 mt-0.5 text-xs">
                Preview the scheduler&apos;s proposal, then commit to persist games. Season must
                be finalized before you can commit.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={runPreview}
                disabled={previewLoading}
                className="bg-play-600 hover:bg-play-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                {previewLoading ? "Running…" : "Preview schedule"}
              </button>
              <button
                onClick={commitSchedule}
                disabled={
                  committing ||
                  !["FINALIZED", "IN_PROGRESS"].includes(league.leagueStatus)
                }
                title={
                  !["FINALIZED", "IN_PROGRESS"].includes(league.leagueStatus)
                    ? "Finalize the season before committing"
                    : ""
                }
                className="bg-court-600 hover:bg-court-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                {committing ? "Committing…" : "Commit schedule"}
              </button>
              {scheduleGames.length > 0 && (
                <button
                  onClick={wipeSchedule}
                  className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
                >
                  Delete all
                </button>
              )}
            </div>
          </div>

          {scheduleError && (
            <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-3 rounded-xl border px-3 py-2 text-xs">
              {scheduleError}
            </div>
          )}

          {preview && (
            <div className="mb-6 rounded-2xl border border-play-200 bg-play-50 p-4">
              <p className="text-play-800 mb-2 text-sm font-semibold">
                Preview: {preview.games.length} game{preview.games.length === 1 ? "" : "s"}
                {preview.unscheduled.length > 0
                  ? ` · ${preview.unscheduled.length} unscheduled`
                  : ""}
              </p>
              {preview.warnings.length > 0 && (
                <ul className="mb-3 space-y-0.5">
                  {preview.warnings.map((w, i) => (
                    <li key={i} className="text-amber-700 text-xs">
                      • {w}
                    </li>
                  ))}
                </ul>
              )}
              {preview.utilization && (
                <p className="text-ink-500 mb-3 text-xs">
                  Slots used: {preview.utilization.slotsUsed ?? "—"} /{" "}
                  {preview.utilization.slotsAvailable ?? "—"}
                </p>
              )}
              <div className="max-h-80 overflow-y-auto rounded-xl bg-white">
                <table className="text-ink-700 w-full text-xs">
                  <thead className="bg-ink-50 text-ink-500 sticky top-0 text-[10px] uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-1.5 text-left">When</th>
                      <th className="px-3 py-1.5 text-left">Home</th>
                      <th className="px-3 py-1.5 text-left">Away</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.games.map((g: any, i: number) => (
                      <tr key={i} className="border-ink-100 border-t">
                        <td className="px-3 py-1.5">
                          {format(new Date(g.scheduledAt), "EEE MMM d · h:mm a")}
                        </td>
                        <td className="px-3 py-1.5">{g.homeTeamName}</td>
                        <td className="px-3 py-1.5">{g.awayTeamName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.unscheduled.length > 0 && (
                <details className="mt-3 text-xs">
                  <summary className="text-amber-700 cursor-pointer font-medium">
                    {preview.unscheduled.length} pairing(s) couldn&apos;t be placed
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {preview.unscheduled.map((u: any, i: number) => (
                      <li key={i} className="text-ink-600">
                        • {u.homeTeamName} vs {u.awayTeamName}
                        {u.reason ? ` — ${u.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          <div>
            <p className="text-ink-600 mb-2 text-sm font-semibold">
              Committed games ({scheduleGames.length})
            </p>
            {scheduleGames.length === 0 ? (
              <p className="text-ink-500 text-sm">
                No games committed yet. Preview then commit once the season is finalized.
              </p>
            ) : (
              <div className="space-y-2">
                {scheduleGames.map((g: any) => {
                  const open = openGameId === g.id
                  const statusStyle =
                    g.status === "CANCELLED"
                      ? "text-hoop-600"
                      : g.status === "COMPLETED"
                        ? "text-court-700"
                        : g.status === "DEFAULTED"
                          ? "text-amber-700"
                          : "text-ink-600"
                  return (
                    <div
                      key={g.id}
                      className="border-ink-100 rounded-xl border bg-white"
                    >
                      <button
                        onClick={() => setOpenGameId(open ? null : g.id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs"
                      >
                        <div className="flex flex-1 flex-wrap items-center gap-3">
                          <span className="text-ink-700 whitespace-nowrap">
                            {format(new Date(g.scheduledAt), "EEE MMM d · h:mm a")}
                          </span>
                          <span className="text-ink-900 font-medium">
                            {g.homeTeam?.name ?? g.homeTeamId}{" "}
                            <span className="text-ink-400">vs</span>{" "}
                            {g.awayTeam?.name ?? g.awayTeamId}
                          </span>
                          <span className="text-ink-500">
                            {g.venue?.name ?? "—"}
                            {g.court?.name ? ` · ${g.court.name}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {g.isLocked && (
                            <span className="text-ink-500 text-[10px]">🔒</span>
                          )}
                          <span className={`text-[10px] font-semibold ${statusStyle}`}>
                            {g.status}
                          </span>
                          <span className="text-ink-400 text-[10px]">
                            {open ? "▴" : "▾"}
                          </span>
                        </div>
                      </button>

                      {open && (
                        <div className="border-ink-100 border-t px-3 py-3 text-xs">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => patchGame(g.id, { isLocked: !g.isLocked })}
                              className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                            >
                              {g.isLocked ? "Unlock" : "Lock"}
                            </button>
                            <button
                              onClick={() => {
                                if (suggestionsFor === g.id) {
                                  setSuggestionsFor(null)
                                  setSuggestions([])
                                } else {
                                  loadSuggestions(g.id)
                                }
                              }}
                              className="border-play-300 text-play-700 hover:bg-play-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                            >
                              {suggestionsFor === g.id ? "Hide alternates" : "Find alternates"}
                            </button>
                            <button
                              onClick={() =>
                                patchGame(g.id, { status: "DEFAULTED", defaultedBy: g.homeTeamId })
                              }
                              className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                            >
                              Home defaults
                            </button>
                            <button
                              onClick={() =>
                                patchGame(g.id, { status: "DEFAULTED", defaultedBy: g.awayTeamId })
                              }
                              className="border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg border px-2 py-1 text-[11px] font-semibold"
                            >
                              Away defaults
                            </button>
                            <button
                              onClick={() => cancelGame(g.id)}
                              disabled={g.status === "CANCELLED" || g.status === "COMPLETED"}
                              className="border-hoop-300 text-hoop-700 hover:bg-hoop-50 rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                            >
                              Cancel game
                            </button>
                          </div>

                          {suggestionsFor === g.id && (
                            <div className="bg-ink-50 rounded-xl p-2">
                              <p className="text-ink-700 mb-2 text-[11px] font-semibold">
                                Suggested alternate slots
                              </p>
                              {suggestionsLoading ? (
                                <p className="text-ink-500 text-[11px]">Searching…</p>
                              ) : suggestions.length === 0 ? (
                                <p className="text-ink-500 text-[11px]">
                                  No viable alternate slots found.
                                </p>
                              ) : (
                                <ul className="space-y-1">
                                  {suggestions.map((s, i) => (
                                    <li
                                      key={i}
                                      className="border-ink-100 flex items-center justify-between gap-2 rounded-lg border bg-white px-2 py-1"
                                    >
                                      <div>
                                        <span className="text-ink-900 font-medium">
                                          {format(new Date(s.startAt), "EEE MMM d · h:mm a")}
                                        </span>
                                        {s.sameDay && (
                                          <span className="bg-play-100 text-play-700 ml-2 rounded-full px-1.5 py-0.5 text-[9px]">
                                            same day
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => applySuggestion(g.id, s)}
                                        className="bg-play-600 hover:bg-play-700 rounded-lg px-2 py-1 text-[10px] font-semibold text-white"
                                      >
                                        Move here
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {activeTab === "standings" && (
      <div className="space-y-6">
        <div className={panelClass}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-ink-900 font-semibold">Standings</h3>
              <p className="text-ink-500 mt-0.5 text-xs">
                Computed on read from completed games. Ties are broken in the order
                configured in the Tiebreakers tab.
              </p>
            </div>
            <button
              onClick={loadStandings}
              disabled={standingsLoading}
              className="border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {standingsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {standingsLoading && standings.length === 0 ? (
            <p className="text-ink-500 text-sm">Loading…</p>
          ) : standings.length === 0 ? (
            <p className="text-ink-500 text-sm">
              No standings yet. Standings become meaningful once games are completed.
            </p>
          ) : (
            <div className="space-y-6">
              {standings.map((div: any) => (
                <div key={div.divisionId}>
                  <h4 className="text-ink-800 mb-2 text-sm font-semibold">
                    {div.divisionName}
                  </h4>
                  {div.rows.length === 0 ? (
                    <p className="text-ink-500 text-xs">No teams in this division.</p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-ink-100">
                      <table className="text-ink-700 w-full text-xs">
                        <thead className="bg-ink-50 text-ink-500 text-[10px] uppercase tracking-wide">
                          <tr>
                            <th className="px-3 py-1.5 text-left">#</th>
                            <th className="px-3 py-1.5 text-left">Team</th>
                            <th className="px-3 py-1.5 text-right">GP</th>
                            <th className="px-3 py-1.5 text-right">W</th>
                            <th className="px-3 py-1.5 text-right">L</th>
                            <th className="px-3 py-1.5 text-right">T</th>
                            <th className="px-3 py-1.5 text-right">PF</th>
                            <th className="px-3 py-1.5 text-right">PA</th>
                            <th className="px-3 py-1.5 text-right">Diff</th>
                            <th className="px-3 py-1.5 text-right">Win%</th>
                            <th className="px-3 py-1.5 text-left">Tiebreakers</th>
                          </tr>
                        </thead>
                        <tbody>
                          {div.rows.map((row: any, idx: number) => (
                            <tr key={row.teamId} className="border-ink-100 border-t">
                              <td className="px-3 py-1.5 font-mono text-[10px] text-ink-400">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-1.5 text-ink-900 font-medium">
                                {row.name}
                              </td>
                              <td className="px-3 py-1.5 text-right">{row.gamesPlayed}</td>
                              <td className="px-3 py-1.5 text-right">{row.wins}</td>
                              <td className="px-3 py-1.5 text-right">{row.losses}</td>
                              <td className="px-3 py-1.5 text-right">{row.ties}</td>
                              <td className="px-3 py-1.5 text-right">{row.pointsFor}</td>
                              <td className="px-3 py-1.5 text-right">{row.pointsAgainst}</td>
                              <td
                                className={`px-3 py-1.5 text-right font-mono text-[11px] ${
                                  row.differential > 0
                                    ? "text-court-700"
                                    : row.differential < 0
                                      ? "text-hoop-600"
                                      : "text-ink-500"
                                }`}
                              >
                                {row.differential > 0 ? "+" : ""}
                                {row.differential}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                {(row.winPct * 100).toFixed(0)}%
                              </td>
                              <td className="px-3 py-1.5 text-ink-500 text-[10px]">
                                {row.appliedTiebreakers.length > 0
                                  ? row.appliedTiebreakers.join(", ")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Season Info */}
      {activeTab === "overview" && (
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
      )}
    </div>
  )
}
