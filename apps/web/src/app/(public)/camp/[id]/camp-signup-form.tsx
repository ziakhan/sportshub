"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { formatCurrency } from "@/lib/countries"
import { Button } from "@/components/ui"

interface Player {
  id: string
  firstName: string
  lastName: string
}

interface CampSignupFormProps {
  campId: string
  campName: string
  location: string
  currency: string
  weeklyFee: number
  fullCampFee: number | null
  numberOfWeeks: number
  players: Player[]
  /** playerIds already registered (active) for this camp. */
  existingPlayerIds: string[]
}

/**
 * Public camp registration form (mirrors the tryout signup flow). Posts to the
 * existing /api/camps/[id]/signup endpoint, which creates the CampSignup +
 * obligation. Rendered in the sidebar of the public camp page when a parent is
 * signed in.
 */
export function CampSignupForm({
  campId,
  campName,
  location,
  currency,
  weeklyFee,
  fullCampFee,
  numberOfWeeks,
  players,
  existingPlayerIds,
}: CampSignupFormProps) {
  const [playerId, setPlayerId] = useState("")
  const [weeksSelected, setWeeksSelected] = useState(numberOfWeeks)
  const [notes, setNotes] = useState("")
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ playerName: string; total: number } | null>(null)

  const availablePlayers = useMemo(
    () => players.filter((p) => !existingPlayerIds.includes(p.id)),
    [players, existingPlayerIds]
  )

  const fullDiscount = fullCampFee != null && numberOfWeeks > 1 && fullCampFee < weeklyFee * numberOfWeeks
  const total =
    weeksSelected >= numberOfWeeks && fullCampFee != null ? fullCampFee : weeklyFee * weeksSelected

  const labelClass = "block text-sm font-medium text-ink-800"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-ink-900 shadow-sm focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-line)]"

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!playerId) {
      setError("Select a player.")
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/camps/${campId}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, weeksSelected, notes: notes || undefined, marketingConsent }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || "Failed to register")
      }
      const data = await res.json()
      const player = players.find((p) => p.id === playerId)
      setSuccess({
        playerName: player ? `${player.firstName} ${player.lastName}` : "Your player",
        total: typeof data.totalFee === "number" ? data.totalFee : total,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <h3 className="mb-1 font-semibold text-green-800">Registered!</h3>
          <p className="text-court-700 text-sm">
            <strong>{success.playerName}</strong> is registered for {campName}
            {success.total > 0 ? (
              <>
                {" "}
                — a fee of <strong>{formatCurrency(success.total, currency)}</strong> is now due (the
                club will confirm payment).
              </>
            ) : (
              <>. See you at {location}.</>
            )}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="block text-center text-sm font-semibold text-[color:var(--brand-ink)] hover:underline"
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
          <p className="text-hoop-700 text-sm">Add your child before registering for this camp.</p>
        </div>
        <Button
          href={`/players/add?redirect=/camp/${campId}`}
          block
          size="lg"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>}
        >
          Add a player
        </Button>
      </div>
    )
  }

  if (availablePlayers.length === 0) {
    return (
      <div className="rounded-2xl border border-court-200 bg-court-50 p-4 text-center text-sm text-court-700">
        All your players are already registered for this camp.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="camp-player" className={labelClass}>
          Player <span className="text-red-500">*</span>
        </label>
        <select
          id="camp-player"
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

      {numberOfWeeks > 1 && (
        <div>
          <label htmlFor="camp-weeks" className={labelClass}>
            Weeks
          </label>
          <select
            id="camp-weeks"
            value={weeksSelected}
            onChange={(e) => setWeeksSelected(Number(e.target.value))}
            className={inputClass}
          >
            {Array.from({ length: numberOfWeeks }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === numberOfWeeks
                  ? `All ${n} weeks${fullDiscount ? " (best value)" : ""}`
                  : `${n} week${n !== 1 ? "s" : ""}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="camp-notes" className={labelClass}>
          Notes <span className="text-ink-400">(optional)</span>
        </label>
        <textarea
          id="camp-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
          placeholder="Allergies, level, anything the club should know..."
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

      <Button
        type="submit"
        block
        size="lg"
        disabled={isSubmitting}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      >
        {isSubmitting
          ? "Registering..."
          : total > 0
            ? `Register (${formatCurrency(total, currency)})`
            : "Register (Free)"}
      </Button>
    </form>
  )
}
