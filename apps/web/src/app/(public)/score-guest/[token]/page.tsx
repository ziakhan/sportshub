"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"

/**
 * Guest scorekeeper landing (owner 2026-07-15): a volunteer opens the
 * WhatsApp'd link, types their name, and lands in the scoring console for
 * that one game — no account.
 */

interface InviteInfo {
  game: {
    id: string
    scheduledAt: string
    status: string
    homeTeam: string
    awayTeam: string
    venue: string | null
  }
  claimed: boolean
  claimedName: string | null
}

export default function GuestScorePage() {
  const params = useParams()
  const router = useRouter()
  const token = params?.token as string
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch(`/api/score-invites/${token}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || "This link is no longer valid")
        setInfo(data)
        if (data.claimedName) setName(data.claimedName)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "This link is no longer valid"))
  }, [token])

  async function start() {
    if (!info || busy || name.trim().length < 2) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/score-invites/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't start")
      sessionStorage.setItem(`guestScoreToken:${data.gameId}`, token)
      router.push(`/games/${data.gameId}/score`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start")
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-10">
      <div className="border-ink-100 rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-play-600 text-xs font-bold uppercase tracking-[0.18em]">
          Scorekeeper invite
        </p>
        {error ? (
          <p className="text-hoop-700 mt-4 text-sm">{error}</p>
        ) : !info ? (
          <p className="text-ink-500 mt-4 text-sm">Checking the link…</p>
        ) : (
          <>
            <h1 className="text-ink-950 mt-2 text-xl font-bold">
              {info.game.homeTeam} vs {info.game.awayTeam}
            </h1>
            <p className="text-ink-500 mt-1 text-sm">
              {new Date(info.game.scheduledAt).toLocaleString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {info.game.venue ? ` · ${info.game.venue}` : ""}
            </p>
            <p className="text-ink-600 mt-4 text-sm">
              You&apos;ve been asked to keep score for this game. Type your name and you&apos;re
              in — no account needed.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="border-ink-200 focus:border-play-400 mt-4 w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && void start()}
            />
            <button
              onClick={() => void start()}
              disabled={busy || name.trim().length < 2}
              className="bg-play-600 hover:bg-play-700 mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {busy ? "Opening the console…" : "Start scoring"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
