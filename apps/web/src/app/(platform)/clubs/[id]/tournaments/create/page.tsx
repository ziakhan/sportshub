"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

export default function CreateTournamentPage() {
  const params = useParams()
  const clubId = params?.id as string
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [registrationDeadline, setRegistrationDeadline] = useState("")
  const [teamFee, setTeamFee] = useState("")
  const [gamesGuaranteed, setGamesGuaranteed] = useState("")
  const [gameSlotMinutes, setGameSlotMinutes] = useState("60")
  const [gameLengthMinutes, setGameLengthMinutes] = useState("40")
  const [gamePeriods, setGamePeriods] = useState("HALVES")
  const [playoffFormat, setPlayoffFormat] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: clubId,
          name,
          city,
          state: state || undefined,
          description: description || undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
          registrationDeadline: registrationDeadline
            ? new Date(registrationDeadline).toISOString()
            : undefined,
          teamFee: teamFee ? parseFloat(teamFee) : undefined,
          gamesGuaranteed: gamesGuaranteed ? parseInt(gamesGuaranteed) : undefined,
          gameSlotMinutes: parseInt(gameSlotMinutes),
          gameLengthMinutes: parseInt(gameLengthMinutes),
          gamePeriods,
          playoffFormat: playoffFormat || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create tournament")
      }

      const data = await res.json()
      router.push(`/clubs/${clubId}/tournaments/${data.id}/manage`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link
            href={`/clubs/${clubId}/tournaments`}
            className="text-sm text-play-700 hover:underline"
          >
            &larr; Back to Tournaments
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-ink-900 mb-6">Create Tournament</h1>

        {error && (
          <div className="mb-4 rounded-md bg-hoop-50 p-3 text-sm text-hoop-700 border border-hoop-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tournament Info */}
          <div className="rounded-lg border border-ink-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-ink-900">Tournament Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-ink-700">
                  Tournament Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. March Madness Invitational"
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-ink-700">City *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  placeholder="e.g. Toronto"
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">State / Province</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Ontario"
                className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="About this tournament..."
                className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="rounded-lg border border-ink-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-ink-900">Dates</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-ink-700">Start Date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">End Date *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">
                  Registration Deadline
                </label>
                <input
                  type="date"
                  value={registrationDeadline}
                  onChange={(e) => setRegistrationDeadline(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
                />
              </div>
            </div>
          </div>

          {/* Format */}
          <div className="rounded-lg border border-ink-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-ink-900">Format</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-700">
                  Team Registration Fee ($) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={teamFee}
                  onChange={(e) => setTeamFee(e.target.value)}
                  required
                  placeholder="e.g. 500"
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">
                  Games Guaranteed
                </label>
                <input
                  type="number"
                  min="1"
                  value={gamesGuaranteed}
                  onChange={(e) => setGamesGuaranteed(e.target.value)}
                  placeholder="e.g. 3"
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">
                  Schedule Slot (minutes)
                </label>
                <input
                  type="number"
                  min="30"
                  max="180"
                  value={gameSlotMinutes}
                  onChange={(e) => setGameSlotMinutes(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
                />
                <p className="mt-1 text-xs text-ink-400">
                  Includes warmup, halftime, breaks
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">
                  Game Length (minutes)
                </label>
                <input
                  type="number"
                  min="10"
                  max="120"
                  value={gameLengthMinutes}
                  onChange={(e) => setGameLengthMinutes(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
                />
                <p className="mt-1 text-xs text-ink-400">Actual playing time</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">Periods</label>
                <select
                  value={gamePeriods}
                  onChange={(e) => setGamePeriods(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
                >
                  <option value="HALVES">2 Halves</option>
                  <option value="QUARTERS">4 Quarters</option>
                </select>
              </div>
            </div>
          </div>

          {/* Playoffs */}
          <div className="rounded-lg border border-ink-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-ink-900">Playoffs (Optional)</h3>
            <p className="text-xs text-ink-500">
              Can be defined now or configured later from the manage page.
            </p>
            <div>
              <label className="block text-sm font-medium text-ink-700">Playoff Format</label>
              <select
                value={playoffFormat}
                onChange={(e) => setPlayoffFormat(e.target.value)}
                className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20"
              >
                <option value="">To be determined</option>
                <option value="SINGLE_ELIMINATION">Single Elimination</option>
                <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                <option value="ROUND_ROBIN">Round Robin</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Link
              href={`/clubs/${clubId}/tournaments`}
              className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-court-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-xl bg-play-600 px-4 py-2 text-sm font-semibold text-white hover:bg-play-700 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Tournament"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-xs text-ink-500 text-center">
          After creating, you&apos;ll add divisions, venues, and manage teams from the management
          page.
        </p>
      </div>
    </div>
  )
}
