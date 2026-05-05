"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function AcceptInviteActions({ invitationId }: { invitationId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<"accepted" | "declined" | null>(null)

  async function respond(action: "accept" | "decline") {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/invitations/${invitationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (HTTP ${res.status})`)
      }
      setDone(action === "accept" ? "accepted" : "declined")
      // Refresh server data; user can navigate to their dashboard from here.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(null)
    }
  }

  if (done === "accepted") {
    return (
      <div className="border-play-200 bg-play-50 text-play-700 rounded-xl border p-4 text-sm">
        ✅ Invitation accepted. You&apos;ve been added to the club.{" "}
        <a href="/dashboard" className="underline">Go to dashboard →</a>
      </div>
    )
  }
  if (done === "declined") {
    return (
      <div className="border-ink-200 bg-ink-50 text-ink-700 rounded-xl border p-4 text-sm">
        Invitation declined. The club has been notified.
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-4 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => respond("accept")}
          disabled={busy !== null}
          className="bg-play-600 hover:bg-play-700 disabled:bg-ink-400 flex-1 rounded-xl px-4 py-2 font-semibold text-white transition disabled:cursor-not-allowed"
        >
          {busy === "accept" ? "Accepting…" : "Accept"}
        </button>
        <button
          onClick={() => respond("decline")}
          disabled={busy !== null}
          className="border-ink-200 text-ink-700 hover:bg-court-50 disabled:opacity-50 flex-1 rounded-xl border px-4 py-2 font-semibold transition disabled:cursor-not-allowed"
        >
          {busy === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
    </>
  )
}
