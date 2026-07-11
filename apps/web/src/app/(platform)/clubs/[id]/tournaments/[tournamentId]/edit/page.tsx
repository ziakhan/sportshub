"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button, PanelHeader } from "@/components/ui"

/** Statuses where the team fee may still be changed. */
const FEE_EDITABLE_STATUSES = ["DRAFT", "REGISTRATION"]

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ""
  return iso.slice(0, 10)
}

export default function EditTournamentPage() {
  const params = useParams()
  const clubId = params?.id as string
  const tournamentId = params?.tournamentId as string
  const router = useRouter()

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState("DRAFT")

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

  const feeLocked = !FEE_EDITABLE_STATUSES.includes(status)
  const isUnderway = status === "IN_PROGRESS" || status === "COMPLETED"

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}`)
        if (!res.ok) throw new Error("Failed to load tournament")
        const t = await res.json()
        setStatus(t.status || "DRAFT")
        setName(t.name || "")
        setCity(t.city || "")
        setState(t.state || "")
        setDescription(t.description || "")
        setStartDate(toDateInputValue(t.startDate))
        setEndDate(toDateInputValue(t.endDate))
        setRegistrationDeadline(toDateInputValue(t.registrationDeadline))
        setTeamFee(t.teamFee != null ? String(t.teamFee) : "")
        setGamesGuaranteed(t.gamesGuaranteed != null ? String(t.gamesGuaranteed) : "")
        setGameSlotMinutes(t.gameSlotMinutes != null ? String(t.gameSlotMinutes) : "60")
        setGameLengthMinutes(t.gameLengthMinutes != null ? String(t.gameLengthMinutes) : "40")
        setGamePeriods(t.gamePeriods || "HALVES")
        setPlayoffFormat(t.playoffFormat || "")
      } catch {
        setError("Failed to load tournament")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [tournamentId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        name,
        city,
        state: state || null,
        description: description || null,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        registrationDeadline: registrationDeadline
          ? new Date(registrationDeadline).toISOString()
          : undefined,
        gamesGuaranteed: gamesGuaranteed ? parseInt(gamesGuaranteed) : undefined,
        gameSlotMinutes: gameSlotMinutes ? parseInt(gameSlotMinutes) : undefined,
        gameLengthMinutes: gameLengthMinutes ? parseInt(gameLengthMinutes) : undefined,
        gamePeriods,
        playoffFormat: playoffFormat || null,
      }
      // Fee changes are only allowed while registration is open — omit otherwise.
      if (!feeLocked && teamFee) payload.teamFee = parseFloat(teamFee)

      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let errorMsg = "Failed to update tournament"
        try {
          const data = await res.json()
          errorMsg = data.error || errorMsg
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMsg)
      }

      router.push(`/clubs/${clubId}/tournaments/${tournamentId}/manage`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="text-ink-500 py-12 text-center p-6">Loading...</div>
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link
            href={`/clubs/${clubId}/tournaments/${tournamentId}/manage`}
            className="text-sm text-play-700 hover:underline"
          >
            &larr; Back to Tournament
          </Link>
        </div>

        <h1 className="font-condensed text-ink-950 mb-6 text-3xl font-bold uppercase tracking-wide">
          Edit Tournament
        </h1>

        {error && (
          <div className="mb-4 rounded-md bg-hoop-50 p-3 text-sm text-hoop-700 border border-hoop-200">
            {error}
          </div>
        )}

        {isUnderway && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This tournament is {status === "COMPLETED" ? "completed" : "underway"} &mdash; edits
            affect the public record.
          </div>
        )}

        <div className="reveal rounded-[28px] border border-ink-100 bg-white p-6 shadow-soft md:p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Tournament Info */}
            <div className="space-y-4">
              <PanelHeader title="Tournament info" />
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
            <div className="space-y-4">
              <PanelHeader title="Dates" />
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
            <div className="space-y-4">
              <PanelHeader title="Format" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-ink-700">
                    Team Registration Fee ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={teamFee}
                    onChange={(e) => setTeamFee(e.target.value)}
                    disabled={feeLocked}
                    className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:ring-play-500/20 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400"
                  />
                  {feeLocked && (
                    <p className="mt-1 text-xs text-amber-700">
                      Fee is locked after registration closes &mdash; registered teams paid at
                      this rate.
                    </p>
                  )}
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
            <div className="space-y-4">
              <PanelHeader title="Playoffs" />
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
              <Button
                href={`/clubs/${clubId}/tournaments/${tournamentId}/manage`}
                variant="subtle"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>

        <p className="mt-4 text-xs text-ink-500 text-center">
          Divisions, venues, teams, and the tournament&apos;s status are managed from the
          management page.
        </p>
      </div>
    </div>
  )
}
