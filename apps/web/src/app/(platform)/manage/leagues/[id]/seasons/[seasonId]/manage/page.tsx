"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { OverviewTab } from "./components/overview-tab"
import { DivisionsTab } from "./components/divisions-tab"
import { VenuesTab } from "./components/venues-tab"
import { SessionsTab } from "./components/sessions-tab"
import { SchedulingTab } from "./components/scheduling-tab"
import { TiebreakersTab } from "./components/tiebreakers-tab"
import { TeamsTab } from "./components/teams-tab"
import { ScheduleTab } from "./components/schedule-tab"
import { StandingsTab } from "./components/standings-tab"
import type { SchedSettings } from "./components/types"

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

  // Scheduling settings form (populated by fetchAll, edited in the Scheduling tab)
  const [schedSettings, setSchedSettings] = useState<SchedSettings>({
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
  const [finalizeErrors, setFinalizeErrors] = useState<string[]>([])
  const [finalizeWarnings, setFinalizeWarnings] = useState<string[]>([])
  const [scheduleGames, setScheduleGames] = useState<any[]>([])

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

  const patchSeason = async (body: Record<string, any>) => {
    await fetch(`/api/seasons/${seasonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    fetchAll()
  }

  if (loading) return <div className="text-ink-500 p-6 py-12 text-center">Loading...</div>
  if (!league) return <div className="text-ink-500 p-6 py-12 text-center">League not found.</div>

  const currentIdx = STATUS_FLOW.indexOf(league.leagueStatus)
  const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null
  const allTeams = league.teams || []

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
          href={`/manage/leagues/${leagueId}`}
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

      {activeTab === "overview" && (
        <OverviewTab
          league={league}
          divisions={divisions}
          sessions={sessions}
          venues={venues}
          preflightChecks={preflightChecks}
          canFinalize={canFinalize}
          finalizeErrors={finalizeErrors}
          finalizeWarnings={finalizeWarnings}
        />
      )}

      {activeTab === "divisions" && (
        <DivisionsTab
          seasonId={seasonId}
          divisions={divisions}
          seasonStatus={league?.leagueStatus}
          refresh={fetchAll}
        />
      )}
      {activeTab === "sessions" && (
        <SessionsTab
          seasonId={seasonId}
          sessions={sessions}
          seasonStatus={league?.leagueStatus}
          refresh={fetchAll}
        />
      )}
      {activeTab === "venues" && (
        <VenuesTab seasonId={seasonId} venues={venues} refresh={fetchAll} />
      )}
      {activeTab === "teams" && (
        <TeamsTab seasonId={seasonId} league={league} refresh={fetchAll} />
      )}
      {activeTab === "scheduling" && (
        <SchedulingTab
          seasonId={seasonId}
          league={league}
          divisions={divisions}
          schedulingGroups={schedulingGroups}
          schedSettings={schedSettings}
          setSchedSettings={setSchedSettings}
          patchSeason={patchSeason}
          refresh={fetchAll}
        />
      )}
      {activeTab === "tiebreakers" && (
        <TiebreakersTab league={league} patchSeason={patchSeason} />
      )}
      {activeTab === "schedule" && (
        <ScheduleTab
          seasonId={seasonId}
          league={league}
          scheduleGames={scheduleGames}
          refresh={fetchAll}
        />
      )}
      {activeTab === "standings" && <StandingsTab seasonId={seasonId} />}
    </div>
  )
}
