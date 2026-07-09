"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { LeagueScoringSettings } from "@/components/scoring/league-scoring-settings"
import { brandStyle } from "@/lib/club-page/brand"
import { StatTile, AnimatedNumber, Button, PanelHeader, Badge, type BadgeTone } from "@/components/ui"

interface Season {
  id: string
  label: string
  type: string
  status: string
  startDate: string | null
  endDate: string | null
  registrationDeadline: string | null
  teamFee: number | null
  gamesGuaranteed: number | null
  _count: { teamSubmissions: number; games: number; divisions: number }
}

interface League {
  id: string
  name: string
  description: string | null
  ownerId: string
  seasons: Season[]
  primaryColor?: string | null
  statDepth?: string
  gameClockMode?: string
  periodType?: string
  periodMinutes?: number
}

const STATUS_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  REGISTRATION: { label: "Open for Registration", tone: "court" },
  REGISTRATION_CLOSED: { label: "Registration Closed", tone: "play" },
  FINALIZED: { label: "Finalized", tone: "hoop" },
  IN_PROGRESS: { label: "In Progress", tone: "play" },
  COMPLETED: { label: "Completed", tone: "neutral" },
}

const SEASON_TYPE_LABELS: Record<string, string> = {
  FALL_WINTER: "Fall / Winter",
  SPRING: "Spring",
  SUMMER: "Summer",
  CUSTOM: "Custom",
}

type SeasonTypeKey = "FALL_WINTER" | "SPRING" | "SUMMER" | "CUSTOM"

export default function LeagueDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const leagueId = params?.id as string

  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [label, setLabel] = useState("")
  const [type, setType] = useState<SeasonTypeKey>("FALL_WINTER")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [registrationDeadline, setRegistrationDeadline] = useState("")
  const [teamFee, setTeamFee] = useState("")
  const [gamesGuaranteed, setGamesGuaranteed] = useState("")

  const labelClass = "block text-sm font-medium text-ink-700"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-line)]"

  const load = async () => {
    const res = await fetch(`/api/leagues/${leagueId}`)
    if (res.ok) {
      const data = await res.json()
      setLeague(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [leagueId]) // eslint-disable-line

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const res = await fetch(`/api/leagues/${leagueId}/seasons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          type,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          registrationDeadline: registrationDeadline
            ? new Date(registrationDeadline).toISOString()
            : undefined,
          teamFee: teamFee ? parseFloat(teamFee) : undefined,
          gamesGuaranteed: gamesGuaranteed ? parseInt(gamesGuaranteed) : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create")
      }
      const data = await res.json()
      router.push(`/manage/leagues/${leagueId}/seasons/${data.id}/manage`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="text-ink-500 p-6 py-12 text-center">Loading...</div>
  if (!league) return <div className="text-ink-500 p-6 py-12 text-center">League not found.</div>

  const totalTeams = league.seasons.reduce((a, s) => a + s._count.teamSubmissions, 0)
  const totalGames = league.seasons.reduce((a, s) => a + s._count.games, 0)
  const totalDivisions = league.seasons.reduce((a, s) => a + s._count.divisions, 0)

  return (
    <div
      className="font-barlow space-y-6 p-6 md:p-8"
      style={brandStyle(league.primaryColor || "#4f46e5")}
    >
      <div className="mb-2">
        <Link
          href="/manage/leagues"
          className="text-[color:var(--brand-ink)] text-sm font-medium hover:underline"
        >
          &larr; Back to Leagues
        </Link>
      </div>

      <div className="reveal border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="border-[color:var(--brand-line)] bg-[var(--brand-soft)] text-[color:var(--brand-ink)] mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
              League
            </div>
            <h1 className="font-display text-ink-950 text-3xl font-bold">{league.name}</h1>
            {league.description && (
              <p className="text-ink-500 mt-1 text-sm">{league.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/manage/leagues/${leagueId}/public`}
              className="border-ink-200 text-ink-700 hover:border-ink-300 hover:bg-ink-50 inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Public hub
            </a>
            <Button href={`/manage/leagues/${leagueId}/customize`} variant="subtle" icon={BTN_ICONS.sliders}>
              Customize page
            </Button>
            <Button href={`/manage/leagues/${leagueId}/payments`} variant="subtle" icon={BTN_ICONS.card}>
              Payments
            </Button>
            <Button
              onClick={() => setShowCreate((v) => !v)}
              icon={showCreate ? BTN_ICONS.x : BTN_ICONS.plus}
            >
              {showCreate ? "Cancel" : "New Season"}
            </Button>
          </div>
        </div>
      </div>

      {league.seasons.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile value={league.seasons.length} label="Seasons" tone="brand" icon={TILE_ICONS.calendar} delay={0} />
          <StatTile value={totalTeams} label="Teams" tone="court" icon={TILE_ICONS.teams} delay={70} />
          <StatTile value={totalGames} label="Games" tone="play" icon={TILE_ICONS.games} delay={140} />
          <StatTile value={totalDivisions} label="Divisions" tone="hoop" icon={TILE_ICONS.grid} delay={210} />
        </div>
      )}

      <LeagueScoringSettings
        leagueId={leagueId}
        initial={{
          statDepth: league.statDepth,
          gameClockMode: league.gameClockMode,
          periodType: league.periodType,
          periodMinutes: league.periodMinutes,
          requireRefereeApproval: (league as any).requireRefereeApproval,
        }}
      />

      {showCreate && (
        <div className="reveal border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
          <PanelHeader title="Create a season" />
          {error && (
            <div className="border-hoop-200 text-hoop-700 mb-4 rounded-xl border bg-red-50 p-3 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleCreateSeason} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Label *</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  placeholder="e.g. Fall 2026, Winter 2026-27"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Season Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as SeasonTypeKey)}
                  className={inputClass}
                >
                  <option value="FALL_WINTER">Fall / Winter</option>
                  <option value="SPRING">Spring</option>
                  <option value="SUMMER">Summer</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Registration Deadline</label>
                <input
                  type="date"
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Team Fee ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={teamFee}
                  onChange={(e) => setTeamFee(e.target.value)}
                  placeholder="e.g. 3500"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Games Guaranteed</label>
                <input
                  type="number"
                  min="1"
                  value={gamesGuaranteed}
                  onChange={(e) => setGamesGuaranteed(e.target.value)}
                  placeholder="e.g. 10"
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-ink-500 text-xs">
              You&apos;ll configure divisions, venues, sessions, and scheduling on the next screen.
            </p>
            <Button type="submit" disabled={creating} block icon={BTN_ICONS.plus}>
              {creating ? "Creating..." : "Create Season"}
            </Button>
          </form>
        </div>
      )}

      <div>
        <PanelHeader title="Seasons" />
        {league.seasons.length === 0 ? (
          <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-8 text-center">
            <p className="text-ink-600 mb-4 text-sm">
              No seasons yet. Create your first season to start accepting team registrations.
            </p>
            <div className="inline-flex">
              <Button onClick={() => setShowCreate(true)} icon={BTN_ICONS.plus}>
                Create First Season
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {league.seasons.map((season, i) => {
              const status = STATUS_LABELS[season.status] || STATUS_LABELS.DRAFT
              return (
                <Link
                  key={season.id}
                  href={`/manage/leagues/${leagueId}/seasons/${season.id}/manage`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="reveal border-ink-100 shadow-soft hover:border-[color:var(--brand-line)] hover:bg-[var(--brand-softer)] block rounded-2xl border bg-white p-5 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-ink-950 font-semibold">{season.label}</h3>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                      <p className="text-ink-500 text-xs">{SEASON_TYPE_LABELS[season.type]}</p>
                      {season.startDate && season.endDate && (
                        <p className="text-ink-400 mt-1 text-xs">
                          {format(new Date(season.startDate), "MMM d")} -{" "}
                          {format(new Date(season.endDate), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="bg-ink-50 rounded-xl p-3">
                      <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Divisions</p>
                      <p className="text-ink-900 font-condensed mt-1 text-2xl font-bold leading-none">
                        <AnimatedNumber value={season._count.divisions} />
                      </p>
                    </div>
                    <div className="bg-ink-50 rounded-xl p-3">
                      <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Teams</p>
                      <p className="text-ink-900 font-condensed mt-1 text-2xl font-bold leading-none">
                        <AnimatedNumber value={season._count.teamSubmissions} />
                      </p>
                    </div>
                    <div className="bg-ink-50 rounded-xl p-3">
                      <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Games</p>
                      <p className="text-ink-900 font-condensed mt-1 text-2xl font-bold leading-none">
                        <AnimatedNumber value={season._count.games} />
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** Unsized SVG icons for the kit <Button> (the button sizes them). */
const BTN_ICONS: Record<string, React.ReactNode> = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  ),
  sliders: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" strokeLinecap="round" />
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" strokeLinecap="round" />
    </svg>
  ),
}

/** 20×20 SVG icons for the StatTiles. */
const TILE_ICONS: Record<string, React.ReactNode> = {
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  ),
  teams: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
    </svg>
  ),
  games: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
}
