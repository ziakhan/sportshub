"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

/** Accept/decline panel for a family invitation (client half of the page). */
export function AcceptFamilyInvite({
  token,
  type,
  playerName,
  inviterName,
  invitedEmail,
}: {
  token: string
  type: "CHILD_LOGIN" | "GUARDIAN"
  playerName: string
  inviterName: string
  invitedEmail: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function respond(action: "accept" | "decline") {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/family-invitations/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Something went wrong")
      if (action === "accept") {
        router.push(type === "CHILD_LOGIN" ? "/dashboard" : "/players")
      } else {
        router.push("/dashboard")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
      setBusy(null)
    }
  }

  return (
    <div className="border-ink-100 rounded-2xl border bg-white p-8">
      <h1 className="text-ink-900 text-xl font-bold">
        {type === "CHILD_LOGIN" ? `Take over ${playerName}'s profile` : `Become ${playerName}'s parent/guardian`}
      </h1>
      <p className="text-ink-600 mt-3 text-sm leading-relaxed">
        {type === "CHILD_LOGIN" ? (
          <>
            <strong>{inviterName}</strong> set up {playerName}&apos;s basketball profile and
            invited you to run it with your own login. You&apos;ll see your teams, games, stats,
            and schedule. Registrations and payments stay with {inviterName}.
          </>
        ) : (
          <>
            <strong>{playerName}</strong> plays basketball on SportsHub and asked you to be
            their parent/guardian. Accepting links their profile to your account: you approve
            follower requests, register them for programs, and program fees are billed to you
            going forward.
          </>
        )}
      </p>
      <p className="text-ink-400 mt-2 text-xs">Invitation sent to {invitedEmail}.</p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => respond("accept")}
          disabled={busy !== null}
          className="bg-play-600 hover:bg-play-700 disabled:bg-ink-300 flex-1 cursor-pointer rounded-xl px-4 py-2.5 font-semibold text-white transition-colors duration-200"
        >
          {busy === "accept" ? "Linking..." : "Accept"}
        </button>
        <button
          type="button"
          onClick={() => respond("decline")}
          disabled={busy !== null}
          className="border-ink-200 text-ink-600 hover:bg-ink-50 cursor-pointer rounded-xl border px-4 py-2.5 font-semibold transition-colors duration-200"
        >
          {busy === "decline" ? "..." : "Decline"}
        </button>
      </div>
    </div>
  )
}
