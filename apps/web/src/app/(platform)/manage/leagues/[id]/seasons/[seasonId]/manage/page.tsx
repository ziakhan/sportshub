"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button, Badge, SmartBack, toneForStatus } from "@/components/ui"
import { SeasonCloseOut } from "./components/overview-tab"
import { SeasonChecklist } from "./components/season-checklist"
import { RefereesTab } from "./components/referees-tab"
import { TeamsTab } from "./components/teams-tab"
import { ClubsTab } from "./components/clubs-tab"
import { NeedsAttention } from "./components/needs-attention"
import { SeasonReport } from "./components/season-report"
import { ScheduleReadiness } from "./components/capacity-words"
import { ScheduleTab } from "./components/schedule-tab"
import { StandingsTab } from "./components/standings-tab"
import { PlayoffsTab } from "./components/playoffs-tab"
import { SettingsTab } from "./components/settings-tab"
import type { SchedSettings } from "./components/types"

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  REGISTRATION: "Open for Registration",
  REGISTRATION_CLOSED: "Registration Closed",
  FINALIZED: "Finalized",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
}

// FLAT nav, no submenus (owner ruling 2026-07-30, league-ia-redesign.md §2):
// every tab is a recurring job with a self-describing name; Settings is the
// one grouping label; outputs (Standings) are their own clearly-named views.
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "clubs", label: "Clubs" },
  { key: "teams", label: "Teams" },
  // Planning is its own job, not a corner of Schedule (owner 2026-08-02:
  // "I want the planner to show up as a separate tab beside Schedule
  // because currently you have it buried inside Schedule").
  { key: "plan", label: "Plan Your Season" },
  { key: "schedule", label: "Schedule" },
  { key: "standings", label: "Standings" },
  { key: "playoffs", label: "Playoffs" },
  { key: "referees", label: "Referees" },
  { key: "settings", label: "⚙ Settings" },
] as const

type TabKey = (typeof TABS)[number]["key"]

// Old bookmarks/deep-links from the 13-tab era land on the right new home.
const LEGACY_TABS: Record<string, { tab: TabKey; anchor?: string }> = {
  divisions: { tab: "settings", anchor: "divisions" },
  venues: { tab: "schedule" },
  sessions: { tab: "schedule" },
  scheduling: { tab: "settings", anchor: "game-format" },
  tiebreakers: { tab: "settings", anchor: "rules" },
  regsettings: { tab: "settings", anchor: "registration" },
}

export default function LeagueManagePage() {
  const params = useParams()
  const router = useRouter()
  const leagueId = params?.id as string
  const seasonId = params?.seasonId as string
  const [league, setLeague] = useState<any>(null)
  const [divisions, setDivisions] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [venues, setVenues] = useState<any[]>([])
  const [schedulingGroups, setSchedulingGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null)

  // Tab state lives in the URL (owner 2026-07-29: back from a team page must
  // land on the Teams tab, not Overview). replaceState keeps history clean;
  // the query restores the tab on back-navigation and enables deep links.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab")
    if (!t) return
    // The Plan tab is a door, not a panel (owner 2026-08-07, the double-rail
    // collapse): a cold ?tab=plan URL — old bookmarks, old links — walks
    // straight into the wizard the tab now opens.
    if (t === "plan") {
      router.replace(`/manage/leagues/${leagueId}/seasons/${seasonId}/plan`)
      return
    }
    if (TABS.some((x) => x.key === t)) {
      setActiveTab(t as TabKey)
    } else if (LEGACY_TABS[t]) {
      const { tab, anchor } = LEGACY_TABS[t]
      setActiveTab(tab)
      if (anchor) setPendingAnchor(anchor)
      const url = new URL(window.location.href)
      url.searchParams.set("tab", tab)
      window.history.replaceState(null, "", url)
    }
  }, [])
  const selectTab = (t: TabKey, anchor?: string) => {
    setActiveTab(t)
    setPendingAnchor(anchor ?? null)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", t)
    window.history.replaceState(null, "", url)
  }
  // Scroll to a Settings section once the tab's content is on screen.
  useEffect(() => {
    if (!pendingAnchor || loading) return
    const id = pendingAnchor
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
      setPendingAnchor(null)
    })
    return () => cancelAnimationFrame(raf)
  }, [pendingAnchor, activeTab, loading])

  // Scheduling settings form (populated by fetchAll, edited under Settings)
  const [schedSettings, setSchedSettings] = useState<SchedSettings>({
    gamesGuaranteed: "",
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
    }
    setLeague(leagueData)
    setSchedSettings({
      gamesGuaranteed: leagueData.gamesGuaranteed?.toString() ?? "",
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
    // One click here changes the season for every club — confirm (found
    // 2026-07-29 when an automated test stray-clicked "Close Registration").
    if (
      !window.confirm(
        `Move the season to "${STATUS_LABELS[newStatus] ?? newStatus}"? Clubs see this immediately.`
      )
    )
      return
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

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <SmartBack fallback={`/manage/leagues/${leagueId}`} fallbackLabel={league.name} className="-ml-1" />
        <Link
          href={`/manage/leagues/${leagueId}/seasons/${seasonId}/waivers`}
          className="text-play-700 float-right text-sm font-medium hover:underline"
        >
          Waiver signing status &rarr;
        </Link>
      </div>

      <div className="reveal mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase leading-none tracking-wide">
            {league.label}
          </h1>
          <p className="text-ink-500 mt-1 text-sm">{league.name}</p>
          <Badge className="mt-2" tone={toneForStatus(league.leagueStatus)}>
            {STATUS_LABELS[league.leagueStatus]}
          </Badge>
        </div>
        {/* Status-advance buttons live ONLY in the Season checklist (§3) —
            the old header button was one stray click from disaster. */}
        {activeTab !== "overview" && league.leagueStatus !== "COMPLETED" && (
          <Button variant="subtle" size="sm" onClick={() => selectTab("overview")}>
            Season checklist
          </Button>
        )}
      </div>

      {/* Flat tab row — every job visible, nothing nested */}
      <div className="reveal mb-6" style={{ animationDelay: "80ms" }}>
        <div
          role="tablist"
          aria-label="Season sections"
          className="border-ink-100 flex flex-wrap gap-1 overflow-x-auto border-b"
        >
          {TABS.map((t) => {
            const selected = activeTab === t.key
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={selected}
                // ONE PROGRESSION, NOT TWO (owner 2026-08-07: two five-item
                // rails sharing two names read as broken). The Plan Your
                // Season tab is a door straight into the wizard, whose own
                // five steps are the only rail; the old stage-rail home
                // screen between them is gone.
                onClick={() =>
                  t.key === "plan"
                    ? router.push(`/manage/leagues/${leagueId}/seasons/${seasonId}/plan`)
                    : selectTab(t.key)
                }
                className={`relative -mb-px whitespace-nowrap px-3 py-2.5 text-sm font-semibold transition-colors ${
                  selected ? "text-play-600" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                {t.label}
                {selected && (
                  <span
                    className="bg-play-600 absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                    aria-hidden
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div key={activeTab} role="tabpanel" className="reveal">
        {activeTab === "overview" && (
          <>
            <SeasonCloseOut
              league={league}
              divisions={divisions}
              onGoToStandings={() => selectTab("standings")}
            />
            <NeedsAttention
              leagueId={leagueId}
              seasonId={seasonId}
              league={league}
              onGoToTab={(t) => selectTab(t as TabKey)}
            />
            <SeasonChecklist
              seasonId={seasonId}
              league={league}
              divisions={divisions}
              sessions={sessions}
              venues={venues}
              scheduleGames={scheduleGames}
              finalizeErrors={finalizeErrors}
              finalizeWarnings={finalizeWarnings}
              onGoToTab={(t, anchor) => selectTab(t as TabKey, anchor)}
              onStatusChange={handleStatusChange}
            />
            <SeasonReport leagueId={leagueId} seasonId={seasonId} />
          </>
        )}

        {activeTab === "clubs" && (
          <ClubsTab seasonId={seasonId} leagueId={leagueId} league={league} />
        )}
        {activeTab === "teams" && (
          <TeamsTab seasonId={seasonId} leagueId={leagueId} league={league} refresh={fetchAll} />
        )}


        {activeTab === "schedule" && (
          <div className="space-y-6">
            <ScheduleReadiness
              seasonId={seasonId}
              league={league}
              divisions={divisions}
              scheduleGamesCount={scheduleGames.length}
            />
            {/* Venues & courts moved off this tab (owner ruling 2026-08-07):
                planning owns supply now. Sessions & rounds live in Settings
                (Stage 1, 2026-08-07). */}
            <ScheduleTab
              seasonId={seasonId}
              league={league}
              sessions={sessions}
              scheduleGames={scheduleGames}
              refresh={fetchAll}
              onGoToTab={(t) => selectTab(t as TabKey)}
            />
          </div>
        )}

        {activeTab === "standings" && <StandingsTab seasonId={seasonId} />}
        {activeTab === "playoffs" && (
          <PlayoffsTab
            seasonId={seasonId}
            divisions={divisions}
            seasonStatus={league?.leagueStatus}
          />
        )}
        {activeTab === "referees" && (
          <RefereesTab leagueId={leagueId} sessions={sessions} refresh={fetchAll} />
        )}

        {activeTab === "settings" && (
          <SettingsTab
            seasonId={seasonId}
            league={league}
            divisions={divisions}
            sessions={sessions}
            venues={venues}
            schedulingGroups={schedulingGroups}
            schedSettings={schedSettings}
            setSchedSettings={setSchedSettings}
            patchSeason={patchSeason}
            refresh={fetchAll}
          />
        )}
      </div>
    </div>
  )
}
