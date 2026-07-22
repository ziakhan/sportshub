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

/**
 * Public training-program registration (mirrors the camp signup flow).
 * Posts to /api/training-sessions/[id]/signup, which creates the signup +
 * payment obligation.
 */
export function TrainingSignupForm({
  sessionId,
  sessionTitle,
  currency,
  fee,
  players,
  existingPlayerIds,
}: {
  sessionId: string
  sessionTitle: string
  currency: string
  fee: number
  players: Player[]
  existingPlayerIds: string[]
}) {
  const [playerId, setPlayerId] = useState("")
  const [notes, setNotes] = useState("")
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ playerName: string; total: number } | null>(null)
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
      const res = await fetch(`/api/training-sessions/${sessionId}/signup`, {
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
      const data = await res.json()
      const player = players.find((p) => p.id === playerId)
      setSuccess({
        playerName: player ? `${player.firstName} ${player.lastName}` : "Your player",
        total: typeof data.totalFee === "number" ? data.totalFee : fee,
      })
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
            <strong>{success.playerName}</strong> is registered for {sessionTitle}
            {success.total > 0 ? (
              <>
                {" "}
                — a fee of <strong>{formatCurrency(success.total, currency)}</strong> is now due
                (the trainer will confirm payment).
              </>
            ) : (
              <>.</>
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
          <p className="text-hoop-700 text-sm">Add your child before registering.</p>
        </div>
        <Button
          href={`/players/add?redirect=/training/${sessionId}`}
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
      <div className="border-court-200 bg-court-50 text-court-700 rounded-2xl border p-4 text-center text-sm">
        All your players are already registered for this program.
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
        <label htmlFor="training-player" className={labelClass}>
          Player <span className="text-red-500">*</span>
        </label>
        <select
          id="training-player"
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
        <label htmlFor="training-notes" className={labelClass}>
          Notes <span className="text-ink-400">(optional)</span>
        </label>
        <textarea
          id="training-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
          placeholder="Level, goals, anything the trainer should know..."
        />
      </div>

      <label className="text-ink-600 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
          className="border-ink-300 mt-0.5 h-4 w-4 rounded"
        />
        <span>Email me about future programs from this trainer</span>
      </label>

      <Button
        type="submit"
        block
        size="lg"
        disabled={isSubmitting}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      >
        {isSubmitting
          ? "Registering..."
          : fee > 0
            ? `Register (${formatCurrency(fee, currency)})`
            : "Register (Free)"}
      </Button>
    </form>
  )
}
