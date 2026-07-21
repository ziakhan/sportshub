"use client"

// Blocking waiver-signing modal (owner ruling 2026-07-20): opened by
// registration/offer forms when the API answers 409 WAIVERS_REQUIRED. Walks
// the outstanding documents one by one; each signature posts to
// /api/waivers/sign-inline (session-authenticated, parent-child checked
// server-side). onComplete → the caller retries its original submit.

import { useState } from "react"
import { SignaturePad } from "@/components/scoring/signature-pad"

export interface GateWaiver {
  id: string
  title: string
  body: string
  annualRenewal?: boolean
}

export function WaiverSignGate({
  waivers,
  playerId,
  playerName,
  onComplete,
  onCancel,
}: {
  waivers: GateWaiver[]
  playerId: string
  playerName?: string
  onComplete: () => void
  onCancel: () => void
}) {
  const [index, setIndex] = useState(0)
  const [signerName, setSignerName] = useState("")
  const [relationship, setRelationship] = useState("Parent/Guardian")
  const [signature, setSignature] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const waiver = waivers[index]
  if (!waiver) return null
  const canSign = agreed && signerName.trim().length >= 2 && !!signature && !busy

  async function sign() {
    if (!canSign) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/waivers/sign-inline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          waiverId: waiver.id,
          playerId,
          signerName: signerName.trim(),
          relationship,
          signatureData: signature,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.")
        return
      }
      if (index + 1 < waivers.length) {
        setIndex(index + 1)
        setSignature(null)
        setAgreed(false)
      } else {
        onComplete()
      }
    } catch {
      setError("Something went wrong. Please check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {waivers.length > 1 ? `Document ${index + 1} of ${waivers.length}` : "One more step"}
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-ink-900">{waiver.title}</h2>
              <p className="mt-0.5 text-sm text-ink-500">
                {playerName ? `Sign for ${playerName} to participate.` : "Sign to complete this registration."}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-600"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-ink-50/50 px-5 py-4">
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-700">
            {waiver.body}
          </pre>
        </div>

        <div className="space-y-3 border-t border-ink-100 px-5 py-4">
          {error ? (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-200"
            />
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-200"
            >
              <option value="Parent/Guardian">Parent or guardian</option>
              <option value="Player (18+)">Player (18 or older)</option>
            </select>
          </div>
          <div className="overflow-hidden rounded-xl border border-ink-200">
            {/* key resets the canvas between documents */}
            <SignaturePad key={waiver.id} onChange={setSignature} height={110} />
          </div>
          <label className="flex items-start gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300"
            />
            <span>I have read and understood this document and I am authorized to sign it.</span>
          </label>
          <button
            type="button"
            onClick={sign}
            disabled={!canSign}
            className="w-full rounded-xl bg-play-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-play-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy
              ? "Recording signature..."
              : index + 1 < waivers.length
                ? "Sign and continue"
                : "Sign and finish"}
          </button>
        </div>
      </div>
    </div>
  )
}
