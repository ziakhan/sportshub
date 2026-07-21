"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { formatCurrency } from "@/lib/countries"
import { Button } from "@/components/ui"
import { WaiverSignGate, type GateWaiver } from "@/components/waivers/waiver-sign-gate"

interface Player {
  id: string
  firstName: string
  lastName: string
}

interface HouseLeagueSignupFormProps {
  houseLeagueId: string
  leagueName: string
  location: string
  currency: string
  fee: number
  players: Player[]
  /** playerIds already registered (active) for this house league. */
  existingPlayerIds: string[]
}

/**
 * Public house-league registration form (mirrors the tryout signup flow). Posts
 * to the existing /api/house-leagues/[id]/signup endpoint, which creates the
 * HouseLeagueSignup + obligation.
 */
export function HouseLeagueSignupForm({
  houseLeagueId,
  leagueName,
  location,
  currency,
  fee,
  players,
  existingPlayerIds,
}: HouseLeagueSignupFormProps) {
  const [playerId, setPlayerId] = useState("")
  const [notes, setNotes] = useState("")
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ playerName: string } | null>(null)
  // Required club waivers surfaced by the API (409 WAIVERS_REQUIRED) — signed
  // in a blocking modal, then the registration retries.
  const [waiverGate, setWaiverGate] = useState<GateWaiver[] | null>(null)

  const availablePlayers = useMemo(
    () => players.filter((p) => !existingPlayerIds.includes(p.id)),
    [players, existingPlayerIds]
  )

  const labelClass = "block text-sm font-medium text-ink-800"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-ink-900 shadow-sm focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-line)]"

  async function submitSignup() {
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/house-leagues/${houseLeagueId}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, notes: notes || undefined, marketingConsent }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        if (e.code === "WAIVERS_REQUIRED" && Array.isArray(e.waivers)) {
          setWaiverGate(e.waivers)
          return
        }
        throw new Error(e.error || "Failed to register")
      }
      await res.json()
      const player = players.find((p) => p.id === playerId)
      setSuccess({ playerName: player ? `${player.firstName} ${player.lastName}` : "Your player" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!playerId) {
      setError("Select a player.")
      return
    }
    await submitSignup()
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <h3 className="mb-1 font-semibold text-green-800">Registered!</h3>
          <p className="text-court-700 text-sm">
            <strong>{success.playerName}</strong> is registered for {leagueName}
            {fee > 0 ? (
              <>
                {" "}
                — a fee of <strong>{formatCurrency(fee, currency)}</strong> is now due (the club will
                confirm payment).
              </>
            ) : (
              <>. See you at {location}.</>
            )}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="block text-center text-sm font-medium text-[color:var(--brand-ink)] hover:underline"
        >
          View in Dashboard &rarr;
        </Link>
      </div>
    )
  }

  if (players.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="mb-1 font-semibold text-yellow-800">Add a player first</h3>
          <p className="text-hoop-700 text-sm">Add your child before registering for this league.</p>
        </div>
        <Button
          href={`/players/add?redirect=/house-league/${houseLeagueId}`}
          block
          size="lg"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          }
        >
          Add a player
        </Button>
      </div>
    )
  }

  if (availablePlayers.length === 0) {
    return (
      <div className="rounded-2xl border border-court-200 bg-court-50 p-4 text-center text-sm text-court-700">
        All your players are already registered for this league.
      </div>
    )
  }

  const gatePlayer = players.find((p) => p.id === playerId)

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {waiverGate && playerId ? (
        <WaiverSignGate
          waivers={waiverGate}
          playerId={playerId}
          playerName={gatePlayer ? `${gatePlayer.firstName} ${gatePlayer.lastName}` : undefined}
          onComplete={() => {
            setWaiverGate(null)
            void submitSignup()
          }}
          onCancel={() => setWaiverGate(null)}
        />
      ) : null}
      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="hl-player" className={labelClass}>
          Player <span className="text-red-500">*</span>
        </label>
        <select
          id="hl-player"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className={inputClass}
        >
          <option value="">Choose a player...</option>
          {availablePlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="hl-notes" className={labelClass}>
          Notes <span className="text-ink-400">(optional)</span>
        </label>
        <textarea
          id="hl-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
          placeholder="Level, requests, anything the club should know..."
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-ink-300"
        />
        <span>Email me about future programs from this club</span>
      </label>

      <Button type="submit" disabled={isSubmitting} block size="lg">
        {isSubmitting ? "Registering..." : fee > 0 ? `Register (${formatCurrency(fee, currency)})` : "Register (Free)"}
      </Button>
    </form>
  )
}
