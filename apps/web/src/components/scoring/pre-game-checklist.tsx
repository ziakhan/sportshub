"use client"

import { useEffect, useState } from "react"

/**
 * Pre-game checklist (owner 2026-07-15): when scoring opens for a game that
 * hasn't started, surface what's missing — scorekeeper, referee — with an
 * on-the-spot guest link generator (WhatsApp-able), BEFORE attendance,
 * lineups and scoring. Dismissible; guests never see it.
 */

interface Readiness {
  status: string | null
  scorekeeper: string | null
  referee: string | null
}

export function PreGameChecklist({ gameId }: { gameId: string }) {
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState<Readiness | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  // Pre-game clock choice (owner 2026-07-15): unoperated clocks count minutes
  // wrongly, so the scorekeeper opts in/out per game before tip-off.
  const [clockChoice, setClockChoice] = useState<boolean | null>(null)
  const [clockBusy, setClockBusy] = useState(false)

  useEffect(() => {
    // Guests skip the checklist — the operator did this part already
    if (sessionStorage.getItem(`guestScoreToken:${gameId}`)) return
    if (sessionStorage.getItem(`preGameChecklistDone:${gameId}`)) return
    let cancelled = false
    ;(async () => {
      try {
        const [live, sk, ref, clock] = await Promise.all([
          fetch(`/api/live/${gameId}`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/games/${gameId}/scorekeeper`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/games/${gameId}/referee`).then((r) => (r.ok ? r.json() : null)),
          fetch(`/api/games/${gameId}/clock`).then((r) => (r.ok ? r.json() : null)),
        ])
        if (cancelled) return
        const status = live?.game?.status ?? null
        if (status !== "SCHEDULED") return // live/finished games skip straight in
        const scorekeeper = sk?.assigned?.[0]?.name ?? null
        const referee = ref?.assigned?.[0]?.name ?? null
        if (clock) setClockChoice(clock.clockEnabled ?? clock.effectiveMode === "SIMPLE")
        setReady({ status, scorekeeper, referee })
        setOpen(true)
      } catch {
        // never block scoring on the checklist
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId])

  async function generateInvite() {
    setInviteBusy(true)
    try {
      const res = await fetch(`/api/games/${gameId}/score-invites`, { method: "POST" })
      const data = await res.json()
      if (res.ok) setInviteUrl(`${window.location.origin}${data.path}`)
    } finally {
      setInviteBusy(false)
    }
  }

  async function chooseClock(useClock: boolean) {
    setClockBusy(true)
    try {
      const res = await fetch(`/api/games/${gameId}/clock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useClock }),
      })
      if (res.ok) setClockChoice(useClock)
    } finally {
      setClockBusy(false)
    }
  }

  function dismiss() {
    sessionStorage.setItem(`preGameChecklistDone:${gameId}`, "1")
    setOpen(false)
  }

  if (!open || !ready) return null

  const rows: Array<{ label: string; value: string | null }> = [
    { label: "Scorekeeper", value: ready.scorekeeper },
    { label: "Referee", value: ready.referee },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <p className="text-play-600 text-xs font-bold uppercase tracking-[0.18em]">
          Before tip-off
        </p>
        <h2 className="text-ink-950 mt-1 text-lg font-bold">Game-day checklist</h2>

        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${
                r.value ? "border-court-200 bg-court-50" : "border-gold-100 bg-gold-50"
              }`}
            >
              <span className="text-ink-800 font-medium">{r.label}</span>
              <span className={r.value ? "text-court-700" : "text-gold-600"}>
                {r.value ?? "Not assigned"}
              </span>
            </div>
          ))}
        </div>

        <div className="border-ink-100 mt-3 rounded-xl border p-3">
          <p className="text-ink-800 text-sm font-semibold">Run the game clock?</p>
          <p className="text-ink-500 mt-0.5 text-xs">
            Only choose Yes if you&apos;ll operate start/stop during play — otherwise minutes
            count wrongly. Most games just use the arena clock.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void chooseClock(true)}
              disabled={clockBusy}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                clockChoice === true
                  ? "border-court-600 bg-court-600 text-white"
                  : "border-ink-200 text-ink-600 hover:border-court-400"
              }`}
            >
              Yes — I&apos;ll run it
            </button>
            <button
              onClick={() => void chooseClock(false)}
              disabled={clockBusy}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                clockChoice === false
                  ? "border-ink-700 bg-ink-700 text-white"
                  : "border-ink-200 text-ink-600 hover:border-ink-400"
              }`}
            >
              No clock
            </button>
          </div>
        </div>

        <div className="border-ink-100 mt-3 rounded-xl border p-3">
          <p className="text-ink-800 text-sm font-semibold">Need a volunteer scorekeeper?</p>
          <p className="text-ink-500 mt-0.5 text-xs">
            Generate a one-time link and send it over WhatsApp — they type their name and start
            scoring, no account.
          </p>
          {inviteUrl ? (
            <div className="mt-2 space-y-2">
              <div className="bg-ink-50 text-ink-700 break-all rounded-lg p-2 font-mono text-[11px]">
                {inviteUrl}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(inviteUrl)
                    setCopied(true)
                  }}
                  className="border-ink-200 text-ink-700 hover:bg-ink-50 flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                >
                  {copied ? "Copied ✓" : "Copy link"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Can you keep score for our game? Tap to start: ${inviteUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-court-600 hover:bg-court-700 flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-semibold text-white"
                >
                  Share on WhatsApp
                </a>
              </div>
              <p className="text-ink-400 text-[10px]">
                Generating a new link kills the old one; the link dies a few hours after the game.
              </p>
            </div>
          ) : (
            <button
              onClick={() => void generateInvite()}
              disabled={inviteBusy}
              className="bg-play-600 hover:bg-play-700 mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
            >
              {inviteBusy ? "Generating…" : "Generate guest link"}
            </button>
          )}
        </div>

        <button
          onClick={dismiss}
          className="text-ink-600 hover:text-ink-950 mt-4 w-full rounded-xl border border-transparent py-2 text-sm font-semibold"
        >
          Continue to attendance &amp; scoring →
        </button>
      </div>
    </div>
  )
}
