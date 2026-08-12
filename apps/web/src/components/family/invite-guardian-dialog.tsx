"use client"

import { useState } from "react"

/**
 * The one dialog that invites a parent or guardian (parent-child linking arc
 * 2026-08-12). Opened from the dashboard nudge and from every payable action
 * a 13-17 self-owned account runs into, so the ask reads the same everywhere
 * and there is only one form to keep honest.
 */
export function InviteGuardianDialog({
  playerId,
  onClose,
  onSent,
}: {
  playerId: string
  onClose: () => void
  onSent: (email: string) => void
}) {
  const [email, setEmail] = useState("")
  const [alreadyAdded, setAlreadyAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/family-invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "GUARDIAN",
          playerId,
          email: email.trim(),
          preferClaim: alreadyAdded,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Couldn't send that")
      onSent(email.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Invite a parent or guardian"
    >
      <div className="border-ink-100 w-full max-w-md rounded-3xl border bg-white p-6 shadow-[0_22px_70px_-42px_rgba(15,23,42,0.45)]">
        <h3 className="text-ink-950 text-lg font-semibold">Invite your parent or guardian</h3>
        <p className="text-ink-600 mt-1 text-sm">
          We email them a link. Accepting links their account to yours: they approve who follows
          you, register you for programs, and pay for anything that costs money. You keep your own
          login.
        </p>

        <label className="text-ink-700 mt-4 block text-sm font-medium" htmlFor="guardian-invite-email">
          Their email
        </label>
        <input
          id="guardian-invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="parent@example.com"
          className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm focus:outline-none"
        />

        <label className="text-ink-700 mt-3 flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={alreadyAdded}
            onChange={(e) => setAlreadyAdded(e.target.checked)}
            className="border-ink-300 mt-0.5 h-4 w-4 rounded"
          />
          <span>
            A parent already added me to SportsHub
            <span className="text-ink-500 mt-0.5 block text-xs">
              If that matches, they get a request to link this login to the profile they already
              made, instead of starting a second one.
            </span>
          </span>
        </label>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="border-ink-200 text-ink-700 hover:bg-court-50 cursor-pointer rounded-xl border px-4 py-2.5 font-semibold transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || !email.includes("@")}
            className="bg-play-600 hover:bg-play-700 disabled:bg-ink-300 flex-1 cursor-pointer rounded-xl px-4 py-2.5 font-semibold text-white transition-colors duration-200 disabled:cursor-not-allowed"
          >
            {busy ? "Sending..." : "Send the invite"}
          </button>
        </div>
      </div>
    </div>
  )
}
