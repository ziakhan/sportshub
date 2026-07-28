"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  OfferComposer,
  packagePayload,
  type OfferPackageDraft,
} from "@/components/offers/offer-composer"

interface RosterState {
  committed: number
  provisional: number
  cap: number | null
  isFull: boolean
  openOffers: number
}

/**
 * Per-signup offer modal. The composer builds 1..4 package options — one
 * option behaves exactly like the classic single-template offer; more give
 * the family a choice at accept time. For many players at once, use the
 * BulkOfferButton at the top of the signups page instead.
 */
export function MakeOfferButton({
  teamId,
  teamName,
  playerId,
  playerName,
  tryoutSignupId,
  clubId,
}: {
  teamId: string
  teamName: string
  playerId: string
  playerName: string
  tryoutSignupId: string
  clubId: string
}) {
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [packages, setPackages] = useState<OfferPackageDraft[]>([])
  const [message, setMessage] = useState("")
  const [expiresInDays, setExpiresInDays] = useState("7")
  const [rosterState, setRosterState] = useState<RosterState | null>(null)
  const router = useRouter()

  // Roster commitment context (owner 2026-07-24, QA-103): let staff see the
  // cap and how many offers are already out before they send one more.
  useEffect(() => {
    if (!showForm) return
    let cancelled = false
    fetch(`/api/teams/${teamId}/roster-state`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setRosterState(data)
      })
      .catch(() => {
        if (!cancelled) setRosterState(null)
      })
    return () => {
      cancelled = true
    }
  }, [showForm, teamId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (packages.length === 0) {
      setError("Add at least one package")
      return
    }
    setIsSubmitting(true)
    setError(null)

    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays))

      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          playerId,
          tryoutSignupId,
          options: packagePayload(packages),
          message: message || undefined,
          expiresAt: expiresAt.toISOString(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create offer")
      }

      setSuccess(true)
      setTimeout(() => router.refresh(), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return <span className="text-xs font-medium text-green-600">Offer sent!</span>
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="bg-play-600 hover:bg-play-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
      >
        Make Offer
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-ink-900 text-lg font-bold">Make Offer</h3>
        <p className="text-ink-500 mb-4 text-sm">
          {playerName} → {teamName}
        </p>

        {rosterState && rosterState.cap != null && (
          <div className="border-ink-100 bg-ink-50 mb-4 rounded-xl border px-3 py-2 text-xs text-ink-600">
            <p>
              Committed {rosterState.committed} / cap {rosterState.cap} &middot;{" "}
              {rosterState.openOffers} offers out
            </p>
            {rosterState.openOffers + rosterState.committed >= rosterState.cap && (
              <p className="mt-1.5 text-amber-700">
                You&apos;re offering beyond your roster cap. That&apos;s fine (declines happen),
                but use the message below to tell families how you&apos;ll handle it. Spots are
                committed by payment, first come first served.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <OfferComposer clubId={clubId} packages={packages} onChange={setPackages} />

          <div>
            <label className="text-ink-700 mb-1 block text-xs font-semibold">
              Message <span className="text-ink-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              className="border-ink-200 focus:border-play-500 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
              placeholder="We'd love to have you on the team…"
            />
          </div>

          <div>
            <label className="text-ink-700 mb-1 block text-xs font-semibold">Expires in</label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              className="border-ink-200 rounded-xl border px-3 py-2 text-sm"
            >
              {[3, 5, 7, 10, 14].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-xl border px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || packages.length === 0}
              className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSubmitting ? "Sending…" : "Send Offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
