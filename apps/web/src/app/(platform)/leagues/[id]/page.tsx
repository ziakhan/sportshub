"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"

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
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Draft", color: "bg-ink-100 text-ink-700" },
  REGISTRATION: { label: "Open for Registration", color: "bg-court-50 text-court-700" },
  REGISTRATION_CLOSED: { label: "Registration Closed", color: "bg-play-50 text-play-700" },
  FINALIZED: { label: "Finalized", color: "bg-hoop-50 text-hoop-700" },
  IN_PROGRESS: { label: "In Progress", color: "bg-play-50 text-play-700" },
  COMPLETED: { label: "Completed", color: "bg-ink-100 text-ink-600" },
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
    "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"

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
      router.push(`/leagues/${leagueId}/seasons/${data.id}/manage`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="text-ink-500 p-6 py-12 text-center">Loading...</div>
  if (!league) return <div className="text-ink-500 p-6 py-12 text-center">League not found.</div>

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="mb-2">
        <Link href="/leagues" className="text-play-700 text-sm font-medium hover:underline">
          &larr; Back to Leagues
        </Link>
      </div>

      <div className="border-ink-100 shadow-soft rounded-[28px] border bg-white p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
              League
            </div>
            <h1 className="font-display text-ink-950 text-3xl font-bold">{league.name}</h1>
            {league.description && (
              <p className="text-ink-500 mt-1 text-sm">{league.description}</p>
            )}
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            {showCreate ? "Cancel" : "New Season"}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
          <h2 className="text-ink-900 mb-4 font-semibold">Create a season</h2>
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
            <button
              type="submit"
              disabled={creating}
              className="bg-play-600 hover:bg-play-700 w-full rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Season"}
            </button>
          </form>
        </div>
      )}

      <div>
        <h2 className="font-display text-ink-950 mb-3 text-xl font-semibold">Seasons</h2>
        {league.seasons.length === 0 ? (
          <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-8 text-center">
            <p className="text-ink-600 mb-4 text-sm">
              No seasons yet. Create your first season to start accepting team registrations.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-play-600 hover:bg-play-700 inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold text-white"
            >
              Create First Season
            </button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {league.seasons.map((season) => {
              const status = STATUS_LABELS[season.status] || STATUS_LABELS.DRAFT
              return (
                <Link
                  key={season.id}
                  href={`/leagues/${leagueId}/seasons/${season.id}/manage`}
                  className="border-ink-100 shadow-soft hover:border-play-200 hover:bg-play-50 block rounded-2xl border bg-white p-5 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="text-ink-950 font-semibold">{season.label}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}
                        >
                          {status.label}
                        </span>
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
                      <p className="text-ink-900 mt-1 text-lg font-semibold">
                        {season._count.divisions}
                      </p>
                    </div>
                    <div className="bg-ink-50 rounded-xl p-3">
                      <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Teams</p>
                      <p className="text-ink-900 mt-1 text-lg font-semibold">
                        {season._count.teamSubmissions}
                      </p>
                    </div>
                    <div className="bg-ink-50 rounded-xl p-3">
                      <p className="text-ink-400 text-xs uppercase tracking-[0.1em]">Games</p>
                      <p className="text-ink-900 mt-1 text-lg font-semibold">
                        {season._count.games}
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
