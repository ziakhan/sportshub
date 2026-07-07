"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  OfferComposer,
  packagePayload,
  type OfferPackageDraft,
} from "@/components/offers/offer-composer"

/**
 * Bulk offers: compose the packages ONCE, tick the players, send — each
 * gets their own offer with the same options. Players already offered,
 * cancelled, or without a linked profile are skipped and reported.
 */

export interface BulkRecipient {
  signupId: string
  playerName: string
  eligible: boolean
  /** Shown when not eligible ("Offered", "Cancelled", "No player profile") */
  status: string | null
}

export function BulkOfferButton({
  teamId,
  teamName,
  clubId,
  recipients,
}: {
  teamId: string
  teamName: string
  clubId: string
  recipients: BulkRecipient[]
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(recipients.filter((r) => r.eligible).map((r) => r.signupId))
  )
  const [packages, setPackages] = useState<OfferPackageDraft[]>([])
  const [message, setMessage] = useState("")
  const [expiresInDays, setExpiresInDays] = useState("7")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    sent: number
    skipped: Array<{ playerName: string | null; reason: string }>
  } | null>(null)
  const router = useRouter()

  const eligibleCount = recipients.filter((r) => r.eligible).length
  if (eligibleCount === 0) return null

  function toggle(signupId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(signupId)) next.delete(signupId)
      else next.add(signupId)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (packages.length === 0 || selected.size === 0) return
    setIsSubmitting(true)
    setError(null)
    try {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays))
      const res = await fetch("/api/offers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          signupIds: [...selected],
          options: packagePayload(packages),
          message: message || undefined,
          expiresAt: expiresAt.toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send offers")
      setResult({ sent: data.sent, skipped: data.skipped })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
      >
        Send Offers ({eligibleCount})
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            {result ? (
              <div>
                <h3 className="text-ink-900 text-lg font-bold">
                  {result.sent} offer{result.sent === 1 ? "" : "s"} sent
                </h3>
                {result.skipped.length > 0 && (
                  <div className="mt-3">
                    <p className="text-ink-700 text-sm font-semibold">
                      Skipped ({result.skipped.length}):
                    </p>
                    <ul className="text-ink-500 mt-1 space-y-0.5 text-sm">
                      {result.skipped.map((s, i) => (
                        <li key={i}>
                          {s.playerName ?? "Unknown"} — {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setOpen(false)
                      setResult(null)
                    }}
                    className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <h3 className="text-ink-900 text-lg font-bold">Send Offers — {teamName}</h3>
                  <p className="text-ink-500 text-sm">
                    Compose the packages once; everyone you tick gets the same offer.
                  </p>
                </div>

                <div className="border-ink-100 max-h-44 space-y-1 overflow-y-auto rounded-xl border p-3">
                  {recipients.map((r) => (
                    <label
                      key={r.signupId}
                      className={`flex items-center justify-between gap-2 text-sm ${
                        r.eligible ? "text-ink-800" : "text-ink-300"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={!r.eligible}
                          checked={selected.has(r.signupId)}
                          onChange={() => toggle(r.signupId)}
                        />
                        <span className="truncate">{r.playerName}</span>
                      </span>
                      {!r.eligible && r.status && (
                        <span className="text-ink-400 shrink-0 text-xs">{r.status}</span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-ink-400 text-xs">
                  {selected.size} of {eligibleCount} eligible selected
                </p>

                <OfferComposer clubId={clubId} packages={packages} onChange={setPackages} />

                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px] flex-1">
                    <label className="text-ink-700 mb-1 block text-xs font-semibold">
                      Message <span className="text-ink-400 font-normal">(optional)</span>
                    </label>
                    <input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="border-ink-200 focus:border-play-500 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"
                      placeholder="Congrats — we'd love to have you!"
                    />
                  </div>
                  <div>
                    <label className="text-ink-700 mb-1 block text-xs font-semibold">
                      Expires in
                    </label>
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
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="border-ink-200 text-ink-600 hover:bg-ink-50 rounded-xl border px-4 py-2 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || packages.length === 0 || selected.size === 0}
                    className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isSubmitting
                      ? "Sending…"
                      : `Send to ${selected.size} player${selected.size === 1 ? "" : "s"}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
