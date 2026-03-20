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
          registrationDeadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : undefined,
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create League Season</h1>

        {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">League Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">League Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  placeholder="e.g. NPH Showcase League"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Season *</label>
                <input type="text" value={season} onChange={(e) => setSeason(e.target.value)} required
                  placeholder="e.g. Fall 2026, Winter 2026-27"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                placeholder="About this league season..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Dates</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Season Start</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Season End</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Registration Deadline</label>
                <input type="date" value={registrationDeadline} onChange={(e) => setRegistrationDeadline(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Season Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Team Registration Fee ($)</label>
                <input type="number" min="0" step="0.01" value={teamFee} onChange={(e) => setTeamFee(e.target.value)}
                  placeholder="e.g. 3500"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Games Guaranteed</label>
                <input type="number" min="1" value={gamesGuaranteed} onChange={(e) => setGamesGuaranteed(e.target.value)}
                  placeholder="e.g. 10"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Games Per Session</label>
                <select value={gamesPerSession} onChange={(e) => setGamesPerSession(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n} game{n !== 1 ? "s" : ""} per weekend</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Game Format</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Schedule Slot (minutes)</label>
                <input type="number" min="30" max="180" value={gameSlotMinutes} onChange={(e) => setGameSlotMinutes(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                <p className="mt-1 text-xs text-gray-400">Includes warmup, halftime, breaks</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Game Length (minutes)</label>
                <input type="number" min="10" max="120" value={gameLengthMinutes} onChange={(e) => setGameLengthMinutes(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                <p className="mt-1 text-xs text-gray-400">Actual playing time</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Periods</label>
                <select value={gamePeriods} onChange={(e) => setGamePeriods(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="HALVES">2 Halves</option>
                  <option value="QUARTERS">4 Quarters</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Playoffs (Optional)</h3>
            <p className="text-xs text-gray-500">Can be defined now or configured later.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Playoff Format</label>
                <select value={playoffFormat} onChange={(e) => setPlayoffFormat(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">To be determined</option>
                  <option value="SINGLE_ELIMINATION">Single Elimination</option>
                  <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                  <option value="ROUND_ROBIN">Round Robin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Teams in Playoffs</label>
                <input type="number" min="2" value={playoffTeams} onChange={(e) => setPlayoffTeams(e.target.value)}
                  placeholder="e.g. 4, 8"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link href="/leagues" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </Link>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
              {isSubmitting ? "Creating..." : "Create Season"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-gray-500 text-center">
          After creating, you&apos;ll add divisions, venues, and session dates from the management page.
        </p>
      </div>
    </div>
  )
}
