"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function CreateLeagueSeasonPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [season, setSeason] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [registrationDeadline, setRegistrationDeadline] = useState("")
  const [teamFee, setTeamFee] = useState("")
  const [gamesGuaranteed, setGamesGuaranteed] = useState("")
  const [gamesPerSession, setGamesPerSession] = useState("1")
  const [gameSlotMinutes, setGameSlotMinutes] = useState("90")
  const [gameLengthMinutes, setGameLengthMinutes] = useState("40")
  const [gamePeriods, setGamePeriods] = useState("HALVES")
  const [playoffFormat, setPlayoffFormat] = useState("")
  const [playoffTeams, setPlayoffTeams] = useState("")
  const labelClass = "block text-sm font-medium text-ink-700"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"
  const cardClass =
    "space-y-4 rounded-3xl border border-ink-100 bg-white p-6 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          season,
          description: description || undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          registrationDeadline: registrationDeadline
            ? new Date(registrationDeadline).toISOString()
            : undefined,
          teamFee: teamFee ? parseFloat(teamFee) : undefined,
          gamesGuaranteed: gamesGuaranteed ? parseInt(gamesGuaranteed) : undefined,
          gamesPerSession: parseInt(gamesPerSession),
          gameSlotMinutes: parseInt(gameSlotMinutes),
          gameLengthMinutes: parseInt(gameLengthMinutes),
          gamePeriods,
          playoffFormat: playoffFormat || undefined,
          playoffTeams: playoffTeams ? parseInt(playoffTeams) : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create")
      }

      const data = await res.json()
      router.push(`/leagues/${data.id}/manage`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-ink-900 mb-6 text-2xl font-semibold">Create League Season</h1>

        {error && (
          <div className="border-hoop-200 text-hoop-700 mb-4 rounded-xl border bg-red-50 p-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={cardClass}>
            <h3 className="text-ink-900 font-semibold">League Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>League Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. NPH Showcase League"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Season *</label>
                <input
                  type="text"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  required
                  placeholder="e.g. Fall 2026, Winter 2026-27"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="About this league season..."
                className={inputClass}
              />
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="text-ink-900 font-semibold">Dates</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Season Start</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Season End</label>
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
          </div>

          <div className={cardClass}>
            <h3 className="text-ink-900 font-semibold">Season Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Team Registration Fee ($)</label>
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
              <div>
                <label className={labelClass}>Games Per Session</label>
                <select
                  value={gamesPerSession}
                  onChange={(e) => setGamesPerSession(e.target.value)}
                  className={inputClass}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} game{n !== 1 ? "s" : ""} per weekend
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="text-ink-900 font-semibold">Game Format</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Schedule Slot (minutes)</label>
                <input
                  type="number"
                  min="30"
                  max="180"
                  value={gameSlotMinutes}
                  onChange={(e) => setGameSlotMinutes(e.target.value)}
                  className={inputClass}
                />
                <p className="text-ink-400 mt-1 text-xs">Includes warmup, halftime, breaks</p>
              </div>
              <div>
                <label className={labelClass}>Game Length (minutes)</label>
                <input
                  type="number"
                  min="10"
                  max="120"
                  value={gameLengthMinutes}
                  onChange={(e) => setGameLengthMinutes(e.target.value)}
                  className={inputClass}
                />
                <p className="text-ink-400 mt-1 text-xs">Actual playing time</p>
              </div>
              <div>
                <label className={labelClass}>Periods</label>
                <select
                  value={gamePeriods}
                  onChange={(e) => setGamePeriods(e.target.value)}
                  className={inputClass}
                >
                  <option value="HALVES">2 Halves</option>
                  <option value="QUARTERS">4 Quarters</option>
                </select>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="text-ink-900 font-semibold">Playoffs (Optional)</h3>
            <p className="text-ink-500 text-xs">Can be defined now or configured later.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Playoff Format</label>
                <select
                  value={playoffFormat}
                  onChange={(e) => setPlayoffFormat(e.target.value)}
                  className={inputClass}
                >
                  <option value="">To be determined</option>
                  <option value="SINGLE_ELIMINATION">Single Elimination</option>
                  <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                  <option value="ROUND_ROBIN">Round Robin</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Teams in Playoffs</label>
                <input
                  type="number"
                  min="2"
                  value={playoffTeams}
                  onChange={(e) => setPlayoffTeams(e.target.value)}
                  placeholder="e.g. 4, 8"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link
              href="/leagues"
              className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-4 py-2 text-sm font-medium transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-play-600 hover:bg-play-700 flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Season"}
            </button>
          </div>
        </form>

        <p className="text-ink-500 mt-4 text-center text-xs">
          After creating, you&apos;ll add divisions, venues, and session dates from the management
          page.
        </p>
      </div>
    </div>
  )
}
