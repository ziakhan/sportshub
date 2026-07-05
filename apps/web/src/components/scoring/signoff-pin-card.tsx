"use client"

import { useEffect, useState } from "react"

/**
 * Referee's scoresheet sign-off PIN — set here, entered at the scorer's
 * table to approve a final score as the assigned referee.
 */
export function SignoffPinCard() {
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [currentPin, setCurrentPin] = useState("")
  const [pin, setPin] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/referee/signoff-pin")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHasPin(data ? data.hasPin : null))
      .catch(() => setHasPin(null))
  }, [])

  if (hasPin === null) return null

  async function save() {
    setError(null)
    setMessage(null)
    if (pin.length < 4) {
      setError("PIN must be at least 4 characters")
      return
    }
    if (pin !== confirm) {
      setError("PINs don't match")
      return
    }
    setSaving(true)
    const res = await fetch("/api/referee/signoff-pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin, ...(hasPin ? { currentPin } : {}) }),
    })
    setSaving(false)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body.error || "Couldn't save the PIN")
      return
    }
    setMessage("Sign-off PIN saved")
    setHasPin(true)
    setPin("")
    setConfirm("")
    setCurrentPin("")
  }

  return (
    <div className="border-ink-100 rounded-2xl border bg-white p-5">
      <h3 className="text-ink-900 text-sm font-semibold">Scoresheet sign-off PIN</h3>
      <p className="text-ink-500 mt-0.5 text-xs">
        When you&apos;re the assigned referee, you enter this PIN at the scorer&apos;s table to
        approve the final score — your approval shows as PIN-verified on the official scoresheet.
      </p>
      {error && (
        <p className="border-hoop-200 bg-hoop-50 text-hoop-700 mt-2 rounded-lg border px-2 py-1.5 text-xs">
          {error}
        </p>
      )}
      {message && (
        <p className="border-court-200 bg-court-50 text-court-700 mt-2 rounded-lg border px-2 py-1.5 text-xs">
          {message}
        </p>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {hasPin && (
          <input
            type="password"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            placeholder="Current PIN"
            className="border-ink-200 rounded-lg border px-3 py-2 text-sm"
          />
        )}
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder={hasPin ? "New PIN" : "Choose a PIN (4+ chars)"}
          className="border-ink-200 rounded-lg border px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm PIN"
          className="border-ink-200 rounded-lg border px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="bg-ink-900 hover:bg-ink-800 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : hasPin ? "Change PIN" : "Set PIN"}
        </button>
      </div>
    </div>
  )
}
